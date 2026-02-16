import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ManufacturersSource = 'manufacturers' | 'fabricantes';

function normalizeManufacturerRow(row: any, source: ManufacturersSource) {
    if (source === 'manufacturers') {
        return {
            id: row.id,
            name: row.name || '',
            category: row.category || '',
            contact: row.contact || '',
            status: row.status || 'Ativo',
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    return {
        id: row.id,
        name: row.nome || '',
        category: '',
        contact: row.website || '',
        status: 'Ativo',
        created_at: row.created_at,
        updated_at: row.created_at,
    };
}

async function tableHasRows(supabase: any, source: ManufacturersSource): Promise<boolean> {
    const query = supabase
        .from(source)
        .select('*')
        .limit(1);

    const { data, error } = source === 'manufacturers'
        ? await query.order('name', { ascending: true })
        : await query.order('nome', { ascending: true });

    if (error) return false;
    return (data || []).length > 0;
}

async function tableExists(supabase: any, source: ManufacturersSource): Promise<boolean> {
    const { error } = await supabase
        .from(source)
        .select('id', { count: 'exact', head: true });

    return !error;
}

async function detectManufacturersSource(supabase: any): Promise<ManufacturersSource> {
    const manufacturersExists = await tableExists(supabase, 'manufacturers');
    const fabricantesExists = await tableExists(supabase, 'fabricantes');

    if (manufacturersExists && await tableHasRows(supabase, 'manufacturers')) {
        return 'manufacturers';
    }

    if (fabricantesExists && await tableHasRows(supabase, 'fabricantes')) {
        return 'fabricantes';
    }

    if (manufacturersExists) return 'manufacturers';
    return 'fabricantes';
}

async function fetchAllRowsFromSource(supabase: any, source: ManufacturersSource) {
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;
    const rows: any[] = [];

    while (hasMore) {
        const to = from + pageSize - 1;
        const query = supabase
            .from(source)
            .select('*')
            .range(from, to);

        const { data, error } = source === 'manufacturers'
            ? await query.order('name', { ascending: true })
            : await query.order('nome', { ascending: true });

        if (error) {
            return { rows: [], error };
        }

        const currentRows = data || [];
        rows.push(...currentRows);

        if (currentRows.length < pageSize) {
            hasMore = false;
        } else {
            from += pageSize;
        }
    }

    return { rows, error: null };
}

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const supabaseAuthCookie = request.cookies
        .getAll()
        .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;

    let parsedSupabaseCookieToken: string | null = null;
    if (supabaseAuthCookie) {
        try {
            const parsed = JSON.parse(supabaseAuthCookie);
            if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                parsedSupabaseCookieToken = parsed[0];
            }
        } catch {
            parsedSupabaseCookieToken = null;
        }
    }

    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value
        || request.cookies.get('sb-access-token')?.value
        || parsedSupabaseCookieToken;

    if (!token) {
        return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return { user, supabase };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const { supabase } = auth;

        const manufacturersExists = await tableExists(supabase, 'manufacturers');
        const fabricantesExists = await tableExists(supabase, 'fabricantes');

        const manufacturersResult = manufacturersExists
            ? await fetchAllRowsFromSource(supabase, 'manufacturers')
            : { rows: [], error: null };

        const fabricantesResult = fabricantesExists
            ? await fetchAllRowsFromSource(supabase, 'fabricantes')
            : { rows: [], error: null };

        if (manufacturersResult.error && fabricantesResult.error) {
            throw manufacturersResult.error;
        }

        const normalizedFromManufacturers = manufacturersResult.rows
            .map((row) => normalizeManufacturerRow(row, 'manufacturers'));
        const normalizedFromFabricantes = fabricantesResult.rows
            .map((row) => normalizeManufacturerRow(row, 'fabricantes'));

        const merged = [...normalizedFromManufacturers, ...normalizedFromFabricantes];
        const deduped = Array.from(
            new Map(merged.map((item) => [
                `${(item.name || '').toLowerCase()}|${(item.contact || '').toLowerCase()}`,
                item,
            ])).values()
        );

        deduped.sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
        );

        return NextResponse.json({
            manufacturers: deduped,
            total: deduped.length,
            source: {
                manufacturers: normalizedFromManufacturers.length,
                fabricantes: normalizedFromFabricantes.length,
            },
        });
    } catch (error: any) {
        console.error('Erro ao buscar fabricantes:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const { supabase } = auth;
        const source = await detectManufacturersSource(supabase);
        const body = await request.json();
        const { name, category, contact, status } = body;

        if (!name || !String(name).trim()) {
            return NextResponse.json({ error: 'Nome do fabricante é obrigatório.' }, { status: 400 });
        }

        const payload = source === 'manufacturers'
            ? {
                name: String(name).trim(),
                category: category || null,
                contact: contact || null,
                status: status || 'Ativo',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }
            : {
                nome: String(name).trim(),
                website: contact || null,
                created_at: new Date().toISOString(),
            };

        const { data, error } = await supabase
            .from(source)
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;

        return NextResponse.json({ manufacturer: normalizeManufacturerRow(data, source), source });
    } catch (error: any) {
        console.error('Erro ao criar fabricante:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const { supabase } = auth;
        const source = await detectManufacturersSource(supabase);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
        }

        const { error } = await supabase
            .from(source)
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Erro ao excluir fabricante:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}
