"use client";

import { useState } from "react";
import { auth, db } from "../../../lib/firebase";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";

interface SupplierQuotationResponseSectionProps {
    quotation: any;
    onBack: () => void;
}

export function SupplierQuotationResponseSection({ quotation, onBack }: SupplierQuotationResponseSectionProps) {
    const [responses, setResponses] = useState<{ [key: number]: { preco: string, disponibilidade: string } }>({});
    const [paymentMethod, setPaymentMethod] = useState("");
    const [validity, setValidity] = useState("");
    const [observations, setObservations] = useState("");
    const [loading, setLoading] = useState(false);

    const handleResponseChange = (itemId: number, field: 'preco' | 'disponibilidade', value: string) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleSendProposal = async () => {
        if (!auth.currentUser) return;
        setLoading(true);

        try {
            const batch = writeBatch(db);

            // Generate a new ID for the proposal
            const proposalRef = doc(collection(db, "quotations", quotation.id, "proposals"));
            const proposalId = proposalRef.id;

            // Reference to the root proposals collection with the same ID
            const rootProposalRef = doc(db, "proposals", proposalId);

            const totalValue = quotation.items.reduce((total: number, item: any) => {
                const response = responses[item.id];
                if (response?.preco) {
                    return total + (parseFloat(response.preco) * item.quantidade);
                }
                return total;
            }, 0);

            const proposalData = {
                id: proposalId,
                supplierId: auth.currentUser.uid,
                supplierName: auth.currentUser.displayName || "Fornecedor",
                quotationId: quotation.id,
                clientCode: quotation.clientCode || "Cliente",
                location: quotation.location || {},
                items: quotation.items.map((item: any) => ({
                    itemId: item.id,
                    description: item.descricao,
                    quantity: item.quantidade,
                    unit: item.unidade,
                    price: responses[item.id]?.preco ? parseFloat(responses[item.id].preco) : 0,
                    availability: responses[item.id]?.disponibilidade || "indisponivel"
                })),
                paymentMethod,
                validity,
                observations,
                totalValue,
                createdAt: serverTimestamp(),
                status: "sent"
            };

            // Save to subcollection of the quotation
            batch.set(proposalRef, proposalData);

            // Save to root proposals collection (for supplier dashboard)
            batch.set(rootProposalRef, proposalData);

            // Create notification for the client
            if (quotation.userId) {
                const notificationRef = doc(collection(db, "notifications"));
                batch.set(notificationRef, {
                    userId: quotation.userId,
                    title: "Nova Proposta Recebida",
                    message: `Um fornecedor enviou uma proposta para sua cotação.`,
                    type: "success",
                    read: false,
                    createdAt: serverTimestamp(),
                    relatedId: quotation.id,
                    relatedType: "quotation"
                });
            }

            await batch.commit();

            alert("Proposta enviada com sucesso!");
            onBack();
        } catch (error) {
            console.error("Erro ao enviar proposta:", error);
            alert("Erro ao enviar proposta. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Resposta à Cotação</h3>
                    <p className="mt-1 text-sm text-gray-600">
                        Insira sua proposta comercial para os materiais solicitados
                    </p>
                </div>
                <button
                    onClick={onBack}
                    className="text-sm text-gray-500 hover:text-gray-700"
                >
                    Voltar
                </button>
            </div>

            {/* Informações da consulta */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="font-medium text-gray-700">Cliente:</span>
                        <div className="text-gray-900">{quotation.clientCode}</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Localização:</span>
                        <div className="text-gray-900">{quotation.location}</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Prazo de Resposta:</span>
                        <div className="text-red-600 font-medium">{quotation.deadline}</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Total de Itens:</span>
                        <div className="text-gray-900">{quotation.itemsCount} materiais</div>
                    </div>
                </div>
            </div>

            {/* Alerta de segurança */}
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-red-800">Atenção - Monitoramento Ativo</h4>
                        <p className="mt-1 text-sm text-red-700">
                            <strong>Proibido fornecer contatos diretos!</strong> Tentativas de passar número de telefone, e-mail ou qualquer forma de contato direto serão detectadas pelo sistema e podem resultar em penalidades ou exclusão do cadastro.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabela de cotação */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h4 className="text-base font-medium text-gray-900">Itens para Cotação</h4>
                    <p className="text-sm text-gray-600">Preencha apenas sua coluna. Você não tem acesso às propostas dos concorrentes.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unid.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Unitário</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disponibilidade</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {quotation.items && quotation.items.map((item: any) => {
                                const response = responses[item.id] || { preco: '', disponibilidade: '' };
                                const subtotal = response.preco ? (parseFloat(response.preco) * item.quantidade).toFixed(2) : '0.00';

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div>{item.descricao}</div>
                                            {item.observacao && (
                                                <div className="text-xs text-gray-500 mt-1">{item.observacao}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unidade}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{item.quantidade}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="0,00"
                                                className="w-24 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={response.preco}
                                                onChange={(e) => handleResponseChange(item.id, 'preco', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select
                                                className="text-sm text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={response.disponibilidade}
                                                onChange={(e) => handleResponseChange(item.id, 'disponibilidade', e.target.value)}
                                            >
                                                <option value="">Selecionar</option>
                                                <option value="imediata">Imediata</option>
                                                <option value="24h">24 horas</option>
                                                <option value="48h">48 horas</option>
                                                <option value="3-5-dias">3 a 5 dias</option>
                                                <option value="5-10-dias">5 a 10 dias</option>
                                                <option value="indisponivel">Indisponível</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            R$ {subtotal}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td colSpan={5} className="px-6 py-3 text-right text-sm font-medium text-gray-900">Total Geral:</td>
                                <td className="px-6 py-3 text-sm font-bold text-gray-900">
                                    R$ {quotation.items ? quotation.items.reduce((total: number, item: any) => {
                                        const response = responses[item.id];
                                        if (response?.preco) {
                                            return total + (parseFloat(response.preco) * item.quantidade);
                                        }
                                        return total;
                                    }, 0).toFixed(2) : '0.00'}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Condições comerciais */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 mb-4">Condições Comerciais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione</option>
                            <option value="vista">À vista</option>
                            <option value="15-dias">15 dias</option>
                            <option value="30-dias">30 dias</option>
                            <option value="30-60-dias">30/60 dias</option>
                            <option value="30-60-90-dias">30/60/90 dias</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Validade da Proposta</label>
                        <select
                            value={validity}
                            onChange={(e) => setValidity(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione</option>
                            <option value="7-dias">7 dias</option>
                            <option value="15-dias">15 dias</option>
                            <option value="30-dias">30 dias</option>
                            <option value="60-dias">60 dias</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Observações Adicionais</label>
                        <textarea
                            rows={3}
                            value={observations}
                            onChange={(e) => setObservations(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Insira informações adicionais sobre sua proposta..."
                        />
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end space-x-3">
                <button
                    onClick={onBack}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSendProposal}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                    {loading ? "Enviando..." : "Enviar Proposta"}
                </button>
            </div>
        </div>
    );
}