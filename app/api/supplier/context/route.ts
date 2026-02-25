import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabaseOrThrow, listUserSupplierAccess } from '@/lib/supplierAccessServer';

async function getAuthUser(req: NextRequest) {
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
                // ignore
            }
        }
    }

    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    const supabase = getServiceSupabaseOrThrow();
    if (!token) return null;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const supabase = getServiceSupabaseOrThrow();
        const suppliers = await listUserSupplierAccess(supabase, user.id);
        const defaultSupplierId = suppliers.find((s) => s.isPrimary)?.id || suppliers[0]?.id || null;

        return NextResponse.json({
            suppliers: suppliers.map((s) => ({
                id: s.id,
                razao_social: s.razao_social,
                nome_fantasia: s.nome_fantasia,
                cnpj: s.cnpj,
                ativo: s.ativo,
                isPrimary: s.isPrimary,
            })),
            requiresSelection: suppliers.length > 1,
            hasMultipleSuppliers: suppliers.length > 1,
            defaultSupplierId,
        });
    } catch (error: any) {
        console.error('Erro ao carregar contexto de fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
    }
}

