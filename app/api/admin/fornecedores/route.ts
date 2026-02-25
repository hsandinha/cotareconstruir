/**
 * API Route: Admin - Gerenciar Fornecedores
 * CRUD de fornecedores (requer admin) - Bypass RLS com service_role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getFornecedorRecadastroEmailTemplate } from '@/lib/emailService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function normalizeEmail(value?: string | null) {
    return (value || '').trim().toLowerCase();
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
            supabase.from('users').select('id, fornecedor_id, must_change_password, last_login_at'),
            supabase.from('fornecedor_grupo').select('fornecedor_id, grupo_id')
        ]);

        if (fornecedoresRes.error) throw fornecedoresRes.error;

        return NextResponse.json({
            fornecedores: fornecedoresRes.data || [],
            grupos: gruposRes.data || [],
            users: usersRes.data || [],
            fornecedorGrupos: fornecedorGruposRes.data || []
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

            const codigo = `F${Date.now().toString().slice(-6)}`;
            const { data: newFornecedor, error } = await supabase
                .from('fornecedores')
                .insert({
                    ...supabaseData,
                    codigo: supabaseData?.codigo || codigo,
                    codigo_grupo: supabaseData?.codigo_grupo ?? '',
                    grupo_insumos: supabaseData?.grupo_insumos ?? '',
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

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
            resend_access_on_email_change,
            ...updateData
        } = body as Record<string, any>;
        const resendAccessOnEmailChange = Boolean(resend_access_on_email_change);
        let emailLoginSynced = false;
        let accessCredentialsResent = false;
        let warning: string | null = null;

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        if (typeof updateData.email === 'string') {
            updateData.email = updateData.email.trim();
        }

        // Buscar estado atual para detectar troca de email e sincronizar login
        const { data: currentFornecedor, error: currentFornecedorError } = await supabase
            .from('fornecedores')
            .select('id, email, user_id')
            .eq('id', id)
            .single();

        if (currentFornecedorError) throw currentFornecedorError;

        const incomingEmail = typeof updateData.email === 'string' ? updateData.email : undefined;
        const emailChanged = incomingEmail !== undefined
            && normalizeEmail(incomingEmail) !== normalizeEmail(currentFornecedor?.email);

        if (emailChanged && incomingEmail) {
            // Validar conflito em fornecedores antes de sincronizar Auth
            const { data: fornecedorEmailConflict, error: fornecedorEmailConflictError } = await supabase
                .from('fornecedores')
                .select('id')
                .eq('email', incomingEmail)
                .neq('id', id)
                .maybeSingle();

            if (fornecedorEmailConflictError) throw fornecedorEmailConflictError;
            if (fornecedorEmailConflict) {
                return NextResponse.json({ error: 'Email já está em uso por outro fornecedor' }, { status: 409 });
            }

            // Resolver conta de acesso vinculada (preferir user_id da tabela fornecedores, fallback por users.fornecedor_id)
            let linkedUserId: string | null = currentFornecedor?.user_id || null;
            if (!linkedUserId) {
                const { data: linkedUser, error: linkedUserError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('fornecedor_id', id)
                    .maybeSingle();

                if (linkedUserError) throw linkedUserError;
                linkedUserId = linkedUser?.id || null;
            }

            if (linkedUserId) {
                // Validar conflito na tabela users
                const { data: userEmailConflict, error: userEmailConflictError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', incomingEmail)
                    .neq('id', linkedUserId)
                    .maybeSingle();

                if (userEmailConflictError) throw userEmailConflictError;
                if (userEmailConflict) {
                    return NextResponse.json({ error: 'Email já está em uso por outra conta de acesso' }, { status: 409 });
                }

                const defaultPassword = '123456';
                const authUpdatePayload: Record<string, any> = {
                    email: incomingEmail,
                    email_confirm: true,
                };
                if (resendAccessOnEmailChange) {
                    authUpdatePayload.password = defaultPassword;
                }

                // Atualizar email no Supabase Auth (login) e, opcionalmente, resetar senha
                const { error: authUpdateError } = await supabase.auth.admin.updateUserById(linkedUserId, authUpdatePayload);

                if (authUpdateError) {
                    if (authUpdateError.message?.includes('already been registered')) {
                        return NextResponse.json({ error: 'Email já está em uso no sistema de login' }, { status: 409 });
                    }
                    throw authUpdateError;
                }
                emailLoginSynced = true;

                // Atualizar espelho na tabela users
                const usersUpdateData: Record<string, any> = { email: incomingEmail };
                if (resendAccessOnEmailChange) {
                    usersUpdateData.status = 'pending';
                    usersUpdateData.must_change_password = true;
                    usersUpdateData.password_changed_at = null;
                }
                const { error: usersTableUpdateError } = await supabase
                    .from('users')
                    .update(usersUpdateData)
                    .eq('id', linkedUserId);

                if (usersTableUpdateError) throw usersTableUpdateError;

                if (resendAccessOnEmailChange) {
                    try {
                        const template = getFornecedorRecadastroEmailTemplate({
                            recipientEmail: incomingEmail,
                            temporaryPassword: defaultPassword,
                        });

                        await sendEmail({
                            to: incomingEmail,
                            subject: template.subject,
                            html: template.html,
                            text: template.text,
                        });

                        accessCredentialsResent = true;
                    } catch (emailError: any) {
                        warning = 'Email de login atualizado, mas houve falha ao enviar as novas credenciais para o novo email.';
                        console.error('Erro ao enviar credenciais após alteração de email do fornecedor:', emailError);
                    }
                }
            }
        }

        const { data, error } = await supabase
            .from('fornecedores')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            fornecedor: data,
            emailLoginSynced,
            accessCredentialsResent,
            warning,
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
