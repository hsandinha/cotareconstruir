/**
 * API: Desativar 2FA
 * POST /api/auth/2fa/disable
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { formatErrorResponse, AuthenticationError } from '@/lib/errorHandler';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';
import { withCors } from '@/lib/cors';

async function handler(request: NextRequest) {
    try {
        const { userId, password } = await request.json();

        if (!userId || !password) {
            throw new AuthenticationError('User ID and password are required');
        }

        if (!supabaseAdmin) {
            throw new Error('Server configuration error');
        }

        // TODO: Verificar senha antes de desativar
        // const isValidPassword = await verifyPassword(userId, password);
        // if (!isValidPassword) throw new AuthenticationError('Invalid password');

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
