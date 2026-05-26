import {
    SupplierApiError,
    assertUuid,
    parseNonNegativeInteger,
    parseNonNegativeNumber,
} from '@/lib/supplierApiErrors';

const QUOTE_VISIBLE_STATUSES = new Set(['enviada', 'respondida', 'fechada']);
const ORDER_STATUSES = new Set(['pendente', 'confirmado', 'em_preparacao', 'enviado', 'entregue', 'cancelado']);

function parseIsoDate(value: unknown, field: string) {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        throw new SupplierApiError(400, 'invalid_date', `${field} deve ser uma data ISO válida`);
    }
    return date.toISOString();
}

function normalizeAvailability(value: unknown) {
    const normalized = String(value || 'disponivel').trim();
    if (!['disponivel', 'sob_consulta', 'indisponivel'].includes(normalized)) {
        throw new SupplierApiError(400, 'invalid_availability', 'disponibilidade deve ser disponivel, sob_consulta ou indisponivel');
    }
    return normalized;
}

function normalizeOrderStatus(value: unknown) {
    const normalized = String(value || '').trim();
    if (!ORDER_STATUSES.has(normalized)) {
        throw new SupplierApiError(400, 'invalid_order_status', 'status do pedido inválido');
    }
    return normalized;
}

async function getInvitedQuoteIds(supabase: any, fornecedorId: string) {
    const { data, error } = await supabase
        .from('cotacao_convites')
        .select('cotacao_id, visualizado_em, notificado_em')
        .eq('fornecedor_id', fornecedorId);

    if (error) throw error;
    return data || [];
}

async function assertQuoteAccess(supabase: any, fornecedorId: string, cotacaoId: string) {
    const { data: invite, error: inviteError } = await supabase
        .from('cotacao_convites')
        .select('id, visualizado_em')
        .eq('fornecedor_id', fornecedorId)
        .eq('cotacao_id', cotacaoId)
        .maybeSingle();

    if (inviteError) throw inviteError;

    if (invite) {
        if (!invite.visualizado_em) {
            await supabase
                .from('cotacao_convites')
                .update({ visualizado_em: new Date().toISOString() })
                .eq('id', invite.id);
        }
        return true;
    }

    const { data: proposal, error: proposalError } = await supabase
        .from('propostas')
        .select('id')
        .eq('fornecedor_id', fornecedorId)
        .eq('cotacao_id', cotacaoId)
        .maybeSingle();

    if (proposalError) throw proposalError;
    if (proposal) return true;

    throw new SupplierApiError(404, 'quote_not_found', 'Cotação não encontrada para este fornecedor');
}

async function getQuoteItems(supabase: any, cotacaoId: string) {
    const { data, error } = await supabase
        .from('cotacao_itens')
        .select('*')
        .eq('cotacao_id', cotacaoId);

    if (error) throw error;
    return data || [];
}

async function getSupplierProposalByQuote(supabase: any, fornecedorId: string, cotacaoId: string) {
    const { data, error } = await supabase
        .from('propostas')
        .select('*, proposta_itens(*)')
        .eq('fornecedor_id', fornecedorId)
        .eq('cotacao_id', cotacaoId)
        .maybeSingle();

    if (error) throw error;
    return data || null;
}

export async function listSupplierQuotes(
    supabase: any,
    params: {
        fornecedorId: string;
        status?: string | null;
        updatedSince?: string | null;
        page: number;
        pageSize: number;
    }
) {
    const invites = await getInvitedQuoteIds(supabase, params.fornecedorId);
    const quoteIds = invites.map((invite: any) => invite.cotacao_id).filter(Boolean);

    if (quoteIds.length === 0) {
        return { data: [], page: params.page, page_size: params.pageSize, total: 0, total_pages: 0 };
    }

    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;

    let query = supabase
        .from('cotacoes')
        .select(`
            *,
            cotacao_itens (*),
            obra:obras (
                id,
                nome,
                bairro,
                cidade,
                estado,
                logradouro,
                numero,
                complemento,
                cep,
                horario_entrega,
                restricoes_entrega
            )
        `, { count: 'exact' })
        .in('id', quoteIds)
        .order('updated_at', { ascending: false })
        .range(start, end);

    if (params.status) {
        query = query.eq('status', params.status);
    } else {
        query = query.in('status', Array.from(QUOTE_VISIBLE_STATUSES));
    }

    if (params.updatedSince) query = query.gte('updated_at', params.updatedSince);

    const { data, error, count } = await query;
    if (error) throw error;

    const proposals = data?.length
        ? await supabase
            .from('propostas')
            .select('id, cotacao_id, status, valor_total, data_envio, updated_at')
            .eq('fornecedor_id', params.fornecedorId)
            .in('cotacao_id', data.map((row: any) => row.id))
        : { data: [] };

    if (proposals.error) throw proposals.error;

    const proposalByQuote = new Map((proposals.data || []).map((proposal: any) => [proposal.cotacao_id, proposal]));

    return {
        data: (data || []).map((quote: any) => ({
            ...quote,
            proposta: proposalByQuote.get(quote.id) || null,
        })),
        page: params.page,
        page_size: params.pageSize,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / params.pageSize),
    };
}

export async function getSupplierQuote(supabase: any, fornecedorId: string, cotacaoId: string) {
    await assertQuoteAccess(supabase, fornecedorId, cotacaoId);

    const { data, error } = await supabase
        .from('cotacoes')
        .select(`
            *,
            cotacao_itens (*),
            obra:obras (
                id,
                nome,
                bairro,
                cidade,
                estado,
                logradouro,
                numero,
                complemento,
                cep,
                horario_entrega,
                restricoes_entrega
            )
        `)
        .eq('id', cotacaoId)
        .maybeSingle();

    if (error) throw error;
    if (!data || !QUOTE_VISIBLE_STATUSES.has(String(data.status))) {
        throw new SupplierApiError(404, 'quote_not_found', 'Cotação não encontrada para este fornecedor');
    }

    const proposal = await getSupplierProposalByQuote(supabase, fornecedorId, cotacaoId);
    return { ...data, proposta: proposal };
}

export async function upsertSupplierProposal(
    supabase: any,
    params: {
        fornecedorId: string;
        cotacaoId: string;
        body: any;
        expectedProposalId?: string | null;
    }
) {
    await assertQuoteAccess(supabase, params.fornecedorId, params.cotacaoId);

    const { data: cotacao, error: quoteError } = await supabase
        .from('cotacoes')
        .select('id, status, user_id')
        .eq('id', params.cotacaoId)
        .maybeSingle();

    if (quoteError) throw quoteError;
    if (!cotacao) throw new SupplierApiError(404, 'quote_not_found', 'Cotação não encontrada');

    let canEditProposal = cotacao.status === 'enviada' || cotacao.status === 'respondida';
    let linkedPedido: any = null;

    if (!canEditProposal && cotacao.status === 'fechada') {
        const { data: pedidoData, error: pedidoError } = await supabase
            .from('pedidos')
            .select('id, status')
            .eq('cotacao_id', params.cotacaoId)
            .eq('fornecedor_id', params.fornecedorId)
            .maybeSingle();

        if (pedidoError) throw pedidoError;
        linkedPedido = pedidoData || null;
        canEditProposal = !!linkedPedido && ['pendente', 'confirmado'].includes(linkedPedido.status);
    }

    if (!canEditProposal) {
        throw new SupplierApiError(409, 'quote_closed', 'Esta cotação não aceita proposta neste estágio');
    }

    if (!Array.isArray(params.body?.itens) || params.body.itens.length === 0) {
        throw new SupplierApiError(400, 'empty_proposal_items', 'itens deve conter ao menos um item');
    }

    const cotacaoItens = await getQuoteItems(supabase, params.cotacaoId);
    const cotacaoItemById = new Map<string, any>(cotacaoItens.map((item: any) => [item.id, item]));

    const propostaItens = params.body.itens.map((item: any, index: number) => {
        const cotacaoItemId = assertUuid(item?.cotacao_item_id, `itens[${index}].cotacao_item_id`);
        const cotacaoItem = cotacaoItemById.get(cotacaoItemId);
        if (!cotacaoItem) {
            throw new SupplierApiError(400, 'invalid_quote_item', `itens[${index}].cotacao_item_id não pertence à cotação`);
        }

        const precoUnitario = parseNonNegativeNumber(item?.preco_unitario, `itens[${index}].preco_unitario`);
        const quantidade = item?.quantidade === undefined
            ? Number(cotacaoItem.quantidade || 0)
            : parseNonNegativeNumber(item.quantidade, `itens[${index}].quantidade`);
        const subtotal = Number((precoUnitario * quantidade).toFixed(2));
        const prazoDias = item?.prazo_dias === undefined || item?.prazo_dias === null
            ? null
            : parseNonNegativeInteger(item.prazo_dias, `itens[${index}].prazo_dias`);

        return {
            cotacao_item_id: cotacaoItemId,
            fornecedor_material_id: item?.fornecedor_material_id
                ? assertUuid(item.fornecedor_material_id, `itens[${index}].fornecedor_material_id`)
                : null,
            preco_unitario: precoUnitario,
            quantidade,
            subtotal,
            disponibilidade: normalizeAvailability(item?.disponibilidade),
            prazo_dias: prazoDias,
            observacao: item?.observacao ? String(item.observacao).trim() : null,
        };
    });

    const subtotal = propostaItens.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);
    const valorFrete = params.body?.valor_frete === undefined ? 0 : parseNonNegativeNumber(params.body.valor_frete, 'valor_frete');
    const impostos = params.body?.valor_impostos === undefined && params.body?.impostos === undefined
        ? 0
        : parseNonNegativeNumber(params.body?.valor_impostos ?? params.body?.impostos, 'valor_impostos');
    const valorTotal = Number((subtotal + valorFrete + impostos).toFixed(2));
    const prazoEntrega = params.body?.prazo_entrega === undefined || params.body?.prazo_entrega === null
        ? null
        : parseNonNegativeInteger(params.body.prazo_entrega, 'prazo_entrega');

    const dataValidade = parseIsoDate(params.body?.data_validade, 'data_validade');
    const existing = await getSupplierProposalByQuote(supabase, params.fornecedorId, params.cotacaoId);

    if (params.expectedProposalId && existing?.id !== params.expectedProposalId) {
        throw new SupplierApiError(404, 'proposal_not_found', 'Proposta não encontrada para esta cotação');
    }

    const propostaPayload = {
        cotacao_id: params.cotacaoId,
        fornecedor_id: params.fornecedorId,
        status: 'enviada',
        valor_total: valorTotal,
        valor_frete: valorFrete,
        impostos,
        prazo_entrega: prazoEntrega,
        condicoes_pagamento: params.body?.condicoes_pagamento ? String(params.body.condicoes_pagamento).trim() : null,
        observacoes: params.body?.observacoes ? String(params.body.observacoes).trim() : null,
        data_envio: new Date().toISOString(),
        data_validade: dataValidade,
        updated_at: new Date().toISOString(),
    };

    let proposta: any = null;
    if (existing) {
        const { data, error } = await supabase
            .from('propostas')
            .update(propostaPayload)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        proposta = data;

        const { error: deleteError } = await supabase
            .from('proposta_itens')
            .delete()
            .eq('proposta_id', existing.id);
        if (deleteError) throw deleteError;
    } else {
        const { data, error } = await supabase
            .from('propostas')
            .insert(propostaPayload)
            .select()
            .single();

        if (error) throw error;
        proposta = data;
    }

    const { data: insertedItems, error: itemsError } = await supabase
        .from('proposta_itens')
        .insert(propostaItens.map((item: any) => ({ ...item, proposta_id: proposta.id })))
        .select();

    if (itemsError) throw itemsError;

    await supabase
        .from('cotacoes')
        .update({ status: cotacao.status === 'enviada' ? 'respondida' : cotacao.status, updated_at: new Date().toISOString() })
        .eq('id', params.cotacaoId);

    if (cotacao.user_id) {
        const action = existing ? 'Proposta Atualizada' : 'Nova Proposta Recebida';
        await supabase
            .from('notificacoes')
            .insert({
                user_id: cotacao.user_id,
                titulo: action,
                mensagem: existing
                    ? 'Um fornecedor atualizou os valores da proposta.'
                    : 'Um fornecedor enviou uma proposta para sua cotação.',
                tipo: 'success',
                lida: false,
                link: `/dashboard/cliente?tab=pedidos&cotacaoId=${encodeURIComponent(params.cotacaoId)}`,
            });
    }

    if (linkedPedido && ['pendente', 'confirmado'].includes(linkedPedido.status)) {
        await supabase
            .from('pedidos')
            .update({
                valor_total: valorTotal,
                impostos,
                condicoes_pagamento: propostaPayload.condicoes_pagamento,
                updated_at: new Date().toISOString(),
            })
            .eq('id', linkedPedido.id);
    }

    return {
        data: {
            ...proposta,
            proposta_itens: insertedItems || [],
        },
        subtotal,
        valor_frete: valorFrete,
        impostos,
        valor_total: valorTotal,
    };
}

export async function listSupplierOrders(
    supabase: any,
    params: {
        fornecedorId: string;
        status?: string | null;
        updatedSince?: string | null;
        page: number;
        pageSize: number;
    }
) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;

    let query = supabase
        .from('pedidos')
        .select(`
            *,
            pedido_itens (*),
            cotacao:cotacoes (id, status, data_validade),
            obra:obras (
                id,
                nome,
                bairro,
                cidade,
                estado,
                logradouro,
                numero,
                complemento,
                cep,
                horario_entrega,
                restricoes_entrega
            )
        `, { count: 'exact' })
        .eq('fornecedor_id', params.fornecedorId)
        .order('created_at', { ascending: false })
        .range(start, end);

    if (params.status) query = query.eq('status', params.status);
    if (params.updatedSince) query = query.gte('updated_at', params.updatedSince);

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

export async function getSupplierOrder(supabase: any, fornecedorId: string, pedidoId: string) {
    const { data, error } = await supabase
        .from('pedidos')
        .select(`
            *,
            pedido_itens (*),
            cotacao:cotacoes (id, status, data_validade),
            obra:obras (
                id,
                nome,
                bairro,
                cidade,
                estado,
                logradouro,
                numero,
                complemento,
                cep,
                horario_entrega,
                restricoes_entrega
            )
        `)
        .eq('id', pedidoId)
        .eq('fornecedor_id', fornecedorId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new SupplierApiError(404, 'order_not_found', 'Pedido não encontrado para este fornecedor');
    return data;
}

export async function updateSupplierOrderStatus(
    supabase: any,
    params: {
        fornecedorId: string;
        pedidoId: string;
        status: string;
        observacoes?: string | null;
        trackingUrl?: string | null;
        trackingCode?: string | null;
        dataPrevisaoEntrega?: string | null;
    }
) {
    const pedido = await getSupplierOrder(supabase, params.fornecedorId, params.pedidoId);
    const status = normalizeOrderStatus(params.status);

    const summaryUpdate: Record<string, any> = {};
    if (params.trackingUrl) summaryUpdate.trackingUrl = params.trackingUrl;
    if (params.trackingCode) summaryUpdate.trackingCode = params.trackingCode;

    const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
    };

    if (params.observacoes !== undefined) updateData.observacoes = params.observacoes;
    if (params.dataPrevisaoEntrega) {
        const parsedDate = parseIsoDate(params.dataPrevisaoEntrega, 'data_previsao_entrega');
        updateData.data_previsao_entrega = parsedDate?.slice(0, 10);
    }
    if (status === 'confirmado') updateData.data_confirmacao = new Date().toISOString();
    if (status === 'entregue') updateData.data_entrega = new Date().toISOString();

    if (Object.keys(summaryUpdate).length > 0) {
        const currentEndereco = pedido?.endereco_entrega || {};
        updateData.endereco_entrega = {
            ...currentEndereco,
            summary: {
                ...(currentEndereco.summary || {}),
                ...summaryUpdate,
            },
        };
    }

    const { data, error } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', params.pedidoId)
        .eq('fornecedor_id', params.fornecedorId)
        .select()
        .single();

    if (error) throw error;

    if (pedido?.user_id) {
        await supabase
            .from('notificacoes')
            .insert({
                user_id: pedido.user_id,
                titulo: 'Status do pedido atualizado',
                mensagem: `O pedido #${pedido.numero || String(params.pedidoId).slice(0, 8)} foi atualizado para ${status}.`,
                tipo: status === 'entregue' ? 'success' : 'info',
                lida: false,
                link: `/dashboard/cliente?tab=pedidos&pedidoId=${encodeURIComponent(params.pedidoId)}`,
            });
    }

    return data;
}
