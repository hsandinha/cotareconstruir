import { supabaseAdmin } from '@/lib/supabase';

export interface SupplierAccessSummary {
    id: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    cnpj: string | null;
    ativo: boolean;
    isPrimary: boolean;
}

type ResolveSupplierAccessSuccess = {
    ok: true;
    fornecedorId: string | null;
    suppliers: SupplierAccessSummary[];
    hasMultipleSuppliers: boolean;
    requiresSelection: boolean;
    defaultSupplierId: string | null;
};

type ResolveSupplierAccessError = {
    ok: false;
    status: number;
    error: string;
    code?: string;
};

export type ResolveSupplierAccessResult = ResolveSupplierAccessSuccess | ResolveSupplierAccessError;

function asSupplierSummary(row: any, isPrimary = false): SupplierAccessSummary | null {
    if (!row?.id) return null;
    return {
        id: String(row.id),
        razao_social: row.razao_social ?? null,
        nome_fantasia: row.nome_fantasia ?? null,
        cnpj: row.cnpj ?? null,
        ativo: typeof row.ativo === 'boolean'
            ? row.ativo
            : String(row.status || '').toLowerCase() !== 'suspended',
        isPrimary,
    };
}

function sortSuppliers(items: SupplierAccessSummary[]) {
    return [...items].sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        const aName = (a.razao_social || a.nome_fantasia || '').toLowerCase();
        const bName = (b.razao_social || b.nome_fantasia || '').toLowerCase();
        return aName.localeCompare(bName);
    });
}

export async function listUserSupplierAccess(supabase: any, userId: string): Promise<SupplierAccessSummary[]> {
    const byId = new Map<string, SupplierAccessSummary>();
    let legacyPrimaryId: string | null = null;

    // 1) New N:N table (best source)
    try {
        const { data: accessRows, error: accessError } = await supabase
            .from('user_fornecedor_access')
            .select(`
                fornecedor_id,
                is_primary,
                fornecedores:fornecedor_id (
                    id,
                    razao_social,
                    nome_fantasia,
                    cnpj,
                    ativo,
                    status
                )
            `)
            .eq('user_id', userId);

        if (!accessError && Array.isArray(accessRows)) {
            for (const row of accessRows) {
                const fornecedor = Array.isArray((row as any).fornecedores)
                    ? (row as any).fornecedores[0]
                    : (row as any).fornecedores;
                const summary = asSupplierSummary(fornecedor, Boolean((row as any).is_primary));
                if (!summary) continue;
                if (summary.isPrimary) legacyPrimaryId = summary.id;
                byId.set(summary.id, summary);
            }
        }
    } catch {
        // Table may not exist yet in some environments; fallback below
    }

    // 2) Legacy primary pointer in users
    try {
        const { data: userRow } = await supabase
            .from('users')
            .select('fornecedor_id')
            .eq('id', userId)
            .maybeSingle();
        legacyPrimaryId = userRow?.fornecedor_id || legacyPrimaryId;
    } catch {
        // ignore
    }

    // 3) Legacy direct links in fornecedores.user_id
    try {
        const { data: fornecedoresByUser } = await supabase
            .from('fornecedores')
            .select('id, razao_social, nome_fantasia, cnpj, ativo, status')
            .eq('user_id', userId);

        for (const row of (fornecedoresByUser || [])) {
            const summary = asSupplierSummary(row, false);
            if (!summary) continue;
            const prev = byId.get(summary.id);
            byId.set(summary.id, {
                ...summary,
                isPrimary: prev?.isPrimary || false,
            });
        }
    } catch {
        // ignore
    }

    // 4) Legacy supplier referenced in users.fornecedor_id (if not already loaded)
    if (legacyPrimaryId && !byId.has(legacyPrimaryId)) {
        try {
            const { data: fornecedor } = await supabase
                .from('fornecedores')
                .select('id, razao_social, nome_fantasia, cnpj, ativo, status')
                .eq('id', legacyPrimaryId)
                .maybeSingle();
            const summary = asSupplierSummary(fornecedor, true);
            if (summary) {
                byId.set(summary.id, summary);
            }
        } catch {
            // ignore
        }
    }

    let items = Array.from(byId.values());

    if (legacyPrimaryId) {
        items = items.map((item) => ({ ...item, isPrimary: item.id === legacyPrimaryId || item.isPrimary }));
    } else if (items.length === 1) {
        items = items.map((item) => ({ ...item, isPrimary: true }));
        legacyPrimaryId = items[0].id;
    }

    return sortSuppliers(items);
}

export async function resolveSupplierAccess(
    supabase: any,
    userId: string,
    requestedFornecedorId?: string | null
): Promise<ResolveSupplierAccessResult> {
    const suppliers = await listUserSupplierAccess(supabase, userId);
    const defaultSupplierId = suppliers.find((s) => s.isPrimary)?.id || suppliers[0]?.id || null;
    const hasMultipleSuppliers = suppliers.length > 1;

    if (requestedFornecedorId) {
        const requested = suppliers.find((s) => s.id === requestedFornecedorId);
        if (!requested) {
            return {
                ok: false,
                status: 403,
                error: 'Acesso negado',
            };
        }

        return {
            ok: true,
            fornecedorId: requested.id,
            suppliers,
            hasMultipleSuppliers,
            requiresSelection: false,
            defaultSupplierId,
        };
    }

    if (suppliers.length === 0) {
        return {
            ok: true,
            fornecedorId: null,
            suppliers,
            hasMultipleSuppliers: false,
            requiresSelection: false,
            defaultSupplierId: null,
        };
    }

    if (suppliers.length === 1) {
        return {
            ok: true,
            fornecedorId: suppliers[0].id,
            suppliers,
            hasMultipleSuppliers: false,
            requiresSelection: false,
            defaultSupplierId: suppliers[0].id,
        };
    }

    return {
        ok: false,
        status: 409,
        error: 'Seleção de empresa obrigatória',
        code: 'supplier_selection_required',
    };
}

export async function userHasSupplierAccess(supabase: any, userId: string, fornecedorId: string): Promise<boolean> {
    const suppliers = await listUserSupplierAccess(supabase, userId);
    return suppliers.some((s) => s.id === fornecedorId);
}

export async function syncLegacySupplierPointersForUser(supabase: any, userId: string) {
    const { data: accessRows, error: accessError } = await supabase
        .from('user_fornecedor_access')
        .select('fornecedor_id, is_primary, created_at')
        .eq('user_id', userId);

    if (accessError) throw accessError;

    const links = Array.isArray(accessRows) ? accessRows : [];
    const sorted = [...links].sort((a: any, b: any) => {
        if (Boolean(a.is_primary) !== Boolean(b.is_primary)) return a.is_primary ? -1 : 1;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });

    const primarySupplierId = sorted[0]?.fornecedor_id || null;
    const linkedSupplierIds = sorted.map((row: any) => row.fornecedor_id).filter(Boolean);

    const { error: userUpdateError } = await supabase
        .from('users')
        .update({ fornecedor_id: primarySupplierId, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (userUpdateError) throw userUpdateError;

    // Clear legacy direct links pointing to this user
    const { error: clearOwnedError } = await supabase
        .from('fornecedores')
        .update({ user_id: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    if (clearOwnedError) throw clearOwnedError;

    // Keep only the primary supplier with the legacy pointer
    if (primarySupplierId) {
        const { error: primaryUpdateError } = await supabase
            .from('fornecedores')
            .update({ user_id: userId, updated_at: new Date().toISOString() })
            .eq('id', primarySupplierId);
        if (primaryUpdateError) throw primaryUpdateError;
    }

    // Ensure secondary suppliers linked to same account stay null on legacy pointer
    const secondaryIds = linkedSupplierIds.filter((id: string) => id !== primarySupplierId);
    if (secondaryIds.length > 0) {
        const { error: secondaryUpdateError } = await supabase
            .from('fornecedores')
            .update({ user_id: null, updated_at: new Date().toISOString() })
            .in('id', secondaryIds);
        if (secondaryUpdateError) throw secondaryUpdateError;
    }

    return { primarySupplierId, linkedSupplierIds };
}

export async function upsertUserSupplierAccessLink(
    supabase: any,
    params: { userId: string; fornecedorId: string; isPrimary?: boolean; createdBy?: string | null }
) {
    const { userId, fornecedorId, isPrimary = false, createdBy = null } = params;

    const { data: existing, error: existingError } = await supabase
        .from('user_fornecedor_access')
        .select('id, is_primary')
        .eq('user_id', userId)
        .eq('fornecedor_id', fornecedorId)
        .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
        if (isPrimary && !existing.is_primary) {
            const { error: resetError } = await supabase
                .from('user_fornecedor_access')
                .update({ is_primary: false, updated_at: new Date().toISOString() })
                .eq('user_id', userId);
            if (resetError) throw resetError;

            const { error: promoteError } = await supabase
                .from('user_fornecedor_access')
                .update({ is_primary: true, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            if (promoteError) throw promoteError;
        }
        return { created: false, id: existing.id };
    }

    if (isPrimary) {
        const { error: resetError } = await supabase
            .from('user_fornecedor_access')
            .update({ is_primary: false, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        if (resetError) throw resetError;
    }

    const { data, error } = await supabase
        .from('user_fornecedor_access')
        .insert({
            user_id: userId,
            fornecedor_id: fornecedorId,
            is_primary: Boolean(isPrimary),
            created_by: createdBy,
        })
        .select('id')
        .single();

    if (error) throw error;
    return { created: true, id: data?.id };
}

export async function getSupplierAccessOwnerUserId(supabase: any, fornecedorId: string): Promise<string | null> {
    try {
        const { data: accessRow, error } = await supabase
            .from('user_fornecedor_access')
            .select('user_id')
            .eq('fornecedor_id', fornecedorId)
            .maybeSingle();
        if (!error && accessRow?.user_id) return accessRow.user_id;
    } catch {
        // ignore
    }

    // Legacy fallback
    const { data: fornecedor } = await supabase
        .from('fornecedores')
        .select('user_id')
        .eq('id', fornecedorId)
        .maybeSingle();
    return fornecedor?.user_id || null;
}

export function getServiceSupabaseOrThrow() {
    if (!supabaseAdmin) {
        throw new Error('Configuração do servidor incompleta');
    }
    return supabaseAdmin;
}

