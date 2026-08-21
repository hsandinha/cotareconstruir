/**
 * Situação pública da turma de lançamento.
 *
 * A landing usa para mostrar quantas das 20 vagas de teste gratuito ainda
 * estão abertas. Só devolve contagem — nenhum dado de quem se cadastrou.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getStatusTurma, TURMA_PADRAO } from '@/lib/lancamentoService';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (!supabaseAdmin) {
        return NextResponse.json(TURMA_PADRAO);
    }

    const status = await getStatusTurma(supabaseAdmin as any);
    return NextResponse.json(status);
}
