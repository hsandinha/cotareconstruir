import {
    SupplierApiError,
    assertUuid,
    parseNonNegativeInteger,
} from '@/lib/supplierApiErrors';
import { upsertSupplierMaterials } from '@/lib/supplierMaterialsService';

const STOCK_MOVEMENT_TYPES = new Set([
    'entrada',
    'saida',
    'ajuste',
    'reserva',
    'baixa_reserva',
    'cancelamento_reserva',
]);

function normalizeStockMovementType(value: unknown) {
    const normalized = String(value || '').trim();
    if (!STOCK_MOVEMENT_TYPES.has(normalized)) {
        throw new SupplierApiError(
            400,
            'invalid_movement_type',
            'tipo deve ser entrada, saida, ajuste, reserva, baixa_reserva ou cancelamento_reserva'
        );
    }
    return normalized;
}

function calculateNewStock(currentStock: number, type: string, quantity: number) {
    if (type === 'entrada' || type === 'cancelamento_reserva') return currentStock + quantity;
    if (type === 'ajuste') return quantity;
    return currentStock - quantity;
}

export async function listSupplierStocks(
    supabase: any,
    params: {
        fornecedorId: string;
        ativo?: boolean | null;
        belowMinimum?: boolean | null;
        page: number;
        pageSize: number;
    }
) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;

    let query = supabase
        .from('fornecedor_materiais')
        .select(`
            id,
            fornecedor_id,
            material_id,
            preco,
            estoque,
            estoque_minimo,
            codigo_sku,
            ativo,
            updated_at,
            material:materiais (
                id,
                nome,
                unidade,
                descricao
            )
        `, { count: 'exact' })
        .eq('fornecedor_id', params.fornecedorId)
        .order('updated_at', { ascending: false })
        .range(start, end);

    if (typeof params.ativo === 'boolean') query = query.eq('ativo', params.ativo);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data || []).filter((row: any) => {
        if (params.belowMinimum !== true) return true;
        return Number(row.estoque || 0) <= Number(row.estoque_minimo || 0);
    });

    return {
        data: rows,
        page: params.page,
        page_size: params.pageSize,
        total: params.belowMinimum === true ? rows.length : (count || 0),
        total_pages: Math.ceil((params.belowMinimum === true ? rows.length : (count || 0)) / params.pageSize),
    };
}

export async function getSupplierStock(supabase: any, fornecedorId: string, materialId: string) {
    const { data, error } = await supabase
        .from('fornecedor_materiais')
        .select(`
            id,
            fornecedor_id,
            material_id,
            preco,
            estoque,
            estoque_minimo,
            codigo_sku,
            ativo,
            updated_at,
            material:materiais (
                id,
                nome,
                unidade,
                descricao
            )
        `)
        .eq('fornecedor_id', fornecedorId)
        .eq('material_id', materialId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new SupplierApiError(404, 'stock_not_found', 'Estoque não encontrado para este material');
    return data;
}

export async function updateSupplierStocks(
    supabase: any,
    params: {
        fornecedorId: string;
        items: any[];
        dryRun?: boolean;
    }
) {
    const items = params.items.map((item: any) => ({
        material_id: item?.material_id,
        estoque: item?.estoque,
        estoque_minimo: item?.estoque_minimo,
        ativo: item?.ativo,
    }));

    return upsertSupplierMaterials(supabase, {
        fornecedorId: params.fornecedorId,
        items,
        dryRun: Boolean(params.dryRun),
    });
}

export async function listSupplierStockMovements(
    supabase: any,
    params: {
        fornecedorId: string;
        materialId?: string | null;
        tipo?: string | null;
        createdSince?: string | null;
        page: number;
        pageSize: number;
    }
) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;

    let query = supabase
        .from('fornecedor_estoque_movimentacoes')
        .select('*', { count: 'exact' })
        .eq('fornecedor_id', params.fornecedorId)
        .order('created_at', { ascending: false })
        .range(start, end);

    if (params.materialId) query = query.eq('material_id', params.materialId);
    if (params.tipo) query = query.eq('tipo', normalizeStockMovementType(params.tipo));
    if (params.createdSince) query = query.gte('created_at', params.createdSince);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
        data: data || [],
        page: params.page,
        page_size: params.pageSize,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / params.pageSize),
    };
}

export async function createSupplierStockMovements(
    supabase: any,
    params: {
        fornecedorId: string;
        movements: any[];
        dryRun?: boolean;
    }
) {
    if (!Array.isArray(params.movements) || params.movements.length === 0) {
        throw new SupplierApiError(400, 'empty_movements', 'movements deve conter ao menos um item');
    }

    if (params.movements.length > 3000) {
        throw new SupplierApiError(413, 'too_many_movements', 'O limite é de 3000 movimentações por request');
    }

    const results: any[] = [];
    let acceptedCount = 0;
    let rejectedCount = 0;

    for (const [index, movement] of params.movements.entries()) {
        try {
            const materialId = assertUuid(movement?.material_id, 'material_id');
            const tipo = normalizeStockMovementType(movement?.tipo);
            const quantidade = parseNonNegativeInteger(movement?.quantidade, 'quantidade');
            const pedidoId = movement?.pedido_id ? assertUuid(movement.pedido_id, 'pedido_id') : null;

            const { data: fornecedorMaterial, error } = await supabase
                .from('fornecedor_materiais')
                .select('id, fornecedor_id, material_id, estoque')
                .eq('fornecedor_id', params.fornecedorId)
                .eq('material_id', materialId)
                .maybeSingle();

            if (error) throw error;
            if (!fornecedorMaterial) {
                throw new SupplierApiError(404, 'supplier_material_not_found', 'Material não cadastrado para este fornecedor');
            }

            const estoqueAnterior = Number(fornecedorMaterial.estoque || 0);
            const estoqueNovo = calculateNewStock(estoqueAnterior, tipo, quantidade);

            if (estoqueNovo < 0) {
                throw new SupplierApiError(400, 'insufficient_stock', 'Movimentação deixaria o estoque negativo');
            }

            if (!params.dryRun) {
                const { error: updateError } = await supabase
                    .from('fornecedor_materiais')
                    .update({ estoque: estoqueNovo, updated_at: new Date().toISOString() })
                    .eq('id', fornecedorMaterial.id);

                if (updateError) throw updateError;

                const { data: insertedMovement, error: insertError } = await supabase
                    .from('fornecedor_estoque_movimentacoes')
                    .insert({
                        fornecedor_id: params.fornecedorId,
                        fornecedor_material_id: fornecedorMaterial.id,
                        material_id: materialId,
                        pedido_id: pedidoId,
                        tipo,
                        quantidade,
                        estoque_anterior: estoqueAnterior,
                        estoque_atual: estoqueNovo,
                        referencia_externa: movement?.referencia ? String(movement.referencia).trim() : null,
                        observacao: movement?.observacao ? String(movement.observacao).trim() : null,
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                results.push({
                    index,
                    status: 'accepted',
                    material_id: materialId,
                    estoque_anterior: estoqueAnterior,
                    estoque_novo: estoqueNovo,
                    movimentacao: insertedMovement,
                });
            } else {
                results.push({
                    index,
                    status: 'accepted',
                    material_id: materialId,
                    estoque_anterior: estoqueAnterior,
                    estoque_novo: estoqueNovo,
                });
            }

            acceptedCount += 1;
        } catch (error: any) {
            rejectedCount += 1;
            results.push({
                index,
                status: 'rejected',
                code: error?.code || 'invalid_movement',
                error: error?.message || 'Movimentação inválida',
            });
        }
    }

    return {
        dry_run: Boolean(params.dryRun),
        accepted_count: acceptedCount,
        rejected_count: rejectedCount,
        results,
    };
}
