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
import { auth, db } from "../../../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

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
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [userUid, setUserUid] = useState<string | null>(null);
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
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserUid(user.uid);
                const q = query(collection(db, "users", user.uid, "offers"));
                const unsubscribeSnapshot = onSnapshot(
                    q,
                    (snapshot) => {
                        const items: Offer[] = [];
                        snapshot.forEach((doc) => {
                            items.push({ id: doc.id, ...doc.data() } as Offer);
                        });
                        setOffers(items);
                        setLoading(false);
                    },
                    (error) => {
                        // Silenciar erro de permissão - é esperado quando coleção não existe
                        if (error.code !== 'permission-denied') {
                            console.error("Erro ao carregar ofertas:", error);
                        }
                        setOffers([]);
                        setLoading(false);
                    }
                );
                return () => unsubscribeSnapshot();
            } else {
                setOffers([]);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const toggleStatus = async (offer: Offer) => {
        if (!userUid) return;
        const newStatus = offer.status === 'active' ? 'paused' : 'active';
        try {
            await updateDoc(doc(db, "users", userUid, "offers", offer.id), {
                status: newStatus
            });
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Erro ao atualizar status.");
        }
    };

    const deleteOffer = async (id: string) => {
        if (!userUid) return;
        if (confirm('Tem certeza que deseja excluir esta oferta?')) {
            try {
                await deleteDoc(doc(db, "users", userUid, "offers", id));
            } catch (error) {
                console.error("Error deleting offer:", error);
                alert("Erro ao excluir oferta.");
            }
        }
    };

    const handleCreateOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userUid) return;

        try {
            await addDoc(collection(db, "users", userUid, "offers"), {
                material: newOffer.material,
                type: newOffer.type,
                value: Number(newOffer.value),
                status: "active",
                reach: 0,
                conversions: 0,
                startDate: newOffer.startDate,
                endDate: newOffer.endDate,
                createdAt: serverTimestamp()
            });
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