/**
 * Cotação respondida por planilha no WhatsApp — a volta inteira.
 *
 * O fornecedor recebe a notificação com a planilha anexada (template
 * nova_cotacao_fornecedor_v3), digita o preço de cada item e manda o arquivo
 * de volta na conversa. Daqui para frente é tudo automático: a plataforma
 * baixa o arquivo, identifica a cotação, monta a proposta e dispara para o
 * cliente — o fornecedor não precisa acessar a plataforma em momento algum.
 *
 * Quem autentica é o número de telefone: o arquivo só vira proposta se o
 * número estiver vinculado a um fornecedor convidado para aquela cotação.
 * Por isso nada aqui aceita um id vindo do arquivo sem conferir no banco.
 *
 * Nenhuma falha pode derrubar o webhook: todo caminho de erro termina numa
 * resposta explicando o que fazer, e o erro é logado.
 */

import { supabaseAdmin } from './supabase';
import { normalizarTelefone } from './whatsappCentral';
import { formatPaymentTerms } from './paymentTerms';
import { buildQuotationLoginUrl } from './quotationLink';
import { criarOuAtualizarProposta } from './propostaService';
import {
    diasDaValidade,
    gerarPlanilhaResposta,
    lerRespostaPlanilha,
    montarConfirmacao,
    montarItensProposta,
    nomeArquivoPlanilha,
    pareceAnexoDeCotacao,
    type LinhaRespostaPlanilha,
} from './cotacaoPlanilha';
import {
    downloadWhatsAppMedia,
    sendWhatsAppText,
    type PlanilhaCotacaoAnexo,
    type WhatsAppIncomingMessage,
} from './whatsappService';

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Status de cotação que ainda aceita proposta nova. */
const STATUS_ABERTOS = ['enviada', 'respondida'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// IDA — a planilha que acompanha a notificação
// ============================================================

/**
 * Gera a planilha de resposta de cada cotação, pronta para virar anexo do
 * template nova_cotacao_fornecedor_v3.
 *
 * Em lote porque um envio de cotação costuma atingir dezenas de fornecedores
 * repartidos em poucas cotações: gerar por fornecedor seria o mesmo arquivo
 * montado muitas vezes.
 *
 * Cotação sem itens fica de fora do mapa — a notificação então sai sem anexo
 * em vez de levar uma planilha vazia.
 */
export async function planilhasDeRespostaPorCotacao(
    cotacaoIds: string[],
): Promise<Map<string, PlanilhaCotacaoAnexo>> {
    const planilhas = new Map<string, PlanilhaCotacaoAnexo>();
    const ids = [...new Set(cotacaoIds.filter(Boolean))];
    if (!supabaseAdmin || ids.length === 0) return planilhas;

    try {
        const { data: cotacoes } = await supabaseAdmin
            .from('cotacoes')
            .select('id, numero')
            .in('id', ids);

        const { data: itens } = await supabaseAdmin
            .from('cotacao_itens')
            .select('id, cotacao_id, nome, fabricante, unidade, quantidade')
            .in('cotacao_id', ids);

        const itensPorCotacao = new Map<string, any[]>();
        for (const item of itens || []) {
            const lista = itensPorCotacao.get(item.cotacao_id) || [];
            lista.push(item);
            itensPorCotacao.set(item.cotacao_id, lista);
        }

        for (const cotacao of cotacoes || []) {
            const lista = itensPorCotacao.get(cotacao.id) || [];
            if (lista.length === 0) continue;

            planilhas.set(cotacao.id, {
                conteudo: gerarPlanilhaResposta(cotacao, lista),
                filename: nomeArquivoPlanilha(String(cotacao.numero || cotacao.id)),
                mimeType: MIME_XLSX,
            });
        }
    } catch (error) {
        // Sem planilha a notificação ainda sai (template v2, só com o botão).
        console.error('❌ Resposta por WhatsApp: falha ao gerar planilhas', error);
    }

    return planilhas;
}

export interface ResultadoRespostaWhatsapp {
    /** false = não era uma planilha de cotação; o webhook segue a vida. */
    tratada: boolean;
    sucesso?: boolean;
    motivo?: string;
    propostaId?: string;
}

/**
 * Caminho completo: arquivo recebido → proposta publicada → confirmação.
 *
 * Só é chamado para mensagem nova (o webhook descarta reenvio da Meta pelo
 * wa_message_id), porque publicar duas vezes avisaria o cliente duas vezes.
 */
export async function processarRespostaDeCotacao(
    mensagem: WhatsAppIncomingMessage,
): Promise<ResultadoRespostaWhatsapp> {
    if (!pareceAnexoDeCotacao(mensagem) || !mensagem.mediaId) {
        return { tratada: false };
    }

    if (!supabaseAdmin) {
        console.error('❌ Resposta por WhatsApp: Supabase não configurado');
        return { tratada: false };
    }

    const telefone = normalizarTelefone(mensagem.from);

    try {
        const fornecedor = await resolverFornecedor(telefone);
        if (!fornecedor) {
            // Número desconhecido mandando planilha é mais provavelmente um
            // cliente anexando algo do que fornecedor: não respondemos nada
            // automático, a Central de WhatsApp mostra a mensagem ao time.
            return { tratada: false };
        }

        const baixado = await downloadWhatsAppMedia(mensagem.mediaId);
        if (!baixado) {
            await responder(telefone, 'Não consegui abrir o arquivo que você enviou. Pode mandar de novo?');
            return { tratada: true, sucesso: false, motivo: 'download' };
        }

        const nomeArquivo = mensagem.mediaFilename || 'resposta.xlsx';
        const planilha = lerRespostaPlanilha(baixado.buffer, nomeArquivo);

        if (planilha.linhas.length === 0) {
            await responder(
                telefone,
                'A planilha chegou vazia. Preencha a coluna *preco_unitario* e envie o arquivo novamente.',
            );
            return { tratada: true, sucesso: false, motivo: 'planilha-vazia' };
        }

        const cotacao = await resolverCotacao(planilha.ref, planilha.linhas, fornecedor.id);
        if (!cotacao) {
            await responder(
                telefone,
                'Não identifiquei a qual cotação esta planilha pertence. Reenvie o arquivo original que mandamos, sem renomear.',
            );
            return { tratada: true, sucesso: false, motivo: 'cotacao-nao-identificada' };
        }

        const { data: convite } = await supabaseAdmin
            .from('cotacao_convites')
            .select('cotacao_id')
            .eq('cotacao_id', cotacao.id)
            .eq('fornecedor_id', fornecedor.id)
            .maybeSingle();

        if (!convite) {
            await responder(
                telefone,
                `A cotação #${cotacao.numero || cotacao.id} não está aberta para a sua empresa. Se achar que é engano, responda esta mensagem.`,
            );
            return { tratada: true, sucesso: false, motivo: 'sem-convite' };
        }

        const { data: itensCotacao } = await supabaseAdmin
            .from('cotacao_itens')
            .select('id, nome, quantidade, unidade')
            .eq('cotacao_id', cotacao.id);

        const itens = montarItensProposta(itensCotacao || [], planilha.linhas);
        const cotados = itens.filter((item) => (item.preco_unitario || 0) > 0);

        if (cotados.length === 0) {
            await responder(
                telefone,
                'Não encontrei nenhum preço preenchido na planilha. Preencha a coluna *preco_unitario* e envie o arquivo novamente.',
            );
            return { tratada: true, sucesso: false, motivo: 'sem-precos' };
        }

        const mercadoria = itens.reduce((soma, item) => soma + (item.subtotal || 0), 0);
        const frete = Math.max(planilha.condicoes.valorFrete || 0, 0);
        const impostos = Math.max(planilha.condicoes.valorImpostos || 0, 0);
        // O desconto abate a mercadoria e não pode superá-la — mesma regra do painel.
        const desconto = Math.min(Math.max(planilha.condicoes.valorDesconto || 0, 0), mercadoria);

        const validade = new Date();
        validade.setDate(validade.getDate() + diasDaValidade(planilha.condicoes.validade));

        const prazoEntrega = planilha.condicoes.prazoEntregaDias !== null
            ? Math.max(0, Math.round(planilha.condicoes.prazoEntregaDias))
            : null;

        const observacoesBase = planilha.condicoes.observacoes?.trim() || '';
        const observacoes = [observacoesBase, 'Proposta enviada pela planilha no WhatsApp.']
            .filter(Boolean)
            .join('\n');

        const resultado = await criarOuAtualizarProposta({
            cotacaoId: cotacao.id,
            fornecedorId: fornecedor.id,
            autor: { userId: fornecedor.userId, nome: fornecedor.nome },
            valorTotal: mercadoria - desconto + frete + impostos,
            valorFrete: frete,
            valorImpostos: impostos,
            valorDesconto: desconto,
            prazoEntrega,
            condicoesPagamento: planilha.condicoes.formaPagamento
                ? formatPaymentTerms(planilha.condicoes.formaPagamento)
                : null,
            observacoes,
            dataValidade: validade.toISOString(),
            itens,
        });

        if (!resultado.ok) {
            await responder(
                telefone,
                `Não consegui registrar sua proposta na cotação #${cotacao.numero || cotacao.id}: ${resultado.error}`,
            );
            return { tratada: true, sucesso: false, motivo: resultado.error };
        }

        await responder(
            telefone,
            montarConfirmacao({
                cotacaoNumero: resultado.cotacaoNumero,
                atualizada: resultado.atualizada,
                itensCotados: cotados.length,
                itensTotal: itens.length,
                total: mercadoria - desconto + frete + impostos,
                loginUrl: buildQuotationLoginUrl({
                    email: fornecedor.email || undefined,
                    cotacaoId: cotacao.id,
                    role: 'fornecedor',
                }),
            }),
        );

        console.log(`✅ Proposta ${resultado.proposta?.id} criada pela planilha do WhatsApp (${telefone})`);
        return { tratada: true, sucesso: true, propostaId: resultado.proposta?.id };
    } catch (error) {
        console.error('❌ Resposta por WhatsApp: falha ao processar planilha', error);
        await responder(
            telefone,
            'Tive um problema para ler sua planilha. Nossa equipe já foi avisada — você também pode enviar a proposta pela plataforma.',
        ).catch(() => undefined);
        return { tratada: true, sucesso: false, motivo: 'excecao' };
    }
}

// ============================================================
// RESOLUÇÃO
// ============================================================

interface FornecedorResolvido {
    id: string;
    nome: string | null;
    email: string | null;
    userId: string | null;
}

/**
 * Número → fornecedor.
 *
 * A conversa da Central já guarda esse vínculo; quando está vazio (número que
 * escreveu antes de a empresa ser cadastrada) mandamos o banco refazer a
 * ligação pelos 8 últimos dígitos, que é o que não muda entre máscara, DDI e
 * nono dígito.
 */
async function resolverFornecedor(telefone: string): Promise<FornecedorResolvido | null> {
    if (!supabaseAdmin || !telefone) return null;

    const { data: conversa } = await supabaseAdmin
        .from('whatsapp_conversas')
        .select('id, fornecedor_id')
        .eq('telefone', telefone)
        .maybeSingle();

    let fornecedorId = conversa?.fornecedor_id || null;

    if (!fornecedorId && conversa?.id) {
        await supabaseAdmin.rpc('whatsapp_vincular_contato', { p_conversa_id: conversa.id });
        const { data: revinculada } = await supabaseAdmin
            .from('whatsapp_conversas')
            .select('fornecedor_id')
            .eq('id', conversa.id)
            .maybeSingle();
        fornecedorId = revinculada?.fornecedor_id || null;
    }

    if (!fornecedorId) return null;

    const { data: fornecedor } = await supabaseAdmin
        .from('fornecedores')
        .select('id, razao_social, nome_fantasia, email, user_id')
        .eq('id', fornecedorId)
        .maybeSingle();

    if (!fornecedor) return null;

    return {
        id: fornecedor.id,
        nome: fornecedor.nome_fantasia || fornecedor.razao_social || null,
        email: fornecedor.email || null,
        userId: fornecedor.user_id || null,
    };
}

interface CotacaoResolvida {
    id: string;
    numero: string | null;
}

/**
 * Descobre de qual cotação é a planilha, da pista mais confiável para a mais
 * frágil. Toda pista vinda do arquivo é conferida no banco antes de valer.
 */
async function resolverCotacao(
    ref: { cotacaoId?: string; numero?: string },
    linhas: LinhaRespostaPlanilha[],
    fornecedorId: string,
): Promise<CotacaoResolvida | null> {
    if (!supabaseAdmin) return null;

    // 1) Aba oculta `_ref` — sobrevive ao fornecedor salvar por cima no Excel.
    if (ref.cotacaoId && UUID_RE.test(ref.cotacaoId)) {
        const { data } = await supabaseAdmin
            .from('cotacoes')
            .select('id, numero')
            .eq('id', ref.cotacaoId)
            .maybeSingle();
        if (data) return data;
    }

    // 2) Coluna cotacao_item_id — é o que resta quando converteram para CSV.
    const itemId = linhas.find((linha) => linha.cotacaoItemId)?.cotacaoItemId;
    if (itemId) {
        const { data } = await supabaseAdmin
            .from('cotacao_itens')
            .select('cotacoes(id, numero)')
            .eq('id', itemId)
            .maybeSingle();
        const cotacao = (data as any)?.cotacoes;
        if (cotacao?.id) return { id: cotacao.id, numero: cotacao.numero };
    }

    // 3) Número no nome do arquivo (cotacao-10070.xlsx).
    if (ref.numero) {
        const { data } = await supabaseAdmin
            .from('cotacoes')
            .select('id, numero')
            .eq('numero', ref.numero)
            .maybeSingle();
        if (data) return data;
    }

    // 4) Último recurso: o fornecedor tem exatamente uma cotação aberta.
    //    Com duas ou mais seria chute, e chute aqui vira proposta na cotação
    //    errada — então preferimos pedir o arquivo original de volta.
    const { data: convites } = await supabaseAdmin
        .from('cotacao_convites')
        .select('cotacoes(id, numero, status)')
        .eq('fornecedor_id', fornecedorId);

    const abertas = (convites || [])
        .map((linha: any) => linha.cotacoes)
        .filter((cotacao: any) => cotacao && STATUS_ABERTOS.includes(cotacao.status));

    if (abertas.length === 1) {
        return { id: abertas[0].id, numero: abertas[0].numero };
    }

    return null;
}

/** Texto livre: só entrega porque o fornecedor acabou de escrever (janela de 24h). */
async function responder(telefone: string, texto: string): Promise<void> {
    await sendWhatsAppText({ to: telefone, text: texto, origem: 'automatica' });
}
