"use client";

import { useState, useEffect, useRef, Fragment } from "react";

import { ChatInterface } from "../../ChatInterface";
import { ReviewModal } from "../../ReviewModal";
import { getQuotationStatusBadge } from "./quotationStatus";
import { supabase } from "@/lib/supabaseAuth";
import { authFetch } from "@/lib/authHeaders";
import { Download, MessageSquare, Star, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { ReportModal } from "../../ReportModal";
import { formatPaymentTerms } from "@/lib/paymentTerms";

interface ClientComparativeSectionProps {
    orderId?: string;
    status?: string;
}

export function ClientComparativeSection({ orderId, status }: ClientComparativeSectionProps) {
    const { showToast } = useToast();
    const [quotation, setQuotation] = useState<any>(null);
    const [allProposals, setAllProposals] = useState<any[]>([]);
    const [proposals, setProposals] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [showOnlyDelayedSuborders, setShowOnlyDelayedSuborders] = useState(false);
    const [loading, setLoading] = useState(true);
    const [finalizingOrder, setFinalizingOrder] = useState(false);
    const [totalPropostas, setTotalPropostas] = useState(0);

    // State for selection logic
    const [selectedSuppliers, setSelectedSuppliers] = useState<{ [itemId: string]: string }>({}); // itemId -> supplierId
    const [rejectedSuppliers, setRejectedSuppliers] = useState<string[]>([]);
    const [view, setView] = useState<"map" | "oc">("map");
    // Pedido fechado: alterna entre os subpedidos e o mapa comparativo preservado
    const [closedView, setClosedView] = useState<"pedidos" | "mapa">("pedidos");
    // Dados do cliente (faturamento) e da obra (entrega) para a Ordem de Compra
    const [clientInfo, setClientInfo] = useState<any>(null);
    const [obraInfo, setObraInfo] = useState<any>(null);
    const [chatContext, setChatContext] = useState<{ recipientName: string; recipientId?: string; initialRoomId: string; initialRoomTitle?: string } | null>(null);
    const chatContextRef = useRef(chatContext);
    chatContextRef.current = chatContext;

    // On unmount: dispatch chat-room-closed so ChatNotificationListener unsuppresses
    useEffect(() => {
        return () => {
            if (chatContextRef.current?.recipientId) {
                window.dispatchEvent(new CustomEvent('chat-room-closed', { detail: { recipientId: chatContextRef.current.recipientId } }));
            }
        };
    }, []);

    const [negotiationModal, setNegotiationModal] = useState<{
        isOpen: boolean;
        supplier: any;
        step: 'initial' | 'discount' | 'freight' | 'closed';
        discountPercent: number;
    } | null>(null);
    const [reviewModal, setReviewModal] = useState<{
        isOpen: boolean;
        supplierId: string;
        supplierName: string;
    } | null>(null);
    const [reportModal, setReportModal] = useState<{
        isOpen: boolean;
        supplierId: string;
        supplierName: string;
    } | null>(null);

    useEffect(() => {
        if (!orderId) return;

        setLoading(true);

        // Fetch all data via API route (bypasses RLS)
        const fetchData = async () => {
            try {
                const res = await authFetch(`/api/cotacoes/detail?id=${orderId}`);

                if (!res.ok) {
                    console.error('Erro ao carregar cotação:', res.status);
                    setLoading(false);
                    return;
                }

                const json = await res.json();
                const { cotacao: cotacaoData, propostas: propostasData, pedidos: pedidosData, total_propostas } = json;

                // Dados do cliente (faturamento) e da obra (entrega) para a OC
                setClientInfo(json.cliente || null);
                setObraInfo(json.obra || null);

                // Armazenar total de propostas (inclui histórico de propostas já deletadas)
                setTotalPropostas(total_propostas || 0);

                if (cotacaoData) {
                    setQuotation({
                        id: cotacaoData.id,
                        obra_id: cotacaoData.obra_id,
                        status: cotacaoData.status,
                        clientCode: cotacaoData.user_id,
                        items: cotacaoData.cotacao_itens?.map((item: any) => ({
                            id: item.id,
                            descricao: item.nome,
                            quantidade: item.quantidade,
                            unidade: item.unidade,
                            fabricante: item.fabricante || null,
                            observacao: item.observacao
                        })) || []
                    });
                }

                const mappedProposals = (propostasData || []).map((p: any) => {
                    const frete = parseFloat(p.valor_frete) || 0;
                    const valorTotal = parseFloat(p.valor_total) || 0;
                    const impostos = parseFloat(p.impostos) || 0;
                    const prazoEntregaParsed = Number.parseInt(String(p.prazo_entrega ?? ''), 10);
                    const prazoEntrega = Number.isFinite(prazoEntregaParsed) && prazoEntregaParsed >= 0
                        ? prazoEntregaParsed
                        : null;
                    // valor_total do DB já inclui frete, separar mercadoria
                    const merchandiseTotal = valorTotal - frete;
                    return {
                        id: p.id,
                        numero: p.numero || null,
                        supplierId: p.fornecedor_id,
                        supplierUserId: p.fornecedor?.user_id,
                        supplierName: p.fornecedor?.nome_fantasia || p.fornecedor?.razao_social || 'Fornecedor',
                        supplierDetails: {
                            name: p.fornecedor?.nome_fantasia || p.fornecedor?.razao_social || 'Fornecedor',
                            document: p.fornecedor?.cnpj || '',
                            email: p.fornecedor?.email || '',
                            phone: p.fornecedor?.telefone || '',
                            address: [p.fornecedor?.logradouro, p.fornecedor?.numero, p.fornecedor?.bairro, p.fornecedor?.cidade, p.fornecedor?.estado].filter(Boolean).join(', ')
                        },
                        totalValue: merchandiseTotal,
                        freightPrice: frete,
                        impostos: impostos,
                        deliveryDays: prazoEntrega,
                        validity: p.data_validade ? new Date(p.data_validade).toLocaleDateString('pt-BR') : null,
                        paymentMethod: p.condicoes_pagamento,
                        observacoes: String(p.observacoes || '').replace(/\[IMPOSTOS=[^\]]*\]/gi, '').trim() || null,
                        anexos: p.proposta_anexos || [],
                        items: p.proposta_itens?.map((item: any) => ({
                            itemId: item.cotacao_item_id,
                            price: item.preco_unitario,
                            quantity: item.quantidade,
                            disponibilidade: item.disponibilidade || 'disponivel'
                        })) || []
                    };
                });

                setAllProposals(mappedProposals);

                const top3Proposals = [...mappedProposals]
                    .sort((a, b) => (a.totalValue + (a.freightPrice || 0)) - (b.totalValue + (b.freightPrice || 0)))
                    .slice(0, 3);

                setProposals(top3Proposals);

                if (pedidosData && pedidosData.length > 0) {
                    const mappedOrders = pedidosData.map((order: any) => ({
                        id: order.id,
                        numero: order.numero || order.id.slice(0, 8),
                        supplierId: order.fornecedor_id,
                        supplierName: order.fornecedor?.nome_fantasia || order.fornecedor?.razao_social || 'Fornecedor',
                        supplierDetails: {
                            name: order.fornecedor?.nome_fantasia || order.fornecedor?.razao_social,
                            document: order.fornecedor?.cnpj,
                            email: order.fornecedor?.email,
                            phone: order.fornecedor?.telefone,
                            address: [order.fornecedor?.logradouro, order.fornecedor?.numero, order.fornecedor?.bairro, order.fornecedor?.cidade, order.fornecedor?.estado].filter(Boolean).join(', ')
                        },
                        supplierRaw: order.fornecedor || null,
                        items: order.pedido_itens?.map((item: any) => ({
                            id: item.id,
                            name: item.nome,
                            descricao: item.nome,
                            quantity: item.quantidade,
                            quantidade: item.quantidade,
                            unidade: item.unidade || '',
                            unitPrice: item.preco_unitario,
                            total: item.subtotal
                        })) || [],
                        freight: parseFloat(order?.endereco_entrega?.summary?.freight) || 0,
                        deliveryDays: Number.isFinite(order?.endereco_entrega?.summary?.deliveryDays)
                            ? Number(order.endereco_entrega.summary.deliveryDays)
                            : null,
                        paymentMethod: order?.endereco_entrega?.summary?.paymentMethod || null,
                        summary: order?.endereco_entrega?.summary || {},
                        dataConfirmacao: order?.data_confirmacao || null,
                        dataPrevisaoEntrega: order?.data_previsao_entrega || null,
                        dataEntrega: order?.data_entrega || null,
                        createdAt: order?.created_at || null,
                        subtotal: order.valor_total || 0,
                        total: order.valor_total || 0,
                        status: order.status
                    }));
                    setOrders(mappedOrders);
                }

                setLoading(false);
            } catch (error) {
                console.error("Error fetching data:", error);
                setLoading(false);
            }
        };

        fetchData();

        // Set up realtime subscriptions - just trigger refetch on changes
        const quotationChannel = supabase
            .channel(`quotation-${orderId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'cotacoes', filter: `id=eq.${orderId}` },
                () => { fetchData(); }
            )
            .subscribe();

        const proposalsChannel = supabase
            .channel(`proposals-${orderId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'propostas', filter: `cotacao_id=eq.${orderId}` },
                () => { fetchData(); }
            )
            .subscribe();

        let ordersChannel: ReturnType<typeof supabase.channel> | null = null;
        if (status === "fechada") {
            ordersChannel = supabase
                .channel(`orders-${orderId}`)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'pedidos', filter: `cotacao_id=eq.${orderId}` },
                    () => { fetchData(); }
                )
                .subscribe();
        }

        return () => {
            quotationChannel.unsubscribe();
            proposalsChannel.unsubscribe();
            if (ordersChannel) {
                ordersChannel.unsubscribe();
            }
        };
    }, [orderId, status]);

    useEffect(() => {
        if (quotation?.status === 'fechada' && orderId && orders.length === 0) {
            const fetchOrders = async () => {
                try {
                    const res = await authFetch(`/api/cotacoes/detail?id=${orderId}`);
                    if (!res.ok) return;
                    const json = await res.json();
                    const pedidosData = json.pedidos || [];

                    const mappedOrders = pedidosData.map((order: any) => ({
                        id: order.id,
                        numero: order.numero || order.id.slice(0, 8),
                        supplierId: order.fornecedor_id,
                        supplierName: order.fornecedor?.nome_fantasia || order.fornecedor?.razao_social || 'Fornecedor',
                        supplierDetails: {
                            name: order.fornecedor?.nome_fantasia || order.fornecedor?.razao_social,
                            document: order.fornecedor?.cnpj,
                            email: order.fornecedor?.email,
                            phone: order.fornecedor?.telefone,
                            address: [order.fornecedor?.logradouro, order.fornecedor?.numero, order.fornecedor?.bairro, order.fornecedor?.cidade, order.fornecedor?.estado].filter(Boolean).join(', ')
                        },
                        supplierRaw: order.fornecedor || null,
                        items: order.pedido_itens?.map((item: any) => ({
                            id: item.id,
                            name: item.nome,
                            descricao: item.nome,
                            quantity: item.quantidade,
                            quantidade: item.quantidade,
                            unidade: item.unidade || '',
                            unitPrice: item.preco_unitario,
                            total: item.subtotal
                        })) || [],
                        freight: parseFloat(order?.endereco_entrega?.summary?.freight) || 0,
                        deliveryDays: Number.isFinite(order?.endereco_entrega?.summary?.deliveryDays)
                            ? Number(order.endereco_entrega.summary.deliveryDays)
                            : null,
                        paymentMethod: order?.endereco_entrega?.summary?.paymentMethod || null,
                        summary: order?.endereco_entrega?.summary || {},
                        dataConfirmacao: order?.data_confirmacao || null,
                        dataPrevisaoEntrega: order?.data_previsao_entrega || null,
                        dataEntrega: order?.data_entrega || null,
                        createdAt: order?.created_at || null,
                        subtotal: order.valor_total || 0,
                        total: order.valor_total || 0,
                        status: order.status
                    }));

                    setOrders(mappedOrders);
                } catch (error) {
                    console.error("Error fetching orders:", error);
                }
            };
            fetchOrders();
        }
    }, [quotation?.status, orderId]);

    if (loading) {
        return <div className="p-12 text-center">Carregando mapa comparativo...</div>;
    }

    const currentStatusBadge = getQuotationStatusBadge(
        quotation?.status || status || 'enviada',
        totalPropostas || proposals.length
    );

    const getOrderStatusMeta = (orderStatus: string) => {
        if (orderStatus === 'entregue') {
            return { label: 'Entregue', color: 'bg-green-100 text-green-800' };
        }
        if (orderStatus === 'enviado') {
            return { label: 'Em transporte', color: 'bg-blue-100 text-blue-800' };
        }
        if (orderStatus === 'em_preparacao') {
            return { label: 'Em separação', color: 'bg-indigo-100 text-indigo-800' };
        }
        if (orderStatus === 'confirmado') {
            return { label: 'Em faturamento', color: 'bg-purple-100 text-purple-800' };
        }
        if (orderStatus === 'cancelado') {
            return { label: 'Cancelado', color: 'bg-red-100 text-red-800' };
        }
        return { label: 'Aguardando confirmação', color: 'bg-yellow-100 text-yellow-800' };
    };

    const getSuborderStepState = (orderStatus: string) => {
        const billingDone = ['em_preparacao', 'enviado', 'entregue'].includes(orderStatus);
        const pickingDone = ['enviado', 'entregue'].includes(orderStatus);
        const deliveryDone = orderStatus === 'entregue';

        const billingActive = orderStatus === 'confirmado' || orderStatus === 'pendente';
        const pickingActive = orderStatus === 'em_preparacao';
        const deliveryActive = orderStatus === 'enviado';

        return {
            billing: billingDone ? 'done' : billingActive ? 'active' : 'pending',
            picking: pickingDone ? 'done' : pickingActive ? 'active' : 'pending',
            delivery: deliveryDone ? 'done' : deliveryActive ? 'active' : 'pending',
        } as const;
    };

    const stepStyle = (state: 'done' | 'active' | 'pending') => {
        if (state === 'done') return 'bg-green-50 border-green-200 text-green-700';
        if (state === 'active') return 'bg-blue-50 border-blue-200 text-blue-700';
        return 'bg-gray-50 border-gray-200 text-gray-500';
    };

    const formatDateTime = (value?: string | null) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getExpectedDeliveryDate = (order: any): Date | null => {
        if (order?.dataPrevisaoEntrega) {
            const explicit = new Date(order.dataPrevisaoEntrega);
            if (!Number.isNaN(explicit.getTime())) return explicit;
        }

        const deliveryDays = Number(order?.summary?.deliveryDays);
        const createdAt = order?.createdAt ? new Date(order.createdAt) : null;

        if (!createdAt || Number.isNaN(createdAt.getTime()) || !Number.isFinite(deliveryDays) || deliveryDays < 0) {
            return null;
        }

        const expected = new Date(createdAt);
        expected.setDate(expected.getDate() + deliveryDays);
        return expected;
    };

    const isOrderDelayed = (order: any) => {
        const expectedDeliveryDate = getExpectedDeliveryDate(order);
        if (!expectedDeliveryDate) return false;
        if (order.status === 'entregue') return false;
        return Date.now() > expectedDeliveryDate.getTime();
    };

    if (quotation?.status === 'fechada') {
        const generalOrderCode = String(quotation?.id || orderId || '').slice(0, 8);
        const delayedOrdersCount = orders.filter(isOrderDelayed).length;
        const visibleOrders = showOnlyDelayedSuborders ? orders.filter(isOrderDelayed) : orders;

        // Pedido fechado: fornecedores revelados + condições comerciais da proposta
        const proposalBySupplier = new Map(allProposals.map((p: any) => [String(p.supplierId), p]));
        const winnerSupplierIds = new Set(orders.map((o: any) => String(o.supplierId)));
        const proposalItemPrice = (proposal: any, itemId: string) => {
            const it = (proposal?.items || []).find((x: any) => String(x.itemId) === String(itemId));
            return parseFloat(String(it?.price ?? '')) || 0;
        };
        const formatDeliveryDays = (days: any) => {
            const n = Number(days);
            if (!Number.isFinite(n) || days === null || days === undefined || days === '') return null;
            return n === 0 ? 'Imediata' : `${n} dia${n === 1 ? '' : 's'}`;
        };
        return (
            <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <Download className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-800 mb-2">Pedido Finalizado!</h2>
                    <p className="text-green-700 max-w-2xl mx-auto">
                        Seus pedidos foram gerados e enviados aos fornecedores com sucesso.
                        Abaixo você pode visualizar os detalhes de cada pedido gerado.
                    </p>
                    {totalPropostas > 0 && (
                        <p className="text-green-600 text-sm mt-2 font-medium">
                            Total de {totalPropostas} {totalPropostas === 1 ? 'proposta recebida' : 'propostas recebidas'} —
                            {' '}mapa financeiro preservado com as {Math.min(proposals.length, 3)} melhores
                        </p>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pedido Geral</p>
                            <h3 className="text-lg font-bold text-gray-900">#{generalOrderCode}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                                <button
                                    onClick={() => setClosedView('pedidos')}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${closedView === 'pedidos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Subpedidos
                                </button>
                                <button
                                    onClick={() => setClosedView('mapa')}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${closedView === 'mapa' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Mapa Comparativo
                                </button>
                            </div>
                            <button
                                onClick={() => setShowOnlyDelayedSuborders((prev) => !prev)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border ${showOnlyDelayedSuborders
                                    ? 'bg-red-100 text-red-800 border-red-200'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {showOnlyDelayedSuborders ? 'Mostrando atrasados' : 'Somente atrasados'}
                            </button>
                            <div className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200">
                                {orders.length} {orders.length === 1 ? 'subpedido' : 'subpedidos'}
                            </div>
                            {delayedOrdersCount > 0 && (
                                <div className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-semibold border border-red-200">
                                    {delayedOrdersCount} atrasado{delayedOrdersCount === 1 ? '' : 's'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {closedView === 'mapa' && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-base font-semibold text-gray-900">Mapa Comparativo (cotação fechada)</h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Registro das {proposals.length} melhores propostas para conferência e renegociação. Fornecedores revelados após o fechamento.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th rowSpan={2} className="border-b border-gray-100 px-3 py-3 text-center text-black w-14">Itens</th>
                                        <th rowSpan={2} className="border-b border-gray-100 px-4 py-3 text-left text-black">Descrição dos Materiais</th>
                                        <th rowSpan={2} className="border-b border-gray-100 px-3 py-3 text-center text-black w-16">Qtde</th>
                                        <th rowSpan={2} className="border-b border-gray-100 px-3 py-3 text-center text-black w-16">Unid.</th>
                                        {proposals.map((proposal: any) => (
                                            <th key={proposal.id} colSpan={2} className="border-b border-l border-gray-200 px-4 py-2 text-center text-black">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span>{proposal.supplierName}</span>
                                                    {proposal.numero && (
                                                        <span className="text-[11px] text-gray-500 font-normal">{proposal.numero}</span>
                                                    )}
                                                    {winnerSupplierIds.has(String(proposal.supplierId)) && (
                                                        <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                            ✓ Pedido fechado
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {proposals.map((proposal: any) => (
                                            <Fragment key={`sub-${proposal.id}`}>
                                                <th className="border-b border-l border-gray-200 px-3 py-2 text-center text-black text-[11px]">Unitário</th>
                                                <th className="border-b border-gray-100 px-3 py-2 text-center text-black text-[11px]">Total</th>
                                            </Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(quotation?.items || []).map((item: any, itemIndex: number) => (
                                        <tr key={item.id} className="odd:bg-white even:bg-gray-50/60">
                                            <td className="border-b border-gray-100 px-3 py-3 text-center text-gray-500 font-semibold">{itemIndex + 1}</td>
                                            <td className="border-b border-gray-100 px-4 py-3">
                                                <p className="font-semibold text-gray-900">{item.descricao}</p>
                                                {item.fabricante && (
                                                    <p className="text-xs text-blue-600 mt-0.5">Fabricante: {item.fabricante}</p>
                                                )}
                                            </td>
                                            <td className="border-b border-gray-100 px-3 py-3 text-center text-gray-900 font-medium">{item.quantidade}</td>
                                            <td className="border-b border-gray-100 px-3 py-3 text-center text-gray-700">{item.unidade}</td>
                                            {proposals.map((proposal: any) => {
                                                const price = proposalItemPrice(proposal, item.id);
                                                return (
                                                    <Fragment key={`${item.id}-${proposal.id}`}>
                                                        <td className="border-b border-l border-gray-200 px-3 py-3 text-center">
                                                            {price > 0 ? (
                                                                <span className="text-sm font-semibold text-gray-900">R$ {price.toFixed(2)}</span>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">Sem oferta</span>
                                                            )}
                                                        </td>
                                                        <td className="border-b border-gray-100 px-3 py-3 text-center">
                                                            {price > 0 ? (
                                                                <span className="text-sm font-semibold text-gray-800">R$ {(price * (parseFloat(item.quantidade) || 0)).toFixed(2)}</span>
                                                            ) : (
                                                                <span className="text-xs text-gray-300">—</span>
                                                            )}
                                                        </td>
                                                    </Fragment>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    {[
                                        { key: 'desconto', label: 'Desconto à vista', render: (_p: any) => '—' },
                                        { key: 'impostos', label: 'Impostos', render: (p: any) => (p.impostos > 0 ? `R$ ${p.impostos.toFixed(2)}` : '-') },
                                        { key: 'mercadoria', label: 'Total da Mercadoria', render: (p: any) => `R$ ${p.totalValue.toFixed(2)}` },
                                        { key: 'frete', label: 'Frete', render: (p: any) => `R$ ${(p.freightPrice || 0).toFixed(2)}` },
                                    ].map((rowDef, rowIdx) => (
                                        <tr key={rowDef.key} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                            <td colSpan={4} className="border-t border-gray-100 px-4 py-2.5 text-right text-black font-semibold">{rowDef.label}</td>
                                            {proposals.map((proposal: any) => (
                                                <td key={`${rowDef.key}-${proposal.id}`} colSpan={2} className="border-t border-l border-gray-200 px-4 py-2.5 text-center text-gray-700 font-medium">
                                                    {rowDef.render(proposal)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-900/90 text-white">
                                        <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold">Total Global</td>
                                        {proposals.map((proposal: any) => (
                                            <td key={`total-${proposal.id}`} colSpan={2} className="px-4 py-3 text-center text-sm font-bold border-l border-slate-700">
                                                R$ {(proposal.totalValue + (proposal.freightPrice || 0) + (proposal.impostos || 0)).toFixed(2)}
                                            </td>
                                        ))}
                                    </tr>
                                    {[
                                        { key: 'pagamento', label: 'Condições de Pagamento', render: (p: any) => formatPaymentTerms(p.paymentMethod) || '-' },
                                        { key: 'prazo', label: 'Prazo de Entrega', render: (p: any) => formatDeliveryDays(p.deliveryDays) || '-' },
                                        { key: 'validade', label: 'Validade da Proposta', render: (p: any) => p.validity || '-' },
                                        { key: 'obs', label: 'Observações', render: (p: any) => p.observacoes || '-' },
                                    ].map((rowDef, rowIdx) => (
                                        <tr key={rowDef.key} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td colSpan={4} className="border-t border-gray-100 px-4 py-2.5 text-right text-black font-semibold">{rowDef.label}</td>
                                            {proposals.map((proposal: any) => (
                                                <td key={`${rowDef.key}-${proposal.id}`} colSpan={2} className="border-t border-l border-gray-200 px-4 py-2.5 text-center text-gray-700 text-xs whitespace-pre-wrap break-words max-w-[18rem]">
                                                    {rowDef.render(proposal)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr className="bg-white">
                                        <td colSpan={4} className="border-t border-gray-100 px-4 py-2.5 text-right text-black font-semibold">Anexos</td>
                                        {proposals.map((proposal: any) => (
                                            <td key={`anexos-${proposal.id}`} colSpan={2} className="border-t border-l border-gray-200 px-4 py-2.5 text-center text-xs">
                                                {(proposal.anexos || []).length > 0 ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        {(proposal.anexos || []).map((anexo: any, anexoIdx: number) => (
                                                            <a
                                                                key={anexo.id || anexoIdx}
                                                                href={anexo.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline truncate max-w-[10rem]"
                                                                title={anexo.nome}
                                                            >
                                                                📎 {anexo.nome}
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {closedView === 'pedidos' && (
                <div className="grid gap-6">
                    {visibleOrders.map((order, index) => {
                        const statusMeta = getOrderStatusMeta(order.status);
                        const steps = getSuborderStepState(order.status);
                        const billingAt = formatDateTime(order?.summary?.billingCompletedAt || order?.summary?.billingStartedAt || order?.dataConfirmacao);
                        const pickingAt = formatDateTime(order?.summary?.pickingCompletedAt || order?.summary?.pickingStartedAt);
                        const deliveryAt = formatDateTime(order?.summary?.deliveryCompletedAt || order?.summary?.deliveryStartedAt || order?.dataEntrega);
                        const expectedDeliveryDate = getExpectedDeliveryDate(order);
                        const isDelayed = isOrderDelayed(order);
                        const expectedDeliveryLabel = expectedDeliveryDate ? expectedDeliveryDate.toLocaleDateString('pt-BR') : null;

                        // Condições fechadas: usa o resumo do pedido e completa com a proposta original
                        const supplierProposal = proposalBySupplier.get(String(order.supplierId));
                        const paymentLabel = formatPaymentTerms(order.paymentMethod || supplierProposal?.paymentMethod) || null;
                        const deliveryLabel = formatDeliveryDays(order.deliveryDays ?? supplierProposal?.deliveryDays);
                        const taxesValue = parseFloat(order?.summary?.taxes) || supplierProposal?.impostos || 0;
                        const validityLabel = supplierProposal?.validity || null;
                        const supplierObs = supplierProposal?.observacoes || null;
                        const supplierAnexos = supplierProposal?.anexos || [];
                        const supplierInfo = order.supplierDetails || {};

                        return (
                            <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Ordem de Compra</p>
                                        <h3 className="text-lg font-bold text-gray-900">{order.supplierName}</h3>
                                        <p className="text-sm text-gray-500">Subpedido 1.{index + 1} • Pedido #{order.numero}</p>
                                        {expectedDeliveryLabel && (
                                            <p className="text-xs text-gray-500 mt-1">Previsão de entrega: {expectedDeliveryLabel}</p>
                                        )}
                                        <button
                                            onClick={() => setReportModal({ isOpen: true, supplierId: order.supplierId, supplierName: order.supplierName })}
                                            className="mt-2 inline-flex items-center text-xs text-rose-500 hover:text-rose-700 font-medium"
                                        >
                                            <ShieldAlert className="w-3 h-3 mr-1" />
                                            Reportar Problema
                                        </button>
                                    </div>
                                    <div className="text-right space-y-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusMeta.color}`}>
                                            {statusMeta.label}
                                        </span>
                                        {isDelayed && (
                                            <div>
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Atrasado
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div className={`rounded-lg border px-3 py-2 ${stepStyle(steps.billing)}`}>
                                            <div className="text-xs font-semibold">Faturamento</div>
                                            {billingAt && <div className="mt-0.5 text-[11px]">{billingAt}</div>}
                                        </div>
                                        <div className={`rounded-lg border px-3 py-2 ${stepStyle(steps.picking)}`}>
                                            <div className="text-xs font-semibold">Separação</div>
                                            {pickingAt && <div className="mt-0.5 text-[11px]">{pickingAt}</div>}
                                        </div>
                                        <div className={`rounded-lg border px-3 py-2 ${stepStyle(steps.delivery)}`}>
                                            <div className="text-xs font-semibold">Entrega</div>
                                            {deliveryAt && <div className="mt-0.5 text-[11px]">{deliveryAt}</div>}
                                        </div>
                                    </div>

                                    {/* Dados de fornecedor, faturamento e entrega (modelo da OC) */}
                                    {(() => {
                                        const raw = order.supplierRaw || {};
                                        const clienteNome = clientInfo?.razao_social || clientInfo?.nome || supplierProposal?.clientName || '—';
                                        const enderecoCobranca = [
                                            [clientInfo?.logradouro, clientInfo?.numero].filter(Boolean).join(', '),
                                            clientInfo?.complemento,
                                        ].filter(Boolean).join(' - ');
                                        const enderecoEntrega = [
                                            [obraInfo?.logradouro, obraInfo?.numero].filter(Boolean).join(', '),
                                            obraInfo?.complemento,
                                        ].filter(Boolean).join(' - ');
                                        return (
                                            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                                <div className="rounded-lg border border-gray-200 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Fornecedor</p>
                                                    <p className="font-semibold text-gray-900">{order.supplierName}</p>
                                                    {supplierInfo.document && <p className="text-xs text-gray-600">CNPJ: {supplierInfo.document}</p>}
                                                    {supplierInfo.email && <p className="text-xs text-gray-600">Contato: {supplierInfo.email}</p>}
                                                    {supplierInfo.phone && <p className="text-xs text-gray-600">Telefone: {supplierInfo.phone}</p>}
                                                    {raw.whatsapp && <p className="text-xs text-gray-600">WhatsApp: {raw.whatsapp}</p>}
                                                    {(raw.logradouro || supplierInfo.address) && (
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            {raw.logradouro
                                                                ? [[raw.logradouro, raw.numero].filter(Boolean).join(', '), raw.bairro, [raw.cidade, raw.estado].filter(Boolean).join('/'), raw.cep ? `CEP: ${raw.cep}` : ''].filter(Boolean).join(' - ')
                                                                : supplierInfo.address}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="rounded-lg border border-gray-200 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Faturar para</p>
                                                    <p className="font-semibold text-gray-900">{clienteNome}</p>
                                                    {clientInfo?.cpf_cnpj && <p className="text-xs text-gray-600">CNPJ/CPF: {clientInfo.cpf_cnpj}</p>}
                                                    {(clientInfo?.telefone || clientInfo?.whatsapp) && (
                                                        <p className="text-xs text-gray-600">
                                                            {[clientInfo?.telefone ? `Tel: ${clientInfo.telefone}` : '', clientInfo?.whatsapp ? `WhatsApp: ${clientInfo.whatsapp}` : ''].filter(Boolean).join(' • ')}
                                                        </p>
                                                    )}
                                                    {enderecoCobranca && <p className="text-xs text-gray-600 mt-1">{enderecoCobranca}</p>}
                                                    {(clientInfo?.bairro || clientInfo?.cidade) && (
                                                        <p className="text-xs text-gray-600">
                                                            {[clientInfo?.bairro, [clientInfo?.cidade, clientInfo?.estado].filter(Boolean).join('/'), clientInfo?.cep ? `CEP: ${clientInfo.cep}` : ''].filter(Boolean).join(' - ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="rounded-lg border border-gray-200 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Endereço de Entrega</p>
                                                    {obraInfo?.nome && <p className="font-semibold text-gray-900">{obraInfo.nome}</p>}
                                                    {enderecoEntrega && <p className="text-xs text-gray-600">{enderecoEntrega}</p>}
                                                    {(obraInfo?.bairro || obraInfo?.cidade) && (
                                                        <p className="text-xs text-gray-600">
                                                            {[obraInfo?.bairro, [obraInfo?.cidade, obraInfo?.estado].filter(Boolean).join('/'), obraInfo?.cep ? `CEP: ${obraInfo.cep}` : ''].filter(Boolean).join(' - ')}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-gray-600 mt-1">Contato: {clientInfo?.nome || clienteNome}</p>
                                                    {(clientInfo?.telefone || clientInfo?.whatsapp) && (
                                                        <p className="text-xs text-gray-600">Telefone/obra: {clientInfo?.whatsapp || clientInfo?.telefone}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <table className="min-w-full text-sm mb-4 border border-gray-200">
                                        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            <tr>
                                                <th className="px-3 py-2 text-center w-14 border-b border-gray-200">Ítem</th>
                                                <th className="px-4 py-2 text-left border-b border-gray-200">Descrição dos Materiais</th>
                                                <th className="px-3 py-2 text-center border-b border-gray-200">Qtde.</th>
                                                <th className="px-3 py-2 text-center border-b border-gray-200">Unid.</th>
                                                <th className="px-4 py-2 text-right border-b border-gray-200">Pço Unit.</th>
                                                <th className="px-4 py-2 text-right border-b border-gray-200">Pço Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {order.items.map((item: any, itemIdx: number) => (
                                                <tr key={item.id}>
                                                    <td className="px-3 py-2 text-center text-gray-500 font-semibold">{itemIdx + 1}</td>
                                                    <td className="px-4 py-2 font-medium text-gray-900">{item.descricao || item.name}</td>
                                                    <td className="px-3 py-2 text-center">{item.quantidade || item.quantity}</td>
                                                    <td className="px-3 py-2 text-center text-gray-600">{item.unidade || item.unit || '—'}</td>
                                                    <td className="px-4 py-2 text-right">R$ {item.unitPrice?.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-right">R$ {item.total?.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                            {(() => {
                                                const merchandiseTotal = (order.items || []).reduce((sum: number, i: any) => sum + (parseFloat(i.total) || 0), 0);
                                                const notaTotal = merchandiseTotal + (order.freight || 0) + taxesValue;
                                                return (
                                                    <>
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Desconto à vista</td>
                                                            <td className="px-4 py-2 text-right text-gray-500">—</td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Impostos</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-gray-700">{taxesValue > 0 ? `R$ ${taxesValue.toFixed(2)}` : '—'}</td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Total da Mercadoria</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-gray-700">R$ {merchandiseTotal.toFixed(2)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Frete</td>
                                                            <td className="px-4 py-2 text-right font-semibold text-gray-700">R$ {order.freight?.toFixed(2)}</td>
                                                        </tr>
                                                        <tr className="bg-gray-50">
                                                            <td colSpan={5} className="px-4 py-2 text-right font-bold text-gray-900">Valor Total da Nota</td>
                                                            <td className="px-4 py-2 text-right font-bold text-gray-900">R$ {notaTotal.toFixed(2)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Condições de Pagamento</td>
                                                            <td className="px-4 py-2 text-right text-gray-700 text-xs whitespace-nowrap">{paymentLabel || '—'}</td>
                                                        </tr>
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Prazo de Entrega</td>
                                                            <td className="px-4 py-2 text-right text-gray-700 text-xs whitespace-nowrap">{deliveryLabel || '—'}</td>
                                                        </tr>
                                                        {validityLabel && (
                                                            <tr>
                                                                <td colSpan={5} className="px-4 py-2 text-right font-semibold text-gray-700">Validade da Proposta</td>
                                                                <td className="px-4 py-2 text-right text-gray-700 text-xs whitespace-nowrap">{validityLabel}</td>
                                                            </tr>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                    </table>

                                    {(supplierObs || supplierAnexos.length > 0) && (
                                        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            {supplierObs && (
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Obs.</p>
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{supplierObs}</p>
                                                </div>
                                            )}
                                            {supplierAnexos.length > 0 && (
                                                <div className={supplierObs ? 'mt-2' : ''}>
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Anexos da Proposta</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {supplierAnexos.map((anexo: any, anexoIdx: number) => (
                                                            <a
                                                                key={anexo.id || anexoIdx}
                                                                href={anexo.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 rounded-full bg-white border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                                                title={anexo.nome}
                                                            >
                                                                📎 <span className="truncate max-w-[12rem]">{anexo.nome}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Autorização do cliente e aceite do fornecedor, com data */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Autorizado pelo Cliente</p>
                                            <p className="text-sm font-semibold text-emerald-900">{clientInfo?.razao_social || clientInfo?.nome || 'Cliente'}</p>
                                            {order.createdAt && (
                                                <p className="text-xs text-emerald-700">{formatDateTime(order.createdAt)}</p>
                                            )}
                                        </div>
                                        <div className={`rounded-lg border px-4 py-3 ${order.dataConfirmacao ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                                            <p className={`text-[11px] font-bold uppercase tracking-wide ${order.dataConfirmacao ? 'text-emerald-700' : 'text-amber-700'}`}>Aceite do Fornecedor</p>
                                            <p className={`text-sm font-semibold ${order.dataConfirmacao ? 'text-emerald-900' : 'text-amber-800'}`}>
                                                {order.dataConfirmacao ? order.supplierName : 'Aguardando aceite do fornecedor'}
                                            </p>
                                            {order.dataConfirmacao && (
                                                <p className="text-xs text-emerald-700">{formatDateTime(order.dataConfirmacao)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {visibleOrders.length === 0 && showOnlyDelayedSuborders && (
                        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                            Nenhum subpedido atrasado no momento.
                        </div>
                    )}
                </div>
                )}

                {/* Este branch retorna antes do render principal, então os modais
                    precisam ser renderizados aqui também */}
                {reportModal && (
                    <ReportModal
                        isOpen={reportModal.isOpen}
                        onClose={() => setReportModal(null)}
                        targetType="fornecedor"
                        targetId={reportModal.supplierId}
                        contextName={reportModal.supplierName}
                    />
                )}
                {reviewModal && (
                    <ReviewModal
                        isOpen={reviewModal.isOpen}
                        onClose={() => setReviewModal(null)}
                        supplierId={reviewModal.supplierId}
                        supplierName={reviewModal.supplierName}
                        orderId={orderId}
                    />
                )}
            </div>
        );
    }

    if (!proposals.length) {
        return (
            <div className="space-y-6 mt-6">
                {/* Status banner */}
                <div className="p-6 text-center bg-white rounded-lg border border-gray-200">
                    <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Aguardando Propostas</h3>
                    <p className="text-gray-500 mt-2 max-w-md mx-auto">
                        Os fornecedores estão analisando seu pedido. O mapa comparativo será gerado automaticamente assim que recebermos as primeiras propostas.
                    </p>
                    {totalPropostas > 0 && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-semibold text-blue-700">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            {totalPropostas} {totalPropostas === 1 ? 'proposta recebida' : 'propostas recebidas'}
                        </div>
                    )}
                </div>

                {/* Items table - Mapa de Preços preview */}
                {quotation && quotation.items.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="text-base font-semibold text-gray-900">Mapa de Preços</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{quotation.items.length} {quotation.items.length === 1 ? 'item' : 'itens'} na cotação</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Unitário</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {quotation.items.map((item: any, idx: number) => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">{item.descricao}</div>
                                                {item.observacao && (
                                                    <div className="text-xs text-gray-400 mt-0.5">{item.observacao}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{item.quantidade}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.unidade}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                                                    Aguardando
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                                                    Aguardando
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={4} className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total Estimado</td>
                                        <td colSpan={2} className="px-6 py-3 text-right">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                                                {currentStatusBadge.label}
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Mapa de nomes anônimos para o mapa comparativo (oculta nome real do fornecedor)
    const anonymousNameMap = new Map<string, string>();
    [...proposals]
        .sort((a, b) => (a.totalValue + (a.freightPrice || 0)) - (b.totalValue + (b.freightPrice || 0)))
        .forEach((p, idx) => {
            anonymousNameMap.set(String(p.supplierId), `Fornecedor ${idx + 1}`);
        });
    const getAnonymousName = (supplierId: string | number) => anonymousNameMap.get(String(supplierId)) || 'Fornecedor';
    const findProposalBySupplierId = (supplierId: string | number) =>
        proposals.find((p) => String(p.supplierId) === String(supplierId));

    // Helper to find price of an item in a proposal
    const getItemPrice = (proposal: any, itemId: string | number) => {
        const item = proposal.items.find((i: any) => i.itemId === itemId);
        return item ? parseFloat(item.price) : 0;
    };

    const getItemTotal = (proposal: any, itemId: string | number) => {
        const item = proposal.items.find((i: any) => i.itemId === itemId);
        return item ? parseFloat(item.price) * item.quantity : 0;
    };

    // Revelação por mérito: APENAS o fornecedor que cotou TODOS os itens e tem
    // o melhor preço total tem o nome real revelado no mapa; os demais
    // permanecem ocultos até o fechamento do pedido.
    const revealedSupplierId = (() => {
        const best = getBestTotalStrategy();
        return best.supplierId ? String(best.supplierId) : null;
    })();
    const isRevealedSupplier = (supplierId: string | number) =>
        revealedSupplierId !== null && String(supplierId) === revealedSupplierId;
    const getDisplaySupplierName = (supplierId: string | number) => {
        if (isRevealedSupplier(supplierId)) {
            const revealed = proposals.find((p: any) => String(p.supplierId) === revealedSupplierId);
            if (revealed?.supplierName) return revealed.supplierName;
        }
        return getAnonymousName(supplierId);
    };

    const getItemAvailability = (proposal: any, itemId: string | number): string => {
        const item = proposal.items.find((i: any) => i.itemId === itemId);
        return item?.disponibilidade || 'disponivel';
    };

    const getAvailabilityLabel = (disponibilidade: string): { label: string; color: string } => {
        switch (disponibilidade) {
            case 'disponivel':
                return { label: 'Imediata', color: 'text-green-600' };
            case 'sob_consulta':
                return { label: 'Consulta', color: 'text-yellow-600' };
            case 'indisponivel':
                return { label: 'Indisponível', color: 'text-red-600' };
            default:
                return { label: 'Imediata', color: 'text-green-600' };
        }
    };

    function bestSupplier(itemId: string | number): string | null {
        let bestId: string | null = null;
        let bestPrice: number | null = null;

        proposals.forEach((p) => {
            const price = getItemPrice(p, itemId);
            if (price > 0) {
                if (bestPrice === null || price < bestPrice) {
                    bestPrice = price;
                    bestId = p.supplierId; // Using supplierId to identify column
                }
            }
        });

        return bestId;
    }

    // Get ranking (1st, 2nd, 3rd) of supplier for a given item
    function getSupplierRank(itemId: string | number, supplierId: string): number | null {
        const pricesWithSupplier = proposals
            .map(p => ({ supplierId: p.supplierId, price: getItemPrice(p, itemId) }))
            .filter(x => x.price > 0)
            .sort((a, b) => a.price - b.price);

        const idx = pricesWithSupplier.findIndex(x => x.supplierId === supplierId);
        return idx >= 0 ? idx + 1 : null;
    }

    const rankEmoji = (rank: number | null) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return null;
    };

    function columnTotal(supplierId: string) {
        const proposal = findProposalBySupplierId(supplierId);
        return proposal ? proposal.totalValue : 0;
    }

    function handleSelectSupplier(itemId: string | number, supplierId: string) {
        setSelectedSuppliers((prev) => ({
            ...prev,
            [itemId]: supplierId,
        }));
    }

    function handleSelectBestPerItem() {
        const newSelections: { [itemId: string]: string } = {};
        quotation.items.forEach((item: any) => {
            const best = bestSupplier(item.id);
            if (best) {
                newSelections[item.id] = best;
            }
        });
        setSelectedSuppliers(newSelections);
    }

    function getBestTotalStrategy() {
        let bestSupplierId: string | null = null;
        let bestMerchandiseTotal = 0;
        let bestFreight = 0;
        let bestGrandTotal = Infinity;

        proposals.forEach((proposal) => {
            const coversAllItems = quotation.items.every((item: any) => getItemPrice(proposal, item.id) > 0);
            if (!coversAllItems) return;

            const merchandiseTotal = quotation.items.reduce((sum: number, item: any) => {
                return sum + getItemTotal(proposal, item.id);
            }, 0);

            const freight = proposal.freightPrice || 0;
            const grandTotal = merchandiseTotal + freight;

            if (grandTotal < bestGrandTotal) {
                bestGrandTotal = grandTotal;
                bestSupplierId = String(proposal.supplierId);
                bestMerchandiseTotal = merchandiseTotal;
                bestFreight = freight;
            }
        });

        return {
            supplierId: bestSupplierId,
            merchandiseTotal: bestMerchandiseTotal,
            freight: bestFreight,
            total: Number.isFinite(bestGrandTotal) ? bestGrandTotal : 0
        };
    }

    function getBestPerItemStrategy() {
        let merchandiseTotal = 0;
        const selectedSupplierIds = new Set<string>();

        quotation.items.forEach((item: any) => {
            const best = bestSupplier(item.id);
            if (!best) return;

            const proposal = findProposalBySupplierId(best);
            if (!proposal) return;

            selectedSupplierIds.add(String(best));
            merchandiseTotal += getItemTotal(proposal, item.id);
        });

        const freightTotal = Array.from(selectedSupplierIds).reduce((sum, supplierId) => {
            const proposal = findProposalBySupplierId(supplierId);
            return sum + (proposal?.freightPrice || 0);
        }, 0);

        return {
            merchandiseTotal,
            freightSuppliersCount: selectedSupplierIds.size,
            freightTotal,
            total: merchandiseTotal + freightTotal
        };
    }


    function handleSelectBestWithFreight() {
        const strategy = getBestTotalStrategy();
        const bestSupplierId = strategy.supplierId;

        if (bestSupplierId) {
            const newSelections: { [itemId: string]: string } = {};
            quotation.items.forEach((item: any) => {
                // Only select if this supplier actually quoted the item
                if (getItemPrice(proposals.find(p => p.supplierId === bestSupplierId), item.id) > 0) {
                    newSelections[item.id] = bestSupplierId!;
                }
            });
            setSelectedSuppliers(newSelections);
        }
    }

    function handleGenerateOC() {
        if (Object.keys(selectedSuppliers).length === 0) {
            showToast("error", "Selecione pelo menos um fornecedor para os itens.");
            return;
        }
        setView("oc");
    }

    async function handleFinalizeOrder() {
        if (!quotation || !orderId) return;
        if (finalizingOrder) return;

        try {
            setFinalizingOrder(true);
            // Group items by supplier
            const supplierGroups: any[] = [];
            const groupedBySupplier: { [key: string]: any[] } = {};

            quotation.items.forEach((item: any) => {
                const selectedId = selectedSuppliers[item.id];
                if (selectedId) {
                    if (!groupedBySupplier[selectedId]) {
                        groupedBySupplier[selectedId] = [];
                    }

                    const proposal = findProposalBySupplierId(selectedId);
                    const price = getItemPrice(proposal, item.id);
                    const total = price * item.quantidade;

                    groupedBySupplier[selectedId].push({
                        id: item.id,
                        name: item.descricao,
                        quantity: item.quantidade,
                        unit: item.unidade,
                        unitPrice: price,
                        total: total,
                        observation: item.observacao || ""
                    });
                }
            });

            for (const [supplierId, items] of Object.entries(groupedBySupplier)) {
                const proposal = findProposalBySupplierId(supplierId);
                supplierGroups.push({
                    supplierId,
                    proposalId: proposal?.id,
                    supplierUserId: proposal?.supplierUserId,
                    supplierName: proposal?.supplierName || 'Fornecedor',
                    supplierDetails: proposal?.supplierDetails || {
                        name: proposal?.supplierName || 'Fornecedor',
                        document: '',
                        email: '',
                        phone: '',
                        address: ''
                    },
                    freightPrice: proposal?.freightPrice || 0,
                    impostos: proposal?.impostos || 0,
                    deliveryDays: proposal?.deliveryDays ?? null,
                    paymentMethod: proposal?.paymentMethod || null,
                    items
                });
            }

            const res = await authFetch('/api/cotacoes/detail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'finalize-order',
                    cotacaoId: orderId,
                    obraId: quotation.obra_id,
                    itemsBySupplier: supplierGroups
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao finalizar pedido');
            }

            showToast("success", "Pedidos gerados com sucesso!");
            window.location.reload();

        } catch (error) {
            console.error("Error finalizing order:", error);
            showToast("error", "Erro ao finalizar pedido. Tente novamente.");
        } finally {
            setFinalizingOrder(false);
        }
    }

    if (view === "oc") {
        // If finished, use the orders data which contains full details
        if (status === "fechada" && orders.length > 0) {
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-900">Pedidos Confirmados</h2>
                        <button onClick={() => setView("map")} className="text-sm text-blue-600 hover:underline">Voltar ao Mapa</button>
                    </div>
                    {orders.map(order => (
                        <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{order.supplierDetails?.name || order.supplierName}</h3>
                                    <div className="text-sm text-slate-600 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                                        <p><span className="font-medium">CNPJ:</span> {order.supplierDetails?.document || "N/A"}</p>
                                        <p><span className="font-medium">Email:</span> {order.supplierDetails?.email || "N/A"}</p>
                                        <p><span className="font-medium">Telefone:</span> {order.supplierDetails?.phone || "N/A"}</p>
                                        <p><span className="font-medium">Endereço:</span> {order.supplierDetails?.address || "N/A"}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Total Pedido</p>
                                    <p className="text-lg font-bold text-slate-900">R$ {order.total.toFixed(2)}</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Prazo de entrega: {order.deliveryDays === null || order.deliveryDays === undefined
                                            ? 'N/A'
                                            : order.deliveryDays === 0
                                                ? 'Hoje'
                                                : `${order.deliveryDays} dias`}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Pagamento: {order.paymentMethod || 'N/A'}
                                    </p>
                                    <button
                                        onClick={() => setReviewModal({ isOpen: true, supplierId: order.supplierId, supplierName: order.supplierName })}
                                        className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center justify-end gap-1 ml-auto"
                                    >
                                        <Star className="h-4 w-4" /> Avaliar Fornecedor
                                    </button>
                                </div>
                            </div>

                            <table className="min-w-full text-sm mb-4">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Item</th>
                                        <th className="px-4 py-2 text-center">Qtde</th>
                                        <th className="px-4 py-2 text-right">Unitário</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {order.items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-2 font-medium text-slate-900">{item.name || item.descricao}</td>
                                            <td className="px-4 py-2 text-center">{item.quantity || item.quantidade}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-700">Frete</td>
                                        <td className="px-4 py-2 text-right font-semibold text-slate-700">R$ {order.freight.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="flex justify-end">
                                <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                    <Download className="h-4 w-4" />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // Group items by selected supplier
        const itemsBySupplier: { [key: string]: any[] } = {};
        quotation.items.forEach((item: any) => {
            const selectedId = selectedSuppliers[item.id];
            if (selectedId) {
                if (!itemsBySupplier[selectedId]) {
                    itemsBySupplier[selectedId] = [];
                }

                const proposal = findProposalBySupplierId(selectedId);
                const price = getItemPrice(proposal, item.id);
                const total = price * item.quantidade;

                itemsBySupplier[selectedId].push({
                    ...item,
                    unitPrice: price,
                    total: total
                });
            }
        });

        const totalGlobal = Object.entries(itemsBySupplier).reduce((sum, [supplierId, items]) => {
            const supplierTotal = (items as any[]).reduce((itemsSum: number, item: any) => itemsSum + item.total, 0);
            const proposal = findProposalBySupplierId(supplierId);
            const freight = proposal?.freightPrice || 0;
            return sum + supplierTotal + freight;
        }, 0);

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Ordem de Compra Gerada</h2>
                    <button
                        onClick={() => setView("map")}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        Voltar ao Mapa
                    </button>
                </div>

                {Object.entries(itemsBySupplier).map(([supplierId, items]) => {
                    const proposal = findProposalBySupplierId(supplierId);
                    const supplierLabel = getDisplaySupplierName(supplierId);
                    const supplierTotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
                    const freight = proposal?.freightPrice || 0;
                    const deliveryDays = proposal?.deliveryDays;
                    const paymentMethod = proposal?.paymentMethod;

                    return (
                        <div key={supplierId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{supplierLabel}</h3>
                                    <p className="text-sm text-slate-500">Fornecedor Selecionado</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Total Pedido</p>
                                    <p className="text-lg font-bold text-slate-900">R$ {(supplierTotal + freight).toFixed(2)}</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Prazo de entrega: {deliveryDays === null || deliveryDays === undefined
                                            ? 'N/A'
                                            : deliveryDays === 0
                                                ? 'Hoje'
                                                : `${deliveryDays} dias`}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Pagamento: {paymentMethod || 'N/A'}
                                    </p>
                                    {status === "fechada" && (
                                        <button
                                            onClick={() => setReviewModal({ isOpen: true, supplierId, supplierName: supplierLabel })}
                                            className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center justify-end gap-1"
                                        >
                                            <Star className="h-4 w-4" /> Avaliar Fornecedor
                                        </button>
                                    )}
                                </div>
                            </div>

                            <table className="min-w-full text-sm mb-4">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Item</th>
                                        <th className="px-4 py-2 text-center">Qtde</th>
                                        <th className="px-4 py-2 text-right">Unitário</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-2 font-medium text-slate-900">{item.descricao}</td>
                                            <td className="px-4 py-2 text-center">{item.quantidade}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-700">Frete</td>
                                        <td className="px-4 py-2 text-right font-semibold text-slate-700">R$ {freight.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="flex justify-end">
                                <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                    <Download className="h-4 w-4" />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>
                    );
                })}

                <div className="flex justify-end pt-6 border-t border-slate-200">
                    <div className="text-right">
                        <p className="text-sm text-slate-500 mb-1">Total Geral dos Pedidos</p>
                        <p className="text-2xl font-bold text-slate-900 mb-4">R$ {totalGlobal.toFixed(2)}</p>
                        <button
                            onClick={handleFinalizeOrder}
                            disabled={finalizingOrder}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-lg hover:bg-green-700 transition-all"
                        >
                            {finalizingOrder ? 'Finalizando...' : 'Confirmar e Finalizar Pedidos'}
                        </button>
                    </div>
                </div>

                {/* Este branch retorna antes do render principal, então os modais
                    precisam ser renderizados aqui também */}
                {reviewModal && (
                    <ReviewModal
                        isOpen={reviewModal.isOpen}
                        onClose={() => setReviewModal(null)}
                        supplierId={reviewModal.supplierId}
                        supplierName={reviewModal.supplierName}
                        orderId={orderId}
                    />
                )}
                {reportModal && (
                    <ReportModal
                        isOpen={reportModal.isOpen}
                        onClose={() => setReportModal(null)}
                        targetType="fornecedor"
                        targetId={reportModal.supplierId}
                        contextName={reportModal.supplierName}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Mapa comparativo
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">
                        Selecione os melhores fornecedores
                    </h2>
                    <p className="text-sm text-slate-500">
                        Compare preços, fretes e selecione o fornecedor para cada item ou grupo.
                    </p>
                    <div className="mt-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${currentStatusBadge.color}`}>
                            {currentStatusBadge.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Contador de Propostas Recebidas */}
            <div className="mt-4 flex items-center gap-4">
                <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <div className="flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-lg text-white font-bold text-sm">
                        {totalPropostas || proposals.length}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-indigo-900">
                            {(totalPropostas || proposals.length) === 1 ? 'Cotação Recebida' : 'Cotações Recebidas'}
                        </p>
                        {totalPropostas > proposals.length && (
                            <p className="text-xs text-indigo-500">Exibindo as {proposals.length} melhores</p>
                        )}
                    </div>
                </div>
            </div>

            {(() => {
                const bestTotal = getBestTotalStrategy();
                const bestPerItem = getBestPerItemStrategy();
                const bestSupplierName = bestTotal.supplierId ? getDisplaySupplierName(bestTotal.supplierId) : 'Sem cobertura total';

                return (
                    <div className="mt-6 sticky top-4 z-20 rounded-2xl border border-slate-200 bg-slate-50/95 backdrop-blur-sm p-4 shadow-sm">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Melhor Preço Total</p>
                                <p className="mt-2 text-base font-semibold text-slate-900">{bestSupplierName}</p>
                                <p className="mt-2 text-sm text-slate-700">Total R$ {bestTotal.total.toFixed(2)}</p>
                                <p className="text-sm text-slate-700">Frete R$ {bestTotal.freight.toFixed(2)}</p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Melhor Preço por Item</p>
                                <p className="mt-2 text-sm text-slate-700">Total R$ {bestPerItem.total.toFixed(2)}</p>
                                <p className="text-sm text-slate-700">Qde de frete: {bestPerItem.freightSuppliersCount}</p>
                                <p className="text-sm text-slate-700">Frete total R$ {bestPerItem.freightTotal.toFixed(2)}</p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-2 justify-center">
                                <button
                                    onClick={handleSelectBestWithFreight}
                                    className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
                                >
                                    Melhor Preço Total
                                </button>
                                <button
                                    onClick={handleSelectBestPerItem}
                                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
                                >
                                    Melhor Preço por Item
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th rowSpan={2} className="border-b border-slate-100 px-3 py-3 text-black text-center w-14">Itens</th>
                            <th rowSpan={2} className="border-b border-slate-100 px-4 py-3 text-black text-left">Descrição dos Materiais</th>
                            <th rowSpan={2} className="border-b border-slate-100 px-3 py-3 text-black text-center w-16">Qtde</th>
                            <th rowSpan={2} className="border-b border-slate-100 px-3 py-3 text-black text-center w-16">Unid.</th>
                            {proposals.map((proposal) => (
                                <th key={proposal.id} colSpan={2} className="border-b border-l border-slate-200 px-4 py-2 text-black text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <span>{getDisplaySupplierName(proposal.supplierId)}</span>
                                        {isRevealedSupplier(proposal.supplierId) && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 normal-case">
                                                🏆 Melhor preço total
                                            </span>
                                        )}
                                        {proposal.numero && (
                                            <span className="text-xs text-gray-600 font-normal">
                                                {proposal.numero}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (!orderId) return;
                                                setChatContext({
                                                    recipientName: 'Fornecedor',
                                                    recipientId: proposal.supplierUserId,
                                                    initialRoomId: `${orderId}::${proposal.supplierId}`,
                                                    initialRoomTitle: 'Cotação',
                                                });
                                                window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { recipientId: proposal.supplierUserId } }));
                                            }}
                                            className="text-xs font-normal text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full"
                                        >
                                            <MessageSquare className="h-3 w-3" />
                                            Chat
                                        </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {proposals.map((proposal) => (
                                <Fragment key={`sub-${proposal.id}`}>
                                    <th className="border-b border-l border-slate-200 px-3 py-2 text-black text-center text-[11px]">Unitário</th>
                                    <th className="border-b border-slate-100 px-3 py-2 text-black text-center text-[11px]">Total</th>
                                </Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {quotation.items.map((item: any, itemIndex: number) => {
                            const highlight = bestSupplier(item.id);
                            const bestPriceInTop3 = proposals.reduce((best: number | null, proposal: any) => {
                                const price = getItemPrice(proposal, item.id);
                                if (price <= 0) return best;
                                if (best === null || price < best) return price;
                                return best;
                            }, null);

                            const bestPriceOutsideTop3 = allProposals
                                .filter((proposal: any) => !proposals.some((top: any) => String(top.id) === String(proposal.id)))
                                .reduce((best: number | null, proposal: any) => {
                                    const price = getItemPrice(proposal, item.id);
                                    if (price <= 0) return best;
                                    if (best === null || price < best) return price;
                                    return best;
                                }, null);

                            const shouldShowExternalBest =
                                bestPriceOutsideTop3 !== null
                                && (bestPriceInTop3 === null || bestPriceOutsideTop3 < bestPriceInTop3);

                            return (
                                <tr key={item.id} className="odd:bg-white even:bg-slate-50/60">
                                    <td className="border-b border-slate-100 px-3 py-3 text-center text-slate-500 font-semibold">
                                        {itemIndex + 1}
                                    </td>
                                    <td className="border-b border-slate-100 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-semibold text-slate-900">{item.descricao}</p>
                                            {shouldShowExternalBest && (
                                                <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                                                    Fora Top 3: R$ {bestPriceOutsideTop3!.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                        {item.fabricante && (
                                            <p className="text-xs text-blue-600 mt-0.5">Fabricante: {item.fabricante}</p>
                                        )}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-3 text-center text-slate-900 font-medium">
                                        {item.quantidade}
                                    </td>
                                    <td className="border-b border-slate-100 px-3 py-3 text-center text-slate-700">
                                        {item.unidade}
                                    </td>
                                    {proposals.map((proposal) => {
                                        const price = getItemPrice(proposal, item.id);
                                        const total = getItemTotal(proposal, item.id);
                                        const isBest = highlight === proposal.supplierId && price > 0;
                                        const isSelected = selectedSuppliers[item.id] === proposal.supplierId;
                                        const rank = price > 0 ? getSupplierRank(item.id, proposal.supplierId) : null;
                                        const medal = rankEmoji(rank);
                                        const cellClass = `border-b border-slate-100 px-3 py-3 text-center cursor-pointer transition-colors
                                            ${isSelected ? "bg-blue-100 ring-2 ring-inset ring-blue-500" : isBest ? "bg-emerald-50/80 hover:bg-emerald-100" : rank && rank <= 3 ? "bg-green-50/40 hover:bg-green-50" : "hover:bg-slate-100"}`;
                                        const handleCellClick = () => price > 0 && handleSelectSupplier(item.id, proposal.supplierId);

                                        return (
                                            <Fragment key={`${item.id}-${proposal.id}`}>
                                                <td onClick={handleCellClick} className={`${cellClass} border-l border-slate-200`}>
                                                    {price > 0 ? (
                                                        <>
                                                            <div className={`text-sm font-semibold ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                                                                {medal && <span className="mr-1">{medal}</span>}
                                                                R$ {price.toFixed(2)}
                                                            </div>
                                                            {(() => {
                                                                const availability = getItemAvailability(proposal, item.id);
                                                                const availabilityInfo = getAvailabilityLabel(availability);
                                                                return (
                                                                    <div className={`text-[10px] font-medium mt-0.5 ${availabilityInfo.color}`}>
                                                                        {availabilityInfo.label}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Sem oferta</span>
                                                    )}
                                                </td>
                                                <td onClick={handleCellClick} className={cellClass}>
                                                    {price > 0 ? (
                                                        <>
                                                            <div className={`text-sm font-semibold ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                                                                R$ {total.toFixed(2)}
                                                            </div>
                                                            {isSelected && (
                                                                <div className="mt-0.5 text-[10px] font-bold text-blue-600 uppercase">
                                                                    Selecionado
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-slate-300">—</span>
                                                    )}
                                                </td>
                                            </Fragment>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {/* Rodapé no formato do Mapa de Preços da Comprar e Construir */}
                        {[
                            { key: 'desconto', label: 'Desconto à vista', render: (_p: any) => '—' },
                            { key: 'impostos', label: 'Impostos', render: (p: any) => (p.impostos > 0 ? `R$ ${p.impostos.toFixed(2)}` : '-') },
                            { key: 'mercadoria', label: 'Total da Mercadoria', render: (p: any) => `R$ ${p.totalValue.toFixed(2)}`, strong: true },
                            { key: 'frete', label: 'Frete', render: (p: any) => `R$ ${(p.freightPrice || 0).toFixed(2)}` },
                        ].map((rowDef, rowIdx) => (
                            <tr key={rowDef.key} className={`${rowIdx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} text-sm`}>
                                <td colSpan={4} className="border-t border-slate-100 px-4 py-2.5 text-right text-black font-semibold">{rowDef.label}</td>
                                {proposals.map((proposal) => (
                                    <td
                                        key={`${rowDef.key}-${proposal.id}`}
                                        colSpan={2}
                                        className={`border-t border-l border-slate-200 px-4 py-2.5 text-center ${rowDef.strong ? 'font-semibold text-slate-900' : 'text-slate-700 font-medium'}`}
                                    >
                                        {rowDef.render(proposal)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        <tr className="bg-slate-900/90 text-white">
                            <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold">Total Global</td>
                            {proposals.map((proposal) => (
                                <td key={`total-${proposal.id}`} colSpan={2} className="px-4 py-3 text-center text-sm font-bold border-l border-slate-700">
                                    R$ {(proposal.totalValue + (proposal.freightPrice || 0) + (proposal.impostos || 0)).toFixed(2)}
                                </td>
                            ))}
                        </tr>
                        {[
                            { key: 'payment', label: 'Condições de Pagamento', render: (p: any) => formatPaymentTerms(p.paymentMethod) || '-' },
                            {
                                key: 'delivery', label: 'Prazo de Entrega', render: (p: any) =>
                                    p.deliveryDays === null || p.deliveryDays === undefined
                                        ? '-'
                                        : p.deliveryDays === 0 ? 'Imediata' : `${p.deliveryDays} dias`
                            },
                            { key: 'validade', label: 'Validade da Proposta', render: (p: any) => p.validity || '-' },
                            { key: 'obs', label: 'Observações do Fornecedor', render: (p: any) => p.observacoes || '-' },
                        ].map((rowDef, rowIdx) => (
                            <tr key={rowDef.key} className={`${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} text-sm`}>
                                <td colSpan={4} className="border-t border-slate-100 px-4 py-2.5 text-right text-black font-semibold">{rowDef.label}</td>
                                {proposals.map((proposal) => (
                                    <td
                                        key={`${rowDef.key}-${proposal.id}`}
                                        colSpan={2}
                                        className="border-t border-l border-slate-200 px-4 py-2.5 text-center text-slate-700 text-xs whitespace-pre-wrap break-words max-w-[18rem]"
                                    >
                                        {rowDef.render(proposal)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        <tr className="bg-white text-sm">
                            <td colSpan={4} className="border-t border-slate-100 px-4 py-2.5 text-right text-black font-semibold">Anexos do Fornecedor</td>
                            {proposals.map((proposal) => (
                                <td
                                    key={`anexos-${proposal.id}`}
                                    colSpan={2}
                                    className="border-t border-l border-slate-200 px-4 py-2.5 text-center text-xs"
                                >
                                    {(proposal.anexos || []).length > 0 ? (
                                        <div className="flex flex-col items-center gap-1">
                                            {(proposal.anexos || []).map((anexo: any, index: number) => (
                                                <a
                                                    key={anexo.id || index}
                                                    href={anexo.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline truncate max-w-[10rem]"
                                                    title={anexo.nome}
                                                >
                                                    📎 {anexo.nome}
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-slate-400">-</span>
                                    )}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleGenerateOC}
                    className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                >
                    Gerar Ordem de Compra
                </button>
            </div>

            {chatContext && (
                <ChatInterface
                    recipientName={chatContext.recipientName}
                    recipientId={chatContext.recipientId || ''}
                    initialRoomId={chatContext.initialRoomId}
                    initialRoomTitle={chatContext.initialRoomTitle}
                    isOpen={!!chatContext}
                    onClose={() => {
                        if (chatContext?.recipientId) {
                            window.dispatchEvent(new CustomEvent('chat-room-closed', { detail: { recipientId: chatContext.recipientId } }));
                        }
                        setChatContext(null);
                    }}
                />
            )}

            {reviewModal && (
                <ReviewModal
                    isOpen={reviewModal.isOpen}
                    onClose={() => setReviewModal(null)}
                    supplierId={reviewModal.supplierId}
                    supplierName={reviewModal.supplierName}
                    orderId={orderId}
                />
            )}

            {reportModal && (
                <ReportModal
                    isOpen={reportModal.isOpen}
                    onClose={() => setReportModal(null)}
                    targetType="fornecedor"
                    targetId={reportModal.supplierId}
                    contextName={reportModal.supplierName}
                />
            )}
        </div>
    );
}
