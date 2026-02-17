"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRightIcon, CalendarIcon, MapPinIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { ClientComparativeSection } from "./ComparativeSection";
import { getQuotationStatusBadge } from "./quotationStatus";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/authHeaders";

export function ClientOrderSection() {
    const { user, initialized } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [worksMap, setWorksMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const deepLinkHandledRef = useRef<string | null>(null);

    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        // Buscar obras para mapear IDs para nomes
        const fetchWorks = async () => {
            try {
                const res = await authFetch('/api/cotacoes/detail?action=list-obras');
                if (!res.ok) return;
                const json = await res.json();
                const map: Record<string, string> = {};
                (json.data || []).forEach((doc: any) => {
                    map[doc.id] = doc.nome;
                });
                setWorksMap(map);
            } catch (error) {
                console.error('Erro ao buscar obras:', error);
            }
        };

        // Buscar cotações (Orders)
        const fetchQuotations = async () => {
            try {
                const res = await authFetch('/api/cotacoes/detail?action=list');
                if (!res.ok) {
                    console.error("Erro ao carregar pedidos:", res.status);
                    setOrders([]);
                    setLoading(false);
                    return;
                }
                const json = await res.json();
                const data = json.data || [];
                const ordersData = data.map((doc: any) => {
                    const statusBadge = getQuotationStatusBadge(doc.status, doc.propostas_count || 0);

                    return {
                        id: doc.id,
                        numero: doc.numero || doc.id.slice(0, 8),
                        workId: doc.obra_id,
                        date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-BR') : 'Data desconhecida',
                        timestamp: doc.created_at ? new Date(doc.created_at).getTime() : 0,
                        items: doc.cotacao_itens?.length || 0,
                        rawStatus: doc.status,
                        status: statusBadge.label,
                        statusColor: statusBadge.color,
                        totalEstimado: "-",
                        propostas_count: doc.propostas_count || 0
                    };
                });
                ordersData.sort((a: any, b: any) => b.timestamp - a.timestamp);
                setOrders(ordersData);
            } catch (error) {
                console.error("Erro ao carregar pedidos:", error);
                setOrders([]);
            }
            setLoading(false);
        };

        fetchWorks();
        fetchQuotations();

        // Configurar subscriptions realtime - just trigger refetch
        const worksChannel = supabase
            .channel('works_orders_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'obras',
                    filter: `user_id=eq.${user.id}`
                },
                () => { fetchWorks(); }
            )
            .subscribe();

        const quotationsChannel = supabase
            .channel('quotations_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cotacoes',
                    filter: `user_id=eq.${user.id}`
                },
                () => { fetchQuotations(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(worksChannel);
            supabase.removeChannel(quotationsChannel);
        };
    }, [user, initialized]);

    useEffect(() => {
        if (orders.length === 0) return;
        if (!searchParams) return;

        const cotacaoId = String(searchParams.get('cotacaoId') || '').trim();
        if (!cotacaoId) return;

        const deepLinkKey = `cotacao:${cotacaoId}`;
        if (deepLinkHandledRef.current === deepLinkKey) return;

        const targetOrder = orders.find((order) => String(order.id) === cotacaoId);
        if (!targetOrder) return;

        setSelectedOrder(targetOrder.id);
        deepLinkHandledRef.current = deepLinkKey;

        const params = new URLSearchParams(searchParams.toString());
        params.delete('cotacaoId');
        params.delete('pedidoId');
        params.delete('chatRoom');
        const nextQuery = params.toString();
        const currentPath = pathname || '/dashboard/cliente';
        router.replace(nextQuery ? `${currentPath}?${nextQuery}` : currentPath);
    }, [orders, searchParams]);

    if (selectedOrder) {
        const order = orders.find(o => o.id === selectedOrder);
        if (!order) return null;

        return (
            <div className="space-y-6">
                <button
                    onClick={() => setSelectedOrder(null)}
                    className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                    <ArrowRightIcon className="h-4 w-4 mr-1 rotate-180" />
                    Voltar para Meus Pedidos
                </button>

                <div className="flex items-center justify-between bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Pedido #{order.numero}</h2>
                        <p className="text-sm text-gray-500 mt-1">{worksMap[order.workId] || "Obra não identificada"} • Criado em {order.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.statusColor}`}>
                            {order.status}
                        </span>
                    </div>
                </div>

                {/* Mapa Comparativo */}
                <ClientComparativeSection orderId={order.id} status={order.rawStatus} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Meus Pedidos</h2>
                    <p className="text-gray-600 mt-1">Acompanhe suas solicitações de cotação e pedidos de compra.</p>
                </div>
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-500">Carregando pedidos...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-500">Nenhum pedido encontrado.</p>
                    </div>
                ) : (
                    orders.map((order) => (
                        <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order.id)}
                            className="group bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-semibold text-blue-600 group-hover:text-blue-700">
                                            #{order.numero}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${order.statusColor}`}>
                                            {order.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-6 text-sm text-gray-600">
                                        <div className="flex items-center gap-1.5">
                                            <MapPinIcon className="h-4 w-4" />
                                            {worksMap[order.workId] || "Obra não identificada"}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <CalendarIcon className="h-4 w-4" />
                                            {order.date}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <DocumentTextIcon className="h-4 w-4" />
                                            {order.items} itens
                                        </div>
                                        {order.propostas_count > 0 && (
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${order.rawStatus === 'fechada'
                                                ? 'bg-gray-100 text-gray-600'
                                                : 'bg-green-100 text-green-700 animate-pulse'
                                                }`}>
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                {order.propostas_count} {order.propostas_count === 1 ? 'proposta' : 'propostas'}
                                                {order.rawStatus === 'fechada' ? ' recebidas' : ''}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-xs text-gray-500 mb-1">Valor Estimado</p>
                                    <p className="text-lg font-bold text-gray-900">{order.totalEstimado}</p>
                                    <div className="mt-4 flex justify-end">
                                        <span className="text-sm font-medium text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                            Ver Detalhes <ArrowRightIcon className="h-4 w-4" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
