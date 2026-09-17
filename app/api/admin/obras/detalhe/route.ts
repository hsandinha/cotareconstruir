/**
 * Histórico completo de uma obra
 *
 * GET /api/admin/obras/detalhe?obra_id=...
 *
 * Tudo que aconteceu com a obra na plataforma: cronograma de fases, cada
 * cotação com seus itens, quem foi convidado, quem viu, quem declinou, quem
 * propôs e por quanto, os pedidos que saíram disso e uma linha do tempo
 * juntando os eventos em ordem.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';

/** Um evento da linha do tempo. `em` é o que ordena. */
interface Evento {
    em: string;
    tipo: 'obra' | 'etapa' | 'cotacao' | 'convite' | 'proposta' | 'pedido' | 'mensagem';
    titulo: string;
    detalhe?: string | null;
    referencia?: string | null;
}

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const obraId = new URL(req.url).searchParams.get('obra_id');
    if (!obraId) {
        return NextResponse.json({ error: 'obra_id é obrigatório' }, { status: 400 });
    }

    const { data: obra, error: erroObra } = await supabaseAdmin
        .from('obras')
        .select('*, cliente:clientes (id, nome, razao_social, email, telefone), dono:users (id, nome, email)')
        .eq('id', obraId)
        .maybeSingle();

    if (erroObra) {
        console.error('❌ Detalhe da obra: erro ao carregar', erroObra);
        return NextResponse.json({ error: 'Erro ao carregar a obra' }, { status: 500 });
    }
    if (!obra) {
        return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // ---------- Cronograma ----------
    // A ordem do cronograma é a cronologia da fase, não a de cadastro
    // (ver migration 20260818000000); `ordem` já espelha isso.
    // A fase entra por consulta separada, e não por embed: `obra_etapas` não
    // está no schema versionado e não dá para garantir a foreign key que o
    // PostgREST exigiria para resolver o relacionamento.
    const { data: etapasBrutas } = await supabaseAdmin
        .from('obra_etapas')
        .select('*')
        .eq('obra_id', obraId)
        .order('ordem', { ascending: true });

    const faseIds = [...new Set((etapasBrutas || []).map((e: any) => e.fase_id).filter(Boolean))];
    const { data: fases } = faseIds.length
        ? await supabaseAdmin.from('fases').select('id, nome, cronologia').in('id', faseIds)
        : { data: [] as any[] };

    const faseDe = new Map((fases || []).map((f: any) => [f.id, f]));
    const etapas = (etapasBrutas || []).map((etapa: any) => ({
        ...etapa,
        fase: etapa.fase_id ? faseDe.get(etapa.fase_id) || null : null,
    }));

    // ---------- Cotações ----------
    const { data: cotacoes } = await supabaseAdmin
        .from('cotacoes')
        .select('*')
        .eq('obra_id', obraId)
        .order('created_at', { ascending: false });

    const cotacaoIds = (cotacoes || []).map((c) => c.id);

    const [itensRes, propostasRes, convitesRes, anexosRes, mensagensRes] = await Promise.all([
        cotacaoIds.length
            ? supabaseAdmin.from('cotacao_itens').select('*').in('cotacao_id', cotacaoIds)
            : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
            ? supabaseAdmin
                .from('propostas')
                .select('*, fornecedor:fornecedores (id, razao_social, nome_fantasia)')
                .in('cotacao_id', cotacaoIds)
            : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
            ? supabaseAdmin
                .from('cotacao_convites')
                .select('*, fornecedor:fornecedores (id, razao_social, nome_fantasia)')
                .in('cotacao_id', cotacaoIds)
            : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
            ? supabaseAdmin.from('cotacao_anexos').select('id, cotacao_id, nome, url, tipo').in('cotacao_id', cotacaoIds)
            : Promise.resolve({ data: [] as any[] }),
        cotacaoIds.length
            ? supabaseAdmin
                .from('mensagens')
                .select('id, cotacao_id, conteudo, created_at, sender_id')
                .in('cotacao_id', cotacaoIds)
                .order('created_at', { ascending: false })
                .limit(200)
            : Promise.resolve({ data: [] as any[] }),
    ]);

    const itens = itensRes.data || [];
    const propostas = propostasRes.data || [];
    const convites = convitesRes.data || [];
    const anexos = anexosRes.data || [];
    const mensagens = mensagensRes.data || [];

    // ---------- Pedidos ----------
    // Por obra_id e também pelas cotações da obra: pedido antigo pode ter
    // ficado sem obra_id, mas a cotação de origem sempre aponta para cá.
    const filtrosPedido = [`obra_id.eq.${obraId}`];
    if (cotacaoIds.length) filtrosPedido.push(`cotacao_id.in.(${cotacaoIds.join(',')})`);

    const { data: pedidosBrutos } = await supabaseAdmin
        .from('pedidos')
        .select('*, fornecedor:fornecedores (id, razao_social, nome_fantasia)')
        .or(filtrosPedido.join(','))
        .order('created_at', { ascending: false });

    const pedidos = pedidosBrutos || [];

    const { data: pedidoItens } = pedidos.length
        ? await supabaseAdmin.from('pedido_itens').select('*').in('pedido_id', pedidos.map((p) => p.id))
        : { data: [] as any[] };

    const nomeFornecedor = (f: any) => f?.nome_fantasia || f?.razao_social || 'Fornecedor';

    // ---------- Cotações montadas ----------
    const cotacoesDetalhadas = (cotacoes || []).map((cotacao) => {
        const propostasDaCotacao = propostas.filter((p) => p.cotacao_id === cotacao.id);
        const convitesDaCotacao = convites.filter((c) => c.cotacao_id === cotacao.id);
        const valores = propostasDaCotacao
            .map((p) => Number(p.valor_total || 0))
            .filter((v) => v > 0);

        return {
            ...cotacao,
            itens: itens.filter((i) => i.cotacao_id === cotacao.id),
            anexos: anexos.filter((a) => a.cotacao_id === cotacao.id),
            propostas: propostasDaCotacao.map((p) => ({
                id: p.id,
                status: p.status,
                fornecedor_nome: nomeFornecedor(p.fornecedor),
                valor_total: Number(p.valor_total || 0),
                valor_frete: Number(p.valor_frete || 0),
                prazo_entrega: p.prazo_entrega,
                condicoes_pagamento: p.condicoes_pagamento,
                data_envio: p.data_envio,
                created_at: p.created_at,
            })),
            convites: convitesDaCotacao.map((c) => ({
                fornecedor_nome: nomeFornecedor(c.fornecedor),
                notificado_em: c.notificado_em,
                visualizado_em: c.visualizado_em,
                declinado_em: c.declinado_em,
                motivo_declinio: c.motivo_declinio,
            })),
            total_mensagens: mensagens.filter((m) => m.cotacao_id === cotacao.id).length,
            // Faixa de preço recebida: o quanto a concorrência apertou
            menor_proposta: valores.length ? Math.min(...valores) : null,
            maior_proposta: valores.length ? Math.max(...valores) : null,
        };
    });

    const pedidosDetalhados = pedidos.map((pedido) => ({
        ...pedido,
        fornecedor_nome: nomeFornecedor(pedido.fornecedor),
        itens: (pedidoItens || []).filter((i: any) => i.pedido_id === pedido.id),
    }));

    // ---------- Linha do tempo ----------
    const eventos: Evento[] = [];

    if (obra.created_at) {
        eventos.push({ em: obra.created_at, tipo: 'obra', titulo: 'Obra cadastrada', detalhe: obra.nome });
    }

    for (const etapa of etapas) {
        if (etapa.data_conclusao) {
            eventos.push({
                em: etapa.data_conclusao,
                tipo: 'etapa',
                titulo: `Fase concluída: ${etapa.nome}`,
                detalhe: etapa.fase?.nome || null,
            });
        }
    }

    for (const cotacao of cotacoes || []) {
        eventos.push({
            em: cotacao.created_at,
            tipo: 'cotacao',
            titulo: `Cotação #${cotacao.numero || '—'} criada`,
            detalhe: `${itens.filter((i) => i.cotacao_id === cotacao.id).length} itens`,
            referencia: cotacao.numero,
        });
        if (cotacao.data_envio) {
            eventos.push({
                em: cotacao.data_envio,
                tipo: 'cotacao',
                titulo: `Cotação #${cotacao.numero || '—'} enviada aos fornecedores`,
                referencia: cotacao.numero,
            });
        }
    }

    for (const convite of convites) {
        const numero = (cotacoes || []).find((c) => c.id === convite.cotacao_id)?.numero;
        if (convite.visualizado_em) {
            eventos.push({
                em: convite.visualizado_em,
                tipo: 'convite',
                titulo: `${nomeFornecedor(convite.fornecedor)} abriu a cotação #${numero || '—'}`,
                referencia: numero,
            });
        }
        if (convite.declinado_em) {
            eventos.push({
                em: convite.declinado_em,
                tipo: 'convite',
                titulo: `${nomeFornecedor(convite.fornecedor)} declinou a cotação #${numero || '—'}`,
                detalhe: convite.motivo_declinio,
                referencia: numero,
            });
        }
    }

    for (const proposta of propostas) {
        const numero = (cotacoes || []).find((c) => c.id === proposta.cotacao_id)?.numero;
        eventos.push({
            em: proposta.data_envio || proposta.created_at,
            tipo: 'proposta',
            titulo: `Proposta de ${nomeFornecedor(proposta.fornecedor)} na cotação #${numero || '—'}`,
            detalhe: proposta.valor_total ? `R$ ${Number(proposta.valor_total).toFixed(2)}` : null,
            referencia: numero,
        });
    }

    for (const pedido of pedidos) {
        eventos.push({
            em: pedido.created_at,
            tipo: 'pedido',
            titulo: `Pedido #${pedido.numero || '—'} para ${nomeFornecedor(pedido.fornecedor)}`,
            detalhe: pedido.valor_total ? `R$ ${Number(pedido.valor_total).toFixed(2)}` : null,
            referencia: pedido.numero,
        });
        if (pedido.data_confirmacao) {
            eventos.push({
                em: pedido.data_confirmacao,
                tipo: 'pedido',
                titulo: `Pedido #${pedido.numero || '—'} confirmado`,
                referencia: pedido.numero,
            });
        }
        if (pedido.data_entrega) {
            eventos.push({
                em: pedido.data_entrega,
                tipo: 'pedido',
                titulo: `Pedido #${pedido.numero || '—'} entregue`,
                referencia: pedido.numero,
            });
        }
    }

    // O chat rende muita linha: entra resumido, a primeira de cada cotação
    const cotacoesComChat = new Set<string>();
    for (const mensagem of [...mensagens].reverse()) {
        if (cotacoesComChat.has(mensagem.cotacao_id)) continue;
        cotacoesComChat.add(mensagem.cotacao_id);
        const numero = (cotacoes || []).find((c) => c.id === mensagem.cotacao_id)?.numero;
        eventos.push({
            em: mensagem.created_at,
            tipo: 'mensagem',
            titulo: `Conversa aberta no chat da cotação #${numero || '—'}`,
            referencia: numero,
        });
    }

    eventos.sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());

    const valorPedidos = pedidos
        .filter((p: any) => p.status !== 'cancelado')
        .reduce((soma: number, p: any) => soma + Number(p.valor_total || 0), 0);

    return NextResponse.json({
        obra,
        etapas,
        cotacoes: cotacoesDetalhadas,
        pedidos: pedidosDetalhados,
        eventos,
        resumo: {
            total_etapas: etapas.length,
            etapas_concluidas: etapas.filter((e: any) => e.is_completed).length,
            total_cotacoes: (cotacoes || []).length,
            total_itens_cotados: itens.length,
            total_convites: convites.length,
            total_propostas: propostas.length,
            total_pedidos: pedidos.length,
            valor_pedidos: valorPedidos,
        },
    });
}
