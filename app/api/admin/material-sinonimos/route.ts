import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * CRUD (admin) da tabela material_sinonimos.
 * Cada linha é um grupo de termos equivalentes (ex.: ['bacia', 'vaso sanitário'])
 * usado para expandir a busca de materiais.
 */

async function verifyAdmin(request: NextRequest) {
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        const supabaseAuthCookie = request.cookies
            .getAll()
            .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;
        if (supabaseAuthCookie) {
            try {
                const parsed = JSON.parse(supabaseAuthCookie);
                if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                    token = parsed[0];
                }
            } catch {
                // Ignorar erro de parse
            }
        }
    }

    if (!token) {
        token = request.cookies.get('authToken')?.value
            || request.cookies.get('token')?.value
            || request.cookies.get('sb-access-token')?.value;
    }

    if (!token) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return { supabase, user };
}

function parseTermos(input: unknown): string[] | null {
    if (!Array.isArray(input)) return null;
    const termos = input
        .map((t) => String(t || '').trim())
        .filter(Boolean);
    const unique = Array.from(new Set(termos.map((t) => t.toLowerCase())))
        .map((lower) => termos.find((t) => t.toLowerCase() === lower)!);
    return unique.length >= 2 ? unique : null;
}

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const { data, error } = await auth.supabase
            .from('material_sinonimos')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ data: data || [] });
    } catch (error: any) {
        console.error('Erro ao listar sinônimos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const body = await request.json();
        const termos = parseTermos(body?.termos);
        if (!termos) {
            return NextResponse.json({ error: 'Informe pelo menos 2 termos equivalentes.' }, { status: 400 });
        }

        const { data, error } = await auth.supabase
            .from('material_sinonimos')
            .insert({ termos })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Erro ao criar sinônimos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const body = await request.json();
        const id = String(body?.id || '').trim();
        const termos = parseTermos(body?.termos);
        if (!id || !termos) {
            return NextResponse.json({ error: 'Informe o id e pelo menos 2 termos equivalentes.' }, { status: 400 });
        }

        const { data, error } = await auth.supabase
            .from('material_sinonimos')
            .update({ termos, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Erro ao atualizar sinônimos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const id = new URL(request.url).searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Informe o id.' }, { status: 400 });
        }

        const { error } = await auth.supabase
            .from('material_sinonimos')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Erro ao excluir sinônimos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
