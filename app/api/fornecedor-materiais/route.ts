import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { userHasSupplierAccess } from '@/lib/supplierAccessServer';
import { findSimilarMateriais, pickProbableDuplicate } from '@/lib/materialSimilarity';
import { SupplierMaterialsServiceError, upsertSupplierMaterials } from '@/lib/supplierMaterialsService';

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
            const result = await upsertSupplierMaterials(supabaseAdmin, {
                fornecedorId: fornecedor_id,
                items: [{ material_id, preco, estoque, ativo }],
            });

            if (result.accepted_count === 0) {
                const firstError = result.results.find((item: any) => item.status === 'rejected') as any;
                return NextResponse.json({ error: firstError?.error || 'Nenhum material válido encontrado' }, { status: 400 });
            }

            return NextResponse.json({ success: true, data: result.data?.[0], result });
        }

        if (action === 'bulk_upsert') {
            const rawItems = Array.isArray(body.items) ? body.items : [];
            const result = await upsertSupplierMaterials(supabaseAdmin, {
                fornecedorId: fornecedor_id,
                items: rawItems,
            });

            if (result.accepted_count === 0) {
                return NextResponse.json({ error: 'Nenhum material válido encontrado na planilha', result }, { status: 400 });
            }

            return NextResponse.json({
                ...result,
                success: true,
            });
        }

        if (action === 'toggle_ativo') {
            const result = await upsertSupplierMaterials(supabaseAdmin, {
                fornecedorId: fornecedor_id,
                items: [{ material_id, ativo }],
            });

            if (result.accepted_count === 0) {
                const firstError = result.results.find((item: any) => item.status === 'rejected') as any;
                return NextResponse.json({ error: firstError?.error || 'Erro ao alterar status', result }, { status: 400 });
            }

            return NextResponse.json({ success: true, data: result.data?.[0], result });
        }

        if (action === 'request_material') {
            const { nome, unidade, descricao, grupo_sugerido, force } = body;
            if (!nome) {
                return NextResponse.json({ error: 'Nome do material é obrigatório' }, { status: 400 });
            }

            // IA / similaridade: verifica se já existe material parecido cadastrado
            const similares = await findSimilarMateriais(supabaseAdmin, String(nome), { limit: 5, threshold: 0.3 });
            const provavel = pickProbableDuplicate(similares, 0.78);

            if (provavel && !force) {
                return NextResponse.json({
                    success: false,
                    duplicate: true,
                    suggestion: provavel,
                    similares,
                    message: `Encontramos um material parecido já cadastrado: "${provavel.nome}". Use-o ou confirme para enviar mesmo assim.`,
                }, { status: 409 });
            }

            const { data, error } = await supabaseAdmin
                .from('solicitacoes_materiais')
                .insert({
                    fornecedor_id,
                    solicitante_user_id: user.id,
                    tipo_solicitante: 'fornecedor',
                    nome,
                    unidade: unidade || 'unid',
                    descricao,
                    grupo_sugerido,
                    similares,
                    status: 'pendente'
                })
                .select()
                .single();

            if (error) {
                console.error('Erro ao solicitar material:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, data, similares });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API fornecedor-materiais:', error);
        if (error instanceof SupplierMaterialsServiceError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
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
