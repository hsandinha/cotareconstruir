"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "../../../lib/useAuth";

// Helper para obter headers com token de autenticação
async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}

interface SupplierQuotationResponseSectionProps {
    quotation: any;
    onBack: () => void;
}

export function SupplierQuotationResponseSection({ quotation, onBack }: SupplierQuotationResponseSectionProps) {
    const { user, profile } = useAuth();
    const [responses, setResponses] = useState<{ [key: string]: { preco: string, disponibilidade: string } }>({});
    const [paymentMethod, setPaymentMethod] = useState("");
    const [validity, setValidity] = useState("");
    const [observations, setObservations] = useState("");
    const [freightValue, setFreightValue] = useState("");
    const [loading, setLoading] = useState(false);

    // Mapeamento de dias da semana
    const dayLabels: Record<string, string> = {
        segunda: "Segunda-feira",
        terca: "Terça-feira",
        quarta: "Quarta-feira",
        quinta: "Quinta-feira",
        sexta: "Sexta-feira",
        sabado: "Sábado",
        domingo: "Domingo",
    };

    const handleResponseChange = (itemId: string, field: 'preco' | 'disponibilidade', value: string) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleSendProposal = async () => {
        if (!user) {
            alert("Usuário não autenticado.");
            return;
        }
        setLoading(true);

        try {
            const totalValue = (quotation.items || []).reduce((total: number, item: any) => {
                const response = responses[item.id];
                if (response?.preco) {
                    return total + (parseFloat(response.preco) * item.quantidade);
                }
                return total;
            }, 0);

            // Calcular data de validade baseado na seleção
            const validityDays: { [key: string]: number } = {
                '7-dias': 7,
                '15-dias': 15,
                '30-dias': 30,
                '60-dias': 60
            };
            const dataValidade = new Date();
            dataValidade.setDate(dataValidade.getDate() + (validityDays[validity] || 30));

            // Build itens for API
            const propostaItens = (quotation.items || []).map((item: any) => {
                const response = responses[item.id] || { preco: '0', disponibilidade: 'indisponivel' };
                const precoUnitario = parseFloat(response.preco) || 0;

                const disponibilidadeMap: { [key: string]: string } = {
                    'disponivel': 'disponivel',
                    'sob_consulta': 'sob_consulta',
                    'indisponivel': 'indisponivel'
                };

                const prazoDiasMap: { [key: string]: number } = {
                    'disponivel': 0,
                    'sob_consulta': 5,
                    'indisponivel': -1
                };

                return {
                    cotacao_item_id: item.id,
                    preco_unitario: precoUnitario,
                    quantidade: item.quantidade,
                    subtotal: precoUnitario * item.quantidade,
                    disponibilidade: disponibilidadeMap[response.disponibilidade] || 'indisponivel',
                    prazo_dias: prazoDiasMap[response.disponibilidade] ?? -1,
                    observacao: null
                };
            });

            // Calcular valor do frete
            const freteVal = parseFloat(freightValue) || 0;

            // Send via API route (bypasses RLS)
            const headers = await getAuthHeaders();
            const res = await fetch('/api/propostas', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'create',
                    cotacao_id: quotation.id,
                    valor_total: totalValue + freteVal,
                    valor_frete: freteVal,
                    condicoes_pagamento: paymentMethod,
                    observacoes: observations,
                    data_validade: dataValidade.toISOString(),
                    itens: propostaItens
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao enviar proposta');
            }

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

            {/* Informações de Entrega da Obra */}
            {quotation.obraHorarioEntrega && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="text-base font-medium text-blue-900 mb-4 flex items-center gap-2">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                        </svg>
                        Informações de Entrega da Obra
                    </h4>

                    <div>
                        {/* Dias e Horários de Entrega */}
                        <div>
                            <span className="text-sm font-medium text-blue-800">Dias e Horários Disponíveis para Entrega:</span>
                            <div className="mt-1 space-y-1">
                                {Object.entries(quotation.obraHorarioEntrega).map(([day, schedule]: [string, any]) => {
                                    if (!schedule?.enabled) return null;
                                    return (
                                        <div key={day} className="flex items-center gap-2 text-sm text-blue-900">
                                            <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                            </svg>
                                            <span className="font-medium min-w-[110px]">{dayLabels[day] || day}:</span>
                                            <span>{schedule.startTime} às {schedule.endTime}</span>
                                        </div>
                                    );
                                })}
                                {Object.values(quotation.obraHorarioEntrega).every((s: any) => !s?.enabled) && (
                                    <p className="text-sm text-blue-700 italic">Nenhum horário específico definido</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Restrições de Entrega */}
                    {quotation.obraRestricoesEntrega && (
                        <div className="mt-4 pt-4 border-t border-blue-200">
                            <span className="text-sm font-medium text-blue-800">Restrições de Entrega:</span>
                            <p className="mt-1 text-sm text-blue-900">{quotation.obraRestricoesEntrega}</p>
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-xs text-blue-600 italic">
                            ⚠️ Os dias e horários acima são os definidos pelo cliente para recebimento de materiais na obra. Considere essas informações ao calcular o valor do frete.
                        </p>
                    </div>
                </div>
            )}

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
                                                <option value="disponivel">Disponível</option>
                                                <option value="sob_consulta">Sob Consulta</option>
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

            {/* Frete */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                    Frete
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Valor do Frete (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={freightValue}
                            onChange={(e) => setFreightValue(e.target.value)}
                            className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">Informe 0 para frete grátis (CIF)</p>
                    </div>
                    <div className="flex items-end">
                        <div className="bg-gray-50 rounded-md p-3 w-full">
                            <div className="text-xs text-gray-500 mb-1">Resumo de Valores</div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Materiais:</span>
                                <span className="font-medium">R$ {quotation.items ? quotation.items.reduce((total: number, item: any) => {
                                    const response = responses[item.id];
                                    if (response?.preco) return total + (parseFloat(response.preco) * item.quantidade);
                                    return total;
                                }, 0).toFixed(2) : '0.00'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Frete:</span>
                                <span className="font-medium">R$ {freightValue ? parseFloat(freightValue).toFixed(2) : '0.00'}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold border-t border-gray-200 mt-2 pt-2">
                                <span className="text-gray-900">Total Geral:</span>
                                <span className="text-green-700">R$ {((quotation.items ? quotation.items.reduce((total: number, item: any) => {
                                    const response = responses[item.id];
                                    if (response?.preco) return total + (parseFloat(response.preco) * item.quantidade);
                                    return total;
                                }, 0) : 0) + (parseFloat(freightValue) || 0)).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
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