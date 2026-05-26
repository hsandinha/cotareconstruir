import { SupplierApiError, assertUuid, parseNonNegativeInteger, parseNonNegativeNumber } from '@/lib/supplierApiErrors';

function parseOfferType(value: unknown): 'valor' | 'percentual' {
    if (value === 'valor' || value === 'percentual') return value;
    throw new SupplierApiError(400, 'invalid_offer_type', 'tipo_oferta deve ser valor ou percentual');
}

function calculateOffer(precoOriginal: number, tipo: 'valor' | 'percentual', valor: number) {
    if (valor <= 0) {
        throw new SupplierApiError(400, 'invalid_offer_value', 'valor_oferta deve ser maior que zero');
    }

    const descontoPercentual = tipo === 'percentual'
        ? valor
        : (valor / precoOriginal) * 100;
    const precoFinal = tipo === 'percentual'
        ? precoOriginal * (1 - valor / 100)
        : precoOriginal - valor;

    if (precoOriginal <= 0) {
        throw new SupplierApiError(400, 'invalid_original_price', 'Material precisa ter preço base maior que zero');
    }

    if (precoFinal <= 0) {
        throw new SupplierApiError(400, 'invalid_final_price', 'O desconto não pode tornar o preço menor ou igual a zero');
    }

    return {
        preco_final: Number(precoFinal.toFixed(2)),
        desconto_percentual: Number(descontoPercentual.toFixed(2)),
    };
}

async function getFornecedorMaterialOrThrow(supabase: any, fornecedorId: string, materialId: string) {
    const { data, error } = await supabase
        .from('fornecedor_materiais')
        .select('*, material:materiais(id, nome, unidade)')
        .eq('fornecedor_id', fornecedorId)
        .eq('material_id', materialId)
        .maybeSingle();

    if (error) throw error;
    if (!data) {
        throw new SupplierApiError(404, 'supplier_material_not_found', 'Material não cadastrado para este fornecedor');
    }
    if (data.ativo === false) {
        throw new SupplierApiError(400, 'supplier_material_inactive', 'Material precisa estar ativo para criar oferta');
    }
    return data;
}

export async function listSupplierOffers(
    supabase: any,
    params: { fornecedorId: string; ativo?: boolean | null; page: number; pageSize: number }
) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;

    let query = supabase
        .from('ofertas')
        .select('*', { count: 'exact' })
        .eq('fornecedor_id', params.fornecedorId)
        .order('created_at', { ascending: false })
        .range(start, end);

    if (typeof params.ativo === 'boolean') {
        query = query.eq('ativo', params.ativo);
    }

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

export async function getSupplierOffer(supabase: any, fornecedorId: string, offerId: string) {
    const { data, error } = await supabase
        .from('ofertas')
        .select('*')
        .eq('id', offerId)
        .eq('fornecedor_id', fornecedorId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new SupplierApiError(404, 'offer_not_found', 'Oferta não encontrada');
    return data;
}

export async function createSupplierOffer(supabase: any, fornecedorId: string, body: any) {
    const materialId = assertUuid(body?.material_id, 'material_id');
    const tipoOferta = parseOfferType(body?.tipo_oferta);
    const valorOferta = parseNonNegativeNumber(body?.valor_oferta, 'valor_oferta');
    const quantidadeMinima = body?.quantidade_minima === undefined
        ? 1
        : parseNonNegativeInteger(body.quantidade_minima, 'quantidade_minima') || 1;
    const estoque = body?.estoque === undefined
        ? null
        : parseNonNegativeInteger(body.estoque, 'estoque');
    const dataInicio = body?.data_inicio ? new Date(String(body.data_inicio)) : new Date();
    const dataFim = body?.data_fim ? new Date(String(body.data_fim)) : null;

    if (Number.isNaN(dataInicio.getTime())) {
        throw new SupplierApiError(400, 'invalid_start_date', 'data_inicio deve ser uma data ISO válida');
    }
    if (dataFim && Number.isNaN(dataFim.getTime())) {
        throw new SupplierApiError(400, 'invalid_end_date', 'data_fim deve ser uma data ISO válida');
    }
    if (dataFim && dataFim.getTime() <= dataInicio.getTime()) {
        throw new SupplierApiError(400, 'invalid_date_range', 'data_fim deve ser maior que data_inicio');
    }

    const fornecedorMaterial = await getFornecedorMaterialOrThrow(supabase, fornecedorId, materialId);
    const precoOriginal = Number(fornecedorMaterial.preco || 0);
    const calculated = calculateOffer(precoOriginal, tipoOferta, valorOferta);
    const material = Array.isArray(fornecedorMaterial.material)
        ? fornecedorMaterial.material[0]
        : fornecedorMaterial.material;

    const payload = {
        fornecedor_id: fornecedorId,
        fornecedor_material_id: fornecedorMaterial.id,
        material_id: materialId,
        material_nome: material?.nome || body?.material_nome || 'Material',
        material_unidade: material?.unidade || body?.material_unidade || '',
        tipo_oferta: tipoOferta,
        valor_oferta: valorOferta,
        preco_original: precoOriginal,
        preco_final: calculated.preco_final,
        desconto_percentual: calculated.desconto_percentual,
        quantidade_minima: quantidadeMinima,
        estoque: estoque ?? fornecedorMaterial.estoque ?? 0,
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim ? dataFim.toISOString() : null,
        ativo: typeof body?.ativo === 'boolean' ? body.ativo : true,
    };

    const { data, error } = await supabase
        .from('ofertas')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateSupplierOffer(supabase: any, fornecedorId: string, offerId: string, body: any) {
    const existing = await getSupplierOffer(supabase, fornecedorId, offerId);
    const fornecedorMaterial = await getFornecedorMaterialOrThrow(supabase, fornecedorId, existing.material_id);

    const tipoOferta = body?.tipo_oferta === undefined ? existing.tipo_oferta : parseOfferType(body.tipo_oferta);
    const valorOferta = body?.valor_oferta === undefined
        ? Number(existing.valor_oferta)
        : parseNonNegativeNumber(body.valor_oferta, 'valor_oferta');
    const calculated = calculateOffer(Number(fornecedorMaterial.preco || existing.preco_original || 0), tipoOferta, valorOferta);

    const dataInicio = body?.data_inicio ? new Date(String(body.data_inicio)) : null;
    const dataFim = body?.data_fim === undefined
        ? (existing.data_fim ? new Date(existing.data_fim) : null)
        : (body.data_fim ? new Date(String(body.data_fim)) : null);

    if (dataInicio && Number.isNaN(dataInicio.getTime())) {
        throw new SupplierApiError(400, 'invalid_start_date', 'data_inicio deve ser uma data ISO válida');
    }
    if (dataFim && Number.isNaN(dataFim.getTime())) {
        throw new SupplierApiError(400, 'invalid_end_date', 'data_fim deve ser uma data ISO válida');
    }
    const effectiveStart = dataInicio || new Date(existing.data_inicio || Date.now());
    if (dataFim && dataFim.getTime() <= effectiveStart.getTime()) {
        throw new SupplierApiError(400, 'invalid_date_range', 'data_fim deve ser maior que data_inicio');
    }

    const payload: any = {
        tipo_oferta: tipoOferta,
        valor_oferta: valorOferta,
        preco_original: Number(fornecedorMaterial.preco || existing.preco_original || 0),
        preco_final: calculated.preco_final,
        desconto_percentual: calculated.desconto_percentual,
        updated_at: new Date().toISOString(),
    };

    if (body?.quantidade_minima !== undefined) {
        payload.quantidade_minima = parseNonNegativeInteger(body.quantidade_minima, 'quantidade_minima') || 1;
    }
    if (body?.estoque !== undefined) {
        payload.estoque = parseNonNegativeInteger(body.estoque, 'estoque');
    }
    if (dataInicio) payload.data_inicio = dataInicio.toISOString();
    if (body?.data_fim !== undefined) payload.data_fim = dataFim ? dataFim.toISOString() : null;
    if (typeof body?.ativo === 'boolean') payload.ativo = body.ativo;

    const { data, error } = await supabase
        .from('ofertas')
        .update(payload)
        .eq('id', offerId)
        .eq('fornecedor_id', fornecedorId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function setSupplierOfferStatus(supabase: any, fornecedorId: string, offerId: string, ativo: boolean) {
    await getSupplierOffer(supabase, fornecedorId, offerId);
    const { data, error } = await supabase
        .from('ofertas')
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq('id', offerId)
        .eq('fornecedor_id', fornecedorId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteSupplierOffer(supabase: any, fornecedorId: string, offerId: string) {
    await getSupplierOffer(supabase, fornecedorId, offerId);
    const { error } = await supabase
        .from('ofertas')
        .delete()
        .eq('id', offerId)
        .eq('fornecedor_id', fornecedorId);

    if (error) throw error;
    return { id: offerId };
}
