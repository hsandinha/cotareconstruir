/**
 * API Route para Login
 * Implementa autenticação com Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/redis';
import { logLogin, logRateLimitExceeded } from '@/lib/auditLog';
import { sanitizeEmail, validateEmail } from '@/lib/validation';
import { formatErrorResponse, ValidationError, AuthenticationError } from '@/lib/errorHandler';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    try {
        // Rate limiting - proteção contra força bruta
        const identifier = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
        const rateLimitResult = await checkRateLimit(`login:${identifier}`, 5, 60); // 5 tentativas por minuto

        if (!rateLimitResult.success) {
            await logRateLimitExceeded(identifier, request);

            return NextResponse.json(
                {
                    error: 'Muitas tentativas de login. Tente novamente em 1 minuto.',
                    retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
                        'X-RateLimit-Limit': String(5),
                        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
                        'X-RateLimit-Reset': String(rateLimitResult.reset),
                    },
                }
            );
        }

        const body = await request.json();
        const { email, password } = body;

        // Validação de input
        if (!email || !password) {
            throw new ValidationError('Email e senha são obrigatórios');
        }

        // Sanitização e validação de email
        const sanitizedEmail = sanitizeEmail(email);
        if (!validateEmail(sanitizedEmail)) {
            throw new ValidationError('Email inválido');
        }

        // Criar cliente Supabase para autenticação
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Autenticação via Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: sanitizedEmail,
            password,
        });

        if (authError || !authData.user) {
            await logLogin('', sanitizedEmail, '', request, false, authError?.message);
            throw new AuthenticationError('Email ou senha incorretos');
        }

        const user = authData.user;

        // Buscar dados do usuário na tabela users
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            // Se não existe perfil, criar um básico
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    id: user.id,
                    email: user.email,
                    role: 'cliente',
                    roles: ['cliente'],
                    status: 'active',
                });

            if (insertError) {
                console.error('Erro ao criar perfil:', insertError);
            }
        }

        // Best effort: registrar último login
        try {
            await supabase
                .from('users')
                .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', user.id);
        } catch {
            // ignore
        }

        // Determinar role principal
        let primaryRole = 'cliente';
        const userRoles = userData?.roles || [userData?.role] || ['cliente'];

        if (userRoles.includes('admin')) {
            primaryRole = 'admin';
        } else if (userRoles.includes('fornecedor')) {
            primaryRole = 'fornecedor';
        }

        // Audit log de sucesso
        await logLogin(user.id, user.email || '', primaryRole, request, true);

        // Criar response
        const response = NextResponse.json({
            success: true,
            user: {
                uid: user.id,
                email: user.email,
                role: primaryRole,
                roles: userRoles,
                mustChangePassword: Boolean((userData as any)?.must_change_password),
            },
        });

        // Headers de rate limiting
        response.headers.append('X-RateLimit-Limit', String(5));
        response.headers.append('X-RateLimit-Remaining', String(rateLimitResult.remaining));
        response.headers.append('X-RateLimit-Reset', String(rateLimitResult.reset));

        return response;

    } catch (error: any) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}
