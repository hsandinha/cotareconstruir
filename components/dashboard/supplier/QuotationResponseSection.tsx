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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <svg className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                        </svg>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-blue-900 mb-2">Horários de Entrega na Obra</h4>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(quotation.obraHorarioEntrega).map(([day, schedule]: [string, any]) => {
                                    if (!schedule?.enabled) return null;
                                    return (
                                        <span key={day} className="inline-flex items-center gap-1.5 bg-white/80 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium text-blue-800">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                            {dayLabels[day] || day} {schedule.startTime}–{schedule.endTime}
                                        </span>
                                    );
                                })}
                                {Object.values(quotation.obraHorarioEntrega).every((s: any) => !s?.enabled) && (
                                    <span className="text-xs text-blue-700 italic">Nenhum horário específico definido</span>
                                )}
                            </div>
                            {quotation.obraRestricoesEntrega && (
                                <p className="mt-2 text-xs text-blue-700"><strong>Restrição:</strong> {quotation.obraRestricoesEntrega}</p>
                            )}
                            <p className="mt-2 text-xs text-blue-500">
                                ⚠️ Considere esses horários ao calcular o frete.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerta de segurança */}
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 flex items-center gap-3">
                <svg className="h-4 w-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-red-700">
                    <strong className="text-red-800">Monitoramento Ativo:</strong> Proibido fornecer contatos diretos (telefone, e-mail). Violações resultam em penalidades ou exclusão.
                </p>
            </div>

            {/* Tabela de cotação */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900">Itens para Cotação</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Preencha preço e disponibilidade para cada item</p>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{quotation.items?.length || 0} {quotation.items?.length === 1 ? 'item' : 'itens'}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Unid.</th>
                                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-14">Qtd.</th>
                                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Preço Unit.</th>
                                <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Status</th>
                                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {quotation.items && quotation.items.map((item: any) => {
                                const response = responses[item.id] || { preco: '', disponibilidade: '' };
                                const subtotal = response.preco ? (parseFloat(response.preco) * item.quantidade).toFixed(2) : '0.00';
                                const dispColor = response.disponibilidade === 'disponivel' ? 'text-green-700 bg-green-50 border-green-200' : response.disponibilidade === 'sob_consulta' ? 'text-amber-700 bg-amber-50 border-amber-200' : response.disponibilidade === 'indisponivel' ? 'text-red-700 bg-red-50 border-red-200' : 'text-gray-600 bg-white border-gray-300';

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            <div className="font-medium">{item.descricao}</div>
                                            {item.observacao && (
                                                <div className="text-xs text-gray-400 mt-0.5">{item.observacao}</div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-center text-xs text-gray-500">{item.unidade}</td>
                                        <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">{item.quantidade}</td>
                                        <td className="px-3 py-3 whitespace-nowrap text-center">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="0,00"
                                                className="w-24 px-2 py-1.5 text-sm text-center text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                value={response.preco}
                                                onChange={(e) => handleResponseChange(item.id, 'preco', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-center">
                                            <select
                                                className={`text-xs font-medium border rounded-md px-1.5 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${dispColor}`}
                                                value={response.disponibilidade}
                                                onChange={(e) => handleResponseChange(item.id, 'disponibilidade', e.target.value)}
                                            >
                                                <option value="">—</option>
                                                <option value="disponivel">✓ Sim</option>
                                                <option value="sob_consulta">◷ Consulta</option>
                                                <option value="indisponivel">✕ Não</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                                            R$ {subtotal}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-700">Total Materiais:</td>
                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
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

            {/* Frete e Resumo */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                            </svg>
                            Valor do Frete (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={freightValue}
                            onChange={(e) => setFreightValue(e.target.value)}
                            className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-400">Informe 0 para frete grátis (CIF)</p>
                    </div>
                    <div className="md:col-span-2">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">Materiais</div>
                                        <div className="text-sm font-semibold text-gray-800">R$ {quotation.items ? quotation.items.reduce((total: number, item: any) => {
                                            const response = responses[item.id];
                                            if (response?.preco) return total + (parseFloat(response.preco) * item.quantidade);
                                            return total;
                                        }, 0).toFixed(2) : '0.00'}</div>
                                    </div>
                                    <div className="text-gray-300 text-lg">+</div>
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">Frete</div>
                                        <div className="text-sm font-semibold text-gray-800">R$ {freightValue ? parseFloat(freightValue).toFixed(2) : '0.00'}</div>
                                    </div>
                                    <div className="text-gray-300 text-lg">=</div>
                                </div>
                                <div className="text-right bg-white rounded-md px-4 py-2 border border-green-200 shadow-sm">
                                    <div className="text-xs text-gray-500">Total Geral</div>
                                    <div className="text-lg font-bold text-green-700">R$ {((quotation.items ? quotation.items.reduce((total: number, item: any) => {
                                        const response = responses[item.id];
                                        if (response?.preco) return total + (parseFloat(response.preco) * item.quantidade);
                                        return total;
                                    }, 0) : 0) + (parseFloat(freightValue) || 0)).toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Condições comerciais */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Condições Comerciais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pagamento</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <label className="block text-xs font-medium text-gray-600 mb-1">Validade da Proposta</label>
                        <select
                            value={validity}
                            onChange={(e) => setValidity(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione</option>
                            <option value="7-dias">7 dias</option>
                            <option value="15-dias">15 dias</option>
                            <option value="30-dias">30 dias</option>
                            <option value="60-dias">60 dias</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                        <textarea
                            rows={2}
                            value={observations}
                            onChange={(e) => setObservations(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Informações adicionais sobre sua proposta..."
                        />
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end items-center gap-3 pt-2">
                <button
                    onClick={onBack}
                    className="px-5 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSendProposal}
                    disabled={loading}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Enviando...
                        </>
                    ) : (
                        <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                            Enviar Proposta
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}