/**
 * Ficha completa do cliente
 *
 * GET /api/admin/clientes/detalhe?cliente_id=...
 *
 * Junta o cadastro, a conta de acesso, as obras e os números do
 * relacionamento (cotações, propostas, pedidos, quanto já comprou).
 *
 * Roda no servidor com service_role porque cruza tabela de vários donos —
 * obras, cotações e pedidos de um cliente não são legíveis pelo admin via RLS
 * numa consulta só.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const clienteId = new URL(req.url).searchParams.get('cliente_id');
    if (!clienteId) {
        return NextResponse.json({ error: 'cliente_id é obrigatório' }, { status: 400 });
    }

    const { data: cliente, error: erroCliente } = await supabaseAdmin
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .maybeSingle();

    if (erroCliente) {
        console.error('❌ Detalhe do cliente: erro ao carregar cadastro', erroCliente);
        return NextResponse.json({ error: 'Erro ao carregar o cliente' }, { status: 500 });
    }
    if (!cliente) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Conta de acesso, quando o cliente já tem login
    let conta = null;
    if (cliente.user_id) {
        const { data } = await supabaseAdmin
            .from('users')
            .select('id, email, nome, role, roles, status, is_verified, two_factor_enabled, created_at')
            .eq('id', cliente.user_id)
            .maybeSingle();
        conta = data;
    }

    // As obras vêm por cliente_id OU por user_id: o cadastro antigo gravava só
    // o user_id, e é por isso que cliente sem conta parecia não ter obra.
    const filtros = [`cliente_id.eq.${clienteId}`];
    if (cliente.user_id) filtros.push(`user_id.eq.${cliente.user_id}`);

    const { data: obrasBrutas } = await supabaseAdmin
        .from('obras')
        .select('*')
        .or(filtros.join(','))
        .order('created_at', { ascending: false });

    const obras = obrasBrutas || [];
    const obraIds = obras.map((o) => o.id);

    // Etapas, cotações e pedidos de todas as obras de uma vez — evita uma
    // rodada de consultas por obra na hora de montar os contadores.
    const [etapasRes, cotacoesRes, pedidosRes] = await Promise.all([
        obraIds.length
            ? supabaseAdmin.from('obra_etapas').select('id, obra_id, is_completed').in('obra_id', obraIds)
            : Promise.resolve({ data: [] as any[] }),
        obraIds.length
            ? supabaseAdmin.from('cotacoes').select('id, obra_id, status, created_at').in('obra_id', obraIds)
            : Promise.resolve({ data: [] as any[] }),
        obraIds.length
            ? supabaseAdmin.from('pedidos').select('id, obra_id, status, valor_total, created_at').in('obra_id', obraIds)
            : Promise.resolve({ data: [] as any[] }),
    ]);

    const etapas = etapasRes.data || [];
    const cotacoes = cotacoesRes.data || [];
    const pedidos = pedidosRes.data || [];

    // Propostas recebidas: mede o engajamento dos fornecedores com este cliente
    let totalPropostas = 0;
    if (cotacoes.length) {
        const { count } = await supabaseAdmin
            .from('propostas')
            .select('id', { count: 'exact', head: true })
            .in('cotacao_id', cotacoes.map((c) => c.id));
        totalPropostas = count || 0;
    }

    const porObra = <T extends { obra_id: string }>(lista: T[], obraId: string) =>
        lista.filter((item) => item.obra_id === obraId);

    const obrasComResumo = obras.map((obra) => {
        const etapasDaObra = porObra(etapas, obra.id);
        const pedidosDaObra = porObra(pedidos, obra.id);
        return {
            id: obra.id,
            nome: obra.nome,
            descricao: obra.descricao,
            tipo: obra.tipo,
            etapa: obra.etapa,
            status: obra.status,
            logradouro: obra.logradouro,
            numero: obra.numero,
            bairro: obra.bairro,
            cidade: obra.cidade,
            estado: obra.estado,
            data_inicio: obra.data_inicio,
            data_previsao_fim: obra.data_previsao_fim,
            created_at: obra.created_at,
            total_etapas: etapasDaObra.length,
            etapas_concluidas: etapasDaObra.filter((e: any) => e.is_completed).length,
            total_cotacoes: porObra(cotacoes, obra.id).length,
            total_pedidos: pedidosDaObra.length,
            valor_pedidos: pedidosDaObra.reduce((soma: number, p: any) => soma + Number(p.valor_total || 0), 0),
        };
    });

    // Só pedido cancelado não conta como compra — os outros estados são
    // etapas do mesmo pedido caminhando até a entrega.
    const valorComprado = pedidos
        .filter((p: any) => p.status !== 'cancelado')
        .reduce((soma: number, p: any) => soma + Number(p.valor_total || 0), 0);

    return NextResponse.json({
        cliente,
        conta,
        obras: obrasComResumo,
        resumo: {
            total_obras: obras.length,
            obras_ativas: obras.filter((o: any) => o.status === 'ativa').length,
            total_cotacoes: cotacoes.length,
            total_propostas: totalPropostas,
            total_pedidos: pedidos.length,
            valor_comprado: valorComprado,
            ultima_cotacao_em: cotacoes
                .map((c: any) => c.created_at)
                .sort()
                .reverse()[0] || null,
        },
    });
}
