import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Lista de fabricantes para qualquer usuário autenticado (o cadastro/admin
 * fica em /api/admin/manufacturers). Usada pelo cliente ao escolher o
 * fabricante de um material no carrinho de cotação.
 */

async function getAuthUser(req: NextRequest, supabase: any) {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        const supabaseAuthCookie = req.cookies
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
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token) return null;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

export async function GET(req: NextRequest) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const user = await getAuthUser(req, supabase);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Mesma dualidade de origem do /api/admin/manufacturers
        const { data: manufacturersRows, error: manufacturersError } = await supabase
            .from('manufacturers')
            .select('id, name')
            .order('name', { ascending: true })
            .limit(2000);

        if (!manufacturersError && (manufacturersRows || []).length > 0) {
            return NextResponse.json({
                data: (manufacturersRows || []).map((row: any) => ({ id: row.id, name: row.name || '' })),
            });
        }

        const { data: fabricantesRows } = await supabase
            .from('fabricantes')
            .select('id, nome')
            .order('nome', { ascending: true })
            .limit(2000);

        return NextResponse.json({
            data: (fabricantesRows || []).map((row: any) => ({ id: row.id, name: row.nome || '' })),
        });
    } catch (error: any) {
        console.error('Erro ao listar fabricantes:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
