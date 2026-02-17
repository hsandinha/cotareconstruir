import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        // Tentar cookies do Supabase (formato: sb-<ref>-auth-token)
        const allCookies = req.cookies.getAll();
        const supabaseAuthCookie = allCookies
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

    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function getFornecedorId(userId: string): Promise<string | null> {
    if (!supabaseAdmin) return null;

    const { data: fornecedorByUser } = await supabaseAdmin
        .from('fornecedores')
        .select('id')
        .eq('user_id', userId)
        .single();

    if (fornecedorByUser?.id) return fornecedorByUser.id;

    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('fornecedor_id')
        .eq('id', userId)
        .single();

    return userData?.fornecedor_id || null;
}

// POST: Create a proposal (proposta) for a cotação
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await req.json();
        const { action } = body;

        if (action === 'create') {
            const fornecedorId = await getFornecedorId(user.id);
            if (!fornecedorId) {
                return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
            }

            const {
                cotacao_id,
                valor_total,
                valor_frete,
                valor_impostos,
                prazo_entrega,
                condicoes_pagamento,
                observacoes,
                data_validade,
                itens
            } = body;

            const prazoEntregaValue = Number.isInteger(prazo_entrega) && prazo_entrega >= 0
                ? prazo_entrega
                : null;
            const impostosValue = parseFloat(valor_impostos) || 0;

            if (!cotacao_id || !itens || !Array.isArray(itens)) {
                return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
            }

            // Verify cotação exists and is open
            const { data: cotacao } = await supabaseAdmin
                .from('cotacoes')
                .select('id, status, user_id')
                .eq('id', cotacao_id)
                .single();

            if (!cotacao) {
                return NextResponse.json({ error: 'Cotação não encontrada' }, { status: 404 });
            }

            // Allow updates on open cotações OR won closed cotações while pedido is still negotiable
            let canEditProposal = cotacao.status === 'enviada' || cotacao.status === 'respondida';
            let linkedPedido: any = null;

            if (!canEditProposal && cotacao.status === 'fechada') {
                const { data: pedidoData } = await supabaseAdmin
                    .from('pedidos')
                    .select('id, status')
                    .eq('cotacao_id', cotacao_id)
                    .eq('fornecedor_id', fornecedorId)
                    .single();

                linkedPedido = pedidoData || null;
                canEditProposal = !!linkedPedido && ['pendente', 'confirmado'].includes(linkedPedido.status);
            }

            if (!canEditProposal) {
                return NextResponse.json({ error: 'Esta cotação/pedido não aceita mais atualização de proposta neste estágio' }, { status: 400 });
            }

            // Check if fornecedor already responded
            const { data: existing } = await supabaseAdmin
                .from('propostas')
                .select('id')
                .eq('cotacao_id', cotacao_id)
                .eq('fornecedor_id', fornecedorId)
                .limit(1);

            const propostaPayload = {
                cotacao_id,
                fornecedor_id: fornecedorId,
                status: 'enviada',
                valor_total: valor_total || 0,
                valor_frete: valor_frete || 0,
                impostos: impostosValue,
                prazo_entrega: prazoEntregaValue,
                condicoes_pagamento: condicoes_pagamento || null,
                observacoes: observacoes || null,
                data_envio: new Date().toISOString(),
                data_validade: data_validade || null
            };

            let proposta: any = null;
            let propostaError: any = null;

            // 1. Create or update proposta
            if (existing && existing.length > 0) {
                const existingId = existing[0].id;
                const updateRes = await supabaseAdmin
                    .from('propostas')
                    .update(propostaPayload)
                    .eq('id', existingId)
                    .select()
                    .single();

                proposta = updateRes.data;
                propostaError = updateRes.error;

                if (!propostaError) {
                    await supabaseAdmin
                        .from('proposta_itens')
                        .delete()
                        .eq('proposta_id', existingId);
                }
            } else {
                const insertRes = await supabaseAdmin
                    .from('propostas')
                    .insert(propostaPayload)
                    .select()
                    .single();

                proposta = insertRes.data;
                propostaError = insertRes.error;
            }

            if (propostaError) {
                console.error('Erro ao criar proposta:', propostaError);
                return NextResponse.json({ error: propostaError.message }, { status: 500 });
            }

            // 2. Create proposta_itens
            const propostaItens = itens.map((item: any) => ({
                proposta_id: proposta.id,
                cotacao_item_id: item.cotacao_item_id,
                preco_unitario: item.preco_unitario || 0,
                quantidade: item.quantidade,
                subtotal: item.subtotal || 0,
                disponibilidade: item.disponibilidade || 'indisponivel',
                prazo_dias: item.prazo_dias ?? -1,
                observacao: item.observacao || null
            }));

            const { error: itensError } = await supabaseAdmin
                .from('proposta_itens')
                .insert(propostaItens);

            if (itensError) {
                console.error('Erro ao criar proposta_itens:', itensError);
                if (!(existing && existing.length > 0)) {
                    await supabaseAdmin.from('propostas').delete().eq('id', proposta.id);
                }
                return NextResponse.json({ error: itensError.message }, { status: 500 });
            }

            // 2.1 If there's a linked won order still negotiable, sync pedido with updated negotiated values
            const shouldSyncPedido = linkedPedido && ['pendente', 'confirmado'].includes(linkedPedido.status);
            if (shouldSyncPedido) {
                const pedidoId = linkedPedido.id;

                const { data: cotacaoItens } = await supabaseAdmin
                    .from('cotacao_itens')
                    .select('id, nome')
                    .eq('cotacao_id', cotacao_id);

                const cotacaoItemNameById = new Map((cotacaoItens || []).map((ci: any) => [ci.id, ci.nome]));

                const { data: pedidoItens } = await supabaseAdmin
                    .from('pedido_itens')
                    .select('id, material_id, nome, unidade')
                    .eq('pedido_id', pedidoId);

                const itensByNome = new Map<string, any>();
                (itens || []).forEach((item: any) => {
                    const nome = cotacaoItemNameById.get(item.cotacao_item_id);
                    if (nome) {
                        itensByNome.set(nome, item);
                    }
                });

                const updates = (pedidoItens || []).map((pedidoItem: any) => {
                    const matched = itensByNome.get(pedidoItem.nome) as any;
                    if (!matched) return null;

                    return supabaseAdmin!
                        .from('pedido_itens')
                        .update({
                            preco_unitario: matched.preco_unitario || 0,
                            subtotal: matched.subtotal || 0,
                            quantidade: matched.quantidade || 0,
                            unidade: pedidoItem.unidade || 'UN'
                        })
                        .eq('id', pedidoItem.id);
                }).filter(Boolean);

                if (updates.length > 0) {
                    await Promise.all(updates as any);
                }

                const { data: refreshedItens } = await supabaseAdmin
                    .from('pedido_itens')
                    .select('subtotal')
                    .eq('pedido_id', pedidoId);

                const subtotal = (refreshedItens || []).reduce((sum: number, item: any) => sum + (parseFloat(item.subtotal) || 0), 0);
                const freight = parseFloat(valor_frete) || 0;
                const taxes = impostosValue;
                const totalPedido = subtotal + freight + taxes;

                const { data: pedidoAtual } = await supabaseAdmin
                    .from('pedidos')
                    .select('endereco_entrega')
                    .eq('id', pedidoId)
                    .single();

                const enderecoAtual = pedidoAtual?.endereco_entrega || {};
                const summaryAtual = enderecoAtual.summary || {};

                await supabaseAdmin
                    .from('pedidos')
                    .update({
                        valor_total: totalPedido,
                        impostos: taxes,
                        condicoes_pagamento: condicoes_pagamento || null,
                        endereco_entrega: {
                            ...enderecoAtual,
                            summary: {
                                ...summaryAtual,
                                subtotal,
                                freight,
                                taxes,
                                deliveryDays: prazoEntregaValue,
                                paymentMethod: condicoes_pagamento || null
                            }
                        },
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', pedidoId);
            }

            // 3. Create notification for the client
            if (cotacao.user_id) {
                // Get fornecedor name
                const { data: fornecedor } = await supabaseAdmin
                    .from('fornecedores')
                    .select('nome_fantasia, razao_social')
                    .eq('id', fornecedorId)
                    .single();

                const supplierName = fornecedor?.nome_fantasia || fornecedor?.razao_social || 'Um fornecedor';

                await supabaseAdmin
                    .from('notificacoes')
                    .insert({
                        user_id: cotacao.user_id,
                        titulo: existing && existing.length > 0 ? 'Proposta Atualizada' : 'Nova Proposta Recebida',
                        mensagem: existing && existing.length > 0
                            ? `${supplierName} atualizou os valores da proposta.`
                            : `${supplierName} enviou uma proposta para sua cotação.`,
                        tipo: 'success',
                        lida: false,
                        link: `/dashboard/cliente?tab=pedidos&cotacaoId=${encodeURIComponent(cotacao_id)}`
                    });
            }

            return NextResponse.json({ success: true, data: proposta });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API propostas:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
