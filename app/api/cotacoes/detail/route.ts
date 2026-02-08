import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
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
            // List all cotações for this user
            const { data, error } = await supabaseAdmin
                .from('cotacoes')
                .select('*, cotacao_itens(id)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao listar cotações:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ data: data || [] });
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
        const { data: propostas } = await supabaseAdmin
            .from('propostas')
            .select('*, proposta_itens(*)')
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

            // Enrich pedidos with fornecedor data
            const pedidoFornecedorIds = [...new Set((pedidosData || []).map(p => p.fornecedor_id).filter(Boolean))];
            const missingIds = pedidoFornecedorIds.filter(id => !fornecedorMap.has(id));

            if (missingIds.length > 0) {
                const { data: moreFornecedores } = await supabaseAdmin
                    .from('fornecedores')
                    .select('id, razao_social, nome_fantasia, cnpj, email, telefone, logradouro, numero, bairro, cidade, estado')
                    .in('id', missingIds);

                (moreFornecedores || []).forEach(f => fornecedorMap.set(f.id, f));
            }

            pedidos = (pedidosData || []).map(p => ({
                ...p,
                fornecedor: fornecedorMap.get(p.fornecedor_id) || null
            }));
        }

        return NextResponse.json({
            cotacao,
            propostas: enrichedPropostas,
            pedidos
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

            const createdOrders: any[] = [];

            // Create orders for each supplier
            for (const supplierGroup of itemsBySupplier) {
                const { supplierId, proposalId, supplierUserId, supplierName, supplierDetails, items } = supplierGroup;

                const supplierTotal = items.reduce((sum: number, item: any) => sum + item.total, 0);

                // Create pedido
                const { data: orderData, error: orderError } = await supabaseAdmin
                    .from('pedidos')
                    .insert({
                        cotacao_id: cotacaoId,
                        proposta_id: proposalId,
                        user_id: user.id,
                        fornecedor_id: supplierId,
                        obra_id: obraId,
                        valor_total: supplierTotal,
                        status: 'pendente',
                        endereco_entrega: {
                            clientDetails,
                            supplierDetails,
                            items
                        },
                        observacoes: 'Pedido gerado via mapa comparativo'
                    })
                    .select()
                    .single();

                if (orderError) {
                    console.error('Error creating order:', orderError);
                    continue;
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

                // Update proposal status
                if (proposalId) {
                    await supabaseAdmin
                        .from('propostas')
                        .update({ status: 'aceita' })
                        .eq('id', proposalId);
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
                            link: '/dashboard/fornecedor'
                        });
                }
            }

            // Update cotação status to fechada
            const { error: quotationError } = await supabaseAdmin
                .from('cotacoes')
                .update({ status: 'fechada' })
                .eq('id', cotacaoId);

            if (quotationError) {
                console.error('Error updating cotação:', quotationError);
                return NextResponse.json({ error: 'Erro ao fechar cotação' }, { status: 500 });
            }

            return NextResponse.json({ success: true, orders: createdOrders });
        }

        return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro POST cotacoes/detail:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
