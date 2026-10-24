/**
 * Programa de afiliados — atribuição e comissão.
 *
 * Como um cliente vira comissão do parceiro, do clique ao extrato:
 *
 *   1. O parceiro divulga comprareconstruir.com/?ref=MARCOS
 *   2. `proxy.ts` grava o código num cookie (primeiro clique vence) e a
 *      landing chama /api/afiliados/clique, que registra a visita
 *   3. No cadastro, /api/auth/signup lê o cookie e chama `atribuirIndicacao`
 *   4. Quando um pagamento é CONFIRMADO (webhook do Asaas ou lançamento
 *      manual), `registrarComissaoDePagamento` gera a linha do extrato
 *
 * Duas regras que valem a pena ter em mente ao mexer aqui:
 *
 * - Um cliente pertence a UM parceiro, decidido no cadastro e nunca mais
 *   alterado (UNIQUE em `afiliado_indicacoes.user_id`). Sem isso, dois
 *   parceiros reivindicariam o mesmo cliente e a comissão dobraria.
 * - Os termos (percentual e duração) são congelados na indicação. Renegociar
 *   com o parceiro vale para quem ele trouxer depois, nunca para trás.
 */

import { supabaseAdmin } from './supabase';
import {
    calcularComissao,
    competenciaDe,
    dentroDaJanela,
    fimDaJanela,
    normalizarCodigo,
} from './cobrancaModelo';

/** Nome do cookie que carrega o código entre a landing e o cadastro. */
export const COOKIE_REF = 'cc_ref';
/** Id anônimo do visitante, só para ligar clique → cadastro no funil. */
export const COOKIE_VISITANTE = 'cc_vis';

export interface DadosClique {
    codigo: string;
    visitante: string;
    destino?: string | null;
    utm?: Record<string, string> | null;
    userAgent?: string | null;
}

/**
 * Código → id do afiliado ativo, ou null.
 *
 * Passa pela RPC `afiliado_por_codigo` em vez de ler a tabela: `afiliados`
 * guarda e-mail, documento e chave PIX de terceiros, e a landing (anônima)
 * não tem o que fazer com nada disso.
 */
export async function resolverAfiliado(codigo: string): Promise<string | null> {
    if (!supabaseAdmin) return null;
    const limpo = normalizarCodigo(codigo);
    if (!limpo) return null;

    const { data, error } = await supabaseAdmin.rpc('afiliado_por_codigo', { p_codigo: limpo });
    if (error) {
        console.error('❌ Afiliados: falha ao resolver código', error);
        return null;
    }
    return (data as string) || null;
}

/**
 * Registra a visita vinda de um link de parceiro.
 *
 * Serve ao funil ("quantos cliques o Marcos trouxe, quantos viraram
 * cadastro"), não à atribuição — quem decide de quem é o cliente é o cookie
 * no momento do cadastro. Por isso nada aqui pode quebrar a página: erro é
 * logado e engolido.
 */
export async function registrarClique(dados: DadosClique): Promise<boolean> {
    if (!supabaseAdmin) return false;

    try {
        const afiliadoId = await resolverAfiliado(dados.codigo);
        if (!afiliadoId) return false;

        await supabaseAdmin.from('afiliado_cliques').insert({
            afiliado_id: afiliadoId,
            visitante: String(dados.visitante || '').slice(0, 64),
            destino: dados.destino ? String(dados.destino).slice(0, 500) : null,
            utm: dados.utm || null,
            user_agent: dados.userAgent ? String(dados.userAgent).slice(0, 500) : null,
        });
        return true;
    } catch (error) {
        console.error('❌ Afiliados: falha ao registrar clique', error);
        return false;
    }
}

export interface AtribuicaoInput {
    userId: string;
    clienteId?: string | null;
    codigo: string;
    /** Quando o visitante clicou no link; usado para respeitar a janela. */
    clicouEm?: string | null;
}

export type ResultadoAtribuicao =
    | { ok: true; indicacaoId: string; afiliadoId: string }
    | { ok: false; motivo: 'sem-codigo' | 'codigo-invalido' | 'ja-atribuido' | 'fora-da-janela' | 'erro' };

/**
 * Carimba o cadastro como indicação de um parceiro.
 *
 * Chamado uma única vez, no cadastro. Se o usuário já tem indicação, não
 * sobrescreve: o primeiro parceiro que o trouxe fica com ele.
 *
 * Nunca lança: cadastro não pode falhar porque a atribuição deu errado. O
 * pior caso aceitável é o cliente entrar sem parceiro — e isso aparece no
 * painel, dá para corrigir à mão.
 */
export async function atribuirIndicacao(input: AtribuicaoInput): Promise<ResultadoAtribuicao> {
    if (!supabaseAdmin) return { ok: false, motivo: 'erro' };

    const codigo = normalizarCodigo(input.codigo);
    if (!codigo) return { ok: false, motivo: 'sem-codigo' };

    try {
        const { data: existente } = await supabaseAdmin
            .from('afiliado_indicacoes')
            .select('id, afiliado_id')
            .eq('user_id', input.userId)
            .maybeSingle();

        if (existente) {
            return { ok: false, motivo: 'ja-atribuido' };
        }

        const { data: afiliado } = await supabaseAdmin
            .from('afiliados')
            .select('id, percentual, duracao_meses, status')
            .eq('codigo', codigo)
            .maybeSingle();

        if (!afiliado || afiliado.status !== 'ativo') {
            return { ok: false, motivo: 'codigo-invalido' };
        }

        // Janela de atribuição: clique velho demais não conta mais.
        const { data: config } = await supabaseAdmin
            .from('cobranca_config')
            .select('afiliado_janela_dias')
            .eq('id', true)
            .maybeSingle();

        const janelaDias = config?.afiliado_janela_dias ?? 90;
        if (input.clicouEm) {
            const limite = new Date(input.clicouEm);
            limite.setUTCDate(limite.getUTCDate() + janelaDias);
            if (new Date() > limite) {
                return { ok: false, motivo: 'fora-da-janela' };
            }
        }

        const { data: indicacao, error } = await supabaseAdmin
            .from('afiliado_indicacoes')
            .insert({
                afiliado_id: afiliado.id,
                user_id: input.userId,
                cliente_id: input.clienteId || null,
                codigo,
                // Congelados: ver cabeçalho do arquivo.
                percentual: afiliado.percentual,
                duracao_meses: afiliado.duracao_meses,
                clicou_em: input.clicouEm || null,
                status: 'cadastrado',
            })
            .select('id')
            .single();

        if (error) {
            // 23505 = corrida: outro request atribuiu no meio do caminho.
            if (error.code === '23505') return { ok: false, motivo: 'ja-atribuido' };
            console.error('❌ Afiliados: falha ao atribuir indicação', error);
            return { ok: false, motivo: 'erro' };
        }

        console.log(`🤝 Afiliados: cadastro ${input.userId} atribuído ao código ${codigo}`);
        return { ok: true, indicacaoId: indicacao.id, afiliadoId: afiliado.id };
    } catch (error) {
        console.error('❌ Afiliados: erro ao atribuir indicação', error);
        return { ok: false, motivo: 'erro' };
    }
}

export type ResultadoComissao =
    | { ok: true; comissaoId: string; valorCentavos: number }
    | { ok: false; motivo: 'sem-indicacao' | 'pagamento-invalido' | 'fora-da-janela' | 'ja-existe' | 'erro' };

/**
 * Gera a comissão de um pagamento confirmado.
 *
 * Idempotente por construção: `afiliado_comissoes.pagamento_id` é UNIQUE, e o
 * webhook do Asaas reenvia o evento quando não recebe 200. Sem isso o
 * parceiro receberia duas vezes pelo mesmo mês.
 *
 * É aqui também que a janela começa a contar: no primeiro pagamento
 * confirmado do cliente, a indicação ganha `comissao_inicio`/`comissao_fim`.
 */
export async function registrarComissaoDePagamento(pagamentoId: string): Promise<ResultadoComissao> {
    if (!supabaseAdmin) return { ok: false, motivo: 'erro' };

    try {
        const { data: pagamento } = await supabaseAdmin
            .from('pagamentos')
            .select('id, status, valor_centavos, competencia, pago_em, assinatura_id, cliente_id')
            .eq('id', pagamentoId)
            .maybeSingle();

        if (!pagamento || pagamento.status !== 'confirmado') {
            return { ok: false, motivo: 'pagamento-invalido' };
        }

        // Dono do pagamento: a assinatura é a fonte mais confiável; o cliente
        // serve de reserva para linha antiga sem user_id.
        const { data: assinatura } = await supabaseAdmin
            .from('assinaturas')
            .select('user_id, cliente_id')
            .eq('id', pagamento.assinatura_id)
            .maybeSingle();

        let userId = assinatura?.user_id || null;
        if (!userId) {
            const clienteId = assinatura?.cliente_id || pagamento.cliente_id;
            if (clienteId) {
                const { data: cliente } = await supabaseAdmin
                    .from('clientes')
                    .select('user_id')
                    .eq('id', clienteId)
                    .maybeSingle();
                userId = cliente?.user_id || null;
            }
        }
        if (!userId) return { ok: false, motivo: 'sem-indicacao' };

        const { data: indicacao } = await supabaseAdmin
            .from('afiliado_indicacoes')
            .select('id, afiliado_id, percentual, duracao_meses, comissao_inicio, comissao_fim, status')
            .eq('user_id', userId)
            .maybeSingle();

        if (!indicacao || indicacao.status === 'cancelado') {
            return { ok: false, motivo: 'sem-indicacao' };
        }

        const competencia = pagamento.competencia || competenciaDe(pagamento.pago_em || new Date());

        // Primeiro pagamento deste cliente: a janela começa agora.
        let inicio = indicacao.comissao_inicio;
        let fim = indicacao.comissao_fim;
        if (!inicio) {
            inicio = competencia;
            fim = fimDaJanela(competencia, indicacao.duracao_meses);
            await supabaseAdmin
                .from('afiliado_indicacoes')
                .update({ comissao_inicio: inicio, comissao_fim: fim, status: 'pagante' })
                .eq('id', indicacao.id);
        }

        if (!dentroDaJanela(competencia, inicio, fim)) {
            return { ok: false, motivo: 'fora-da-janela' };
        }

        const valor = calcularComissao(pagamento.valor_centavos, Number(indicacao.percentual));
        if (valor <= 0) return { ok: false, motivo: 'fora-da-janela' };

        const { data: comissao, error } = await supabaseAdmin
            .from('afiliado_comissoes')
            .insert({
                afiliado_id: indicacao.afiliado_id,
                indicacao_id: indicacao.id,
                pagamento_id: pagamento.id,
                competencia,
                base_centavos: pagamento.valor_centavos,
                percentual: indicacao.percentual,
                valor_centavos: valor,
                status: 'prevista',
            })
            .select('id')
            .single();

        if (error) {
            // 23505 = já comissionado; é reenvio do webhook, não é erro.
            if (error.code === '23505') return { ok: false, motivo: 'ja-existe' };
            console.error('❌ Afiliados: falha ao gerar comissão', error);
            return { ok: false, motivo: 'erro' };
        }

        console.log(`💰 Afiliados: comissão de ${valor} centavos gerada (pagamento ${pagamento.id})`);
        return { ok: true, comissaoId: comissao.id, valorCentavos: valor };
    } catch (error) {
        console.error('❌ Afiliados: erro ao gerar comissão', error);
        return { ok: false, motivo: 'erro' };
    }
}

/**
 * Estorno/chargeback: derruba a comissão daquele pagamento.
 *
 * Só cancela o que ainda não foi pago ao parceiro. Comissão já paga vira
 * acerto no próximo repasse — mexer nela aqui faria o extrato não bater com
 * o que saiu da conta.
 */
export async function cancelarComissaoDePagamento(
    pagamentoId: string,
    motivo = 'Pagamento estornado',
): Promise<boolean> {
    if (!supabaseAdmin) return false;

    try {
        const { data } = await supabaseAdmin
            .from('afiliado_comissoes')
            .update({ status: 'cancelada', observacao: motivo })
            .eq('pagamento_id', pagamentoId)
            .in('status', ['prevista', 'aprovada'])
            .select('id');

        if (data && data.length > 0) {
            console.log(`↩️ Afiliados: comissão cancelada (pagamento ${pagamentoId})`);
        }
        return true;
    } catch (error) {
        console.error('❌ Afiliados: falha ao cancelar comissão', error);
        return false;
    }
}

/** Garante um código livre a partir de uma sugestão. */
export async function codigoDisponivel(codigo: string): Promise<boolean> {
    if (!supabaseAdmin) return false;
    const { data } = await supabaseAdmin
        .from('afiliados')
        .select('id')
        .eq('codigo', normalizarCodigo(codigo))
        .maybeSingle();
    return !data;
}
