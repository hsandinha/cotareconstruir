/**
 * API: Desativar 2FA
 * POST /api/auth/2fa/disable
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { formatErrorResponse, AuthenticationError } from '@/lib/errorHandler';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';
import { withCors } from '@/lib/cors';

/**
 * Autenticação das rotas de 2FA.
 *
 * Estas rotas recebiam `userId` no corpo e agiam sobre QUALQUER usuário sem
 * exigir login — bastava conhecer o UUID da vítima para gerar (e receber) um
 * novo segredo 2FA no lugar dela. Agora o userId vem do token e o corpo é
 * ignorado para esse fim.
 */
async function usuarioAutenticado(request: NextRequest) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
        || request.cookies.get('token')?.value
        || request.cookies.get('sb-access-token')?.value;

    if (!token || !supabaseAdmin) return null;

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
}

async function handler(request: NextRequest) {
    try {
        const autenticado = await usuarioAutenticado(request);
        if (!autenticado) {
            throw new AuthenticationError('Autenticação necessária');
        }

        const { password } = await request.json();
        const userId = autenticado.id;

        if (!password) {
            throw new AuthenticationError('Informe a senha para desativar o 2FA');
        }

        if (!supabaseAdmin) {
            throw new Error('Server configuration error');
        }

        // Buscar e-mail do usuário para testar auth
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError || !userData?.user?.email) {
            throw new AuthenticationError('User not found');
        }

        // Tentar autenticar para verificar a senha (aqui usamos o supabase client normal, ou admin client)
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: userData.user.email,
            password: password,
        });

        if (signInError) {
            throw new AuthenticationError('Invalid password. Permissão negada.');
        }

        // Desativar 2FA
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                two_factor_enabled: false,
                two_factor_secret: null,
                two_factor_backup_codes: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (error) {
            throw new Error(`Failed to disable 2FA: ${error.message}`);
        }

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.USER_UPDATED,
            userId,
            success: true,
            details: { action: '2fa_disabled' },
            ...metadata,
        });

        return NextResponse.json({
            success: true,
            message: '2FA desativado com sucesso',
        });

    } catch (error) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}

export const POST = withCors(handler);
