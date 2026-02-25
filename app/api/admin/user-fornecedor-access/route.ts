import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupplierAccessOwnerUserId, listUserSupplierAccess, syncLegacySupplierPointersForUser } from '@/lib/supplierAccessServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value
        || request.cookies.get('sb-access-token')?.value;

    if (!token) {
        return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        return null;
    }

    return { user, supabase };
}

function uniqIds(values: unknown[]): string[] {
    return [...new Set(
        values
            .map((v) => String(v || '').trim())
            .filter(Boolean)
    )];
}

async function ensureFornecedorUser(supabase: any, userId: string) {
    const { data: userRow, error } = await supabase
        .from('users')
        .select('id, email, nome, role, roles')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    if (!userRow) {
        return { ok: false, response: NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 }) };
    }

    const isFornecedor = userRow.role === 'fornecedor' || userRow.roles?.includes('fornecedor');
    if (!isFornecedor) {
        return { ok: false, response: NextResponse.json({ error: 'Usuário não possui perfil de fornecedor' }, { status: 400 }) };
    }

    return { ok: true, userRow };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (!auth) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });
        }
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const userId = String(searchParams.get('userId') || '').trim();
        const search = String(searchParams.get('search') || '').trim();

        if (!userId) {
            return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
        }

        const userCheck = await ensureFornecedorUser(supabase, userId);
        if (!userCheck.ok) return userCheck.response;

        const linkedSuppliers = await listUserSupplierAccess(supabase, userId);
        const linkedIds = new Set(linkedSuppliers.map((s) => s.id));

        let query = supabase
            .from('fornecedores')
            .select('id, razao_social, nome_fantasia, cnpj, email, cidade, estado, ativo')
            .order('razao_social', { ascending: true })
            .limit(50);

        if (search) {
            query = query.or(
                `razao_social.ilike.%${search}%,nome_fantasia.ilike.%${search}%,cnpj.ilike.%${search}%,email.ilike.%${search}%`
            );
        }

        const { data: fornecedores, error: fornecedoresError } = await query;
        if (fornecedoresError) throw fornecedoresError;

        const availableSuppliersRaw = (fornecedores || []).filter((f: any) => !linkedIds.has(f.id));

        const availableSuppliers: any[] = [];
        for (const fornecedor of availableSuppliersRaw) {
            const ownerUserId = await getSupplierAccessOwnerUserId(supabase, fornecedor.id);
            if (ownerUserId && ownerUserId !== userId) {
                // Não exibir empresas já vinculadas a outro usuário nesta tela
                continue;
            }
            availableSuppliers.push({
                ...fornecedor,
                ownerUserId,
                reserved: Boolean(ownerUserId && ownerUserId !== userId),
            });
        }

        return NextResponse.json({
            success: true,
            user: userCheck.userRow,
            linkedSuppliers,
            availableSuppliers,
        });
    } catch (error: any) {
        console.error('Erro ao carregar vínculos usuário x fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (!auth) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });
        }
        const { supabase } = auth;

        const body = await request.json();
        const userId = String(body.userId || '').trim();
        const supplierIds = uniqIds(Array.isArray(body.supplierIds) ? body.supplierIds : []);
        const primarySupplierId = body.primarySupplierId ? String(body.primarySupplierId).trim() : null;

        if (!userId) {
            return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
        }

        const userCheck = await ensureFornecedorUser(supabase, userId);
        if (!userCheck.ok) return userCheck.response;

        if (supplierIds.length > 0 && !primarySupplierId) {
            return NextResponse.json({ error: 'primarySupplierId é obrigatório quando houver vínculos' }, { status: 400 });
        }

        if (primarySupplierId && !supplierIds.includes(primarySupplierId)) {
            return NextResponse.json({ error: 'Fornecedor primário deve estar na lista de vínculos' }, { status: 400 });
        }

        if (supplierIds.length > 0) {
            const { data: fornecedoresValidos, error: fornecedoresValidosError } = await supabase
                .from('fornecedores')
                .select('id')
                .in('id', supplierIds);
            if (fornecedoresValidosError) throw fornecedoresValidosError;

            const validIds = new Set((fornecedoresValidos || []).map((f: any) => f.id));
            const missing = supplierIds.filter((id) => !validIds.has(id));
            if (missing.length > 0) {
                return NextResponse.json({ error: 'Um ou mais fornecedores não existem' }, { status: 400 });
            }

            for (const supplierId of supplierIds) {
                const ownerUserId = await getSupplierAccessOwnerUserId(supabase, supplierId);
                if (ownerUserId && ownerUserId !== userId) {
                    return NextResponse.json(
                        { error: 'Um dos fornecedores já está vinculado a outro usuário', fornecedorId: supplierId },
                        { status: 409 }
                    );
                }
            }
        }

        const { data: currentLinks, error: currentLinksError } = await supabase
            .from('user_fornecedor_access')
            .select('fornecedor_id')
            .eq('user_id', userId);
        if (currentLinksError) throw currentLinksError;

        const currentIds = new Set((currentLinks || []).map((row: any) => row.fornecedor_id));
        const toRemove = [...currentIds].filter((id) => !supplierIds.includes(id));
        const toAdd = supplierIds.filter((id) => !currentIds.has(id));

        if (toRemove.length > 0) {
            const { error: removeError } = await supabase
                .from('user_fornecedor_access')
                .delete()
                .eq('user_id', userId)
                .in('fornecedor_id', toRemove);
            if (removeError) throw removeError;
        }

        if (supplierIds.length > 0) {
            const { error: resetPrimaryError } = await supabase
                .from('user_fornecedor_access')
                .update({ is_primary: false, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
            if (resetPrimaryError) throw resetPrimaryError;
        }

        if (toAdd.length > 0) {
            const insertPayload = toAdd.map((fornecedorId) => ({
                user_id: userId,
                fornecedor_id: fornecedorId,
                is_primary: false,
                created_by: auth.user.id,
            }));
            const { error: insertError } = await supabase
                .from('user_fornecedor_access')
                .insert(insertPayload);
            if (insertError) throw insertError;
        }

        if (primarySupplierId) {
            const { error: setPrimaryError } = await supabase
                .from('user_fornecedor_access')
                .update({ is_primary: true, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('fornecedor_id', primarySupplierId);
            if (setPrimaryError) throw setPrimaryError;
        }

        await syncLegacySupplierPointersForUser(supabase, userId);

        const linkedSuppliers = await listUserSupplierAccess(supabase, userId);
        return NextResponse.json({
            success: true,
            linkedSuppliers,
            primarySupplierId: linkedSuppliers.find((s) => s.isPrimary)?.id || null,
        });
    } catch (error: any) {
        console.error('Erro ao salvar vínculos usuário x fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}
