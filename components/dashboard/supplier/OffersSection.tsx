"use client";

import { useState, useEffect } from "react";
import {
    MegaphoneIcon,
    PauseIcon,
    PlayIcon,
    TrashIcon,
    ChartBarIcon,
    XMarkIcon
} from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";

interface Offer {
    id: string;
    material: string;
    type: "percentage" | "fixed";
    value: number;
    status: "active" | "paused" | "expired";
    reach: number;
    conversions: number;
    startDate: string;
    endDate: string;
}

export function SupplierOffersSection() {
    const { user, profile, initialized } = useAuth();
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // New Offer Form State
    const [newOffer, setNewOffer] = useState({
        material: "",
        type: "percentage" as "percentage" | "fixed",
        value: "",
        startDate: "",
        endDate: ""
    });

    useEffect(() => {
        if (!initialized) return;

        const fetchOffers = async () => {
            if (user) {
                const { data, error } = await supabase
                    .from('ofertas')
                    .select('*')
                    .eq('user_id', user.id);

                if (error) {
                    // Silenciar erro de permissão - é esperado quando coleção não existe
                    if (error.code !== 'PGRST301') {
                        console.error("Erro ao carregar ofertas:", error);
                    }
                    setOffers([]);
                    setLoading(false);
                    return;
                }

                const mappedOffers: Offer[] = (data || []).map(item => ({
                    id: item.id,
                    material: item.material,
                    type: item.type,
                    value: item.value,
                    status: item.status,
                    reach: item.reach || 0,
                    conversions: item.conversions || 0,
                    startDate: item.start_date,
                    endDate: item.end_date
                }));
                setOffers(mappedOffers);
                setLoading(false);
            } else {
                setOffers([]);
                setLoading(false);
            }
        };

        fetchOffers();

        // Set up realtime subscription
        if (user) {
            const channel = supabase
                .channel('ofertas-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'ofertas',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload) => {
                        // Refetch offers on any change
                        fetchOffers();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user, initialized]);

    const toggleStatus = async (offer: Offer) => {
        if (!user) return;
        const newStatus = offer.status === 'active' ? 'paused' : 'active';
        try {
            const { error } = await supabase
                .from('ofertas')
                .update({ status: newStatus })
                .eq('id', offer.id)
                .eq('user_id', user.id);

            if (error) throw error;

            // Update local state
            setOffers(prev => prev.map(o =>
                o.id === offer.id ? { ...o, status: newStatus } : o
            ));
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Erro ao atualizar status.");
        }
    };

    const deleteOffer = async (id: string) => {
        if (!user) return;
        if (confirm('Tem certeza que deseja excluir esta oferta?')) {
            try {
                const { error } = await supabase
                    .from('ofertas')
                    .delete()
                    .eq('id', id)
                    .eq('user_id', user.id);

                if (error) throw error;

                // Update local state
                setOffers(prev => prev.filter(o => o.id !== id));
            } catch (error) {
                console.error("Error deleting offer:", error);
                alert("Erro ao excluir oferta.");
            }
        }
    };

    const handleCreateOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('ofertas')
                .insert({
                    user_id: user.id,
                    material: newOffer.material,
                    type: newOffer.type,
                    value: Number(newOffer.value),
                    status: "active",
                    reach: 0,
                    conversions: 0,
                    start_date: newOffer.startDate,
                    end_date: newOffer.endDate,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            // Update local state with the new offer
            if (data) {
                const mappedOffer: Offer = {
                    id: data.id,
                    material: data.material,
                    type: data.type,
                    value: data.value,
                    status: data.status,
                    reach: data.reach || 0,
                    conversions: data.conversions || 0,
                    startDate: data.start_date,
                    endDate: data.end_date
                };
                setOffers(prev => [...prev, mappedOffer]);
            }

            setIsModalOpen(false);
            setNewOffer({
                material: "",
                type: "percentage",
                value: "",
                startDate: "",
                endDate: ""
            });
        } catch (error) {
            console.error("Error creating offer:", error);
            alert("Erro ao criar oferta.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando ofertas...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Gerenciamento de Ofertas</h3>
                    <p className="text-sm text-gray-600">
                        Acompanhe o desempenho e gerencie suas ofertas relâmpago ativas.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <MegaphoneIcon className="h-5 w-5" />
                    Nova Oferta
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {offers.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                        <MegaphoneIcon className="mx-auto h-12 w-12 text-gray-300" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma oferta ativa</h3>
                        <p className="mt-1 text-sm text-gray-500">Crie uma nova oferta para impulsionar suas vendas.</p>
                    </div>
                ) : (
                    offers.map((offer) => (
                        <div key={offer.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className={`p-3 rounded-full ${offer.status === 'active' ? 'bg-green-100 text-green-600' :
                                    offer.status === 'paused' ? 'bg-amber-100 text-amber-600' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                    <MegaphoneIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900">{offer.material}</h4>
                                    <p className="text-sm text-gray-500">
                                        {offer.type === 'percentage' ? `${offer.value}% OFF` : `R$ ${offer.value.toFixed(2)}`}
                                        {' • '}
                                        <span className="capitalize">{offer.status === 'active' ? 'Ativa' : offer.status === 'paused' ? 'Pausada' : 'Expirada'}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                                <div className="flex gap-8 text-center">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Alcance</p>
                                        <p className="text-lg font-bold text-gray-900">{offer.reach}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Conversões</p>
                                        <p className="text-lg font-bold text-gray-900">{offer.conversions}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 border-l pl-6 border-gray-200">
                                    <button
                                        onClick={() => toggleStatus(offer)}
                                        className={`p-2 rounded-lg transition-colors ${offer.status === 'active'
                                            ? 'text-amber-600 hover:bg-amber-50'
                                            : 'text-green-600 hover:bg-green-50'
                                            }`}
                                        title={offer.status === 'active' ? 'Pausar' : 'Ativar'}
                                    >
                                        {offer.status === 'active' ? (
                                            <PauseIcon className="h-5 w-5" />
                                        ) : (
                                            <PlayIcon className="h-5 w-5" />
                                        )}
                                    </button>
                                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver Relatório">
                                        <ChartBarIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => deleteOffer(offer.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Offer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">Nova Oferta</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateOffer} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Material em Oferta</label>
                                <input
                                    type="text"
                                    required
                                    value={newOffer.material}
                                    onChange={(e) => setNewOffer({ ...newOffer, material: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: Cimento CP-II"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Desconto</label>
                                    <select
                                        value={newOffer.type}
                                        onChange={(e) => setNewOffer({ ...newOffer, type: e.target.value as "percentage" | "fixed" })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="percentage">Porcentagem (%)</option>
                                        <option value="fixed">Valor Fixo (R$)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={newOffer.value}
                                        onChange={(e) => setNewOffer({ ...newOffer, value: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder={newOffer.type === 'percentage' ? "10" : "15.00"}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                                    <input
                                        type="date"
                                        required
                                        value={newOffer.startDate}
                                        onChange={(e) => setNewOffer({ ...newOffer, startDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                                    <input
                                        type="date"
                                        required
                                        value={newOffer.endDate}
                                        onChange={(e) => setNewOffer({ ...newOffer, endDate: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Criar Oferta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}