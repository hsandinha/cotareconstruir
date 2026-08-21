/**
 * API Route: Admin — Depoimentos da página inicial.
 *
 * O upload do vídeo acontece no navegador, direto para o bucket `depoimentos`
 * (ver lib/depoimentos). Aqui ficam só os metadados: quem falou, a frase,
 * a ordem na vitrine e se está publicado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value
        || request.cookies.get('sb-access-token')?.value;

    if (!token) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) return null;

    return supabase;
}

const texto = (valor: unknown, max = 300): string | null => {
    const t = String(valor ?? '').trim();
    return t ? t.slice(0, max) : null;
};

export async function GET(request: NextRequest) {
    const supabase = await verifyAdmin(request);
    if (!supabase) {
        return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    // Aqui vem tudo, inclusive os despublicados
    const { data, error } = await supabase
        .from('depoimentos')
        .select('*')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[ADMIN DEPOIMENTOS] Erro ao listar:', error);
        return NextResponse.json({ error: 'Não foi possível carregar os depoimentos.' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
    const supabase = await verifyAdmin(request);
    if (!supabase) {
        return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'create');

    if (action === 'create' || action === 'update') {
        const nome = texto(body?.nome, 120);
        const videoUrl = texto(body?.videoUrl, 800);

        if (!nome) {
            return NextResponse.json({ error: 'Informe o nome de quem deu o depoimento.' }, { status: 400 });
        }
        if (!videoUrl) {
            return NextResponse.json({ error: 'Carregue o vídeo do depoimento.' }, { status: 400 });
        }

        const duracao = Number(body?.duracaoSegundos);
        const ordem = Number(body?.ordem);

        const payload = {
            nome,
            cargo: texto(body?.cargo, 120),
            empresa: texto(body?.empresa, 160),
            obra: texto(body?.obra, 160),
            citacao: texto(body?.citacao, 600),
            video_url: videoUrl,
            poster_url: texto(body?.posterUrl, 800),
            duracao_segundos: Number.isFinite(duracao) && duracao > 0 ? Math.round(duracao) : null,
            ordem: Number.isFinite(ordem) ? Math.round(ordem) : 0,
            ativo: body?.ativo !== false,
            updated_at: new Date().toISOString(),
        };

        if (action === 'update') {
            const id = String(body?.id || '');
            if (!id) return NextResponse.json({ error: 'Depoimento não informado.' }, { status: 400 });

            const { error } = await supabase.from('depoimentos').update(payload).eq('id', id);
            if (error) {
                console.error('[ADMIN DEPOIMENTOS] Erro ao atualizar:', error);
                return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        const { data, error } = await supabase.from('depoimentos').insert(payload).select('id').single();
        if (error) {
            console.error('[ADMIN DEPOIMENTOS] Erro ao criar:', error);
            return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 });
        }
        return NextResponse.json({ success: true, id: data?.id });
    }

    // Publica / despublica sem abrir o formulário
    if (action === 'toggle_ativo') {
        const id = String(body?.id || '');
        if (!id) return NextResponse.json({ error: 'Depoimento não informado.' }, { status: 400 });

        const { error } = await supabase
            .from('depoimentos')
            .update({ ativo: Boolean(body?.ativo), updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('[ADMIN DEPOIMENTOS] Erro ao publicar/despublicar:', error);
            return NextResponse.json({ error: 'Não foi possível alterar a publicação.' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    }

    // Reordena a vitrine inteira de uma vez
    if (action === 'reordenar') {
        const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
        if (ids.length === 0) {
            return NextResponse.json({ error: 'Ordem não informada.' }, { status: 400 });
        }

        const updates = ids.map((id, indice) =>
            supabase.from('depoimentos').update({ ordem: indice, updated_at: new Date().toISOString() }).eq('id', id)
        );
        const resultados = await Promise.all(updates);
        const falhou = resultados.find((r: any) => r.error);

        if (falhou) {
            console.error('[ADMIN DEPOIMENTOS] Erro ao reordenar:', (falhou as any).error);
            return NextResponse.json({ error: 'Não foi possível reordenar.' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
    const supabase = await verifyAdmin(request);
    if (!supabase) {
        return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Depoimento não informado.' }, { status: 400 });

    const { error } = await supabase.from('depoimentos').delete().eq('id', id);
    if (error) {
        console.error('[ADMIN DEPOIMENTOS] Erro ao excluir:', error);
        return NextResponse.json({ error: 'Não foi possível excluir.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
