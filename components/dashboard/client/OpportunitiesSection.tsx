"use client";

import { useState } from "react";
import { initialWorks, Work } from "../../../lib/clientDashboardMocks";
import { TagIcon, ClockIcon, CurrencyDollarIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";

// Mock de oportunidades
const opportunities = [
    {
        id: "OPT-001",
        material: "Cimento CP-II 50kg",
        brand: "Votoran",
        originalPrice: 32.90,
        promoPrice: 28.50,
        supplier: "Fornecedor Parceiro A",
        validUntil: "05/12/2025",
        stage: "Estrutura",
        minQuantity: 50,
        image: "https://placehold.co/100x100/e2e8f0/64748b?text=Cimento"
    },
    {
        id: "OPT-002",
        material: "Tijolo Cerâmico 9x19x29",
        brand: "Cerâmica Local",
        originalPrice: 1.80,
        promoPrice: 1.45,
        supplier: "Fornecedor Parceiro B",
        validUntil: "10/12/2025",
        stage: "Alvenaria e Vedações",
        minQuantity: 1000,
        image: "https://placehold.co/100x100/e2e8f0/64748b?text=Tijolo"
    },
    {
        id: "OPT-003",
        material: "Tinta Acrílica Fosca 18L",
        brand: "Suvinil",
        originalPrice: 380.00,
        promoPrice: 315.90,
        supplier: "Fornecedor Parceiro C",
        validUntil: "02/12/2025",
        stage: "Pintura",
        minQuantity: 5,
        image: "https://placehold.co/100x100/e2e8f0/64748b?text=Tinta"
    },
    {
        id: "OPT-004",
        material: "Porcelanato 60x60 Polido",
        brand: "Portinari",
        originalPrice: 89.90,
        promoPrice: 65.00,
        supplier: "Fornecedor Parceiro A",
        validUntil: "15/12/2025",
        stage: "Revestimentos",
        minQuantity: 50, // m²
        image: "https://placehold.co/100x100/e2e8f0/64748b?text=Piso"
    }
];

export function ClientOpportunitiesSection() {
    const [selectedWorkId, setSelectedWorkId] = useState<number>(initialWorks[0]?.id || 0);

    const selectedWork = initialWorks.find(w => w.id === selectedWorkId);

    // Filtrar oportunidades baseadas na etapa da obra selecionada
    // Na vida real, isso seria mais complexo, olhando para as próximas etapas planejadas
    const relevantOpportunities = opportunities.filter(opt => {
        if (!selectedWork) return false;

        // Lógica simplificada: Mostra oportunidades da etapa atual e das próximas
        // Aqui vamos assumir que se a etapa bate ou é uma etapa comum, mostramos
        // Para demo, vamos mostrar tudo se não tiver filtro específico, ou filtrar por string match simples

        // Vamos simular que a obra está em "Estrutura", então mostramos Estrutura e Alvenaria e Vedações (próxima)
        if (selectedWork.etapa === "Estrutura") {
            return opt.stage === "Estrutura" || opt.stage === "Alvenaria e Vedações";
        }
        // Se estiver em Acabamentos Finais, mostra Pintura e Revestimentos também
        if (selectedWork.etapa === "Acabamentos Finais") {
            return opt.stage === "Acabamentos Finais" || opt.stage === "Pintura" || opt.stage === "Revestimentos";
        }
        return true;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Oportunidades Exclusivas</h2>
                    <p className="text-slate-600">
                        Ofertas negociadas especialmente para o cronograma da sua obra.
                    </p>
                </div>

                <div className="w-full md:w-64">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Filtrar por Obra
                    </label>
                    <select
                        value={selectedWorkId}
                        onChange={(e) => setSelectedWorkId(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white text-black border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {initialWorks.map((work) => (
                            <option key={work.id} value={work.id}>
                                {work.obra}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Status da Obra */}
            {selectedWork && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                        <ClockIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-blue-900">Cronograma Atual: {selectedWork.etapa}</h3>
                        <p className="text-sm text-blue-700">
                            Selecionamos ofertas de materiais que você vai precisar nas próximas semanas.
                            Aproveite para antecipar compras e economizar.
                        </p>
                    </div>
                </div>
            )}

            {/* Grid de Oportunidades */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relevantOpportunities.map((opt) => {
                    const discount = Math.round(((opt.originalPrice - opt.promoPrice) / opt.originalPrice) * 100);

                    return (
                        <div key={opt.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group">
                            <div className="relative h-48 bg-slate-100">
                                {/* Badge de Desconto */}
                                <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                    -{discount}% OFF
                                </div>
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-slate-700 text-xs font-medium px-3 py-1 rounded-full shadow-sm border border-slate-100">
                                    {opt.stage}
                                </div>
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    {/* Placeholder image */}
                                    <img src={opt.image} alt={opt.material} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="mb-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{opt.brand}</p>
                                    <h3 className="text-lg font-bold text-slate-900 leading-tight mt-1">{opt.material}</h3>
                                    <p className="text-xs text-slate-400 mt-1">Vendido por {opt.supplier}</p>
                                </div>

                                <div className="flex items-end gap-2 mb-4">
                                    <div>
                                        <p className="text-xs text-slate-400 line-through">R$ {opt.originalPrice.toFixed(2)}</p>
                                        <p className="text-2xl font-bold text-green-600">R$ {opt.promoPrice.toFixed(2)}</p>
                                    </div>
                                    <span className="text-xs text-slate-500 mb-1.5">/unid</span>
                                </div>

                                <div className="space-y-3 text-sm text-slate-600 mb-6">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-orange-500" />
                                        <span>Válido até {opt.validUntil}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TagIcon className="h-4 w-4 text-blue-500" />
                                        <span>Mínimo de {opt.minQuantity} unidades</span>
                                    </div>
                                </div>

                                <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors">
                                    <ShoppingCartIcon className="h-5 w-5" />
                                    Adicionar à Cotação
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {relevantOpportunities.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <TagIcon className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">Nenhuma oferta encontrada</h3>
                    <p className="text-slate-500">Não encontramos promoções específicas para a etapa atual desta obra.</p>
                </div>
            )}
        </div>
    );
}
