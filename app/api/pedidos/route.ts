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

// GET: Load pedidos for the authenticated fornecedor (bypasses RLS)
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

        if (!fornecedorId) {
            return NextResponse.json({ data: [], fornecedor_id: null });
        }

        const { data, error } = await supabaseAdmin
            .from('pedidos')
            .select('*, pedido_itens(*)')
            .eq('fornecedor_id', fornecedorId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar pedidos:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Enrich with obra and cotação data
        const pedidos = data || [];

        if (pedidos.length > 0) {
            // Get unique obra_ids and cotacao_ids
            const obraIds = [...new Set(pedidos.map(p => p.obra_id).filter(Boolean))];
            const cotacaoIds = [...new Set(pedidos.map(p => p.cotacao_id).filter(Boolean))];
            const userIds = [...new Set(pedidos.map(p => p.user_id).filter(Boolean))];

            const [obrasRes, cotacoesRes, usersRes] = await Promise.all([
                obraIds.length > 0
                    ? supabaseAdmin.from('obras').select('id, nome, bairro, cidade, estado, endereco').in('id', obraIds)
                    : Promise.resolve({ data: [] }),
                cotacaoIds.length > 0
                    ? supabaseAdmin.from('cotacoes').select('id, status, data_validade').in('id', cotacaoIds)
                    : Promise.resolve({ data: [] }),
                userIds.length > 0
                    ? supabaseAdmin.from('users').select('id, nome, email').in('id', userIds)
                    : Promise.resolve({ data: [] }),
            ]);

            const obraMap = new Map((obrasRes.data || []).map(o => [o.id, o]));
            const cotacaoMap = new Map((cotacoesRes.data || []).map(c => [c.id, c]));
            const userMap = new Map((usersRes.data || []).map(u => [u.id, u]));

            // Enrich pedidos
            for (const pedido of pedidos) {
                (pedido as any)._obra = obraMap.get(pedido.obra_id) || null;
                (pedido as any)._cotacao = cotacaoMap.get(pedido.cotacao_id) || null;
                (pedido as any)._cliente = userMap.get(pedido.user_id) || null;
            }
        }

        return NextResponse.json({ data: pedidos, fornecedor_id: fornecedorId });
    } catch (error: any) {
        console.error('Erro na API pedidos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

// POST: Update pedido status
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const fornecedorId = await getFornecedorId(user.id);
        if (!fornecedorId) {
            return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
        }

        const body = await req.json();
        const { action, pedido_id, status } = body;

        if (action === 'update_status') {
            if (!pedido_id || !status) {
                return NextResponse.json({ error: 'pedido_id e status são obrigatórios' }, { status: 400 });
            }

            // Verify ownership
            const { data: pedido } = await supabaseAdmin
                .from('pedidos')
                .select('id, fornecedor_id')
                .eq('id', pedido_id)
                .eq('fornecedor_id', fornecedorId)
                .single();

            if (!pedido) {
                return NextResponse.json({ error: 'Pedido não encontrado ou acesso negado' }, { status: 404 });
            }

            const updateData: any = {
                status,
                updated_at: new Date().toISOString(),
            };

            if (status === 'confirmado') {
                updateData.data_confirmacao = new Date().toISOString();
            }

            const { data, error } = await supabaseAdmin
                .from('pedidos')
                .update(updateData)
                .eq('id', pedido_id)
                .select()
                .single();

            if (error) {
                console.error('Erro ao atualizar pedido:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, data });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API pedidos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
