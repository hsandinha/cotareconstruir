/**
 * API: Ativar 2FA para usuário
 * POST /api/auth/2fa/enable
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { generate2FASecret, generate2FAQRCode, generateBackupCodes } from '@/lib/twoFactor';
import { formatErrorResponse, AuthenticationError } from '@/lib/errorHandler';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';
import { withCors } from '@/lib/cors';

async function handler(request: NextRequest) {
    try {
        const { userId, email } = await request.json();

        if (!userId || !email) {
            throw new AuthenticationError('User ID and email are required');
        }

        if (!supabaseAdmin) {
            throw new Error('Server configuration error');
        }

        // Gerar segredo 2FA
        const { secret, otpauthUrl } = generate2FASecret(email);

        // Gerar QR Code
        const qrCodeDataUrl = await generate2FAQRCode(otpauthUrl!);

        // Gerar códigos de backup
        const backupCodes = generateBackupCodes(10);

        // Salvar no Supabase (ainda não ativado)
        const { error } = await supabaseAdmin
            .from('users')
            .update({
                two_factor_enabled: false, // Só ativa após verificar código
                two_factor_secret: secret,
                two_factor_backup_codes: backupCodes,
                two_factor_enrolled_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

        if (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.USER_UPDATED,
            userId,
            userEmail: email,
            success: true,
            details: { action: '2fa_setup_initiated' },
            ...metadata,
        });

        return NextResponse.json({
            success: true,
            qrCode: qrCodeDataUrl,
            backupCodes, // Exibir uma única vez
            message: 'Escaneie o QR Code com seu app autenticador',
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
