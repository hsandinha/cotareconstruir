import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function extractTaxesFromObservacoes(observacoes: string | null | undefined) {
    if (!observacoes) return 0;
    const match = String(observacoes).match(/\[IMPOSTOS=([0-9]+(?:\.[0-9]{1,2})?)\]/i);
    return match ? parseFloat(match[1]) || 0 : 0;
}

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');

    // Tentar múltiplas fontes de token
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        // Tentar cookies do Supabase
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
                // Ignorar erro de parse
            }
        }
    }

    if (!token) {
        // Fallback para outros cookies
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token || !supabaseAdmin) {
        console.warn('Token não encontrado na requisição');
        return null;
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        console.warn('Erro ao validar token:', error?.message);
        return null;
    }
    return user;
}

function normalizeGroupName(value: string | null | undefined) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

async function getFornecedorId(userId: string): Promise<string | null> {
    if (!supabaseAdmin) return null;

    // 1) Fonte mais confiável: fornecedores.user_id vinculado ao usuário autenticado
    const { data: fornecedorByUser } = await supabaseAdmin
        .from('fornecedores')
        .select('id')
        .eq('user_id', userId)
        .single();

    if (fornecedorByUser?.id) return fornecedorByUser.id;

    // 2) Fallback para vínculo legado em users.fornecedor_id
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('fornecedor_id')
        .eq('id', userId)
        .single();

    return userData?.fornecedor_id || null;
}

// GET: Load cotações for the authenticated fornecedor (bypasses RLS)
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const fornecedorId = await getFornecedorId(user.id);

        // Get fornecedor data (status, regioes_atendimento)
        let fornecedorStatus = 'ativo';
        let regioes: string[] = [];

        if (fornecedorId) {
            const { data: fornecedor } = await supabaseAdmin
                .from('fornecedores')
                .select('status, regioes_atendimento')
                .eq('id', fornecedorId)
                .single();

            if (fornecedor) {
                fornecedorStatus = fornecedor.status || 'ativo';
                regioes = (fornecedor.regioes_atendimento || []).map((r: string) => r.toLowerCase());
            }
        }

        if (!fornecedorId) {
            return NextResponse.json({
                data: [],
                fornecedor_id: null,
                fornecedor_status: 'not_found',
                regioes: []
            });
        }

        if (fornecedorStatus === 'suspended') {
            return NextResponse.json({
                data: [],
                fornecedor_id: fornecedorId,
                fornecedor_status: 'suspended',
                regioes
            });
        }

        // ========================================================
        // 1. Get supplier's grupo IDs from fornecedor_grupo
        // ========================================================
        const { data: fgData } = await supabaseAdmin
            .from('fornecedor_grupo')
            .select('grupo_id')
            .eq('fornecedor_id', fornecedorId);

        const supplierGrupoIds = (fgData || []).map(fg => fg.grupo_id);
        const supplierGrupoIdsSet = new Set(supplierGrupoIds);

        // 2. Get group NAMES for the supplier's groups (for text matching with cotacao_itens.grupo)
        let supplierGrupoNames: string[] = [];
        if (supplierGrupoIds.length > 0) {
            const { data: gruposData } = await supabaseAdmin
                .from('grupos_insumo')
                .select('id, nome')
                .in('id', supplierGrupoIds);

            supplierGrupoNames = (gruposData || []).map(g => normalizeGroupName(g.nome));
        }
        const supplierGrupoNameSet = new Set(supplierGrupoNames);

        // ========================================================
        // 5. Load open + closed cotações for supplier inbox
        //    (closed are shown as historical outcome only)
        // ========================================================
        const { data, error } = await supabaseAdmin
            .from('cotacoes')
            .select('*, cotacao_itens(*)')
            .in('status', ['enviada', 'respondida', 'fechada'])
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar cotações:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ========================================================
        // 6. FILTER: only keep cotações with item group associated to supplier
        // ========================================================
        const hasAnyAssociation = supplierGrupoIds.length > 0 || supplierGrupoNames.length > 0;

        let cotacoes = data || [];

        if (hasAnyAssociation) {
            const materialIds = [...new Set(
                cotacoes
                    .flatMap((cotacao: any) => cotacao.cotacao_itens || [])
                    .map((item: any) => item.material_id)
                    .filter(Boolean)
            )];

            const materialGroupMap = new Map<string, string[]>();
            if (materialIds.length > 0) {
                const { data: mgData } = await supabaseAdmin
                    .from('material_grupo')
                    .select('material_id, grupo_id')
                    .in('material_id', materialIds);

                for (const row of (mgData || [])) {
                    const list = materialGroupMap.get(row.material_id) || [];
                    list.push(row.grupo_id);
                    materialGroupMap.set(row.material_id, list);
                }
            }

            cotacoes = cotacoes.filter(cotacao => {
                const items = cotacao.cotacao_itens || [];
                return items.some((item: any) => {
                    const grupoNome = normalizeGroupName(item.grupo);
                    if (grupoNome && supplierGrupoNameSet.has(grupoNome)) {
                        return true;
                    }

                    if (!item.material_id) {
                        return false;
                    }

                    const itemGrupoIds = materialGroupMap.get(item.material_id) || [];
                    if (itemGrupoIds.some((grupoId) => supplierGrupoIdsSet.has(grupoId))) {
                        return true;
                    }

                    return false;
                });
            });
        } else {
            // Supplier has NO groups associated → show nothing
            cotacoes = [];
        }

        // Enrich with obra data
        if (cotacoes.length > 0) {
            const obraIds = [...new Set(cotacoes.map(c => c.obra_id).filter(Boolean))];
            const userIds = [...new Set(cotacoes.map(c => c.user_id).filter(Boolean))];

            const [obrasRes, usersRes] = await Promise.all([
                obraIds.length > 0
                    ? supabaseAdmin.from('obras').select('id, nome, cep, logradouro, numero, complemento, bairro, cidade, estado, horario_entrega, restricoes_entrega').in('id', obraIds)
                    : Promise.resolve({ data: [] }),
                userIds.length > 0
                    ? supabaseAdmin.from('users').select('id, nome, email').in('id', userIds)
                    : Promise.resolve({ data: [] }),
            ]);

            const obraMap = new Map((obrasRes.data || []).map(o => [o.id, o]));
            const userMap = new Map((usersRes.data || []).map(u => [u.id, u]));

            for (const cotacao of cotacoes) {
                (cotacao as any)._obra = obraMap.get(cotacao.obra_id) || null;
                (cotacao as any)._cliente = userMap.get(cotacao.user_id) || null;
            }
        }

        // Also check which cotações this fornecedor already responded to
        const { data: propostas } = await supabaseAdmin
            .from('propostas')
            .select('cotacao_id, status, valor_total, valor_frete, prazo_entrega, condicoes_pagamento, observacoes, proposta_itens(cotacao_item_id, preco_unitario, subtotal, quantidade)')
            .eq('fornecedor_id', fornecedorId);

        const propostaMap = new Map((propostas || []).map((p: any) => [p.cotacao_id, p.status]));
        const propostaResumoMap = new Map((propostas || []).map((p: any) => {
            const itensObject = (p.proposta_itens || []).reduce((acc: Record<string, any>, item: any) => {
                acc[item.cotacao_item_id] = {
                    unitPrice: parseFloat(item.preco_unitario) || 0,
                    total: parseFloat(item.subtotal) || 0,
                    quantity: item.quantidade || 0,
                };
                return acc;
            }, {});

            return [
                p.cotacao_id,
                {
                    totalValue: parseFloat(p.valor_total) || 0,
                    freightValue: parseFloat(p.valor_frete) || 0,
                    taxValue: extractTaxesFromObservacoes(p.observacoes),
                    deliveryDays: Number.isFinite(Number(p.prazo_entrega)) ? Number(p.prazo_entrega) : null,
                    paymentTerms: p.condicoes_pagamento || null,
                    items: itensObject
                }
            ];
        }));

        // Mark cotações with proposal status
        for (const cotacao of cotacoes) {
            (cotacao as any)._proposta_status = propostaMap.get(cotacao.id) || null;
            (cotacao as any)._proposta_resumo = propostaResumoMap.get(cotacao.id) || null;
        }

        // Cotações fechadas: mostrar apenas as que o fornecedor respondeu
        cotacoes = cotacoes.filter(c => c.status !== 'fechada' || propostaMap.has(c.id));

        // Resultado das cotações fechadas
        const closedCotacaoIds = cotacoes
            .filter(c => c.status === 'fechada')
            .map(c => c.id);

        if (closedCotacaoIds.length > 0) {
            const [ordersWithMeRes, ordersWithOtherRes] = await Promise.all([
                supabaseAdmin
                    .from('pedidos')
                    .select('id, cotacao_id, status, endereco_entrega')
                    .eq('fornecedor_id', fornecedorId)
                    .in('cotacao_id', closedCotacaoIds),
                supabaseAdmin
                    .from('pedidos')
                    .select('cotacao_id, fornecedor_id')
                    .neq('fornecedor_id', fornecedorId)
                    .in('cotacao_id', closedCotacaoIds),
            ]);

            const ordersWithMe = ordersWithMeRes.data || [];
            const closedWithMeSet = new Set(ordersWithMe.map((o: any) => o.cotacao_id));
            const closedWithOtherSet = new Set((ordersWithOtherRes.data || []).map((o: any) => o.cotacao_id));
            const orderStatusByCotacao = new Map(ordersWithMe.map((o: any) => [o.cotacao_id, o.status]));
            const orderIdByCotacao = new Map(ordersWithMe.map((o: any) => [o.cotacao_id, o.id]));
            const orderSummaryByCotacao = new Map(ordersWithMe.map((o: any) => [o.cotacao_id, o?.endereco_entrega?.summary || null]));

            for (const cotacao of cotacoes) {
                const isClosed = cotacao.status === 'fechada';
                (cotacao as any)._closed_with_me = isClosed && closedWithMeSet.has(cotacao.id);
                (cotacao as any)._closed_with_other = isClosed && !closedWithMeSet.has(cotacao.id) && closedWithOtherSet.has(cotacao.id);
                (cotacao as any)._pedido_status = orderStatusByCotacao.get(cotacao.id) || null;
                (cotacao as any)._pedido_id = orderIdByCotacao.get(cotacao.id) || null;
                (cotacao as any)._pedido_summary = orderSummaryByCotacao.get(cotacao.id) || null;
            }
        } else {
            for (const cotacao of cotacoes) {
                (cotacao as any)._closed_with_me = false;
                (cotacao as any)._closed_with_other = false;
                (cotacao as any)._pedido_status = null;
                (cotacao as any)._pedido_id = null;
                (cotacao as any)._pedido_summary = null;
            }
        }

        return NextResponse.json({
            data: cotacoes,
            fornecedor_id: fornecedorId,
            fornecedor_status: fornecedorStatus,
            regioes
        });
    } catch (error: any) {
        console.error('Erro na API cotacoes:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

// POST: Create a new cotação (client side - bypasses RLS on cotacoes + cotacao_itens)
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            console.error('POST /api/cotacoes: Usuário não autenticado');
            return NextResponse.json({ error: 'Não autenticado. Faça login novamente.' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await req.json();
        const { action } = body;

        if (action === 'create') {
            const { obra_id, itens, observacoes } = body;

            if (!obra_id) {
                return NextResponse.json({ error: 'obra_id é obrigatório' }, { status: 400 });
            }
            if (!itens || !Array.isArray(itens) || itens.length === 0) {
                return NextResponse.json({ error: 'Itens são obrigatórios' }, { status: 400 });
            }

            // Verify user owns this obra
            const { data: obra } = await supabaseAdmin
                .from('obras')
                .select('id, user_id, nome, bairro, cidade, estado')
                .eq('id', obra_id)
                .eq('user_id', user.id)
                .single();

            if (!obra) {
                return NextResponse.json({ error: 'Obra não encontrada ou acesso negado' }, { status: 404 });
            }

            const materialIds = [...new Set(itens.map((item: any) => item.material_id).filter(Boolean))];

            const [gruposRes, materialGrupoRes] = await Promise.all([
                supabaseAdmin.from('grupos_insumo').select('id, nome'),
                materialIds.length > 0
                    ? supabaseAdmin.from('material_grupo').select('material_id, grupo_id').in('material_id', materialIds)
                    : Promise.resolve({ data: [], error: null } as any),
            ]);

            if (gruposRes.error) {
                return NextResponse.json({ error: gruposRes.error.message }, { status: 500 });
            }
            if (materialGrupoRes.error) {
                return NextResponse.json({ error: materialGrupoRes.error.message }, { status: 500 });
            }

            const groupIdToName = new Map((gruposRes.data || []).map((g: any) => [g.id, g.nome]));
            const groupNameToId = new Map(
                (gruposRes.data || []).map((g: any) => [normalizeGroupName(g.nome), g.id])
            );
            const validGroupNameSet = new Set((gruposRes.data || []).map((g: any) => normalizeGroupName(g.nome)));

            const materialToGrupoIds = new Map<string, string[]>();
            for (const row of (materialGrupoRes.data || [])) {
                const list = materialToGrupoIds.get(row.material_id) || [];
                list.push(row.grupo_id);
                materialToGrupoIds.set(row.material_id, list);
            }

            type GroupedCotacao = {
                groupId: string | null;
                groupName: string;
                items: any[];
            };

            const groupedItems = new Map<string, GroupedCotacao>();
            const invalidGroupItems: string[] = [];

            for (const item of itens) {
                const materialGroupIds = item.material_id ? (materialToGrupoIds.get(item.material_id) || []) : [];
                const inferredGroupId = materialGroupIds[0] || null;
                const fallbackGroupId = groupNameToId.get(normalizeGroupName(item.grupo)) || null;
                const finalGroupId = inferredGroupId || fallbackGroupId;
                const finalGroupName = finalGroupId
                    ? (groupIdToName.get(finalGroupId) || item.grupo || 'Sem grupo')
                    : (item.grupo || 'Sem grupo');

                const hasValidGroup = !!finalGroupId || validGroupNameSet.has(normalizeGroupName(finalGroupName));
                if (!hasValidGroup) {
                    invalidGroupItems.push(item.nome || 'Item sem nome');
                    continue;
                }

                const key = finalGroupId ? `group-id:${finalGroupId}` : `group-name:${normalizeGroupName(finalGroupName)}`;
                const existing: GroupedCotacao = groupedItems.get(key) || {
                    groupId: finalGroupId,
                    groupName: finalGroupName,
                    items: []
                };

                existing.items.push({
                    material_id: item.material_id || null,
                    nome: item.nome,
                    quantidade: item.quantidade,
                    unidade: item.unidade,
                    grupo: finalGroupName,
                    observacao: item.observacao || null,
                    fase_nome: item.fase_nome || null,
                    servico_nome: item.servico_nome || null,
                });

                groupedItems.set(key, existing);
            }

            if (invalidGroupItems.length > 0) {
                return NextResponse.json({
                    error: 'Existem itens sem grupo de insumo válido.',
                    invalid_items: invalidGroupItems
                }, { status: 400 });
            }

            if (groupedItems.size === 0) {
                return NextResponse.json({ error: 'Nenhum item com grupo de insumo válido para gerar solicitações.' }, { status: 400 });
            }

            const createdCotacoes: any[] = [];
            for (const grouped of groupedItems.values()) {
                const groupObservacaoPrefix = `[GRUPO=${grouped.groupName}]`;
                const observacoesComGrupo = observacoes
                    ? `${groupObservacaoPrefix}\n${observacoes}`
                    : groupObservacaoPrefix;

                const { data: cotacao, error: cotacaoError } = await supabaseAdmin
                    .from('cotacoes')
                    .insert({
                        user_id: user.id,
                        obra_id,
                        status: 'enviada',
                        data_envio: new Date().toISOString(),
                        observacoes: observacoesComGrupo,
                    })
                    .select()
                    .single();

                if (cotacaoError) {
                    console.error('Erro ao criar cotação:', cotacaoError);
                    if (createdCotacoes.length > 0) {
                        await supabaseAdmin.from('cotacoes').delete().in('id', createdCotacoes.map((c: any) => c.id));
                    }
                    return NextResponse.json({ error: cotacaoError.message }, { status: 500 });
                }

                const cotacaoItens = grouped.items.map((item: any) => ({
                    cotacao_id: cotacao.id,
                    material_id: item.material_id,
                    nome: item.nome,
                    quantidade: item.quantidade,
                    unidade: item.unidade,
                    grupo: item.grupo,
                    observacao: item.observacao,
                    fase_nome: item.fase_nome,
                    servico_nome: item.servico_nome,
                }));

                const { error: itensError } = await supabaseAdmin
                    .from('cotacao_itens')
                    .insert(cotacaoItens);

                if (itensError) {
                    console.error('Erro ao inserir cotacao_itens:', itensError);
                    await supabaseAdmin.from('cotacoes').delete().eq('id', cotacao.id);
                    if (createdCotacoes.length > 0) {
                        await supabaseAdmin.from('cotacoes').delete().in('id', createdCotacoes.map((c: any) => c.id));
                    }
                    return NextResponse.json({ error: itensError.message }, { status: 500 });
                }

                createdCotacoes.push({
                    ...cotacao,
                    group_id: grouped.groupId,
                    group_name: grouped.groupName,
                    items_count: grouped.items.length,
                });
            }

            let suppliersNotified = 0;
            try {
                if (obra.cidade) {
                    const cityName = obra.cidade.toLowerCase();
                    const createdGroupIds = [...new Set(createdCotacoes.map((c: any) => c.group_id).filter(Boolean))];

                    const [suppliersRes, supplierGroupRes] = await Promise.all([
                        supabaseAdmin
                            .from('fornecedores')
                            .select('id, regioes_atendimento')
                            .eq('status', 'active'),
                        createdGroupIds.length > 0
                            ? supabaseAdmin
                                .from('fornecedor_grupo')
                                .select('fornecedor_id, grupo_id')
                                .in('grupo_id', createdGroupIds)
                            : Promise.resolve({ data: [], error: null } as any),
                    ]);

                    if (!suppliersRes.error && !supplierGroupRes.error) {
                        const supplierToGroupIds = new Map<string, Set<string>>();
                        for (const row of (supplierGroupRes.data || [])) {
                            const set = supplierToGroupIds.get(row.fornecedor_id) || new Set<string>();
                            set.add(row.grupo_id);
                            supplierToGroupIds.set(row.fornecedor_id, set);
                        }

                        const matchedSupplierIds = new Set<string>();
                        for (const supplier of (suppliersRes.data || [])) {
                            const inRegion = supplier.regioes_atendimento?.some((r: string) => r.toLowerCase().includes(cityName));
                            if (!inRegion) continue;

                            const groups = supplierToGroupIds.get(supplier.id);
                            if (createdGroupIds.length > 0 && (!groups || groups.size === 0)) {
                                continue;
                            }

                            if (createdGroupIds.length === 0) {
                                matchedSupplierIds.add(supplier.id);
                                continue;
                            }

                            const hasMatchingGroup = createdGroupIds.some((groupId: string) => groups?.has(groupId));
                            if (hasMatchingGroup) {
                                matchedSupplierIds.add(supplier.id);
                            }
                        }

                        suppliersNotified = matchedSupplierIds.size;
                    }
                }
            } catch (notifyErr) {
                console.error('Erro ao notificar fornecedores:', notifyErr);
            }

            return NextResponse.json({
                success: true,
                data: createdCotacoes,
                cotacoes_created: createdCotacoes.length,
                groups_created: groupedItems.size,
                suppliers_notified: suppliersNotified,
                obra
            });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API cotacoes POST:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
