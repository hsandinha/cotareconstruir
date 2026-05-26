export const SUPPLIER_MATERIALS_BULK_LIMIT = 3000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupplierMaterialField =
    | 'preco'
    | 'preco_promocional'
    | 'estoque'
    | 'estoque_minimo'
    | 'marca'
    | 'fabricante_id'
    | 'codigo_sku'
    | 'descricao'
    | 'ativo';

export interface SupplierMaterialInput {
    material_id?: unknown;
    preco?: unknown;
    preco_promocional?: unknown;
    estoque?: unknown;
    estoque_minimo?: unknown;
    marca?: unknown;
    fabricante_id?: unknown;
    codigo_sku?: unknown;
    descricao?: unknown;
    ativo?: unknown;
}

interface NormalizedSupplierMaterial {
    original_index: number;
    material_id: string;
    values: Partial<Record<SupplierMaterialField, any>>;
}

export class SupplierMaterialsServiceError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = 'SupplierMaterialsServiceError';
        this.status = status;
        this.code = code;
    }
}

function hasOwn(object: any, key: string) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeSearch(value: string) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function parsePage(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: unknown, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function getSupplierGroupIds(supabase: any, fornecedorId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('fornecedor_grupo')
        .select('grupo_id')
        .eq('fornecedor_id', fornecedorId);

    if (error) throw error;
    return (data || []).map((row: any) => row.grupo_id).filter(Boolean);
}

async function getMaterialRows(supabase: any, materialIds: string[]) {
    const rows: any[] = [];
    for (const ids of chunk(materialIds, 1000)) {
        const { data, error } = await supabase
            .from('materiais')
            .select('id, nome, unidade, descricao')
            .in('id', ids);
        if (error) throw error;
        rows.push(...(data || []));
    }
    return rows;
}

function readNumber(
    raw: any,
    field: SupplierMaterialField,
    options: { integer?: boolean; nullable?: boolean } = {}
) {
    if (!hasOwn(raw, field)) return { ok: true, present: false };

    const value = raw[field];
    if (value === null && options.nullable) {
        return { ok: true, present: true, value: null };
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return { ok: false, present: true, error: `${field} deve ser um número maior ou igual a zero` };
    }

    if (options.integer && !Number.isInteger(parsed)) {
        return { ok: false, present: true, error: `${field} deve ser um número inteiro` };
    }

    return { ok: true, present: true, value: parsed };
}

function readText(raw: any, field: SupplierMaterialField, maxLength: number) {
    if (!hasOwn(raw, field)) return { ok: true, present: false };

    const value = raw[field];
    if (value === null) return { ok: true, present: true, value: null };

    if (typeof value !== 'string') {
        return { ok: false, present: true, error: `${field} deve ser texto` };
    }

    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
        return { ok: false, present: true, error: `${field} excede ${maxLength} caracteres` };
    }

    return { ok: true, present: true, value: trimmed || null };
}

function normalizeSupplierMaterial(raw: any, originalIndex: number): { value?: NormalizedSupplierMaterial; error?: string } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { error: 'Item deve ser um objeto' };
    }

    const materialId = typeof raw.material_id === 'string' ? raw.material_id.trim() : '';
    if (!materialId || !UUID_RE.test(materialId)) {
        return { error: 'material_id deve ser um UUID válido' };
    }

    const values: NormalizedSupplierMaterial['values'] = {};
    const numericFields: Array<[SupplierMaterialField, { integer?: boolean; nullable?: boolean }]> = [
        ['preco', {}],
        ['preco_promocional', { nullable: true }],
        ['estoque', { integer: true }],
        ['estoque_minimo', { integer: true }],
    ];

    for (const [field, options] of numericFields) {
        const parsed = readNumber(raw, field, options);
        if (!parsed.ok) return { error: parsed.error };
        if (parsed.present) values[field] = parsed.value;
    }

    const textFields: Array<[SupplierMaterialField, number]> = [
        ['marca', 180],
        ['codigo_sku', 180],
        ['descricao', 1000],
    ];

    for (const [field, maxLength] of textFields) {
        const parsed = readText(raw, field, maxLength);
        if (!parsed.ok) return { error: parsed.error };
        if (parsed.present) values[field] = parsed.value;
    }

    if (hasOwn(raw, 'fabricante_id')) {
        if (raw.fabricante_id === null || raw.fabricante_id === '') {
            values.fabricante_id = null;
        } else if (typeof raw.fabricante_id === 'string' && UUID_RE.test(raw.fabricante_id.trim())) {
            values.fabricante_id = raw.fabricante_id.trim();
        } else {
            return { error: 'fabricante_id deve ser um UUID válido ou null' };
        }
    }

    if (hasOwn(raw, 'ativo')) {
        if (typeof raw.ativo !== 'boolean') {
            return { error: 'ativo deve ser booleano' };
        }
        values.ativo = raw.ativo;
    }

    return {
        value: {
            original_index: originalIndex,
            material_id: materialId,
            values,
        },
    };
}

export async function listSupplierCatalogMaterials(
    supabase: any,
    params: {
        fornecedorId: string;
        q?: string | null;
        grupoId?: string | null;
        page?: number | string | null;
        pageSize?: number | string | null;
    }
) {
    const page = parsePage(params.page, 1);
    const pageSize = parsePageSize(params.pageSize, 100, 500);
    const supplierGroupIds = await getSupplierGroupIds(supabase, params.fornecedorId);

    if (supplierGroupIds.length === 0) {
        return { data: [], page, page_size: pageSize, total: 0, total_pages: 0 };
    }

    const requestedGrupoId = params.grupoId?.trim();
    const targetGroupIds = requestedGrupoId
        ? (supplierGroupIds.includes(requestedGrupoId) ? [requestedGrupoId] : [])
        : supplierGroupIds;

    if (targetGroupIds.length === 0) {
        return { data: [], page, page_size: pageSize, total: 0, total_pages: 0 };
    }

    const { data: links, error: linksError } = await supabase
        .from('material_grupo')
        .select('material_id, grupo_id, grupos_insumo:grupo_id(id, nome)')
        .in('grupo_id', targetGroupIds);

    if (linksError) throw linksError;

    const materialToGroups = new Map<string, Array<{ id: string; nome: string }>>();
    for (const link of (links || [])) {
        if (!link.material_id || !link.grupo_id) continue;
        const group = Array.isArray(link.grupos_insumo) ? link.grupos_insumo[0] : link.grupos_insumo;
        const current = materialToGroups.get(link.material_id) || [];
        current.push({ id: link.grupo_id, nome: group?.nome || link.grupo_id });
        materialToGroups.set(link.material_id, current);
    }

    const materialIds = Array.from(materialToGroups.keys());
    if (materialIds.length === 0) {
        return { data: [], page, page_size: pageSize, total: 0, total_pages: 0 };
    }

    const materials = await getMaterialRows(supabase, materialIds);
    const search = normalizeSearch(params.q || '');

    const rows = materials
        .filter((material: any) => {
            if (!search) return true;
            return normalizeSearch(`${material.nome} ${material.descricao || ''}`).includes(search);
        })
        .map((material: any) => {
            const groups = materialToGroups.get(material.id) || [];
            return {
                material_id: material.id,
                nome: material.nome,
                unidade: material.unidade,
                descricao: material.descricao,
                grupo_ids: groups.map((group) => group.id),
                grupo_nomes: groups.map((group) => group.nome),
            };
        })
        .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const data = rows.slice(start, start + pageSize);

    return {
        data,
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
    };
}

export async function listSupplierConfiguredMaterials(
    supabase: any,
    params: {
        fornecedorId: string;
        ativo?: boolean | null;
        updatedSince?: string | null;
        page?: number | string | null;
        pageSize?: number | string | null;
    }
) {
    const page = parsePage(params.page, 1);
    const pageSize = parsePageSize(params.pageSize, 100, 500);
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    let query = supabase
        .from('fornecedor_materiais')
        .select(`
            *,
            material:materiais(id, nome, unidade, descricao)
        `, { count: 'exact' })
        .eq('fornecedor_id', params.fornecedorId)
        .order('updated_at', { ascending: false })
        .range(start, end);

    if (typeof params.ativo === 'boolean') {
        query = query.eq('ativo', params.ativo);
    }

    if (params.updatedSince) {
        query = query.gte('updated_at', params.updatedSince);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
        data: data || [],
        page,
        page_size: pageSize,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / pageSize),
    };
}

export async function upsertSupplierMaterials(
    supabase: any,
    params: {
        fornecedorId: string;
        items: SupplierMaterialInput[];
        dryRun?: boolean;
    }
) {
    if (!Array.isArray(params.items) || params.items.length === 0) {
        throw new SupplierMaterialsServiceError(400, 'items_required', 'items é obrigatório');
    }

    if (params.items.length > SUPPLIER_MATERIALS_BULK_LIMIT) {
        throw new SupplierMaterialsServiceError(400, 'bulk_limit_exceeded', `Limite de ${SUPPLIER_MATERIALS_BULK_LIMIT} itens por importação`);
    }

    const rejected: Array<{ index: number; material_id?: string; status: 'rejected'; error: string; code: string }> = [];
    const byMaterialId = new Map<string, NormalizedSupplierMaterial>();
    let duplicateCount = 0;

    params.items.forEach((item, index) => {
        const normalized = normalizeSupplierMaterial(item, index);
        if (normalized.error || !normalized.value) {
            rejected.push({
                index,
                material_id: typeof item?.material_id === 'string' ? item.material_id : undefined,
                status: 'rejected',
                error: normalized.error || 'Item inválido',
                code: 'invalid_item',
            });
            return;
        }

        if (byMaterialId.has(normalized.value.material_id)) {
            duplicateCount += 1;
        }
        byMaterialId.set(normalized.value.material_id, normalized.value);
    });

    const normalizedItems = Array.from(byMaterialId.values());
    if (normalizedItems.length === 0) {
        return {
            success: false,
            dry_run: Boolean(params.dryRun),
            accepted_count: 0,
            rejected_count: rejected.length,
            deduplicated_count: duplicateCount,
            updated_count: 0,
            skipped_count: rejected.length,
            results: rejected,
            data: [],
        };
    }

    const materialIds = normalizedItems.map((item) => item.material_id);
    const supplierGroupIds = await getSupplierGroupIds(supabase, params.fornecedorId);
    const supplierGroupSet = new Set(supplierGroupIds);
    const materialRows = await getMaterialRows(supabase, materialIds);
    const existingMaterialIds = new Set(materialRows.map((row: any) => row.id));

    const { data: materialGroupRows, error: materialGroupError } = await supabase
        .from('material_grupo')
        .select('material_id, grupo_id')
        .in('material_id', materialIds);

    if (materialGroupError) throw materialGroupError;

    const materialGroups = new Map<string, Set<string>>();
    for (const row of (materialGroupRows || [])) {
        const current = materialGroups.get(row.material_id) || new Set<string>();
        current.add(row.grupo_id);
        materialGroups.set(row.material_id, current);
    }

    const allowedItems: NormalizedSupplierMaterial[] = [];
    for (const item of normalizedItems) {
        if (!existingMaterialIds.has(item.material_id)) {
            rejected.push({
                index: item.original_index,
                material_id: item.material_id,
                status: 'rejected',
                error: 'Material não encontrado',
                code: 'material_not_found',
            });
            continue;
        }

        const groups = materialGroups.get(item.material_id);
        const belongsToSupplierGroup = groups && Array.from(groups).some((groupId) => supplierGroupSet.has(groupId));
        if (!belongsToSupplierGroup) {
            rejected.push({
                index: item.original_index,
                material_id: item.material_id,
                status: 'rejected',
                error: 'Material não pertence aos grupos do fornecedor',
                code: 'material_not_allowed',
            });
            continue;
        }

        allowedItems.push(item);
    }

    const fabricanteIds = Array.from(new Set(
        allowedItems
            .map((item) => item.values.fabricante_id)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ));

    if (fabricanteIds.length > 0) {
        const { data: fabricanteRows, error: fabricanteError } = await supabase
            .from('fornecedor_fabricante')
            .select('fabricante_id')
            .eq('fornecedor_id', params.fornecedorId)
            .in('fabricante_id', fabricanteIds);

        if (fabricanteError) throw fabricanteError;
        const allowedFabricantes = new Set((fabricanteRows || []).map((row: any) => row.fabricante_id));

        for (let i = allowedItems.length - 1; i >= 0; i -= 1) {
            const fabricanteId = allowedItems[i].values.fabricante_id;
            if (typeof fabricanteId === 'string' && !allowedFabricantes.has(fabricanteId)) {
                const [item] = allowedItems.splice(i, 1);
                rejected.push({
                    index: item.original_index,
                    material_id: item.material_id,
                    status: 'rejected',
                    error: 'Fabricante não está vinculado ao fornecedor',
                    code: 'manufacturer_not_allowed',
                });
            }
        }
    }

    if (allowedItems.length === 0) {
        return {
            success: false,
            dry_run: Boolean(params.dryRun),
            accepted_count: 0,
            rejected_count: rejected.length,
            deduplicated_count: duplicateCount,
            updated_count: 0,
            skipped_count: rejected.length,
            results: rejected.sort((a, b) => a.index - b.index),
            data: [],
        };
    }

    const { data: existingRows, error: existingRowsError } = await supabase
        .from('fornecedor_materiais')
        .select('*')
        .eq('fornecedor_id', params.fornecedorId)
        .in('material_id', allowedItems.map((item) => item.material_id));

    if (existingRowsError) throw existingRowsError;

    const existingByMaterial = new Map((existingRows || []).map((row: any) => [row.material_id, row]));
    const nowIso = new Date().toISOString();

    const payload = allowedItems.map((item) => {
        const existing: any = existingByMaterial.get(item.material_id) || {};
        return {
            fornecedor_id: params.fornecedorId,
            material_id: item.material_id,
            preco: item.values.preco ?? existing.preco ?? 0,
            preco_promocional: hasOwn(item.values, 'preco_promocional') ? item.values.preco_promocional : (existing.preco_promocional ?? null),
            estoque: item.values.estoque ?? existing.estoque ?? 0,
            estoque_minimo: item.values.estoque_minimo ?? existing.estoque_minimo ?? 0,
            marca: hasOwn(item.values, 'marca') ? item.values.marca : (existing.marca ?? null),
            fabricante_id: hasOwn(item.values, 'fabricante_id') ? item.values.fabricante_id : (existing.fabricante_id ?? null),
            codigo_sku: hasOwn(item.values, 'codigo_sku') ? item.values.codigo_sku : (existing.codigo_sku ?? null),
            descricao: hasOwn(item.values, 'descricao') ? item.values.descricao : (existing.descricao ?? null),
            ativo: item.values.ativo ?? existing.ativo ?? true,
            updated_at: nowIso,
        };
    });

    const acceptedResults = allowedItems.map((item) => ({
        index: item.original_index,
        material_id: item.material_id,
        status: params.dryRun ? 'validated' : 'upserted',
        operation: existingByMaterial.has(item.material_id) ? 'update' : 'insert',
    }));

    if (params.dryRun) {
        return {
            success: rejected.length === 0,
            dry_run: true,
            accepted_count: payload.length,
            rejected_count: rejected.length,
            deduplicated_count: duplicateCount,
            updated_count: 0,
            skipped_count: rejected.length,
            results: [...acceptedResults, ...rejected].sort((a, b) => a.index - b.index),
            data: [],
        };
    }

    const { data, error } = await supabase
        .from('fornecedor_materiais')
        .upsert(payload, { onConflict: 'fornecedor_id,material_id' })
        .select();

    if (error) throw error;

    return {
        success: rejected.length === 0,
        dry_run: false,
        accepted_count: payload.length,
        rejected_count: rejected.length,
        deduplicated_count: duplicateCount,
        updated_count: data?.length || payload.length,
        skipped_count: rejected.length,
        results: [...acceptedResults, ...rejected].sort((a, b) => a.index - b.index),
        data: data || [],
    };
}
