/**
 * Autenticação de admin para rotas de API.
 *
 * Mesma checagem que as rotas de /api/admin já faziam cada uma por conta
 * própria — o token pode vir no header, no cookie do Supabase ou nos cookies
 * legados que o login antigo ainda grava.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/** Procura o access token nas várias formas que o app usa para guardá-lo. */
export function extrairToken(req: NextRequest): string | undefined {
    const header = req.headers.get('authorization');
    if (header?.startsWith('Bearer ')) return header.slice(7);

    // Cookie do Supabase: sb-<ref>-auth-token, um JSON com [access, refresh]
    const cookieSupabase = req.cookies.getAll().find((c) => c.name.endsWith('-auth-token'))?.value;
    if (cookieSupabase) {
        try {
            const parsed = JSON.parse(cookieSupabase);
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
        } catch {
            // cookie em outro formato; segue para os legados
        }
    }

    return req.cookies.get('authToken')?.value
        || req.cookies.get('token')?.value
        || req.cookies.get('sb-access-token')?.value;
}

export type ResultadoAdmin =
    | { error: NextResponse }
    | { userId: string; nome: string | null };

/** Garante que quem chamou é admin. Devolve `error` pronto para retornar. */
export async function verificarAdmin(req: NextRequest): Promise<ResultadoAdmin> {
    const token = extrairToken(req);

    if (!token || !supabaseAdmin) {
        return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };
    }

    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('nome, role, roles')
        .eq('id', user.id)
        .single();

    const isAdmin = profile && (profile.role === 'admin' || profile.roles?.includes('admin'));
    if (!isAdmin) {
        return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) };
    }

    return { userId: user.id, nome: profile.nome ?? null };
}
