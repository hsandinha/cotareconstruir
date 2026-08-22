/**
 * API: Verificar e confirmar ativação do 2FA
 * POST /api/auth/2fa/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { verify2FACode } from '@/lib/twoFactor';
import { formatErrorResponse, AuthenticationError, ValidationError } from '@/lib/errorHandler';
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

        const { code } = await request.json();
        const userId = autenticado.id;

        if (!code) {
            throw new ValidationError('Informe o código de verificação');
        }

        if (!supabaseAdmin) {
            throw new Error('Server configuration error');
        }

        // Buscar dados do usuário
        const { data: userData, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('email, two_factor_enabled, two_factor_secret')
            .eq('id', userId)
            .single();

        if (fetchError || !userData) {
            throw new AuthenticationError('User not found');
        }

        if (!userData.two_factor_secret) {
            throw new AuthenticationError('2FA not initialized');
        }

        // Verificar código
        const isValid = verify2FACode(userData.two_factor_secret, code);

        if (!isValid) {
            // Audit log - falha
            const metadata = extractRequestMetadata(request);
            await logAuditEvent({
                action: AuditAction.USER_UPDATED,
                userId,
                userEmail: userData.email,
                success: false,
                details: { action: '2fa_verification_failed' },
                ...metadata,
            });

            throw new ValidationError('Invalid verification code');
        }

        // Ativar 2FA
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                two_factor_enabled: true,
                two_factor_enrolled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (updateError) {
            throw new Error(`Failed to enable 2FA: ${updateError.message}`);
        }

        // Audit log - sucesso
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.USER_UPDATED,
            userId,
            userEmail: userData.email,
            success: true,
            details: { action: '2fa_enabled' },
            ...metadata,
        });

        return NextResponse.json({
            success: true,
            message: '2FA ativado com sucesso!',
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
