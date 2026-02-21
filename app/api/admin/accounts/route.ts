/**
 * API Route: Admin - Gerenciar Contas de Acesso de Fornecedores
 * POST - Criar conta de acesso (requer admin)
 * PUT  - Resetar senha (requer admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, getFornecedorRecadastroEmailTemplate } from '@/lib/emailService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Verificar se é admin
async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value
        || request.cookies.get('sb-access-token')?.value;

    if (!token) {
        return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        return null;
    }

    return { user, supabase };
}

// POST - Criar conta de acesso para fornecedor
export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (!auth) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });
        }
        const { supabase } = auth;

        const { email, entityType, entityId, entityName, whatsapp } = await request.json();

        if (!email || !entityType || !entityId) {
            return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
        }

        const defaultPassword = '123456';

        // 1. Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
        });

        if (authError) {
            if (authError.message.includes('already been registered')) {
                return NextResponse.json({ error: 'Este email já possui uma conta cadastrada' }, { status: 409 });
            }
            throw authError;
        }

        const userId = authData.user.id;

        // 2. Criar registro na tabela users
        const { error: userError } = await supabase
            .from('users')
            .insert({
                id: userId,
                email,
                nome: entityName || '',
                role: entityType,
                roles: [entityType],
                [entityType === 'cliente' ? 'cliente_id' : 'fornecedor_id']: entityId,
                status: 'pending',
                is_verified: false,
                must_change_password: true,
                password_changed_at: null,
                last_login_at: null,
            });

        if (userError) throw userError;

        // 3. Atualizar fornecedor/cliente com o userId
        const tableName = entityType === 'cliente' ? 'clientes' : 'fornecedores';
        const { error: entityError } = await supabase
            .from(tableName)
            .update({ user_id: userId })
            .eq('id', entityId);

        if (entityError) throw entityError;

        // 4. Log
        console.log(`✅ Conta criada: ${email} (${entityType}) -> userId: ${userId}`);

        // 5. Enviar email de recadastramento + credenciais (somente fornecedor)
        if (entityType === 'fornecedor') {
            const template = getFornecedorRecadastroEmailTemplate({
                recipientEmail: email,
                temporaryPassword: defaultPassword,
            });
            await sendEmail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            });
        }

        return NextResponse.json({ success: true, userId });

    } catch (error: any) {
        console.error('Erro ao criar conta:', error);
        return NextResponse.json({ error: error.message || 'Erro ao criar conta' }, { status: 500 });
    }
}

// PUT - Resetar senha
export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (!auth) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });
        }
        const { supabase } = auth;

        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId não fornecido' }, { status: 400 });
        }

        const defaultPassword = '123456';

        // 1. Resetar senha no Supabase Auth
        const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
            password: defaultPassword,
        });

        if (resetError) throw resetError;

        // 2. Marcar que deve trocar senha
        await supabase
            .from('users')
            .update({ status: 'pending', must_change_password: true, password_changed_at: null } as any)
            .eq('id', userId);

        // 3. Enviar email de recadastramento + credenciais (best effort)
        try {
            const { data: userRow } = await supabase
                .from('users')
                .select('email, role')
                .eq('id', userId)
                .single();

            if (userRow?.email && userRow?.role === 'fornecedor') {
                const template = getFornecedorRecadastroEmailTemplate({
                    recipientEmail: userRow.email,
                    temporaryPassword: defaultPassword,
                });
                await sendEmail({
                    to: userRow.email,
                    subject: template.subject,
                    html: template.html,
                    text: template.text,
                });
            }
        } catch {
            // ignore
        }

        console.log(`🔑 Senha resetada para userId: ${userId}`);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Erro ao resetar senha:', error);
        return NextResponse.json({ error: error.message || 'Erro ao resetar senha' }, { status: 500 });
    }
}
