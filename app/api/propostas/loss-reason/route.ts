import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveSupplierAccess } from '@/lib/supplierAccessServer';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        const allCookies = req.cookies.getAll();
        const supabaseAuthCookie = allCookies
            .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;
        if (supabaseAuthCookie) {
            try {
                const parsed = JSON.parse(supabaseAuthCookie);
                if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                    token = parsed[0];
                }
            } catch {
                /* ignore */
            }
        }
    }

    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : 0;
};

const fmtBRL = (v: number): string =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pctDiff = (mine: number, ref: number): number => {
    if (ref <= 0) return 0;
    return ((mine - ref) / ref) * 100;
};

/**
 * GET /api/propostas/loss-reason?cotacao_id=...&fornecedor_id=...
 *
 * Retorna uma análise anonimizada do motivo da perda da cotação.
 * Nunca revela identidade do vencedor — apenas valores agregados
 * e comparativos de forma "concorrente / mercado".
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const url = new URL(req.url);
        const cotacaoId = url.searchParams.get('cotacao_id');
        const requestedFornecedorId = url.searchParams.get('fornecedor_id');

        if (!cotacaoId) {
            return NextResponse.json({ error: 'cotacao_id obrigatório' }, { status: 400 });
        }

        const resolvedAccess = await resolveSupplierAccess(supabaseAdmin, user.id, requestedFornecedorId);
        if (!resolvedAccess.ok) {
            return NextResponse.json(
                { error: resolvedAccess.error, code: resolvedAccess.code },
                { status: resolvedAccess.status }
            );
        }
        if (!resolvedAccess.fornecedorId) {
            return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
        }
        const fornecedorId = resolvedAccess.fornecedorId;

        // 1) Cotação fechada?
        const { data: cotacao, error: cotErr } = await supabaseAdmin
            .from('cotacoes')
            .select('id, status')
            .eq('id', cotacaoId)
            .single();
        if (cotErr || !cotacao) {
            return NextResponse.json({ error: 'Cotação não encontrada' }, { status: 404 });
        }
        if (cotacao.status !== 'fechada') {
            return NextResponse.json({
                outcome: 'open',
                reasons: [],
                message: 'A cotação ainda não foi fechada.'
            });
        }

        // 2) Pedido vinculado (define o vencedor)
        const { data: pedidos } = await supabaseAdmin
            .from('pedidos')
            .select('id, fornecedor_id, valor_total')
            .eq('cotacao_id', cotacaoId);

        const winnerOrder = (pedidos || [])[0];
        if (!winnerOrder) {
            return NextResponse.json({
                outcome: 'no_winner',
                reasons: [],
                message: 'Ainda não há vencedor definido.'
            });
        }

        if (winnerOrder.fornecedor_id === fornecedorId) {
            return NextResponse.json({
                outcome: 'won',
                reasons: [],
                message: 'Você foi o fornecedor escolhido nesta cotação.'
            });
        }

        // 3) Minha proposta + itens
        const { data: myProposta } = await supabaseAdmin
            .from('propostas')
            .select('id, valor_total, valor_frete, prazo_entrega, condicoes_pagamento, observacoes, status, proposta_itens(cotacao_item_id, preco_unitario, subtotal, quantidade)')
            .eq('cotacao_id', cotacaoId)
            .eq('fornecedor_id', fornecedorId)
            .maybeSingle();

        if (!myProposta) {
            return NextResponse.json({
                outcome: 'not_responded',
                reasons: ['Você não enviou proposta para esta cotação. O pedido foi fechado com outro fornecedor.'],
                message: 'Sem proposta registrada.'
            });
        }

        // 4) Proposta vencedora (mesmo cotacao + fornecedor do pedido)
        const { data: winnerProposta } = await supabaseAdmin
            .from('propostas')
            .select('valor_total, valor_frete, prazo_entrega, proposta_itens(cotacao_item_id, preco_unitario)')
            .eq('cotacao_id', cotacaoId)
            .eq('fornecedor_id', winnerOrder.fornecedor_id)
            .maybeSingle();

        // 5) Todas as propostas (para média de mercado anonimizada)
        const { data: allPropostas } = await supabaseAdmin
            .from('propostas')
            .select('id, fornecedor_id, valor_total, valor_frete, prazo_entrega')
            .eq('cotacao_id', cotacaoId);

        const competitorTotals = (allPropostas || [])
            .filter((p: any) => p.fornecedor_id !== fornecedorId)
            .map((p: any) => num(p.valor_total))
            .filter((v: number) => v > 0);

        const competitorFrete = (allPropostas || [])
            .filter((p: any) => p.fornecedor_id !== fornecedorId)
            .map((p: any) => num(p.valor_frete));

        const competitorPrazo = (allPropostas || [])
            .filter((p: any) => p.fornecedor_id !== fornecedorId)
            .map((p: any) => num(p.prazo_entrega))
            .filter((v: number) => v > 0);

        const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const min = (arr: number[]) => arr.length ? Math.min(...arr) : 0;

        const myTotal = num(myProposta.valor_total);
        const myFrete = num(myProposta.valor_frete);
        const myPrazo = num(myProposta.prazo_entrega);

        // Vencedor (valores anônimos)
        const winnerTotal = num(winnerProposta?.valor_total ?? winnerOrder.valor_total);
        const winnerFrete = num(winnerProposta?.valor_frete);
        const winnerPrazo = num(winnerProposta?.prazo_entrega);

        const marketAvgTotal = avg(competitorTotals);
        const marketMinTotal = min(competitorTotals);

        const reasons: Array<{ category: string; severity: 'critical' | 'high' | 'medium' | 'low' | 'info'; text: string }> = [];

        // a) Preço total
        if (winnerTotal > 0 && myTotal > 0) {
            const diff = myTotal - winnerTotal;
            const pct = pctDiff(myTotal, winnerTotal);
            if (diff > 0) {
                const severity: 'critical' | 'high' | 'medium' = pct >= 15 ? 'critical' : pct >= 5 ? 'high' : 'medium';
                reasons.push({
                    category: 'Preço total',
                    severity,
                    text: `Sua proposta ficou ${pct.toFixed(1)}% acima da escolhida (diferença de ${fmtBRL(diff)} no total).`,
                });
            } else if (Math.abs(pct) < 1) {
                reasons.push({
                    category: 'Preço total',
                    severity: 'info',
                    text: 'Seu preço total ficou próximo do vencedor (diferença menor que 1%). A decisão pode ter sido por outros fatores.',
                });
            }
        }

        // b) Frete
        if (winnerFrete > 0 && myFrete > winnerFrete) {
            const diff = myFrete - winnerFrete;
            reasons.push({
                category: 'Frete',
                severity: 'medium',
                text: `O frete proposto ficou ${fmtBRL(diff)} acima do vencedor.`,
            });
        }

        // c) Prazo
        if (winnerPrazo > 0 && myPrazo > 0 && myPrazo > winnerPrazo) {
            const diasExtra = myPrazo - winnerPrazo;
            reasons.push({
                category: 'Prazo de entrega',
                severity: diasExtra >= 5 ? 'high' : 'medium',
                text: `Seu prazo de entrega foi ${diasExtra} dia(s) maior que o vencedor.`,
            });
        }

        // d) Itens caros
        const myItens = (myProposta.proposta_itens || []) as Array<{ cotacao_item_id: string; preco_unitario: number }>;
        const winnerItensMap = new Map<string, number>();
        for (const it of (winnerProposta?.proposta_itens || []) as Array<{ cotacao_item_id: string; preco_unitario: number }>) {
            winnerItensMap.set(it.cotacao_item_id, num(it.preco_unitario));
        }

        let itensAcima = 0;
        let itensComparados = 0;
        let maiorDifPct = 0;
        for (const it of myItens) {
            const winnerPrice = winnerItensMap.get(it.cotacao_item_id) || 0;
            const mine = num(it.preco_unitario);
            if (winnerPrice <= 0 || mine <= 0) continue;
            itensComparados += 1;
            if (mine > winnerPrice) {
                itensAcima += 1;
                const p = pctDiff(mine, winnerPrice);
                if (p > maiorDifPct) maiorDifPct = p;
            }
        }
        if (itensComparados > 0 && itensAcima > 0) {
            reasons.push({
                category: 'Preço por item',
                severity: itensAcima === itensComparados ? 'critical' : 'high',
                text: `${itensAcima} de ${itensComparados} item(s) ficaram acima do preço escolhido. Maior diferença em um item: +${maiorDifPct.toFixed(1)}%.`,
            });
        }

        // e) Posição no ranking de preço (anônimo)
        if (competitorTotals.length > 0 && myTotal > 0) {
            const allTotals = [...competitorTotals, myTotal].sort((a, b) => a - b);
            const myPos = allTotals.indexOf(myTotal) + 1;
            reasons.push({
                category: 'Ranking de preço',
                severity: 'info',
                text: `No ranking de preço total, sua proposta ficou em ${myPos}º de ${allTotals.length} concorrentes.`,
            });
        }

        // Fallback
        if (reasons.length === 0) {
            reasons.push({
                category: 'Análise',
                severity: 'info',
                text: 'Não identificamos diferenças relevantes nos campos comparáveis. O cliente pode ter considerado condições qualitativas (histórico, garantia, relacionamento).',
            });
        }

        // Sugestões práticas
        const suggestions: string[] = [];
        if (reasons.some(r => r.category === 'Preço total' && r.severity !== 'info')) {
            suggestions.push('Revise sua margem em insumos de alto volume para se aproximar do preço de mercado.');
        }
        if (reasons.some(r => r.category === 'Frete')) {
            suggestions.push('Avalie negociar frete com transportadora ou ofereça opções de retirada.');
        }
        if (reasons.some(r => r.category === 'Prazo de entrega')) {
            suggestions.push('Reduza o prazo de entrega quando possível — clientes priorizam disponibilidade rápida.');
        }
        if (reasons.some(r => r.category === 'Preço por item')) {
            suggestions.push('Reveja os preços dos itens críticos identificados — pequenos ajustes podem virar a próxima cotação.');
        }
        if (suggestions.length === 0) {
            suggestions.push('Mantenha o atendimento ágil e considere reforçar diferenciais (qualidade, garantia, suporte).');
        }

        return NextResponse.json({
            outcome: 'lost',
            reasons,
            suggestions,
            summary: {
                myTotal,
                marketMinTotal,
                marketAvgTotal,
                competitorsCount: competitorTotals.length,
            },
        });
    } catch (error: any) {
        console.error('Erro em loss-reason:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
