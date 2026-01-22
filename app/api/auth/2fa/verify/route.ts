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

async function handler(request: NextRequest) {
    try {
        const { userId, code } = await request.json();

        if (!userId || !code) {
            throw new ValidationError('User ID and verification code are required');
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
