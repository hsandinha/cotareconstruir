/**
 * Valida o token do convite da fila de espera.
 *
 * Usado pela tela de cadastro para identificar o convidado e mostrar que a
 * vaga está reservada. Só devolve nome e e-mail do próprio convite — quem
 * não tem o token não descobre nada sobre a fila.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validarConvite } from '@/lib/lancamentoService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const token = new URL(request.url).searchParams.get('token') || '';

    if (!token || !supabaseAdmin) {
        return NextResponse.json({ valido: false });
    }

    const convite = await validarConvite(supabaseAdmin as any, token);
    if (!convite) {
        return NextResponse.json({ valido: false });
    }

    return NextResponse.json({
        valido: true,
        nome: convite.nome,
        email: convite.email,
        expiraEm: convite.expiraEm,
    });
}
