/**
 * Depoimentos ativos para a página inicial (público, sem autenticação).
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (!supabaseAdmin) {
        return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabaseAdmin
        .from('depoimentos')
        .select('id, nome, cargo, empresa, obra, citacao, video_url, poster_url, duracao_segundos, ordem')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        // A home não pode quebrar por causa da vitrine: devolve lista vazia
        console.error('[DEPOIMENTOS] Erro ao carregar:', error.message);
        return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: data || [] });
}
