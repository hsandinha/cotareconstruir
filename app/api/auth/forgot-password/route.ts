/**
 * API Route: Solicitar recuperação de senha
 * Usa Supabase Auth para enviar email de reset
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/redis';
import { sanitizeEmail, validateEmail } from '@/lib/validation';
import { formatErrorResponse, ValidationError } from '@/lib/errorHandler';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';
import { withCors } from '@/lib/cors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function handler(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            throw new ValidationError('Email é obrigatório');
        }

        const sanitizedEmail = sanitizeEmail(email);
        if (!validateEmail(sanitizedEmail)) {
            throw new ValidationError('Email inválido');
        }

        // Rate limiting por email - 3 tentativas por hora
        const rateLimitResult = await checkRateLimit(
            `forgot-password:${sanitizedEmail}`,
            3,
            3600 // 1 hora
        );

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Muitas solicitações. Tente novamente em 1 hora.' },
                { status: 429 }
            );
        }

        // Criar cliente Supabase
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Verificar se usuário existe (opcional - por segurança podemos ignorar)
        const { data: userData } = await supabase
            .from('users')
            .select('id, nome')
            .eq('email', sanitizedEmail)
            .single();

        // Mesmo se não existir, retornamos sucesso por segurança
        if (!userData) {
            return NextResponse.json({
                success: true,
                message: 'Se o email existir, você receberá um link de recuperação.',
            });
        }

        // Enviar email de reset via Supabase Auth
        const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
        });

        if (error) {
            console.error('Erro ao enviar email de reset:', error);
            // Não revelar erro específico por segurança
        }

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.PASSWORD_RESET,
            userId: userData.id,
            userEmail: sanitizedEmail,
            success: true,
            details: { method: 'supabase_auth' },
            ...metadata,
        });

        return NextResponse.json({
            success: true,
            message: 'Se o email existir, você receberá um link de recuperação.',
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
