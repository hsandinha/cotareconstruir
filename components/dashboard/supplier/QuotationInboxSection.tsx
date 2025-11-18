"use client";

import { useState } from "react";

export function SupplierQuotationInboxSection() {
    const [quotations] = useState([
        {
            id: 1,
            clientCode: "Cliente X-001",
            location: "Bairro: Vila Madalena",
            receivedAt: "2024-11-17 14:30",
            deadline: "2024-11-19 18:00",
            status: "Pendente",
            itemsCount: 12,
            urgency: "Alta"
        },
        {
            id: 2,
            clientCode: "Cliente Y-002",
            location: "Bairro: Pinheiros",
            receivedAt: "2024-11-16 09:15",
            deadline: "2024-11-18 17:00",
            status: "Respondida",
            itemsCount: 8,
            urgency: "Média"
        },
        {
            id: 3,
            clientCode: "Cliente Z-003",
            location: "Bairro: Itaim Bibi",
            receivedAt: "2024-11-15 16:45",
            deadline: "2024-11-17 12:00",
            status: "Expirada",
            itemsCount: 15,
            urgency: "Baixa"
        }
    ]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pendente': return 'bg-yellow-100 text-yellow-800';
            case 'Respondida': return 'bg-green-100 text-green-800';
            case 'Expirada': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'Alta': return 'bg-red-100 text-red-800';
            case 'Média': return 'bg-orange-100 text-orange-800';
            case 'Baixa': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900">Recebimento de Consultas de Cotação</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Gerencie as solicitações de cotação recebidas dos clientes
                </p>
            </div>

            {/* Informações de segurança */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-800">Protocolo de Segurança e Anonimato</h4>
                        <div className="mt-2 text-sm text-blue-700">
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Anonimato garantido:</strong> A identidade do cliente é protegida até a finalização do negócio</li>
                                <li><strong>Localização parcial:</strong> Apenas o bairro é informado para cálculo de frete</li>
                                <li><strong>Comunicação monitorada:</strong> Tentativas de contato direto são bloqueadas pelo sistema</li>
                                <li><strong>Notificações:</strong> Você será alertado por e-mail e WhatsApp sobre novas consultas</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros e estatísticas */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">3</div>
                        <div className="text-sm text-gray-500">Consultas Ativas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">1</div>
                        <div className="text-sm text-gray-500">Respondidas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">1</div>
                        <div className="text-sm text-gray-500">Pendentes</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">1</div>
                        <div className="text-sm text-gray-500">Expiradas</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Todas</button>
                    <button className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Pendentes</button>
                    <button className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Respondidas</button>
                    <button className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Expiradas</button>
                </div>
            </div>

            {/* Lista de consultas */}
            <div className="space-y-4">
                {quotations.map((quotation) => (
                    <div key={quotation.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="text-base font-medium text-gray-900">{quotation.clientCode}</h4>
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(quotation.status)}`}>
                                        {quotation.status}
                                    </span>
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
                                <button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100">
                                    Visualizar
                                </button>
                                {quotation.status === 'Pendente' && (
                                    <button className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700">
                                        Responder
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}