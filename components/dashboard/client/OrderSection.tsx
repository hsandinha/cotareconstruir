"use client";

import { useState, useEffect } from "react";
import { ArrowRightIcon, CalendarIcon, MapPinIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { ClientComparativeSection } from "./ComparativeSection";
import { auth, db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export function ClientOrderSection() {
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [worksMap, setWorksMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Fetch Works to map IDs to Names
                const qWorks = query(collection(db, "works"), where("userId", "==", user.uid));
                const unsubscribeWorks = onSnapshot(qWorks, (snapshot) => {
                    const map: Record<string, string> = {};
                    snapshot.docs.forEach(doc => {
                        map[doc.id] = doc.data().obra;
                    });
                    setWorksMap(map);
                });

                // Fetch Quotations (Orders)
                const qQuotations = query(
                    collection(db, "quotations"),
                    where("userId", "==", user.uid)
                );

                const unsubscribeQuotations = onSnapshot(qQuotations, (snapshot) => {
                    const ordersData = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            workId: data.workId,
                            date: data.createdAt ? new Date(data.createdAt).toLocaleDateString('pt-BR') : 'Data desconhecida',
                            timestamp: data.createdAt ? new Date(data.createdAt).getTime() : 0,
                            items: data.totalItems || (data.items ? data.items.length : 0),
                            status: mapStatus(data.status),
                            statusColor: mapStatusColor(data.status),
                            totalEstimado: "-" // Placeholder
                        };
                    });
                    // Sort by date descending
                    ordersData.sort((a, b) => b.timestamp - a.timestamp);
                    setOrders(ordersData);
                    setLoading(false);
                });

                return () => {
                    unsubscribeWorks();
                    unsubscribeQuotations();
                };
            } else {
                setOrders([]);
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const mapStatus = (status: string) => {
        switch (status) {
            case 'pending': return 'Aguardando Fornecedores';
            case 'received': return 'Propostas Recebidas';
            case 'finished': return 'Finalizado';
            default: return 'Em Análise';
        }
    };

    const mapStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'text-yellow-700 bg-yellow-50';
            case 'received': return 'text-green-700 bg-green-50';
            case 'finished': return 'text-gray-700 bg-gray-50';
            default: return 'text-blue-700 bg-blue-50';
        }
    };

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
                        <h2 className="text-xl font-bold text-gray-900">Pedido #{order.id.slice(0, 8)}</h2>
                        <p className="text-sm text-gray-500 mt-1">{worksMap[order.workId] || "Obra não identificada"} • Criado em {order.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.statusColor}`}>
                            {order.status}
                        </span>
                    </div>
                </div>

                {/* Mapa Comparativo */}
                <ClientComparativeSection orderId={order.id} status={order.status} />
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
                                            #{order.id.slice(0, 8)}
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
