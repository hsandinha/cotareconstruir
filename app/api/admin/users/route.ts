/**
 * API Route: Admin - Gerenciar Usuários
 * Cria e gerencia usuários (requer admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatErrorResponse, AuthenticationError, ValidationError } from '@/lib/errorHandler';
import { sendEmail, getFornecedorRecadastroEmailTemplate } from '@/lib/emailService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Verificar se é admin
async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value          // cookie setado pelo login page
        || request.cookies.get('sb-access-token')?.value; // fallback legado

    if (!token) {
        throw new AuthenticationError('Token não fornecido');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        throw new AuthenticationError('Token inválido');
    }

    // Verificar se é admin
    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        throw new AuthenticationError('Acesso negado. Apenas administradores.');
    }

    return user;
}

// POST - Criar usuário
export async function POST(request: NextRequest) {
    try {
        await verifyAdmin(request);

        const body = await request.json();
        const { email, password, nome, role = 'cliente', telefone } = body;
        const temporaryPassword = '123456';

        if (!email || !password) {
            throw new ValidationError('Email e senha são obrigatórios');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const initialPassword = role === 'fornecedor' ? temporaryPassword : password;

        // Criar usuário no Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: initialPassword,
            email_confirm: true,
        });

        if (authError || !authData.user) {
            throw new Error(authError?.message || 'Erro ao criar usuário');
        }

        // Criar perfil na tabela users
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id,
                email,
                nome,
                role,
                roles: [role],
                telefone,
                status: 'active',
                is_verified: true,
                must_change_password: true,
                password_changed_at: null,
                last_login_at: null,
            });

        if (profileError) {
            // Rollback: deletar usuário criado
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw new Error(profileError.message);
        }

        // Enviar email de recadastramento + credenciais (somente fornecedor)
        if (role === 'fornecedor') {
            const template = getFornecedorRecadastroEmailTemplate({
                recipientEmail: email,
                temporaryPassword,
            });
            await sendEmail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });
        }

        return NextResponse.json({
            success: true,
            user: {
                id: authData.user.id,
                email,
                nome,
                role,
            },
        });

    } catch (error: any) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}

// GET - Listar usuários
export async function GET(request: NextRequest) {
    try {
        await verifyAdmin(request);

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '0');
        const perPage = parseInt(searchParams.get('perPage') || '10');
        const role = searchParams.get('role');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let query = supabase
            .from('users')
            .select('*', { count: 'exact' });

        // Filtros
        if (role && role !== 'all') {
            query = query.contains('roles', [role]);
        }
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (search) {
            query = query.or(`email.ilike.%${search}%,nome.ilike.%${search}%`);
        }

        // Paginação
        query = query
            .order('created_at', { ascending: false })
            .range(page * perPage, (page + 1) * perPage - 1);

        const { data, count, error } = await query;

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            users: data,
            total: count,
            page,
            perPage,
        });

    } catch (error: any) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}

// DELETE - Deletar usuário
export async function DELETE(request: NextRequest) {
    try {
        await verifyAdmin(request);

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            throw new ValidationError('userId é obrigatório');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Deletar do Auth (cascade deleta da tabela users)
        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            message: 'Usuário deletado com sucesso',
        });

    } catch (error: any) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}

// PATCH - Atualizar usuário
export async function PATCH(request: NextRequest) {
    try {
        await verifyAdmin(request);

        const body = await request.json();
        const { userId, ...updates } = body;

        if (!userId) {
            throw new ValidationError('userId é obrigatório');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Se tem password, atualizar no Auth
        if (updates.password) {
            const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
                password: updates.password,
            });

            if (authError) {
                throw new Error(authError.message);
            }

            delete updates.password;

            // Ao alterar senha via admin, obrigar troca no próximo login
            updates.must_change_password = true;
            updates.password_changed_at = null;
        }

        // Atualizar perfil se houver outros campos
        if (Object.keys(updates).length > 0) {
            const { error: profileError } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId);

            if (profileError) {
                throw new Error(profileError.message);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Usuário atualizado com sucesso',
        });

    } catch (error: any) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}
