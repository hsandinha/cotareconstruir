import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || req.cookies.get('authToken')?.value
        || req.cookies.get('token')?.value
        || req.cookies.get('sb-access-token')?.value;
    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

// POST: Upsert (configurar preço/estoque) or toggle ativo
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
        const { action, fornecedor_id, material_id, preco, estoque, ativo } = body;

        if (!fornecedor_id) {
            return NextResponse.json({ error: 'fornecedor_id é obrigatório' }, { status: 400 });
        }

        // Verify that the user owns this fornecedor
        const { data: fornecedor } = await supabaseAdmin
            .from('fornecedores')
            .select('id, user_id')
            .eq('id', fornecedor_id)
            .single();

        if (!fornecedor || fornecedor.user_id !== user.id) {
            // Also check users.fornecedor_id
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('fornecedor_id')
                .eq('id', user.id)
                .single();

            if (!userData || userData.fornecedor_id !== fornecedor_id) {
                return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
            }
        }

        if (action === 'upsert') {
            // Upsert preço e estoque (configurar material)
            const { data, error } = await supabaseAdmin
                .from('fornecedor_materiais')
                .upsert({
                    fornecedor_id,
                    material_id,
                    preco: preco ?? 0,
                    estoque: estoque ?? 0,
                    ativo: ativo !== undefined ? ativo : true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'fornecedor_id,material_id' })
                .select()
                .single();

            if (error) {
                console.error('Erro ao upsert fornecedor_materiais:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, data });
        }

        if (action === 'toggle_ativo') {
            // Check if record exists
            const { data: existing } = await supabaseAdmin
                .from('fornecedor_materiais')
                .select('id')
                .eq('fornecedor_id', fornecedor_id)
                .eq('material_id', material_id)
                .single();

            if (existing) {
                // Update existing
                const { data, error } = await supabaseAdmin
                    .from('fornecedor_materiais')
                    .update({ ativo, updated_at: new Date().toISOString() })
                    .eq('fornecedor_id', fornecedor_id)
                    .eq('material_id', material_id)
                    .select()
                    .single();

                if (error) {
                    console.error('Erro ao atualizar status:', error);
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                return NextResponse.json({ success: true, data });
            } else {
                // Insert new record (e.g., inactivating a never-configured material)
                const { data, error } = await supabaseAdmin
                    .from('fornecedor_materiais')
                    .insert({
                        fornecedor_id,
                        material_id,
                        preco: 0,
                        estoque: 0,
                        ativo,
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('Erro ao inserir material inativo:', error);
                    return NextResponse.json({ error: error.message }, { status: 500 });
                }

                return NextResponse.json({ success: true, data });
            }
        }

        if (action === 'request_material') {
            const { nome, unidade, descricao, grupo_sugerido } = body;
            if (!nome) {
                return NextResponse.json({ error: 'Nome do material é obrigatório' }, { status: 400 });
            }

            const { data, error } = await supabaseAdmin
                .from('solicitacoes_materiais')
                .insert({
                    fornecedor_id,
                    nome,
                    unidade: unidade || 'unid',
                    descricao,
                    grupo_sugerido,
                    status: 'pendente'
                })
                .select()
                .single();

            if (error) {
                console.error('Erro ao solicitar material:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, data });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API fornecedor-materiais:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

// GET: Load fornecedor materials (using admin to bypass RLS)
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const fornecedor_id = searchParams.get('fornecedor_id');

        if (!fornecedor_id) {
            return NextResponse.json({ error: 'fornecedor_id é obrigatório' }, { status: 400 });
        }

        // Verify ownership
        const { data: fornecedor } = await supabaseAdmin
            .from('fornecedores')
            .select('id, user_id')
            .eq('id', fornecedor_id)
            .single();

        if (!fornecedor || fornecedor.user_id !== user.id) {
            const { data: userData } = await supabaseAdmin
                .from('users')
                .select('fornecedor_id')
                .eq('id', user.id)
                .single();

            if (!userData || userData.fornecedor_id !== fornecedor_id) {
                return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
            }
        }

        const { data, error } = await supabaseAdmin
            .from('fornecedor_materiais')
            .select('*')
            .eq('fornecedor_id', fornecedor_id);

        if (error) {
            console.error('Erro ao carregar fornecedor_materiais:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data || [] });
    } catch (error: any) {
        console.error('Erro na API fornecedor-materiais:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
