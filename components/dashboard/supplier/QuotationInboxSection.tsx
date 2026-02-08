"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { SupplierQuotationResponseSection } from "./QuotationResponseSection";

export function SupplierQuotationInboxSection() {
    const { user, profile, initialized } = useAuth();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInactive, setIsInactive] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        regions: [] as string[],
        categories: [] as string[]
    });

    useEffect(() => {
        const loadFornecedorData = async () => {
            if (!initialized || !user) return;

            // Buscar fornecedor vinculado ao user
            const { data: fornecedorData, error } = await supabase
                .from('fornecedores')
                .select('id, status, regioes_atendimento')
                .eq('user_id', user.id)
                .single();

            if (error || !fornecedorData) {
                setIsInactive(true);
                setLoading(false);
                return;
            }

            if (fornecedorData.status === 'suspended') {
                setIsInactive(true);
                setLoading(false);
                return;
            }

            setFornecedorId(fornecedorData.id);
            setFilters({
                regions: (fornecedorData.regioes_atendimento || []).map((r: string) => r.toLowerCase()),
                categories: []
            });
        };
        loadFornecedorData();
    }, [user, initialized]);

    useEffect(() => {
        // Fetch initial quotations and set up realtime subscription
        const fetchQuotations = async () => {
            const { data, error } = await supabase
                .from('cotacoes')
                .select('*, cotacao_itens(*), obra:obras(nome, bairro, cidade, estado)')
                .eq('status', 'enviada');

            if (data) {
                let items = data.map(doc => ({
                    id: doc.id,
                    user_id: doc.user_id,
                    obra_id: doc.obra_id,
                    status: doc.status,
                    clientCode: "Cliente " + (doc.user_id ? doc.user_id.substring(0, 5) : "Anon"),
                    locationRaw: doc.obra?.cidade || "",
                    location: doc.obra ? `${doc.obra.bairro || ''}, ${doc.obra.cidade || ''} - ${doc.obra.estado || ''}` : "Não informado",
                    receivedAt: doc.created_at ? new Date(doc.created_at).toLocaleString() : "N/A",
                    deadline: doc.data_validade ? new Date(doc.data_validade).toLocaleDateString('pt-BR') : "Sem prazo",
                    itemsCount: doc.cotacao_itens?.length || 0,
                    items: (doc.cotacao_itens || []).map((item: any) => ({
                        id: item.id,
                        descricao: item.nome,
                        quantidade: item.quantidade,
                        unidade: item.unidade,
                        observacao: item.observacao,
                        grupo: item.grupo,
                        fase_nome: item.fase_nome,
                        servico_nome: item.servico_nome
                    })),
                    urgency: "Média"
                }));

                // Filtrar por região se configurado
                if (filters.regions.length > 0) {
                    items = items.filter(item => {
                        const loc = item.locationRaw.toLowerCase();
                        return filters.regions.some(region => loc.includes(region));
                    });
                }

                setQuotations(items);
            }
            setLoading(false);
        };

        fetchQuotations();

        // Set up realtime subscription
        const channel = supabase
            .channel('cotacoes-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cotacoes',
                    filter: 'status=eq.enviada'
                },
                (payload) => {
                    fetchQuotations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [filters]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'enviada': return 'bg-yellow-100 text-yellow-800';
            case 'respondida': return 'bg-green-100 text-green-800';
            case 'fechada': return 'bg-blue-100 text-blue-800';
            case 'cancelada': return 'bg-red-100 text-red-800';
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
                        <div className="text-2xl font-bold text-yellow-600">{quotations.filter(q => q.status === 'enviada').length}</div>
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
                                            {quotation.status === 'enviada' ? 'Pendente' : quotation.status === 'respondida' ? 'Respondida' : quotation.status}
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
                                    {quotation.status === 'enviada' && (
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