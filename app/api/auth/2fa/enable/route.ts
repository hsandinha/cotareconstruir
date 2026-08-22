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

        // Só o próprio dono da conta ativa o 2FA dela
        const userId = autenticado.id;
        const email = autenticado.email || '';
        if (!email) {
            throw new AuthenticationError('Conta sem e-mail cadastrado');
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
