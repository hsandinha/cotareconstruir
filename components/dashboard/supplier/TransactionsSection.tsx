"use client";

import { useState } from "react";

export function SupplierTransactionsSection() {
    const [transactions] = useState([
        {
            id: 1,
            clientCode: "Cliente X-001",
            clientName: "Construtora ABC Ltda", // Só aparece após aprovação
            quotationId: "COT-2024-001",
            status: "Aprovada",
            totalValue: 15420.50,
            approvedAt: "2024-11-15 14:30",
            deliveryAddress: "Rua das Flores, 123 - Vila Madalena - São Paulo/SP",
            contact: {
                name: "João Silva",
                phone: "(11) 99999-9999",
                email: "joao@construtorabc.com"
            },
            canViewComparative: true
        },
        {
            id: 2,
            clientCode: "Cliente Y-002",
            clientName: null, // Ainda não aprovada
            quotationId: "COT-2024-002",
            status: "Em Avaliação",
            totalValue: 8900.00,
            submittedAt: "2024-11-16 09:15",
            canViewComparative: false
        },
        {
            id: 3,
            clientCode: "Cliente Z-003",
            clientName: "Obras & Construções XYZ",
            quotationId: "COT-2024-003",
            status: "Finalizada",
            totalValue: 22100.75,
            approvedAt: "2024-11-10 16:20",
            completedAt: "2024-11-14 10:00",
            deliveryAddress: "Av. Paulista, 456 - Bela Vista - São Paulo/SP",
            contact: {
                name: "Maria Santos",
                phone: "(11) 88888-8888",
                email: "maria@obrasxyz.com"
            },
            canViewComparative: true
        }
    ]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aprovada': return 'bg-green-100 text-green-800';
            case 'Em Avaliação': return 'bg-yellow-100 text-yellow-800';
            case 'Finalizada': return 'bg-blue-100 text-blue-800';
            case 'Cancelada': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900">Acompanhamento e Transações</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Gerencie suas propostas aprovadas e finalize negócios com os clientes
                </p>
            </div>

            {/* Informações importantes */}
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-green-800">Processo de Finalização</h4>
                        <div className="mt-2 text-sm text-green-700">
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Proposta aprovada:</strong> Você terá acesso aos dados completos do cliente</li>
                                <li><strong>Contato direto liberado:</strong> Negociação e entrega são feitas diretamente com o cliente</li>
                                <li><strong>Fora da plataforma:</strong> A transação financeira é realizada entre você e o cliente</li>
                                <li><strong>Ordem de Compra:</strong> O cliente recebe a OC gerada pela plataforma</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Estatísticas */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">3</div>
                        <div className="text-sm text-gray-500">Propostas Enviadas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">1</div>
                        <div className="text-sm text-gray-500">Aprovadas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">1</div>
                        <div className="text-sm text-gray-500">Em Avaliação</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">R$ 46.421,25</div>
                        <div className="text-sm text-gray-500">Valor Total</div>
                    </div>
                </div>
            </div>

            {/* Lista de transações */}
            <div className="space-y-4">
                {transactions.map((transaction) => (
                    <div key={transaction.id} className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="text-base font-medium text-gray-900">
                                        {transaction.clientName || transaction.clientCode}
                                    </h4>
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transaction.status)}`}>
                                        {transaction.status}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    Cotação: {transaction.quotationId} | Valor: <span className="font-medium text-green-600">R$ {transaction.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                {transaction.canViewComparative && (
                                    <button className="px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100">
                                        Ver Comparativo*
                                    </button>
                                )}
                                <button className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100">
                                    Detalhes
                                </button>
                            </div>
                        </div>

                        {/* Informações do cliente (só se aprovado) */}
                        {transaction.contact && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-2">Dados para Contato e Entrega</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Responsável:</span>
                                        <div className="text-gray-900">{transaction.contact.name}</div>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Telefone:</span>
                                        <div className="text-gray-900">{transaction.contact.phone}</div>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">E-mail:</span>
                                        <div className="text-gray-900">{transaction.contact.email}</div>
                                    </div>
                                    {transaction.deliveryAddress && (
                                        <div>
                                            <span className="font-medium text-gray-700">Endereço de Entrega:</span>
                                            <div className="text-gray-900">{transaction.deliveryAddress}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                                {transaction.submittedAt && (
                                    <div>
                                        <span className="font-medium">Enviada:</span> {transaction.submittedAt}
                                    </div>
                                )}
                                {transaction.approvedAt && (
                                    <div>
                                        <span className="font-medium">Aprovada:</span> {transaction.approvedAt}
                                    </div>
                                )}
                                {transaction.completedAt && (
                                    <div>
                                        <span className="font-medium">Finalizada:</span> {transaction.completedAt}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Nota sobre comparativo */}
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-purple-800">Mapa Comparativo Premium</h4>
                        <p className="mt-1 text-sm text-purple-700">
                            * O acesso ao comparativo com valores e condições dos concorrentes (sem identidade) está disponível mediante pagamento. Este recurso fomenta a concorrência e ajuda a melhorar suas propostas futuras.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}