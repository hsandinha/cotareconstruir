"use client";

import { useState } from "react";

export function SupplierQuotationResponseSection() {
    const [quotationItems] = useState([
        {
            id: 1,
            codigo: "ELE001",
            descricao: "Cabo Flexível 2,5mm - Rolo 100m",
            unidade: "rolo",
            quantidade: 5,
            observacoes: "Cor azul, isolamento 750V"
        },
        {
            id: 2,
            codigo: "ELE002",
            descricao: "Disjuntor bipolar 20A",
            unidade: "unidade",
            quantidade: 12,
            observacoes: "Marca reconhecida, certificado INMETRO"
        },
        {
            id: 3,
            codigo: "ELE003",
            descricao: "Tomada 2P+T 10A - Padrao brasileiro",
            unidade: "unidade",
            quantidade: 25,
            observacoes: "Cor branca, com placa"
        }
    ]);

    const [responses, setResponses] = useState<{ [key: number]: { preco: string, disponibilidade: string } }>({});

    const handleResponseChange = (itemId: number, field: 'preco' | 'disponibilidade', value: string) => {
        setResponses(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900">Resposta à Cotação</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Insira sua proposta comercial para os materiais solicitados
                </p>
            </div>

            {/* Informações da consulta */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="font-medium text-gray-700">Cliente:</span>
                        <div className="text-gray-900">Cliente X-001</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Localização:</span>
                        <div className="text-gray-900">Bairro: Vila Madalena</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Prazo de Resposta:</span>
                        <div className="text-red-600 font-medium">19/11/2024 - 18:00</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Total de Itens:</span>
                        <div className="text-gray-900">3 materiais</div>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unid.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd.</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Unitário</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disponibilidade</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {quotationItems.map((item) => {
                                const response = responses[item.id] || { preco: '', disponibilidade: '' };
                                const subtotal = response.preco ? (parseFloat(response.preco) * item.quantidade).toFixed(2) : '0.00';

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.codigo}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div>{item.descricao}</div>
                                            {item.observacoes && (
                                                <div className="text-xs text-gray-500 mt-1">{item.observacoes}</div>
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
                                <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-900">Total Geral:</td>
                                <td className="px-6 py-3 text-sm font-bold text-gray-900">
                                    R$ {quotationItems.reduce((total, item) => {
                                        const response = responses[item.id];
                                        if (response?.preco) {
                                            return total + (parseFloat(response.preco) * item.quantidade);
                                        }
                                        return total;
                                    }, 0).toFixed(2)}
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
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Insira informações adicionais sobre sua proposta..."
                        />
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end space-x-3">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                    Salvar Rascunho
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700">
                    Enviar Proposta
                </button>
            </div>
        </div>
    );
}