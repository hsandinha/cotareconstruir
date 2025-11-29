"use client";

import { useState } from "react";
import {
    MegaphoneIcon,
    PauseIcon,
    PlayIcon,
    TrashIcon,
    ChartBarIcon
} from "@heroicons/react/24/outline";

export function SupplierOffersSection() {
    const [offers, setOffers] = useState([
        {
            id: 1,
            material: "Cimento CP-II",
            type: "percentage",
            value: 10,
            status: "active",
            reach: 150,
            conversions: 12,
            startDate: "2025-11-28",
            endDate: "2025-11-30"
        },
        {
            id: 2,
            material: "Tubo PVC 100mm",
            type: "fixed",
            value: 14.50,
            status: "paused",
            reach: 85,
            conversions: 5,
            startDate: "2025-11-25",
            endDate: "2025-12-01"
        },
        {
            id: 3,
            material: "Cabo Flexível 2,5mm",
            type: "percentage",
            value: 5,
            status: "expired",
            reach: 200,
            conversions: 45,
            startDate: "2025-11-20",
            endDate: "2025-11-25"
        }
    ]);

    const toggleStatus = (id: number) => {
        setOffers(offers.map(offer => {
            if (offer.id === id) {
                return {
                    ...offer,
                    status: offer.status === 'active' ? 'paused' : 'active'
                };
            }
            return offer;
        }));
    };

    const deleteOffer = (id: number) => {
        if (confirm('Tem certeza que deseja excluir esta oferta?')) {
            setOffers(offers.filter(offer => offer.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Gerenciamento de Ofertas</h3>
                    <p className="text-sm text-gray-600">
                        Acompanhe o desempenho e gerencie suas ofertas relâmpago ativas.
                    </p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    <MegaphoneIcon className="h-5 w-5" />
                    Nova Oferta
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {offers.map((offer) => (
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

                        <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-start">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase font-semibold">Alcance</p>
                                <p className="text-lg font-bold text-gray-900">{offer.reach}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase font-semibold">Vendas</p>
                                <p className="text-lg font-bold text-gray-900">{offer.conversions}</p>
                            </div>
                            <div className="text-center hidden md:block">
                                <p className="text-xs text-gray-500 uppercase font-semibold">Validade</p>
                                <p className="text-sm font-medium text-gray-900">{new Date(offer.endDate).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                            {offer.status !== 'expired' && (
                                <button
                                    onClick={() => toggleStatus(offer.id)}
                                    className={`p-2 rounded-lg border transition-colors ${offer.status === 'active'
                                            ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                            : 'border-green-200 text-green-600 hover:bg-green-50'
                                        }`}
                                    title={offer.status === 'active' ? "Pausar" : "Retomar"}
                                >
                                    {offer.status === 'active' ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                                </button>
                            )}
                            <button
                                onClick={() => deleteOffer(offer.id)}
                                className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                title="Excluir"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}