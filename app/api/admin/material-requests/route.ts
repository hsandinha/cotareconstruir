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

/**
 * GET /api/admin/material-requests?status=pendente
 * Lista todas as solicitações de novos materiais, opcionalmente filtradas por status.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
        .from('solicitacoes_materiais')
        .select(`
            *,
            fornecedor:fornecedores(id, razao_social, nome_fantasia, cnpj),
            solicitante:users!solicitacoes_materiais_solicitante_user_id_fkey(id, nome, email, role)
        `)
        .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
        console.error('Erro ao listar solicitacoes_materiais:', error);
        // Fallback sem join (caso a FK não esteja nomeada exatamente assim)
        const { data: rawData, error: rawError } = await supabaseAdmin
            .from('solicitacoes_materiais')
            .select('*')
            .order('created_at', { ascending: false });
        if (rawError) {
            return NextResponse.json({ error: rawError.message }, { status: 500 });
        }
        return NextResponse.json({ data: rawData || [] });
    }

    return NextResponse.json({ data: data || [] });
}

/**
 * PATCH /api/admin/material-requests
 * Body:
 *   - { id, action: 'approve', nome?, unidade?, descricao?, grupo_ids?: string[] }
 *   - { id, action: 'reject', resposta_admin?: string }
 *   - { id, action: 'link_existing', material_id }
 */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }
    const admin = auth.user;

    try {
        const body = await req.json();
        const { id, action } = body;
        if (!id || !action) {
            return NextResponse.json({ error: 'id e action são obrigatórios' }, { status: 400 });
        }

        const { data: solicitacao, error: fetchError } = await supabaseAdmin
            .from('solicitacoes_materiais')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !solicitacao) {
            return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
        }

        if (solicitacao.status !== 'pendente') {
            return NextResponse.json({ error: 'Solicitação já processada' }, { status: 400 });
        }

        if (action === 'approve') {
            const nome = (body.nome || solicitacao.nome || '').toString().trim();
            const unidade = (body.unidade || solicitacao.unidade || 'unid').toString().trim();
            const descricao = body.descricao !== undefined
                ? String(body.descricao).trim() || null
                : solicitacao.descricao;
            const grupoIds: string[] = Array.isArray(body.grupo_ids) ? body.grupo_ids : [];

            if (!nome) {
                return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
            }

            const { data: material, error: matError } = await supabaseAdmin
                .from('materiais')
                .insert({ nome, unidade, descricao })
                .select()
                .single();

            if (matError) {
                console.error('Erro ao criar material aprovado:', matError);
                return NextResponse.json({ error: matError.message }, { status: 500 });
            }

            if (grupoIds.length > 0) {
                const links = grupoIds.map((grupo_id) => ({ material_id: material.id, grupo_id }));
                const { error: linkError } = await supabaseAdmin
                    .from('material_grupo')
                    .insert(links);
                if (linkError) {
                    console.warn('Material criado mas falhou ao vincular grupos:', linkError);
                }
            }

            const { data: updated, error: updateError } = await supabaseAdmin
                .from('solicitacoes_materiais')
                .update({
                    status: 'aprovada',
                    material_aprovado_id: material.id,
                    aprovado_por: admin.id,
                    aprovado_em: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, material, solicitacao: updated });
        }

        if (action === 'link_existing') {
            const materialId = body.material_id;
            if (!materialId) {
                return NextResponse.json({ error: 'material_id é obrigatório' }, { status: 400 });
            }

            const { data: material, error: matError } = await supabaseAdmin
                .from('materiais')
                .select('id, nome')
                .eq('id', materialId)
                .single();
            if (matError || !material) {
                return NextResponse.json({ error: 'Material informado não existe' }, { status: 404 });
            }

            const { data: updated, error: updateError } = await supabaseAdmin
                .from('solicitacoes_materiais')
                .update({
                    status: 'aprovada',
                    material_aprovado_id: material.id,
                    resposta_admin: body.resposta_admin || `Vinculado ao material existente "${material.nome}".`,
                    aprovado_por: admin.id,
                    aprovado_em: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, material, solicitacao: updated });
        }

        if (action === 'reject') {
            const resposta_admin = body.resposta_admin ? String(body.resposta_admin).trim() : null;
            const { data: updated, error: updateError } = await supabaseAdmin
                .from('solicitacoes_materiais')
                .update({
                    status: 'recusada',
                    resposta_admin,
                    aprovado_por: admin.id,
                    aprovado_em: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
            return NextResponse.json({ success: true, solicitacao: updated });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API admin/material-requests PATCH:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
