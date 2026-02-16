"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { getAuthHeaders } from "@/lib/authHeaders";
import { SupplierQuotationResponseSection } from "./QuotationResponseSection";
import { ChatInterface } from "@/components/ChatInterface";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SupplierQuotationInboxSection() {
    const { user, profile, session, initialized } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInactive, setIsInactive] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
    const [openChats, setOpenChats] = useState<Array<{ recipientName: string; recipientId: string; initialRoomId: string; initialRoomTitle?: string }>>([]);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        regions: [] as string[],
        categories: [] as string[]
    });
    const [statusFilter, setStatusFilter] = useState<"all" | "received" | "responded" | "won" | "lost">("all");
    const deepLinkHandledRef = useRef<string | null>(null);

    const openChat = (context: { recipientName: string; recipientId: string; roomId: string; roomTitle?: string }) => {
        setOpenChats((prev) => {
            const existing = prev.find((chat) => chat.recipientId === context.recipientId);
            if (existing) {
                return prev.map(c => c.recipientId === context.recipientId
                    ? { ...c, initialRoomId: context.roomId, initialRoomTitle: context.roomTitle }
                    : c
                );
            }
            return [...prev, { recipientName: context.recipientName, recipientId: context.recipientId, initialRoomId: context.roomId, initialRoomTitle: context.roomTitle }];
        });
        window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { recipientId: context.recipientId } }));
    };

    const closeChat = (recipientId: string) => {
        setOpenChats((prev) => prev.filter((chat) => chat.recipientId !== recipientId));
        window.dispatchEvent(new CustomEvent('chat-room-closed', { detail: { recipientId } }));
    };

    // Fetch cotações via API route (bypasses RLS)
    const fetchQuotations = useCallback(async () => {
        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch('/api/cotacoes', { headers });

            if (!res.ok) {
                console.error('Erro ao carregar cotações:', res.status);
                setQuotations([]);
                setLoading(false);
                return;
            }

            const json = await res.json();

            const pedidosRes = await fetch('/api/pedidos', { headers });
            const pedidosJson = pedidosRes.ok ? await pedidosRes.json() : { data: [] };
            const pedidosData = pedidosJson.data || [];
            const pedidoByCotacao = new Map(pedidosData.map((pedido: any) => [pedido.cotacao_id, pedido]));

            // Handle fornecedor not found or suspended
            if (json.fornecedor_status === 'not_found' || json.fornecedor_status === 'suspended') {
                setIsInactive(true);
                setLoading(false);
                return;
            }

            setFornecedorId(json.fornecedor_id);
            const regioes = (json.regioes || []) as string[];
            setFilters(prev => ({ ...prev, regions: regioes }));

            const data = json.data || [];

            let items = data.map((doc: any) => {
                const obra = doc._obra;
                const cliente = doc._cliente;
                return {
                    id: doc.id,
                    numero: doc.numero || null,
                    user_id: doc.user_id,
                    obra_id: doc.obra_id,
                    status: doc.status,
                    clientCode: cliente?.nome || ("Cliente " + (doc.user_id ? doc.user_id.substring(0, 5) : "Anon")),
                    locationRaw: obra?.cidade || "",
                    location: obra ? `${obra.bairro || ''}, ${obra.cidade || ''} - ${obra.estado || ''}` : "Não informado",
                    // Dados completos da obra para exibição na resposta
                    obraEndereco: obra ? {
                        logradouro: obra.logradouro || '',
                        numero: obra.numero || '',
                        complemento: obra.complemento || '',
                        bairro: obra.bairro || '',
                        cidade: obra.cidade || '',
                        estado: obra.estado || '',
                        cep: obra.cep || ''
                    } : null,
                    obraHorarioEntrega: obra?.horario_entrega || null,
                    obraRestricoesEntrega: obra?.restricoes_entrega || null,
                    receivedAt: doc.created_at ? new Date(doc.created_at).toLocaleString() : "N/A",
                    deadline: doc.data_validade ? new Date(doc.data_validade).toLocaleDateString('pt-BR') : "Sem prazo",
                    itemsCount: doc.cotacao_itens?.length || 0,
                    items: (doc.cotacao_itens || []).map((item: any) => ({
                        id: item.id,
                        descricao: item.nome,
                        quantidade: item.quantidade,
                        unidade: item.unidade,
                        observacao: item.observacao,
                        grupo: item.grupo,
                        fase_nome: item.fase_nome,
                        servico_nome: item.servico_nome
                    })),
                    urgency: "Média",
                    _proposta_status: doc._proposta_status || null,
                    _closed_with_me: !!doc._closed_with_me,
                    _closed_with_other: !!doc._closed_with_other,
                    _pedido_status: doc._pedido_status || null,
                    _pedido_id: doc._pedido_id || null,
                    _pedido_summary: doc._pedido_summary || null,
                    _pedido: pedidoByCotacao.get(doc.id) || null,
                    _proposta_resumo: doc._proposta_resumo || null
                };
            });

            // Filtrar por região se configurado
            if (regioes.length > 0) {
                items = items.filter((item: any) => {
                    const loc = item.location.toLowerCase();
                    return regioes.some((region: string) => loc.includes(region));
                });
            }

            setQuotations(items);
        } catch (err) {
            console.error('Erro ao carregar cotações:', err);
            setQuotations([]);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        if (!initialized || !user) return;

        fetchQuotations();

        // Set up realtime subscription
        // Escuta TODAS as mudanças em cotacoes (sem filtro de status)
        // porque cotações com status 'respondida' também são abertas para outros fornecedores
        const channel = supabase
            .channel('cotacoes-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cotacoes'
                },
                () => {
                    fetchQuotations();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'propostas'
                },
                () => {
                    fetchQuotations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, initialized, fetchQuotations]);

    useEffect(() => {
        if (!initialized || !user || quotations.length === 0) return;
        if (!searchParams) return;

        const cotacaoId = String(searchParams.get('cotacaoId') || '').trim();
        const pedidoId = String(searchParams.get('pedidoId') || '').trim();
        const chatRoom = String(searchParams.get('chatRoom') || '').trim();

        if (!cotacaoId && !pedidoId && !chatRoom) return;

        const deepLinkKey = `${cotacaoId}|${pedidoId}|${chatRoom}`;
        if (deepLinkHandledRef.current === deepLinkKey) return;

        let targetQuotation: any | null = null;

        if (cotacaoId) {
            targetQuotation = quotations.find((quotation) => String(quotation.id) === cotacaoId) || null;
        }

        if (!targetQuotation && pedidoId) {
            targetQuotation = quotations.find((quotation) => String(quotation._pedido_id || quotation._pedido?.id || '') === pedidoId) || null;
        }

        if (!targetQuotation && chatRoom) {
            if (chatRoom.includes('::')) {
                const [chatCotacaoId] = chatRoom.split('::');
                targetQuotation = quotations.find((quotation) => String(quotation.id) === String(chatCotacaoId || '').trim()) || null;
            } else {
                targetQuotation = quotations.find((quotation) => String(quotation._pedido_id || quotation._pedido?.id || '') === chatRoom) || null;
            }
        }

        if (!targetQuotation) return;

        setStatusFilter('all');
        setSelectedQuotation(targetQuotation);

        if (chatRoom && targetQuotation.user_id) {
            openChat({
                recipientName: targetQuotation.clientCode,
                recipientId: targetQuotation.user_id,
                roomId: chatRoom,
                roomTitle: chatRoom.includes('::') ? 'Cotação' : 'Pedido',
            });
        }

        deepLinkHandledRef.current = deepLinkKey;

        const params = new URLSearchParams(searchParams.toString());
        params.delete('cotacaoId');
        params.delete('pedidoId');
        params.delete('chatRoom');
        const nextQuery = params.toString();
        const currentPath = pathname || '/dashboard/fornecedor';
        router.replace(nextQuery ? `${currentPath}?${nextQuery}` : currentPath);
    }, [initialized, user, quotations, searchParams]);

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'Alta': return 'bg-red-100 text-red-800';
            case 'Média': return 'bg-orange-100 text-orange-800';
            case 'Baixa': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getProposalStatusBadge = (proposalStatus: string | null, quotationStatus: string) => {
        if (!proposalStatus) {
            return {
                label: 'Aguardando resposta',
                className: 'bg-yellow-100 text-yellow-800'
            };
        }

        if (proposalStatus === 'aceita') {
            return {
                label: quotationStatus === 'fechada' ? 'Selecionada' : 'Pré-selecionada',
                className: 'bg-green-100 text-green-800'
            };
        }

        if (proposalStatus === 'recusada') {
            return {
                label: 'Não selecionada',
                className: 'bg-red-100 text-red-800'
            };
        }

        if (proposalStatus === 'expirada') {
            return {
                label: 'Expirada',
                className: 'bg-gray-100 text-gray-700'
            };
        }

        return {
            label: 'Respondida',
            className: 'bg-blue-100 text-blue-800'
        };
    };

    const getUnifiedPedidoStatus = (quotation: any): "received" | "responded" | "won" | "lost" => {
        if (quotation.status === 'fechada') {
            return quotation._closed_with_me ? 'won' : 'lost';
        }
        return quotation._proposta_status ? 'responded' : 'received';
    };

    // Cotações que viraram pedido (ganhou) não devem aparecer na tela de cotações
    // Elas aparecem na seção de Pedidos Confirmados
    const openQuotations = quotations.filter(q => !(q.status === 'fechada' && q._closed_with_me));

    const activeQuotationsCount = openQuotations.filter(q => getUnifiedPedidoStatus(q) === 'received').length;
    const respondedOpenCount = openQuotations.filter(q => getUnifiedPedidoStatus(q) === 'responded').length;
    const receivedOpenCount = openQuotations.filter(q => getUnifiedPedidoStatus(q) === 'received').length;
    const lostClosedCount = openQuotations.filter(q => q.status === 'fechada' && q._closed_with_other).length;

    const filteredQuotations = openQuotations.filter((q) => {
        const unifiedStatus = getUnifiedPedidoStatus(q);
        if (statusFilter === 'received') return unifiedStatus === 'received';
        if (statusFilter === 'responded') return unifiedStatus === 'responded';
        if (statusFilter === 'lost') return unifiedStatus === 'lost';
        return true;
    });

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando cotações...</div>;
    }

    if (isInactive) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
                    <h3 className="text-lg font-medium text-red-800 mb-2">Conta Inativa</h3>
                    <p className="text-red-600">
                        Sua conta está inativa porque seus produtos não foram atualizados recentemente ou por decisão administrativa.
                        <br />
                        Por favor, atualize seu cadastro de materiais para voltar a receber cotações.
                    </p>
                </div>
            </div>
        );
    }

    if (selectedQuotation) {
        const selectedUnifiedStatus = getUnifiedPedidoStatus(selectedQuotation);
        const selectedPedido = selectedQuotation._pedido;
        const selectedPedidoSummary = selectedQuotation._pedido_summary || selectedPedido?.endereco_entrega?.summary || {};
        const selectedPropostaResumo = selectedQuotation._proposta_resumo || null;

        const detailItems = (selectedPedido?.pedido_itens?.length > 0
            ? selectedPedido.pedido_itens.map((item: any) => ({
                id: item.id,
                descricao: item.nome,
                quantidade: item.quantidade,
                unidade: item.unidade,
                unitPrice: parseFloat(item.preco_unitario) || 0,
                total: parseFloat(item.subtotal) || 0,
            }))
            : (selectedQuotation.items || []).map((item: any) => {
                const proposalItem = selectedPropostaResumo?.items
                    ? selectedPropostaResumo.items[item.id]
                    : null;
                return {
                    id: item.id,
                    descricao: item.descricao,
                    quantidade: item.quantidade,
                    unidade: item.unidade,
                    unitPrice: proposalItem?.unitPrice || 0,
                    total: proposalItem?.total || 0,
                };
            })) as Array<{
                id: string;
                descricao: string;
                quantidade: number;
                unidade: string;
                unitPrice: number;
                total: number;
            }>;

        const subtotalFromItems = detailItems.reduce((sum, item) => sum + (item.total || 0), 0);
        const subtotalValue = parseFloat(selectedPedidoSummary?.subtotal) || subtotalFromItems;
        const freightValue = parseFloat(selectedPedidoSummary?.freight) || selectedPropostaResumo?.freightValue || 0;
        const taxesValue = parseFloat(selectedPedidoSummary?.taxes) || selectedPropostaResumo?.taxValue || 0;
        const deliveryDays = Number.isFinite(Number(selectedPedidoSummary?.deliveryDays))
            ? Number(selectedPedidoSummary.deliveryDays)
            : selectedPropostaResumo?.deliveryDays;
        const paymentTerms = selectedPedidoSummary?.paymentMethod || selectedPropostaResumo?.paymentTerms || null;
        const totalValue = (selectedPedido?.valor_total ? parseFloat(selectedPedido.valor_total) : 0) || (subtotalValue + freightValue + taxesValue);

        if (selectedUnifiedStatus !== 'received') {
            if (selectedQuotation?._editProposal) {
                return (
                    <SupplierQuotationResponseSection
                        quotation={selectedQuotation}
                        onBack={() => {
                            setSelectedQuotation({ ...selectedQuotation, _editProposal: false });
                            fetchQuotations();
                        }}
                        mode="update"
                    />
                );
            }

            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Detalhes da Cotação</h3>
                            <p className="mt-1 text-sm text-gray-600">Resumo da sua proposta</p>
                        </div>
                        <button
                            onClick={() => setSelectedQuotation(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Voltar
                        </button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Cliente:</span>
                                <div className="text-gray-900">{selectedQuotation.clientCode}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Localização:</span>
                                <div className="text-gray-900">{selectedQuotation.location}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Status:</span>
                                <div className="text-gray-900">{selectedUnifiedStatus === 'won' ? 'Ganhou' : selectedUnifiedStatus === 'lost' ? 'Perdeu' : 'Respondido'}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Total de Itens:</span>
                                <div className="text-gray-900">{selectedQuotation.itemsCount} materiais</div>
                            </div>
                            {selectedPropostaResumo?.numero && (
                                <div>
                                    <span className="font-medium text-gray-700">Número da Proposta:</span>
                                    <div className="text-gray-900 font-semibold">#{selectedPropostaResumo.numero}</div>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Subtotal Materiais:</span>
                                <div className="text-gray-900">R$ {subtotalValue.toFixed(2)}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Frete:</span>
                                <div className="text-gray-900">R$ {freightValue.toFixed(2)}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Impostos:</span>
                                <div className="text-gray-900">R$ {taxesValue.toFixed(2)}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Prazo de Entrega:</span>
                                <div className="text-gray-900">
                                    {deliveryDays === null || deliveryDays === undefined
                                        ? 'N/A'
                                        : deliveryDays === 0
                                            ? 'Imediata'
                                            : `${deliveryDays} dias`}
                                </div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Pagamento:</span>
                                <div className="text-gray-900">{paymentTerms || 'N/A'}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Total Geral:</span>
                                <div className="text-gray-900 font-semibold">R$ {totalValue.toFixed(2)}</div>
                            </div>
                        </div>
                        {(selectedUnifiedStatus === 'responded') && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => openChat({
                                        recipientName: selectedQuotation.clientCode,
                                        recipientId: selectedQuotation.user_id,
                                        roomId: fornecedorId ? `${selectedQuotation.id}::${fornecedorId}` : selectedQuotation.id,
                                        roomTitle: 'Cotação'
                                    })}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                    Negociar no chat
                                </button>
                                <button
                                    onClick={() => setSelectedQuotation({ ...selectedQuotation, _editProposal: true })}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                                >
                                    Atualizar proposta
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900">Itens do Pedido</h4>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{selectedQuotation.items?.length || 0} itens</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Unid.</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Unit.</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {detailItems.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.descricao}</td>
                                            <td className="px-3 py-3 text-center text-sm text-gray-700">{item.quantidade}</td>
                                            <td className="px-3 py-3 text-center text-sm text-gray-500">{item.unidade}</td>
                                            <td className="px-3 py-3 text-right text-sm text-gray-700">R$ {(item.unitPrice || 0).toFixed(2)}</td>
                                            <td className="px-3 py-3 text-right text-sm font-medium text-gray-900">R$ {(item.total || 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold text-gray-800">Total Itens</td>
                                        <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">R$ {subtotalValue.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <SupplierQuotationResponseSection
                quotation={selectedQuotation}
                onBack={() => {
                    setSelectedQuotation(null);
                    fetchQuotations();
                }}
                mode="create"
            />
        );
    }

    return (
        <div className="space-y-6">


            {/* Filtros e estatísticas */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                {filters.regions.length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        <strong>Filtro Ativo:</strong> Exibindo apenas cotações para as regiões: {filters.regions.join(", ")}.
                        <br />
                        <span className="text-xs text-yellow-600">Você pode alterar isso na aba "Cadastro & Perfil".</span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{activeQuotationsCount}</div>
                        <div className="text-sm text-gray-500">Recebidos</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{respondedOpenCount}</div>
                        <div className="text-sm text-gray-500">Respondidos</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{lostClosedCount}</div>
                        <div className="text-sm text-gray-500">Perdeu</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setStatusFilter('received')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'received' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Recebido ({receivedOpenCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('responded')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'responded' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Respondido ({respondedOpenCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('lost')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'lost' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Perdeu ({lostClosedCount})
                    </button>
                </div>
            </div>

            {/* Lista de consultas */}
            <div className="space-y-4">
                {loading ? (
                    <p className="text-center text-gray-500">Carregando cotações...</p>
                ) : filteredQuotations.length === 0 ? (
                    <p className="text-center text-gray-500">Nenhuma cotação disponível no momento.</p>
                ) : (
                    filteredQuotations.map((quotation) => (
                        <div key={quotation.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        {quotation.numero && (
                                            <span className="text-sm font-bold text-blue-600">#{quotation.numero}</span>
                                        )}
                                        <h4 className="text-base font-medium text-gray-900">{quotation.clientCode}</h4>
                                        {(() => {
                                            const unifiedStatus = getUnifiedPedidoStatus(quotation);
                                            const statusBadgeMap: Record<string, { label: string; className: string }> = {
                                                received: { label: 'Recebido', className: 'bg-blue-100 text-blue-800' },
                                                responded: { label: 'Respondido', className: 'bg-indigo-100 text-indigo-800' },
                                                won: { label: 'Ganhou', className: 'bg-green-100 text-green-800' },
                                                lost: { label: 'Perdeu', className: 'bg-red-100 text-red-800' }
                                            };
                                            const proposalBadge = statusBadgeMap[unifiedStatus] || getProposalStatusBadge(quotation._proposta_status, quotation.status);
                                            return (
                                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${proposalBadge.className}`}>
                                                    {proposalBadge.label}
                                                </span>
                                            );
                                        })()}
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(quotation.urgency)}`}>
                                            {quotation.urgency}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                        <div>
                                            <span className="font-medium">Localização:</span>
                                            <br />
                                            {quotation.location}
                                        </div>
                                        <div>
                                            <span className="font-medium">Recebido em:</span>
                                            <br />
                                            {quotation.receivedAt}
                                        </div>
                                        <div>
                                            <span className="font-medium">Prazo:</span>
                                            <br />
                                            {quotation.deadline}
                                        </div>
                                        <div>
                                            <span className="font-medium">Itens:</span>
                                            <br />
                                            {quotation.itemsCount} materiais
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2 ml-4">
                                    {(getUnifiedPedidoStatus(quotation) === 'received' || getUnifiedPedidoStatus(quotation) === 'responded') && (
                                        <button
                                            onClick={() => openChat({
                                                recipientName: quotation.clientCode,
                                                recipientId: quotation.user_id,
                                                roomId: fornecedorId ? `${quotation.id}::${fornecedorId}` : quotation.id,
                                                roomTitle: 'Cotação'
                                            })}
                                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                                        >
                                            Chat
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedQuotation(quotation)}
                                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                                    >
                                        Visualizar
                                    </button>
                                    {getUnifiedPedidoStatus(quotation) === 'received' && (
                                        <button
                                            onClick={() => setSelectedQuotation(quotation)}
                                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                                        >
                                            Responder
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {openChats.map((chat, index) => (
                <ChatInterface
                    key={chat.recipientId}
                    isOpen={true}
                    onClose={() => closeChat(chat.recipientId)}
                    recipientName={chat.recipientName}
                    recipientId={chat.recipientId}
                    initialRoomId={chat.initialRoomId}
                    initialRoomTitle={chat.initialRoomTitle}
                    offsetIndex={index}
                />
            ))}
        </div>
    );
}