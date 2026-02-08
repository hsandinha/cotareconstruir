import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function getFornecedorId(userId: string): Promise<string | null> {
    if (!supabaseAdmin) return null;

    // Try users.fornecedor_id first
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('fornecedor_id')
        .eq('id', userId)
        .single();

    if (userData?.fornecedor_id) return userData.fornecedor_id;

    // Fallback: fornecedores.user_id
    const { data: fornecedorData } = await supabaseAdmin
        .from('fornecedores')
        .select('id')
        .eq('user_id', userId)
        .single();

    return fornecedorData?.id || null;
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
        // 1. Get supplier's ACTIVE material IDs from fornecedor_materiais
        // ========================================================
        const { data: fmData } = await supabaseAdmin
            .from('fornecedor_materiais')
            .select('material_id')
            .eq('fornecedor_id', fornecedorId)
            .eq('ativo', true);

        const activeMaterialIds = new Set((fmData || []).map(fm => fm.material_id));

        // ========================================================
        // 2. Get supplier's grupo IDs from fornecedor_grupo
        // ========================================================
        const { data: fgData } = await supabaseAdmin
            .from('fornecedor_grupo')
            .select('grupo_id')
            .eq('fornecedor_id', fornecedorId);

        const supplierGrupoIds = (fgData || []).map(fg => fg.grupo_id);

        // 3. Get material IDs that belong to those groups (via material_grupo)
        if (supplierGrupoIds.length > 0) {
            const { data: mgData } = await supabaseAdmin
                .from('material_grupo')
                .select('material_id')
                .in('grupo_id', supplierGrupoIds);

            (mgData || []).forEach(mg => activeMaterialIds.add(mg.material_id));
        }

        // 4. Get group NAMES for the supplier's groups (for text matching with cotacao_itens.grupo)
        let supplierGrupoNames: string[] = [];
        if (supplierGrupoIds.length > 0) {
            const { data: gruposData } = await supabaseAdmin
                .from('grupos_insumo')
                .select('id, nome')
                .in('id', supplierGrupoIds);

            supplierGrupoNames = (gruposData || []).map(g => g.nome.toLowerCase());
        }

        // ========================================================
        // 5. Load ALL cotações with status 'enviada'
        // ========================================================
        const { data, error } = await supabaseAdmin
            .from('cotacoes')
            .select('*, cotacao_itens(*)')
            .eq('status', 'enviada')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar cotações:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ========================================================
        // 6. FILTER: Only keep cotações that have at least one item
        //    matching the supplier's active materials OR groups
        // ========================================================
        const hasAnyAssociation = activeMaterialIds.size > 0 || supplierGrupoNames.length > 0;

        let cotacoes = data || [];

        if (hasAnyAssociation) {
            cotacoes = cotacoes.filter(cotacao => {
                const items = cotacao.cotacao_itens || [];
                return items.some((item: any) => {
                    // Match by material_id (exact UUID match)
                    if (item.material_id && activeMaterialIds.has(item.material_id)) {
                        return true;
                    }
                    // Match by grupo name (text match - cotacao_itens.grupo vs grupos_insumo.nome)
                    if (item.grupo && supplierGrupoNames.includes(item.grupo.toLowerCase())) {
                        return true;
                    }
                    return false;
                });
            });
        } else {
            // Supplier has NO materials and NO groups associated → show nothing
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
            .select('cotacao_id, status')
            .eq('fornecedor_id', fornecedorId);

        const propostaMap = new Map((propostas || []).map(p => [p.cotacao_id, p.status]));

        // Mark cotações with proposal status
        for (const cotacao of cotacoes) {
            (cotacao as any)._proposta_status = propostaMap.get(cotacao.id) || null;
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
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
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

            // 1. Create the cotação
            const { data: cotacao, error: cotacaoError } = await supabaseAdmin
                .from('cotacoes')
                .insert({
                    user_id: user.id,
                    obra_id,
                    status: 'enviada',
                    data_envio: new Date().toISOString(),
                    observacoes: observacoes || null,
                })
                .select()
                .single();

            if (cotacaoError) {
                console.error('Erro ao criar cotação:', cotacaoError);
                return NextResponse.json({ error: cotacaoError.message }, { status: 500 });
            }

            // 2. Insert cotacao_itens
            const cotacaoItens = itens.map((item: any) => ({
                cotacao_id: cotacao.id,
                material_id: item.material_id || null,
                nome: item.nome,
                quantidade: item.quantidade,
                unidade: item.unidade,
                grupo: item.grupo || null,
                observacao: item.observacao || null,
                fase_nome: item.fase_nome || null,
                servico_nome: item.servico_nome || null,
            }));

            const { error: itensError } = await supabaseAdmin
                .from('cotacao_itens')
                .insert(cotacaoItens);

            if (itensError) {
                console.error('Erro ao inserir cotacao_itens:', itensError);
                // Rollback: delete the cotação if items fail
                await supabaseAdmin.from('cotacoes').delete().eq('id', cotacao.id);
                return NextResponse.json({ error: itensError.message }, { status: 500 });
            }

            // 3. Notify suppliers in the region (best effort)
            try {
                if (obra.cidade) {
                    const { data: suppliers } = await supabaseAdmin
                        .from('fornecedores')
                        .select('email, regioes_atendimento')
                        .eq('status', 'active');

                    // Return supplier emails for client-side notification
                    const matchedSuppliers = (suppliers || []).filter(s =>
                        s.regioes_atendimento?.some((r: string) =>
                            r.toLowerCase().includes(obra.cidade!.toLowerCase())
                        )
                    );

                    return NextResponse.json({
                        success: true,
                        data: cotacao,
                        suppliers_notified: matchedSuppliers.length,
                        obra
                    });
                }
            } catch (notifyErr) {
                // Don't fail the whole request if notification fails
                console.error('Erro ao notificar fornecedores:', notifyErr);
            }

            return NextResponse.json({ success: true, data: cotacao, obra });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API cotacoes POST:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
