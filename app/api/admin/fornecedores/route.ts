/**
 * API Route: Admin - Gerenciar Fornecedores
 * CRUD de fornecedores (requer admin) - Bypass RLS com service_role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function isMalformedArrayLiteralError(error: any) {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('malformed array literal');
}

function splitTextList(value: string) {
    return value
        .split(/[,\n;]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function sanitizeFornecedorPayload(payload: Record<string, any>) {
    const next = { ...payload };

    if (typeof next.email === 'string') {
        next.email = next.email.trim();
    }

    // Evita erro em ambientes onde essas colunas podem estar como text[]
    for (const key of ['regioes_atendimento', 'grupo_insumos']) {
        if (typeof next[key] === 'string' && next[key].trim() === '') {
            next[key] = null;
        }
    }

    return next;
}

function convertFornecedorArrayishFieldsForRetry(payload: Record<string, any>) {
    const next = { ...payload };

    for (const key of ['regioes_atendimento', 'grupo_insumos']) {
        const value = next[key];
        if (typeof value === 'string') {
            const parsed = splitTextList(value);
            next[key] = parsed.length > 0 ? parsed : null;
        }
    }

    return next;
}

// Verificar se é admin
async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value          // cookie setado pelo login page
        || request.cookies.get('sb-access-token')?.value; // fallback legado

    if (!token) {
        return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return { user, supabase };
}

// GET - Listar fornecedores com dados relacionados
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const [fornecedoresRes, gruposRes, usersRes, fornecedorGruposRes] = await Promise.all([
            supabase.from('fornecedores').select('*'),
            supabase.from('grupos_insumo').select('*'),
            supabase.from('users').select('id, email, role, roles, fornecedor_id, must_change_password, last_login_at'),
            supabase.from('fornecedor_grupo').select('fornecedor_id, grupo_id')
        ]);

        let userFornecedorAccess: any[] = [];
        try {
            const { data, error } = await supabase
                .from('user_fornecedor_access')
                .select('user_id, fornecedor_id, is_primary');
            if (!error) {
                userFornecedorAccess = data || [];
            }
        } catch {
            // Tabela pode ainda não existir em ambientes sem migration aplicada
        }

        if (fornecedoresRes.error) throw fornecedoresRes.error;

        return NextResponse.json({
            fornecedores: fornecedoresRes.data || [],
            grupos: gruposRes.data || [],
            users: usersRes.data || [],
            fornecedorGrupos: fornecedorGruposRes.data || [],
            userFornecedorAccess,
        });
    } catch (error: any) {
        console.error('Erro ao carregar fornecedores:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

// POST - Criar fornecedor ou operações especiais
export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const { action } = body;

        if (action === 'create') {
            const { data: supabaseData } = body;
            const basePayload = sanitizeFornecedorPayload({
                ...supabaseData,
            });

            const codigo = `F${Date.now().toString().slice(-6)}`;
            const insertPayload = {
                ...basePayload,
                codigo: basePayload?.codigo || codigo,
                codigo_grupo: basePayload?.codigo_grupo ?? '',
                grupo_insumos: basePayload?.grupo_insumos ?? null,
                created_at: new Date().toISOString(),
            };

            let { data: newFornecedor, error } = await supabase
                .from('fornecedores')
                .insert(insertPayload)
                .select()
                .single();

            if (error && isMalformedArrayLiteralError(error)) {
                const retryPayload = convertFornecedorArrayishFieldsForRetry(insertPayload);
                const retry = await supabase
                    .from('fornecedores')
                    .insert(retryPayload)
                    .select()
                    .single();
                newFornecedor = retry.data;
                error = retry.error;
            }

            if (error) throw error;

            return NextResponse.json({ fornecedor: newFornecedor });
        }

        if (action === 'addGrupo') {
            const { fornecedor_id, grupo_id } = body;

            const { error } = await supabase
                .from('fornecedor_grupo')
                .insert({ fornecedor_id, grupo_id });

            if (error) throw error;

            await supabase
                .from('fornecedores')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', fornecedor_id);

            return NextResponse.json({ success: true });
        }

        if (action === 'removeGrupo') {
            const { fornecedor_id, grupo_id } = body;

            const { error } = await supabase
                .from('fornecedor_grupo')
                .delete()
                .eq('fornecedor_id', fornecedor_id)
                .eq('grupo_id', grupo_id);

            if (error) throw error;

            await supabase
                .from('fornecedores')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', fornecedor_id);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro no POST fornecedores:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

// PUT - Atualizar fornecedor
export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const {
            id,
            ...updateData
        } = body as Record<string, any>;

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        const sanitizedUpdateData = sanitizeFornecedorPayload(updateData);

        let { data, error } = await supabase
            .from('fornecedores')
            .update({
                ...sanitizedUpdateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error && isMalformedArrayLiteralError(error)) {
            const retryData = convertFornecedorArrayishFieldsForRetry(sanitizedUpdateData);
            const retry = await supabase
                .from('fornecedores')
                .update({
                    ...retryData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
            data = retry.data;
            error = retry.error;
        }

        if (error) throw error;

        return NextResponse.json({
            fornecedor: data,
            emailLoginSynced: false,
            accessCredentialsResent: false,
            warning: null,
        });
    } catch (error: any) {
        console.error('Erro ao atualizar fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

// DELETE - Excluir fornecedor
export async function DELETE(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        // Remover grupos associados primeiro
        await supabase
            .from('fornecedor_grupo')
            .delete()
            .eq('fornecedor_id', id);

        const { error } = await supabase
            .from('fornecedores')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Erro ao excluir fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}
