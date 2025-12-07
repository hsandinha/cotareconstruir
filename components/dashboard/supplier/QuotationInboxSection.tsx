"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { SupplierQuotationResponseSection } from "./QuotationResponseSection";

export function SupplierQuotationInboxSection() {
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInactive, setIsInactive] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
    const [filters, setFilters] = useState({
        regions: [] as string[],
        categories: [] as string[]
    });

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch user preferences
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();

                    // Check if user is active
                    if (data.isActive === false) {
                        setIsInactive(true);
                        setLoading(false);
                        return;
                    }

                    setFilters({
                        regions: data.operatingRegions ? data.operatingRegions.split(',').map((s: string) => s.trim().toLowerCase()) : [],
                        categories: data.operatingCategories ? data.operatingCategories.split(',').map((s: string) => s.trim().toLowerCase()) : []
                    });
                }
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        // We need to check if the user is active before setting up the listener
        // But since we don't have the user state here directly available in a synchronous way from the previous effect,
        // we might need to refactor slightly or just accept that the UI will show empty list if we don't set filters.
        // However, to be robust, let's add a local state for 'isInactive'.

        const q = query(collection(db, "quotations"), where("status", "==", "pending"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                clientCode: "Cliente " + (doc.data().userId ? doc.data().userId.substring(0, 5) : "Anon"),
                locationRaw: doc.data().location || "",
                location: "Bairro: " + (doc.data().location || "Não informado"),
                receivedAt: doc.data().createdAt ? new Date(doc.data().createdAt).toLocaleString() : "N/A",
                deadline: "Em 2 dias", // Placeholder
                itemsCount: doc.data().totalItems || (doc.data().items ? doc.data().items.length : 0),
                urgency: "Média"
            }));

            // Apply filters if set
            if (filters.regions.length > 0) {
                items = items.filter(item => {
                    const loc = item.locationRaw.toLowerCase();
                    return filters.regions.some(region => loc.includes(region));
                });
            }

            // Note: Category filtering would require structured item data or text analysis
            // For now, we rely on location which is the primary filter for logistics

            setQuotations(items);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [filters]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'responded': return 'bg-green-100 text-green-800';
            case 'expired': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'Alta': return 'bg-red-100 text-red-800';
            case 'Média': return 'bg-orange-100 text-orange-800';
            case 'Baixa': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando cotações...</div>;
    }

    if (isInactive) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
                    <h3 className="text-lg font-medium text-red-800 mb-2">Conta Inativa</h3>
                    <p className="text-red-600">
                        Sua conta está inativa porque seus produtos não foram atualizados recentemente ou por decisão administrativa.
                        <br />
                        Por favor, atualize seu cadastro de materiais para voltar a receber cotações.
                    </p>
                </div>
            </div>
        );
    }

    if (selectedQuotation) {
        return (
            <SupplierQuotationResponseSection
                quotation={selectedQuotation}
                onBack={() => setSelectedQuotation(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900">Recebimento de Consultas de Cotação</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Gerencie as solicitações de cotação recebidas dos clientes
                </p>
            </div>

            {/* Informações de segurança */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-800">Protocolo de Segurança e Anonimato</h4>
                        <div className="mt-2 text-sm text-blue-700">
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Anonimato garantido:</strong> A identidade do cliente é protegida até a finalização do negócio</li>
                                <li><strong>Localização parcial:</strong> Apenas o bairro é informado para cálculo de frete</li>
                                <li><strong>Comunicação monitorada:</strong> Tentativas de contato direto são bloqueadas pelo sistema</li>
                                <li><strong>Notificações:</strong> Você será alertado por e-mail e WhatsApp sobre novas consultas</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros e estatísticas */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                {filters.regions.length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        <strong>Filtro Ativo:</strong> Exibindo apenas cotações para as regiões: {filters.regions.join(", ")}.
                        <br />
                        <span className="text-xs text-yellow-600">Você pode alterar isso na aba "Cadastro & Perfil".</span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{quotations.length}</div>
                        <div className="text-sm text-gray-500">Consultas Ativas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">0</div>
                        <div className="text-sm text-gray-500">Respondidas</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{quotations.filter(q => q.status === 'pending').length}</div>
                        <div className="text-sm text-gray-500">Pendentes</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">0</div>
                        <div className="text-sm text-gray-500">Expiradas</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Todas</button>
                    <button className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Pendentes</button>
                    <button className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Respondidas</button>
                    <button className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Expiradas</button>
                </div>
            </div>

            {/* Lista de consultas */}
            <div className="space-y-4">
                {loading ? (
                    <p className="text-center text-gray-500">Carregando cotações...</p>
                ) : quotations.length === 0 ? (
                    <p className="text-center text-gray-500">Nenhuma cotação disponível no momento.</p>
                ) : (
                    quotations.map((quotation) => (
                        <div key={quotation.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h4 className="text-base font-medium text-gray-900">{quotation.clientCode}</h4>
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(quotation.status)}`}>
                                            {quotation.status === 'pending' ? 'Pendente' : quotation.status}
                                        </span>
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(quotation.urgency)}`}>
                                            {quotation.urgency}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                        <div>
                                            <span className="font-medium">Localização:</span>
                                            <br />
                                            {quotation.location}
                                        </div>
                                        <div>
                                            <span className="font-medium">Recebido em:</span>
                                            <br />
                                            {quotation.receivedAt}
                                        </div>
                                        <div>
                                            <span className="font-medium">Prazo:</span>
                                            <br />
                                            {quotation.deadline}
                                        </div>
                                        <div>
                                            <span className="font-medium">Itens:</span>
                                            <br />
                                            {quotation.itemsCount} materiais
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2 ml-4">
                                    <button
                                        onClick={() => setSelectedQuotation(quotation)}
                                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                                    >
                                        Visualizar
                                    </button>
                                    {quotation.status === 'pending' && (
                                        <button
                                            onClick={() => setSelectedQuotation(quotation)}
                                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                                        >
                                            Responder
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}