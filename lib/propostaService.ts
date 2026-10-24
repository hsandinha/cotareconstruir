/**
 * Criação/atualização de proposta — o núcleo que a rota /api/propostas
 * expunha diretamente.
 *
 * Virou serviço porque agora existem dois caminhos até a mesma proposta:
 *   - o painel do fornecedor (POST /api/propostas, com sessão);
 *   - a planilha devolvida no WhatsApp (lib/cotacaoRespostaWhatsapp.ts, sem
 *     sessão nenhuma — quem autentica é o número de telefone).
 *
 * Tudo que acontece DEPOIS de salvar a proposta (sincronizar pedido em
 * negociação, notificar o cliente no app, WhatsApp e email) mora aqui, para
 * que os dois caminhos se comportem igual. A identidade do fornecedor
 * continua escondida do cliente até o fechamento: ele vê "Fornecedor N".
 */

import { supabaseAdmin } from './supabase';
import { notifyClientNewProposal } from './whatsappService';
import { notifyClientNewProposalEmail } from './emailService';
import { encodeLoginRef, buildQuotationLoginUrl } from './quotationLink';

export interface ItemPropostaInput {
    cotacao_item_id: string;
    preco_unitario?: number;
    quantidade: number;
    subtotal?: number;
    disponibilidade?: string;
    prazo_dias?: number;
    observacao?: string | null;
}

export interface AnexoPropostaInput {
    nome: string;
    url: string;
    tipo?: string | null;
    tamanho?: number | null;
}

/**
 * Por onde a proposta entrou. Guardado porque muda como se lê uma divergência
 * de preço depois: "o fornecedor cotou errado" e "alguém digitou errado aqui
 * dentro" são coisas diferentes.
 */
export type OrigemProposta = 'painel' | 'planilha_whatsapp' | 'link_publico' | 'admin';

export interface CriarPropostaInput {
    cotacaoId: string;
    fornecedorId: string;
    /** Quem assinou a proposta. Pela planilha do WhatsApp pode não haver user. */
    autor: { userId?: string | null; nome?: string | null };
    origem?: OrigemProposta;
    /** Preenchido só quando o administrador lançou pelo fornecedor. */
    lancadaPorAdmin?: string | null;
    valorTotal?: number;
    valorFrete?: number;
    valorImpostos?: number;
    valorDesconto?: number;
    prazoEntrega?: number | null;
    condicoesPagamento?: string | null;
    observacoes?: string | null;
    dataValidade?: string | null;
    itens: ItemPropostaInput[];
    /** `undefined` preserva os anexos atuais; array substitui a lista inteira. */
    anexos?: AnexoPropostaInput[];
}

export type ResultadoProposta =
    | {
        ok: true;
        proposta: any;
        /** true = fornecedor já tinha proposta nesta cotação e ela foi revisada. */
        atualizada: boolean;
        cotacaoNumero: string;
        /** Como o cliente enxerga o fornecedor até o fechamento. */
        rotuloFornecedor: string;
    }
    | { ok: false; error: string; status: number };

/**
 * Grava a proposta e dispara os avisos ao cliente.
 *
 * Aceita cotação aberta ('enviada'/'respondida') e também cotação fechada cujo
 * pedido ainda esteja em negociação — é assim que o fornecedor revisa valores
 * de um pedido que ainda não saiu.
 */
export async function criarOuAtualizarProposta(input: CriarPropostaInput): Promise<ResultadoProposta> {
    if (!supabaseAdmin) {
        return { ok: false, error: 'Configuração do servidor incompleta', status: 500 };
    }

    const { cotacaoId, fornecedorId, itens } = input;
    if (!cotacaoId || !Array.isArray(itens)) {
        return { ok: false, error: 'Dados incompletos', status: 400 };
    }

    const prazoEntregaValue = Number.isInteger(input.prazoEntrega) && (input.prazoEntrega as number) >= 0
        ? (input.prazoEntrega as number)
        : null;
    const freteValue = Number(input.valorFrete) || 0;
    const impostosValue = Number(input.valorImpostos) || 0;
    // Desconto negociado (R$) — substitui o antigo "desconto à vista".
    const descontoValue = Math.max(Number(input.valorDesconto) || 0, 0);

    // Verify cotação exists and is open
    const { data: cotacao } = await supabaseAdmin
        .from('cotacoes')
        .select('id, status, user_id, numero')
        .eq('id', cotacaoId)
        .single();

    if (!cotacao) {
        return { ok: false, error: 'Cotação não encontrada', status: 404 };
    }

    // Allow updates on open cotações OR won closed cotações while pedido is still negotiable
    let canEditProposal = cotacao.status === 'enviada' || cotacao.status === 'respondida';
    let linkedPedido: any = null;

    if (!canEditProposal && cotacao.status === 'fechada') {
        const { data: pedidoData } = await supabaseAdmin
            .from('pedidos')
            .select('id, status')
            .eq('cotacao_id', cotacaoId)
            .eq('fornecedor_id', fornecedorId)
            .single();

        linkedPedido = pedidoData || null;
        canEditProposal = !!linkedPedido && ['pendente', 'aprovado', 'confirmado'].includes(linkedPedido.status);
    }

    if (!canEditProposal) {
        return {
            ok: false,
            error: 'Esta cotação/pedido não aceita mais atualização de proposta neste estágio',
            status: 400,
        };
    }

    // Check if fornecedor already responded
    const { data: existing } = await supabaseAdmin
        .from('propostas')
        .select('id')
        .eq('cotacao_id', cotacaoId)
        .eq('fornecedor_id', fornecedorId)
        .limit(1);

    const jaExistia = !!(existing && existing.length > 0);

    const propostaPayload = {
        cotacao_id: cotacaoId,
        fornecedor_id: fornecedorId,
        status: 'enviada',
        valor_total: input.valorTotal || 0,
        valor_frete: freteValue,
        impostos: impostosValue,
        desconto: descontoValue,
        prazo_entrega: prazoEntregaValue,
        condicoes_pagamento: input.condicoesPagamento || null,
        observacoes: input.observacoes || null,
        enviada_por_user_id: input.autor.userId || null,
        enviada_por_nome: input.autor.nome || null,
        origem: input.origem || 'painel',
        lancada_por_admin: input.lancadaPorAdmin || null,
        data_envio: new Date().toISOString(),
        data_validade: input.dataValidade || null,
    };

    let proposta: any = null;
    let propostaError: any = null;

    // 1. Create or update proposta
    if (jaExistia) {
        const existingId = existing![0].id;
        const updateRes = await supabaseAdmin
            .from('propostas')
            .update(propostaPayload)
            .eq('id', existingId)
            .select()
            .single();

        proposta = updateRes.data;
        propostaError = updateRes.error;

        if (!propostaError) {
            await supabaseAdmin
                .from('proposta_itens')
                .delete()
                .eq('proposta_id', existingId);
        }
    } else {
        const insertRes = await supabaseAdmin
            .from('propostas')
            .insert(propostaPayload)
            .select()
            .single();

        proposta = insertRes.data;
        propostaError = insertRes.error;
    }

    if (propostaError) {
        console.error('Erro ao criar proposta:', propostaError);
        return { ok: false, error: propostaError.message, status: 500 };
    }

    // 2. Create proposta_itens
    const propostaItens = itens.map((item) => ({
        proposta_id: proposta.id,
        cotacao_item_id: item.cotacao_item_id,
        preco_unitario: item.preco_unitario || 0,
        quantidade: item.quantidade,
        subtotal: item.subtotal || 0,
        disponibilidade: item.disponibilidade || 'indisponivel',
        prazo_dias: item.prazo_dias ?? -1,
        observacao: item.observacao || null,
    }));

    const { error: itensError } = await supabaseAdmin
        .from('proposta_itens')
        .insert(propostaItens);

    if (itensError) {
        console.error('Erro ao criar proposta_itens:', itensError);
        if (!jaExistia) {
            await supabaseAdmin.from('propostas').delete().eq('id', proposta.id);
        }
        return { ok: false, error: itensError.message, status: 500 };
    }

    // 2.05 Anexos da proposta: substitui a lista pela enviada
    // (o formulário manda os mantidos + novos; removidos ficam de fora)
    if (Array.isArray(input.anexos)) {
        await supabaseAdmin
            .from('proposta_anexos')
            .delete()
            .eq('proposta_id', proposta.id);

        const anexoRows = input.anexos
            .filter((a) => a && a.url && a.nome)
            .map((a) => ({
                proposta_id: proposta.id,
                nome: String(a.nome).slice(0, 255),
                url: String(a.url),
                tipo: a.tipo ? String(a.tipo) : null,
                tamanho: Number(a.tamanho) || null,
                uploaded_by: input.autor.userId || null,
            }));

        if (anexoRows.length > 0) {
            const { error: anexosError } = await supabaseAdmin
                .from('proposta_anexos')
                .insert(anexoRows);
            if (anexosError) {
                console.error('Erro ao salvar anexos da proposta:', anexosError);
            }
        }
    }

    // 2.1 If there's a linked won order still negotiable, sync pedido with updated negotiated values
    const shouldSyncPedido = linkedPedido && ['pendente', 'aprovado', 'confirmado'].includes(linkedPedido.status);
    if (shouldSyncPedido) {
        await sincronizarPedido({
            pedidoId: linkedPedido.id,
            cotacaoId,
            itens,
            freteValue,
            impostosValue,
            descontoValue,
            prazoEntregaValue,
            condicoesPagamento: input.condicoesPagamento || null,
        });
    }

    // 3. Create notification for the client
    const rotuloFornecedor = await rotularFornecedor(cotacaoId, fornecedorId);
    const cotacaoNumero = String(cotacao.numero || cotacaoId);

    if (cotacao.user_id) {
        await avisarCliente({
            clienteUserId: cotacao.user_id,
            cotacaoId,
            cotacaoNumero,
            rotuloFornecedor,
            atualizada: jaExistia,
        });
    }

    return { ok: true, proposta, atualizada: jaExistia, cotacaoNumero, rotuloFornecedor };
}

/**
 * A identidade do fornecedor só é revelada ao cliente após o fechamento do
 * pedido; até lá, ele aparece como "Fornecedor N" (N = ordem de chegada das
 * propostas nesta cotação).
 */
async function rotularFornecedor(cotacaoId: string, fornecedorId: string): Promise<string> {
    if (!supabaseAdmin) return 'Fornecedor';

    const { data: propostasDaCotacao } = await supabaseAdmin
        .from('propostas')
        .select('fornecedor_id, created_at')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: true });

    const ordem: string[] = [];
    for (const p of propostasDaCotacao || []) {
        if (!ordem.includes(p.fornecedor_id)) ordem.push(p.fornecedor_id);
    }
    return `Fornecedor ${ordem.indexOf(fornecedorId) + 1}`;
}

/** Repassa os valores renegociados para o pedido que ainda não saiu. */
async function sincronizarPedido(params: {
    pedidoId: string;
    cotacaoId: string;
    itens: ItemPropostaInput[];
    freteValue: number;
    impostosValue: number;
    descontoValue: number;
    prazoEntregaValue: number | null;
    condicoesPagamento: string | null;
}): Promise<void> {
    if (!supabaseAdmin) return;

    const { pedidoId, cotacaoId, itens } = params;

    const { data: cotacaoItens } = await supabaseAdmin
        .from('cotacao_itens')
        .select('id, nome')
        .eq('cotacao_id', cotacaoId);

    const cotacaoItemNameById = new Map((cotacaoItens || []).map((ci: any) => [ci.id, ci.nome]));

    const { data: pedidoItens } = await supabaseAdmin
        .from('pedido_itens')
        .select('id, material_id, nome, unidade')
        .eq('pedido_id', pedidoId);

    const itensByNome = new Map<string, any>();
    (itens || []).forEach((item) => {
        const nome = cotacaoItemNameById.get(item.cotacao_item_id);
        if (nome) itensByNome.set(nome, item);
    });

    const updates = (pedidoItens || []).map((pedidoItem: any) => {
        const matched = itensByNome.get(pedidoItem.nome) as any;
        if (!matched) return null;

        return supabaseAdmin!
            .from('pedido_itens')
            .update({
                preco_unitario: matched.preco_unitario || 0,
                subtotal: matched.subtotal || 0,
                quantidade: matched.quantidade || 0,
                unidade: pedidoItem.unidade || 'UN',
            })
            .eq('id', pedidoItem.id);
    }).filter(Boolean);

    if (updates.length > 0) {
        await Promise.all(updates as any);
    }

    const { data: refreshedItens } = await supabaseAdmin
        .from('pedido_itens')
        .select('subtotal')
        .eq('pedido_id', pedidoId);

    const subtotal = (refreshedItens || []).reduce((sum: number, item: any) => sum + (parseFloat(item.subtotal) || 0), 0);
    const freight = params.freteValue;
    const taxes = params.impostosValue;
    const desconto = Math.min(params.descontoValue, subtotal);
    const totalPedido = subtotal - desconto + freight + taxes;

    const { data: pedidoAtual } = await supabaseAdmin
        .from('pedidos')
        .select('endereco_entrega')
        .eq('id', pedidoId)
        .single();

    const enderecoAtual = pedidoAtual?.endereco_entrega || {};
    const summaryAtual = enderecoAtual.summary || {};

    await supabaseAdmin
        .from('pedidos')
        .update({
            valor_total: totalPedido,
            impostos: taxes,
            desconto,
            condicoes_pagamento: params.condicoesPagamento,
            endereco_entrega: {
                ...enderecoAtual,
                summary: {
                    ...summaryAtual,
                    subtotal,
                    freight,
                    // `impostos` é a chave lida pelas telas;
                    // `taxes` fica por compatibilidade.
                    impostos: taxes,
                    taxes,
                    desconto,
                    deliveryDays: params.prazoEntregaValue,
                    paymentMethod: params.condicoesPagamento,
                },
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', pedidoId);
}

/** Notificação no app + WhatsApp + email para o dono da cotação. */
async function avisarCliente(params: {
    clienteUserId: string;
    cotacaoId: string;
    cotacaoNumero: string;
    rotuloFornecedor: string;
    atualizada: boolean;
}): Promise<void> {
    if (!supabaseAdmin) return;

    const { clienteUserId, cotacaoId, cotacaoNumero, rotuloFornecedor, atualizada } = params;

    await supabaseAdmin
        .from('notificacoes')
        .insert({
            user_id: clienteUserId,
            titulo: atualizada ? 'Proposta Atualizada' : 'Nova Proposta Recebida',
            mensagem: atualizada
                ? `${rotuloFornecedor} atualizou os valores da proposta.`
                : `${rotuloFornecedor} enviou uma proposta para sua cotação.`,
            tipo: 'success',
            lida: false,
            link: `/dashboard/cliente?tab=pedidos&cotacaoId=${encodeURIComponent(cotacaoId)}`,
        });

    const { data: clientUser } = await supabaseAdmin
        .from('users')
        .select('telefone, email, cliente_id')
        .eq('id', clienteUserId)
        .single();

    // WhatsApp do cadastro do cliente (preferido para notificação)
    let clientWhatsapp: string | null = null;
    if (clientUser?.cliente_id) {
        const { data: clienteRow } = await supabaseAdmin
            .from('clientes')
            .select('whatsapp')
            .eq('id', clientUser.cliente_id)
            .single();
        clientWhatsapp = clienteRow?.whatsapp || null;
    }

    // Deep-link para o painel do CLIENTE: pré-preenche o email e abre direto
    // a cotação após login (ver lib/quotationLink.ts).
    const clientLoginRef = encodeLoginRef({ email: clientUser?.email || undefined, cotacaoId, role: 'cliente' });
    const clientLoginUrl = buildQuotationLoginUrl({ email: clientUser?.email || undefined, cotacaoId, role: 'cliente' });
    const clientPhone = clientWhatsapp || clientUser?.telefone;

    if (clientPhone) {
        await notifyClientNewProposal(clientPhone, cotacaoNumero, rotuloFornecedor, clientLoginRef || undefined);
    }
    if (clientUser?.email) {
        await notifyClientNewProposalEmail(clientUser.email, cotacaoNumero, rotuloFornecedor, clientLoginUrl);
    }
}
