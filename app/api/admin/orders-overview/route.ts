import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function verifyAdmin(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        const supabaseAuthCookie = req.cookies
            .getAll()
            .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;
        if (supabaseAuthCookie) {
            try {
                const parsed = JSON.parse(supabaseAuthCookie);
                if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                    token = parsed[0];
                }
            } catch {
                // ignore
            }
        }
    }

    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token || !supabaseAdmin) {
        return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
    }

    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    const isAdmin = profile && (profile.role === 'admin' || profile.roles?.includes('admin'));
    if (!isAdmin) {
        return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) };
    }

    return { user };
}

function extractGroupNameFromObservacoes(observacoes: string | null | undefined): string | null {
    if (!observacoes) return null;
    const match = observacoes.match(/\[GRUPO=([^\]]+)\]/);
    return match ? match[1].trim() : null;
}

function clusterCotacoesIntoPedidoGeral(cotacoes: any[]) {
    // Use pedido_geral_id when present; otherwise fall back to (user_id, obra_id, minute window).
    const groups = new Map<string, any[]>();
    for (const c of cotacoes) {
        let key: string;
        if (c.pedido_geral_id) {
            key = `pg:${c.pedido_geral_id}`;
        } else {
            const t = c.data_envio || c.created_at;
            const minuteBucket = t ? new Date(t).toISOString().slice(0, 16) : 'unknown';
            key = `legacy:${c.user_id || 'na'}:${c.obra_id || 'na'}:${minuteBucket}`;
        }
        const arr = groups.get(key) || [];
        arr.push(c);
        groups.set(key, arr);
    }
    return groups;
}

/**
 * GET /api/admin/orders-overview
 * Query params:
 *   - fornecedor_id (opcional): retorna apenas pedidos onde esse fornecedor foi notificado
 *   - supplier_stats=1 & fornecedor_id=X (opcional): retorna apenas o resumo do fornecedor
 *
 * Resposta:
 * {
 *   pedidos: [{
 *     pedido_geral_id, cliente, obra, data_envio,
 *     sub_pedidos: [{ cotacao_id, grupo, itens_count, status,
 *       fornecedores: { invited, viewed, responded, not_responded } }],
 *     totals: { invited, viewed, responded }
 *   }],
 *   fornecedor_stats?: { fornecedor_id, total_notificados, total_visualizados, total_respondidos, total_nao_respondidos }
 * }
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fornecedorFilter = searchParams.get('fornecedor_id');
    const supplierStats = searchParams.get('supplier_stats') === '1';

    try {
        // 1. Load cotacoes (most recent first) — limit window for performance
        let cotacoesQuery = supabaseAdmin
            .from('cotacoes')
            .select('id, pedido_geral_id, user_id, obra_id, status, data_envio, observacoes, created_at, cotacao_itens(id, nome, quantidade, unidade, grupo)')
            .order('created_at', { ascending: false })
            .limit(300);

        // When filtering by fornecedor, narrow cotacoes to those the supplier was invited to.
        let allowedCotacaoIds: Set<string> | null = null;
        if (fornecedorFilter) {
            const { data: convites } = await supabaseAdmin
                .from('cotacao_convites')
                .select('cotacao_id')
                .eq('fornecedor_id', fornecedorFilter);
            allowedCotacaoIds = new Set((convites || []).map((c: any) => c.cotacao_id));
            if (allowedCotacaoIds.size === 0) {
                return NextResponse.json({
                    pedidos: [], fornecedor_stats: supplierStats ? {
                        fornecedor_id: fornecedorFilter,
                        total_notificados: 0, total_visualizados: 0, total_respondidos: 0, total_nao_respondidos: 0
                    } : undefined
                });
            }
            cotacoesQuery = cotacoesQuery.in('id', [...allowedCotacaoIds]);
        }

        const { data: cotacoes, error: cotErr } = await cotacoesQuery;
        if (cotErr) {
            return NextResponse.json({ error: cotErr.message }, { status: 500 });
        }

        const cotacoesData = cotacoes || [];
        const cotacaoIds = cotacoesData.map((c: any) => c.id);

        if (cotacaoIds.length === 0) {
            return NextResponse.json({ pedidos: [] });
        }

        // 2. Load convites, propostas, users, obras in parallel
        const userIds = [...new Set(cotacoesData.map((c: any) => c.user_id).filter(Boolean))];
        const obraIds = [...new Set(cotacoesData.map((c: any) => c.obra_id).filter(Boolean))];

        const [convitesRes, propostasRes, usersRes, obrasRes] = await Promise.all([
            supabaseAdmin
                .from('cotacao_convites')
                .select('cotacao_id, fornecedor_id, notificado_em, visualizado_em')
                .in('cotacao_id', cotacaoIds),
            supabaseAdmin
                .from('propostas')
                .select('cotacao_id, fornecedor_id, status, valor_total, data_envio, created_at')
                .in('cotacao_id', cotacaoIds),
            userIds.length > 0
                ? supabaseAdmin.from('users').select('id, nome, email').in('id', userIds)
                : Promise.resolve({ data: [] } as any),
            obraIds.length > 0
                ? supabaseAdmin.from('obras').select('id, nome, cidade, estado').in('id', obraIds)
                : Promise.resolve({ data: [] } as any),
        ]);

        const convites = convitesRes.data || [];
        const propostas = propostasRes.data || [];

        const fornecedorIds = [...new Set([
            ...convites.map((c: any) => c.fornecedor_id),
            ...propostas.map((p: any) => p.fornecedor_id),
        ].filter(Boolean))];

        let fornecedoresMap = new Map<string, any>();
        if (fornecedorIds.length > 0) {
            const { data: forns } = await supabaseAdmin
                .from('fornecedores')
                .select('id, razao_social, nome_fantasia, cnpj')
                .in('id', fornecedorIds);
            fornecedoresMap = new Map((forns || []).map((f: any) => [f.id, f]));
        }

        const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
        const obraMap = new Map((obrasRes.data || []).map((o: any) => [o.id, o]));

        // Convites by cotacao
        const convitesByCotacao = new Map<string, any[]>();
        for (const c of convites) {
            const list = convitesByCotacao.get(c.cotacao_id) || [];
            list.push(c);
            convitesByCotacao.set(c.cotacao_id, list);
        }

        // Propostas by cotacao
        const propostasByCotacao = new Map<string, Map<string, any>>();
        for (const p of propostas) {
            let m = propostasByCotacao.get(p.cotacao_id);
            if (!m) { m = new Map(); propostasByCotacao.set(p.cotacao_id, m); }
            m.set(p.fornecedor_id, p);
        }

        // 3. Build sub_pedidos & cluster into pedidos gerais
        const grouped = clusterCotacoesIntoPedidoGeral(cotacoesData);

        const pedidos: any[] = [];
        for (const [key, group] of grouped) {
            const first = group[0];
            const cliente = userMap.get(first.user_id) || null;
            const obra = obraMap.get(first.obra_id) || null;

            const subPedidos = group.map((cot: any) => {
                const convitesList = convitesByCotacao.get(cot.id) || [];
                const propostasMap = propostasByCotacao.get(cot.id) || new Map();

                const invited: any[] = [];
                const viewed: any[] = [];
                const responded: any[] = [];
                const notResponded: any[] = [];

                for (const conv of convitesList) {
                    const f = fornecedoresMap.get(conv.fornecedor_id) || { id: conv.fornecedor_id };
                    const proposta = propostasMap.get(conv.fornecedor_id);
                    const respondeu = proposta && proposta.status && proposta.status !== 'pendente';
                    const entry = {
                        fornecedor_id: conv.fornecedor_id,
                        razao_social: f.razao_social || null,
                        nome_fantasia: f.nome_fantasia || null,
                        cnpj: f.cnpj || null,
                        notificado_em: conv.notificado_em,
                        visualizado_em: conv.visualizado_em,
                        proposta_status: proposta?.status || null,
                        proposta_valor: proposta?.valor_total || null,
                        proposta_data: proposta?.data_envio || proposta?.created_at || null,
                    };
                    invited.push(entry);
                    if (conv.visualizado_em) viewed.push(entry);
                    if (respondeu) responded.push(entry);
                    else notResponded.push(entry);
                }

                // Also include propostas from suppliers without a convite row (legacy data).
                for (const [fid, proposta] of propostasMap) {
                    if (convitesList.some((c: any) => c.fornecedor_id === fid)) continue;
                    const f = fornecedoresMap.get(fid) || { id: fid };
                    const entry = {
                        fornecedor_id: fid,
                        razao_social: f.razao_social || null,
                        nome_fantasia: f.nome_fantasia || null,
                        cnpj: f.cnpj || null,
                        notificado_em: null,
                        visualizado_em: null,
                        proposta_status: proposta.status,
                        proposta_valor: proposta.valor_total,
                        proposta_data: proposta.data_envio || proposta.created_at,
                    };
                    invited.push(entry);
                    if (proposta.status && proposta.status !== 'pendente') responded.push(entry);
                }

                return {
                    cotacao_id: cot.id,
                    grupo: extractGroupNameFromObservacoes(cot.observacoes) || (cot.cotacao_itens?.[0]?.grupo ?? 'Sem grupo'),
                    status: cot.status,
                    data_envio: cot.data_envio || cot.created_at,
                    itens: cot.cotacao_itens || [],
                    itens_count: (cot.cotacao_itens || []).length,
                    fornecedores: {
                        invited,
                        viewed,
                        responded,
                        not_responded: notResponded,
                    },
                    totals: {
                        invited: invited.length,
                        viewed: viewed.length,
                        responded: responded.length,
                        not_responded: notResponded.length,
                    },
                };
            });

            const totals = subPedidos.reduce((acc, sp) => {
                acc.invited += sp.totals.invited;
                acc.viewed += sp.totals.viewed;
                acc.responded += sp.totals.responded;
                acc.not_responded += sp.totals.not_responded;
                return acc;
            }, { invited: 0, viewed: 0, responded: 0, not_responded: 0 });

            pedidos.push({
                pedido_geral_id: first.pedido_geral_id || key,
                cliente,
                obra,
                data_envio: first.data_envio || first.created_at,
                sub_pedidos: subPedidos,
                totals,
            });
        }

        // Sort by data_envio desc
        pedidos.sort((a, b) => {
            const ta = a.data_envio ? new Date(a.data_envio).getTime() : 0;
            const tb = b.data_envio ? new Date(b.data_envio).getTime() : 0;
            return tb - ta;
        });

        const response: any = { pedidos };

        if (supplierStats && fornecedorFilter) {
            // Compute stats globally for that supplier
            const { data: allConvites } = await supabaseAdmin
                .from('cotacao_convites')
                .select('cotacao_id, visualizado_em')
                .eq('fornecedor_id', fornecedorFilter);

            const allConvitesArr = allConvites || [];
            const conviteCotacaoIds = allConvitesArr.map((c: any) => c.cotacao_id);

            let totalRespondidos = 0;
            if (conviteCotacaoIds.length > 0) {
                const { data: respondidas } = await supabaseAdmin
                    .from('propostas')
                    .select('cotacao_id, status')
                    .eq('fornecedor_id', fornecedorFilter)
                    .in('cotacao_id', conviteCotacaoIds)
                    .neq('status', 'pendente');
                totalRespondidos = (respondidas || []).length;
            }

            response.fornecedor_stats = {
                fornecedor_id: fornecedorFilter,
                fornecedor: fornecedoresMap.get(fornecedorFilter) || null,
                total_notificados: allConvitesArr.length,
                total_visualizados: allConvitesArr.filter((c: any) => c.visualizado_em).length,
                total_respondidos: totalRespondidos,
                total_nao_respondidos: allConvitesArr.length - totalRespondidos,
            };
        }

        return NextResponse.json(response);
    } catch (e: any) {
        console.error('Erro em orders-overview:', e);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
