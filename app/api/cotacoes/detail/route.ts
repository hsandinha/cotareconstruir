import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    if (!supabaseAdmin) return null;

    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    // Fallback 1: Supabase native auth cookie (sb-*-auth-token, JSON array)
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
            } catch { }
        }
    }

    // Fallback 2: Legacy cookies
    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

// Helper function to get next pedido numero
async function getNextPedidoNumero(): Promise<string> {
    if (!supabaseAdmin) return String(Date.now());

    try {
        // Try to use the sequence first
        const { data: seqData, error: seqError } = await supabaseAdmin
            .rpc('nextval', { sequence_name: 'pedido_numero_seq' });

        if (!seqError && seqData) {
            return String(seqData);
        }
    } catch (e) {
        console.warn('Sequence not available, using fallback');
    }

    // Fallback: Find max numero and increment
    const { data } = await supabaseAdmin
        .from('pedidos')
        .select('numero')
        .order('numero', { ascending: false })
        .limit(1);

    if (data && data.length > 0 && data[0].numero) {
        const maxNum = parseInt(data[0].numero, 10);
        if (!isNaN(maxNum)) {
            return String(maxNum + 1);
        }
    }

    // Ultimate fallback
    return '10001';
}

// GET: Load cotação detail with itens, propostas, pedidos (for client - bypasses RLS)
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const cotacaoId = searchParams.get('id');
        const action = searchParams.get('action') || 'detail';

        if (action === 'list') {
            // List all cotações for this user with proposal counts
            const { data, error } = await supabaseAdmin
                .from('cotacoes')
                .select('*, cotacao_itens(id)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao listar cotações:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            // Enrich with proposal count for each cotação
            const cotacaoIds = (data || []).map(c => c.id);
            let propostaCounts: Record<string, number> = {};

            if (cotacaoIds.length > 0) {
                // Fetch proposal counts grouped by cotacao_id
                const { data: propostasData } = await supabaseAdmin
                    .from('propostas')
                    .select('cotacao_id')
                    .in('cotacao_id', cotacaoIds);

                (propostasData || []).forEach(p => {
                    propostaCounts[p.cotacao_id] = (propostaCounts[p.cotacao_id] || 0) + 1;
                });
            }

            const enrichedData = (data || []).map(c => ({
                ...c,
                propostas_count: c.status === 'fechada'
                    ? (c.total_propostas_recebidas || propostaCounts[c.id] || 0)
                    : (propostaCounts[c.id] || 0)
            }));

            return NextResponse.json({ data: enrichedData });
        }

        if (action === 'list-obras') {
            // List all obras for this user (for OrderSection works map)
            const { data, error } = await supabaseAdmin
                .from('obras')
                .select('id, nome')
                .eq('user_id', user.id);

            if (error) {
                console.error('Erro ao listar obras:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ data: data || [] });
        }

        if (!cotacaoId) {
            return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
        }

        // 1. Fetch cotação with itens
        const { data: cotacao, error: cotacaoError } = await supabaseAdmin
            .from('cotacoes')
            .select('*, cotacao_itens(*)')
            .eq('id', cotacaoId)
            .eq('user_id', user.id)
            .single();

        if (cotacaoError || !cotacao) {
            return NextResponse.json({ error: 'Cotação não encontrada' }, { status: 404 });
        }

        // 2. Fetch propostas with itens and fornecedor data
        const { data: propostas, count: totalPropostas } = await supabaseAdmin
            .from('propostas')
            .select('*, proposta_itens(*)', { count: 'exact' })
            .eq('cotacao_id', cotacaoId)
            .order('valor_total', { ascending: true });

        // Enrich propostas with fornecedor data
        const fornecedorIds = [...new Set((propostas || []).map(p => p.fornecedor_id).filter(Boolean))];
        let fornecedorMap = new Map();

        if (fornecedorIds.length > 0) {
            const { data: fornecedores } = await supabaseAdmin
                .from('fornecedores')
                .select('id, razao_social, nome_fantasia, cnpj, email, telefone, user_id, logradouro, numero, bairro, cidade, estado')
                .in('id', fornecedorIds);

            fornecedorMap = new Map((fornecedores || []).map(f => [f.id, f]));
        }

        const enrichedPropostas = (propostas || []).map(p => ({
            ...p,
            fornecedor: fornecedorMap.get(p.fornecedor_id) || null
        }));

        // 3. If status is 'fechada', also fetch pedidos
        let pedidos: any[] = [];
        if (cotacao.status === 'fechada') {
            const { data: pedidosData } = await supabaseAdmin
                .from('pedidos')
                .select('*, pedido_itens(*)')
                .eq('cotacao_id', cotacaoId);

            const uniquePedidosBySupplier = new Map<string, any>();
            const pedidosSorted = [...(pedidosData || [])].sort((a: any, b: any) => {
                const aTime = new Date(a.created_at || 0).getTime();
                const bTime = new Date(b.created_at || 0).getTime();
                return bTime - aTime;
            });

            for (const pedido of pedidosSorted) {
                const key = String(pedido.fornecedor_id);
                if (!uniquePedidosBySupplier.has(key)) {
                    uniquePedidosBySupplier.set(key, pedido);
                }
            }

            const dedupedPedidosData = Array.from(uniquePedidosBySupplier.values());

            // Enrich pedidos with fornecedor data
            const pedidoFornecedorIds = [...new Set((dedupedPedidosData || []).map(p => p.fornecedor_id).filter(Boolean))];
            const missingIds = pedidoFornecedorIds.filter(id => !fornecedorMap.has(id));

            if (missingIds.length > 0) {
                const { data: moreFornecedores } = await supabaseAdmin
                    .from('fornecedores')
                    .select('id, razao_social, nome_fantasia, cnpj, email, telefone, logradouro, numero, bairro, cidade, estado')
                    .in('id', missingIds);

                (moreFornecedores || []).forEach(f => fornecedorMap.set(f.id, f));
            }

            pedidos = (dedupedPedidosData || []).map(p => ({
                ...p,
                fornecedor: fornecedorMap.get(p.fornecedor_id) || null
            }));
        }

        return NextResponse.json({
            cotacao,
            propostas: enrichedPropostas,
            pedidos,
            total_propostas: cotacao.status === 'fechada'
                ? (cotacao.total_propostas_recebidas || totalPropostas || 0)
                : (totalPropostas || 0)
        });
    } catch (error: any) {
        console.error('Erro na API cotacoes/detail:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

// POST: Finalize order - creates pedidos, updates propostas/cotacoes, sends notifications
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

        if (action === 'finalize-order') {
            const { cotacaoId, obraId, itemsBySupplier, proposals: proposalsData } = body;

            if (!cotacaoId || !itemsBySupplier) {
                return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
            }

            // Fetch client details
            const { data: clientData, error: clientError } = await supabaseAdmin
                .from('users')
                .select('nome, email, telefone, cpf_cnpj')
                .eq('id', user.id)
                .single();

            if (clientError) {
                return NextResponse.json({ error: 'Erro ao buscar dados do cliente' }, { status: 500 });
            }

            const clientDetails = {
                name: clientData?.nome || "Cliente",
                document: clientData?.cpf_cnpj || "",
                email: clientData?.email || "",
                phone: clientData?.telefone || ""
            };

            const { data: existingOrdersForCotacao, error: existingOrdersError } = await supabaseAdmin
                .from('pedidos')
                .select('id, fornecedor_id, proposta_id')
                .eq('cotacao_id', cotacaoId)
                .eq('user_id', user.id);

            if (existingOrdersError) {
                console.error('Erro ao verificar pedidos existentes:', existingOrdersError);
                return NextResponse.json({ error: 'Erro ao validar pedidos existentes' }, { status: 500 });
            }

            const existingOrderKeys = new Set(
                (existingOrdersForCotacao || []).map((order: any) => String(order.fornecedor_id))
            );

            const createdOrders: any[] = [];
            const selectedProposalIds = new Set<string>();
            const processedSupplierKeys = new Set<string>();

            // Buscar numero da cotação para usar no pedido (mesma rastreabilidade)
            const { data: cotacaoData } = await supabaseAdmin
                .from('cotacoes')
                .select('numero')
                .eq('id', cotacaoId)
                .single();
            const cotacaoNumero = cotacaoData?.numero || null;

            // Create orders for each supplier
            let supplierIndex = 0;
            for (const supplierGroup of itemsBySupplier) {
                const { supplierId, proposalId, supplierUserId, supplierName, supplierDetails, items, freightPrice, impostos, deliveryDays, paymentMethod } = supplierGroup;

                const supplierKey = String(supplierId);
                if (processedSupplierKeys.has(supplierKey)) {
                    continue;
                }
                processedSupplierKeys.add(supplierKey);

                if (existingOrderKeys.has(supplierKey)) {
                    continue;
                }

                if (proposalId) {
                    selectedProposalIds.add(proposalId);
                }

                const supplierSubtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
                const freightValue = parseFloat(freightPrice) || 0;
                const impostosValue = parseFloat(impostos) || 0;
                const deliveryDaysValue = Number.isInteger(deliveryDays) && deliveryDays >= 0
                    ? deliveryDays
                    : null;
                const paymentMethodValue = typeof paymentMethod === 'string' && paymentMethod.trim().length > 0
                    ? paymentMethod.trim()
                    : null;
                const supplierTotal = supplierSubtotal + freightValue + impostosValue;

                // Usar o mesmo numero da cotação para rastreabilidade
                // Se houver mais de um fornecedor, adiciona sufixo (.1, .2, etc.)
                const totalSuppliers = itemsBySupplier.filter((g: any) => !existingOrderKeys.has(String(g.supplierId)) && !processedSupplierKeys.has(String(g.supplierId))).length;
                let pedidoNumero: string;
                if (cotacaoNumero) {
                    pedidoNumero = totalSuppliers > 1 ? `${cotacaoNumero}.${supplierIndex + 1}` : cotacaoNumero;
                } else {
                    pedidoNumero = await getNextPedidoNumero();
                }
                supplierIndex++;

                // Create pedido
                const { data: orderData, error: orderError } = await supabaseAdmin
                    .from('pedidos')
                    .insert({
                        numero: pedidoNumero,
                        cotacao_id: cotacaoId,
                        proposta_id: proposalId,
                        user_id: user.id,
                        fornecedor_id: supplierId,
                        obra_id: obraId,
                        valor_total: supplierTotal,
                        impostos: impostosValue,
                        status: 'pendente',
                        endereco_entrega: {
                            clientDetails,
                            supplierDetails,
                            items,
                            summary: {
                                subtotal: supplierSubtotal,
                                freight: freightValue,
                                taxes: impostosValue,
                                deliveryDays: deliveryDaysValue,
                                paymentMethod: paymentMethodValue
                            }
                        },
                        observacoes: 'Pedido gerado via mapa comparativo'
                    })
                    .select()
                    .single();

                if (orderError) {
                    console.error('Error creating order:', orderError);
                    return NextResponse.json({
                        error: 'Erro ao criar pedido para o fornecedor selecionado',
                        details: orderError.message || null
                    }, { status: 500 });
                }

                createdOrders.push(orderData);

                // Create pedido_itens
                const orderItems = items.map((item: any) => ({
                    pedido_id: orderData.id,
                    nome: item.name,
                    quantidade: item.quantity,
                    unidade: item.unit,
                    preco_unitario: item.unitPrice,
                    subtotal: item.total
                }));

                const { error: itemsError } = await supabaseAdmin
                    .from('pedido_itens')
                    .insert(orderItems);

                if (itemsError) {
                    console.error('Error creating order items:', itemsError);
                }

                // Create notification for the supplier's user
                if (supplierUserId) {
                    await supabaseAdmin
                        .from('notificacoes')
                        .insert({
                            user_id: supplierUserId,
                            titulo: 'Novo Pedido Recebido!',
                            mensagem: 'Você recebeu um novo pedido de compra.',
                            tipo: 'success',
                            lida: false,
                            link: `/dashboard/fornecedor?tab=vendas-cotacoes&pedidoId=${encodeURIComponent(orderData.id)}&cotacaoId=${encodeURIComponent(cotacaoId)}`
                        });
                }
            }

            if (createdOrders.length === 0) {
                return NextResponse.json({ error: 'Nenhum pedido foi criado ao finalizar a cotação' }, { status: 500 });
            }

            // ========================================================
            // Fechar cotação: marcar propostas aceitas/recusadas e
            // armazenar total de propostas recebidas
            // ========================================================

            // 1. Contar total de propostas recebidas ANTES de deletar
            const { count: totalPropostasRecebidas } = await supabaseAdmin
                .from('propostas')
                .select('id', { count: 'exact', head: true })
                .eq('cotacao_id', cotacaoId);

            // 2. Buscar todas as propostas ordenadas por valor_total (as 3 melhores)
            const { data: allPropostas } = await supabaseAdmin
                .from('propostas')
                .select('id, valor_total')
                .eq('cotacao_id', cotacaoId)
                .order('valor_total', { ascending: true });

            const top3Ids = (allPropostas || []).slice(0, 3).map(p => p.id);
            const selectedIds = Array.from(selectedProposalIds);
            const rejectedIds = (allPropostas || [])
                .map((p: any) => p.id)
                .filter((id: string) => !selectedProposalIds.has(id));

            // 3. Marcar propostas selecionadas/recusadas
            if (selectedIds.length > 0) {
                const { error: acceptedError } = await supabaseAdmin
                    .from('propostas')
                    .update({ status: 'aceita' })
                    .eq('cotacao_id', cotacaoId)
                    .in('id', selectedIds);

                if (acceptedError) {
                    console.error('Erro ao marcar propostas aceitas:', acceptedError);
                    return NextResponse.json({ error: 'Erro ao marcar propostas selecionadas' }, { status: 500 });
                }
            }

            if (rejectedIds.length > 0) {
                const { error: rejectedError } = await supabaseAdmin
                    .from('propostas')
                    .update({ status: 'recusada' })
                    .eq('cotacao_id', cotacaoId)
                    .in('id', rejectedIds);

                if (rejectedError) {
                    console.error('Erro ao marcar propostas recusadas:', rejectedError);
                    return NextResponse.json({ error: 'Erro ao marcar propostas não selecionadas' }, { status: 500 });
                }
            }

            // 4. Atualizar cotação: status fechada + total de propostas recebidas
            let { error: quotationError } = await supabaseAdmin
                .from('cotacoes')
                .update({
                    status: 'fechada',
                    total_propostas_recebidas: totalPropostasRecebidas || 0
                })
                .eq('id', cotacaoId);

            if (quotationError) {
                const message = String(quotationError.message || '').toLowerCase();
                const details = String((quotationError as any).details || '').toLowerCase();
                const hint = String((quotationError as any).hint || '').toLowerCase();
                const missingTotalPropostasColumn =
                    quotationError.code === '42703'
                    || message.includes('total_propostas_recebidas')
                    || details.includes('total_propostas_recebidas')
                    || hint.includes('total_propostas_recebidas');

                if (missingTotalPropostasColumn) {
                    const fallback = await supabaseAdmin
                        .from('cotacoes')
                        .update({ status: 'fechada' })
                        .eq('id', cotacaoId);

                    quotationError = fallback.error;
                }
            }

            if (quotationError) {
                console.error('Error updating cotação:', quotationError);
                return NextResponse.json({
                    error: 'Erro ao fechar cotação',
                    details: quotationError.message || null
                }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                orders: createdOrders,
                total_propostas_recebidas: totalPropostasRecebidas || 0,
                propostas_mantidas: top3Ids.length,
                propostas_removidas: 0
            });
        }

        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro POST cotacoes/detail:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
