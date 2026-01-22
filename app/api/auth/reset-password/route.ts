/**
 * API Route: Redefinir senha
 * Valida token e atualiza senha
 * Migrado para Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAuth';
import { sendEmail, getPasswordChangedEmailTemplate } from '@/lib/emailService';
import { validatePassword } from '@/lib/validation';
import { formatErrorResponse, ValidationError, AuthenticationError } from '@/lib/errorHandler';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';
import crypto from 'crypto';
import { withCors } from '@/lib/cors';

async function handler(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, email, newPassword } = body;

        // Validações
        if (!token || !email || !newPassword) {
            throw new ValidationError('Token, email e nova senha são obrigatórios');
        }

        // Validar senha forte
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            throw new ValidationError(passwordValidation.errors.join(', '));
        }

        // Hash do token recebido
        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Buscar usuário pelo email
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, email, nome')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            throw new AuthenticationError('Token inválido ou expirado');
        }

        const userId = userData.id;

        // Verificar token de reset na tabela password_resets
        const { data: resetData, error: resetError } = await supabase
            .from('password_resets')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (resetError || !resetData) {
            throw new AuthenticationError('Token inválido ou expirado');
        }

        // Validações do token
        if (resetData.token_hash !== tokenHash) {
            throw new AuthenticationError('Token inválido');
        }

        if (resetData.used) {
            throw new AuthenticationError('Token já foi utilizado');
        }

        const expiresAt = new Date(resetData.expires_at);
        if (expiresAt < new Date()) {
            throw new AuthenticationError('Token expirado');
        }

        // Verificar se admin client está disponível
        if (!supabaseAdmin) {
            throw new Error('Admin client not available');
        }

        // Atualizar senha no Supabase Auth usando admin client
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword,
        });

        if (updateAuthError) {
            throw new Error('Erro ao atualizar senha');
        }

        // Atualizar status do usuário
        await supabaseAdmin
            .from('users')
            .update({
                status: 'active',
            })
            .eq('id', userId);

        // Marcar token como usado
        await supabase
            .from('password_resets')
            .update({
                used: true,
                used_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        // Enviar email de confirmação
        const emailTemplate = getPasswordChangedEmailTemplate(
            userData.nome || 'Usuário'
        );

        await sendEmail({
            to: email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
        });

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.PASSWORD_CHANGED,
            userId,
            userEmail: email,
            success: true,
            details: { method: 'reset_token' },
            ...metadata,
        });

        return NextResponse.json({
            success: true,
            message: 'Senha redefinida com sucesso. Faça login com a nova senha.',
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
