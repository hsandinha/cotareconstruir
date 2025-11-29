"use client";

import { useState } from "react";
import { ArrowRightIcon, CalendarIcon, MapPinIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { ClientComparativeSection } from "./ComparativeSection";

// Mock de pedidos
const orders = [
    {
        id: "REQ-2025-001",
        work: "Cond. Ed. A. Nogueira",
        date: "28/11/2025",
        items: 12,
        status: "Propostas Recebidas",
        statusColor: "text-green-700 bg-green-50",
        totalEstimado: "R$ 12.450,00"
    },
    {
        id: "REQ-2025-002",
        work: "Reforma Escritório Savassi",
        date: "29/11/2025",
        items: 5,
        status: "Aguardando Fornecedores",
        statusColor: "text-yellow-700 bg-yellow-50",
        totalEstimado: "-"
    },
    {
        id: "REQ-2025-003",
        work: "Cond. Ed. A. Nogueira",
        date: "25/11/2025",
        items: 8,
        status: "Finalizado",
        statusColor: "text-gray-700 bg-gray-50",
        totalEstimado: "R$ 8.200,00"
    }
];

export function ClientOrderSection() {
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

    if (selectedOrder) {
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
                        <h2 className="text-xl font-bold text-gray-900">Pedido {selectedOrder}</h2>
                        <p className="text-sm text-gray-500 mt-1">Cond. Ed. A. Nogueira • Criado em 28/11/2025</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            Propostas Recebidas
                        </span>
                    </div>
                </div>

                {/* Mapa Comparativo */}
                <ClientComparativeSection />
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
                {orders.map((order) => (
                    <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order.id)}
                        className="group bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    >
                        <div className="flex items-start justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-semibold text-blue-600 group-hover:text-blue-700">
                                        {order.id}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${order.statusColor}`}>
                                        {order.status}
                                    </span>
                                </div>

                                <div className="flex items-center gap-6 text-sm text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <MapPinIcon className="h-4 w-4" />
                                        {order.work}
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
                ))}
            </div>
        </div>
    );
}
