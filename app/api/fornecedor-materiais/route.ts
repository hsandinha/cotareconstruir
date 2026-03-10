import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { userHasSupplierAccess } from '@/lib/supplierAccessServer';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');

    // Tentar múltiplas fontes de token
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        // Tentar cookies do Supabase (formato: sb-<ref>-auth-token)
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

        const hasAccess = await userHasSupplierAccess(supabaseAdmin, user.id, fornecedor_id);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
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

        if (action === 'bulk_upsert') {
            const rawItems = Array.isArray(body.items) ? body.items : [];
            if (rawItems.length === 0) {
                return NextResponse.json({ error: 'items é obrigatório' }, { status: 400 });
            }

            if (rawItems.length > 3000) {
                return NextResponse.json({ error: 'Limite de 3000 linhas por importação' }, { status: 400 });
            }

            const dedupedByMaterial = new Map<string, {
                fornecedor_id: string;
                material_id: string;
                preco: number;
                estoque: number;
                ativo: boolean;
                updated_at: string;
            }>();
            const nowIso = new Date().toISOString();

            for (const raw of rawItems) {
                const currentMaterialId = typeof raw?.material_id === 'string' ? raw.material_id.trim() : '';
                if (!currentMaterialId) continue;

                const precoValue = Number(raw?.preco);
                const estoqueValue = Number(raw?.estoque);
                const ativoValue = typeof raw?.ativo === 'boolean' ? raw.ativo : true;

                dedupedByMaterial.set(currentMaterialId, {
                    fornecedor_id,
                    material_id: currentMaterialId,
                    preco: Number.isFinite(precoValue) && precoValue >= 0 ? precoValue : 0,
                    estoque: Number.isFinite(estoqueValue) && estoqueValue >= 0 ? Math.trunc(estoqueValue) : 0,
                    ativo: ativoValue,
                    updated_at: nowIso,
                });
            }

            const rows = Array.from(dedupedByMaterial.values());
            if (rows.length === 0) {
                return NextResponse.json({ error: 'Nenhuma linha válida para importar' }, { status: 400 });
            }

            const materialIds = rows.map((row) => row.material_id);
            const { data: existingMaterials, error: existingMaterialsError } = await supabaseAdmin
                .from('materiais')
                .select('id')
                .in('id', materialIds);

            if (existingMaterialsError) {
                console.error('Erro ao validar materiais da importação:', existingMaterialsError);
                return NextResponse.json({ error: existingMaterialsError.message }, { status: 500 });
            }

            const existingIds = new Set((existingMaterials || []).map((item: any) => item.id));
            const validRows = rows.filter((row) => existingIds.has(row.material_id));
            const skippedRows = rows.length - validRows.length;

            if (validRows.length === 0) {
                return NextResponse.json({ error: 'Nenhum material válido encontrado na planilha' }, { status: 400 });
            }

            const { data, error } = await supabaseAdmin
                .from('fornecedor_materiais')
                .upsert(validRows, { onConflict: 'fornecedor_id,material_id' })
                .select();

            if (error) {
                console.error('Erro ao importar fornecedor_materiais:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                updated_count: data?.length || validRows.length,
                skipped_count: skippedRows,
                data: data || [],
            });
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

        const hasAccess = await userHasSupplierAccess(supabaseAdmin, user.id, fornecedor_id);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
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
