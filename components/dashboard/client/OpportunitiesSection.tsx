"use client";

import { useState, useEffect } from "react";
import { TagIcon, ClockIcon, CurrencyDollarIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { auth, db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export function ClientOpportunitiesSection() {
    const [selectedWorkId, setSelectedWorkId] = useState<string>("");
    const [works, setWorks] = useState<any[]>([]);
    const [opportunities, setOpportunities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch Works
                const qWorks = query(collection(db, "works"), where("userId", "==", user.uid));
                const unsubscribeWorks = onSnapshot(qWorks, (snapshot) => {
                    const worksData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setWorks(worksData);
                    if (worksData.length > 0 && !selectedWorkId) {
                        setSelectedWorkId(worksData[0].id);
                    }
                });

                // Fetch Opportunities (Global for now)
                // In a real app, this might be filtered by region or user preferences
                try {
                    const qOpportunities = query(collection(db, "opportunities"));
                    const snapshot = await getDocs(qOpportunities);
                    const opportunitiesData = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setOpportunities(opportunitiesData);
                } catch (error) {
                    console.error("Error fetching opportunities:", error);
                } finally {
                    setLoading(false);
                }

                return () => unsubscribeWorks();
            } else {
                setWorks([]);
                setOpportunities([]);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const selectedWork = works.find(w => w.id === selectedWorkId);

    // Filtrar oportunidades baseadas na etapa da obra selecionada
    const relevantOpportunities = opportunities.filter(opt => {
        if (!selectedWork) return true; // Se não tem obra selecionada, mostra tudo (ou nada?)

        // Lógica simplificada: Mostra oportunidades da etapa atual e das próximas
        if (selectedWork.etapa === "Estrutura") {
            return opt.stage === "Estrutura" || opt.stage === "Alvenaria e Vedações";
        }
        if (selectedWork.etapa === "Acabamentos Finais") {
            return opt.stage === "Acabamentos Finais" || opt.stage === "Pintura" || opt.stage === "Revestimentos";
        }
        // Se não tiver regra específica, mostra tudo ou filtra por match exato
        // Vamos mostrar tudo por enquanto se não houver match específico de regra
        return true;
    });

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando oportunidades...</div>;
    }

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
                        onChange={(e) => setSelectedWorkId(e.target.value)}
                        className="w-full px-3 py-2 bg-white text-black border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {works.map((work) => (
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
                    const originalPrice = Number(opt.originalPrice) || 0;
                    const promoPrice = Number(opt.promoPrice) || 0;
                    const discount = originalPrice > 0 ? Math.round(((originalPrice - promoPrice) / originalPrice) * 100) : 0;

                    return (
                        <div key={opt.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group">
                            <div className="relative h-48 bg-slate-100">
                                {/* Badge de Desconto */}
                                {discount > 0 && (
                                    <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                        -{discount}% OFF
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-slate-700 text-xs font-medium px-3 py-1 rounded-full shadow-sm border border-slate-100">
                                    {opt.stage || "Geral"}
                                </div>
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    {/* Placeholder image */}
                                    {opt.image ? (
                                        <img src={opt.image} alt={opt.material} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <TagIcon className="h-12 w-12 mb-2" />
                                            <span className="text-xs">Sem imagem</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="mb-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{opt.brand || "Marca Genérica"}</p>
                                    <h3 className="text-lg font-bold text-slate-900 leading-tight mt-1">{opt.material || "Material sem nome"}</h3>
                                    <p className="text-xs text-slate-400 mt-1">Vendido por {opt.supplier || "Fornecedor Parceiro"}</p>
                                </div>

                                <div className="flex items-end gap-2 mb-4">
                                    <div>
                                        <p className="text-xs text-slate-400 line-through">R$ {originalPrice.toFixed(2)}</p>
                                        <p className="text-2xl font-bold text-green-600">R$ {promoPrice.toFixed(2)}</p>
                                    </div>
                                    <span className="text-xs text-slate-500 mb-1.5">/unid</span>
                                </div>

                                <div className="space-y-3 text-sm text-slate-600 mb-6">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4 text-orange-500" />
                                        <span>Válido até {opt.validUntil || "Indeterminado"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TagIcon className="h-4 w-4 text-blue-500" />
                                        <span>Mínimo de {opt.minQuantity || 1} unidades</span>
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
