/**
 * Diagnóstico de login.
 *
 * O Supabase devolve o mesmo "Invalid login credentials" para conta
 * inexistente, senha errada e conta criada só via Google (sem senha).
 * Esta rota é chamada apenas DEPOIS de uma tentativa de login falhar,
 * para que a tela mostre o motivo real em vez do erro genérico.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';
import { sanitizeEmail, validateEmail } from '@/lib/validation';

type AccountStatus =
    | 'not_found'        // e-mail não tem conta na plataforma
    | 'oauth_only'       // conta existe, mas só com login social (sem senha)
    | 'email_unconfirmed'// conta existe, e-mail ainda não confirmado
    | 'suspended'        // conta desativada pela administração
    | 'active';          // conta existe e aceita senha → senha digitada está errada

export async function POST(request: NextRequest) {
    try {
        const identifier = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
        const rateLimit = await checkRateLimit(`account-status:${identifier}`, 10, 60);
        if (!rateLimit.success) {
            return NextResponse.json({ status: 'active' as AccountStatus });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ status: 'active' as AccountStatus });
        }

        const body = await request.json();
        const email = sanitizeEmail(String(body?.email || ''));
        if (!email || !validateEmail(email)) {
            return NextResponse.json({ status: 'not_found' as AccountStatus });
        }

        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id, status')
            .eq('email', email)
            .maybeSingle();

        if (!profile?.id) {
            return NextResponse.json({ status: 'not_found' as AccountStatus });
        }

        if (profile.status === 'suspended') {
            return NextResponse.json({ status: 'suspended' as AccountStatus });
        }

        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        const user = authUser?.user;

        if (!user) {
            return NextResponse.json({ status: 'not_found' as AccountStatus });
        }

        if (!user.email_confirmed_at) {
            return NextResponse.json({ status: 'email_unconfirmed' as AccountStatus });
        }

        // Conta criada só por provedor social não tem senha cadastrada:
        // qualquer tentativa por senha falharia para sempre.
        const identities = Array.isArray(user.identities) ? user.identities : [];
        const providers = identities.map((identity: any) => String(identity?.provider || ''));
        const hasPasswordIdentity = providers.includes('email');

        if (providers.length > 0 && !hasPasswordIdentity) {
            const social = providers.find((p) => p && p !== 'email') || 'Google';
            return NextResponse.json({ status: 'oauth_only' as AccountStatus, provider: social });
        }

        return NextResponse.json({ status: 'active' as AccountStatus });
    } catch (error) {
        console.error('Erro em account-status:', error);
        // Em caso de falha, cai no comportamento antigo (mensagem genérica)
        return NextResponse.json({ status: 'active' as AccountStatus });
    }
}
