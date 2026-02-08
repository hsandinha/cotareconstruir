"use client";

import { useState, useEffect, useMemo } from "react";
import {
    MegaphoneIcon,
    PauseIcon,
    PlayIcon,
    TrashIcon,
    XMarkIcon,
    PlusCircleIcon,
    TagIcon
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";

// Helper para obter headers com token de autenticação
async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}

interface Oferta {
    id: string;
    fornecedor_id: string;
    fornecedor_material_id: string;
    material_id: string;
    material_nome: string;
    material_unidade: string;
    tipo_oferta: "valor" | "percentual";
    valor_oferta: number;
    preco_original: number;
    preco_final: number;
    desconto_percentual: number | null;
    quantidade_minima: number;
    estoque: number;
    data_inicio: string;
    data_fim: string | null;
    ativo: boolean;
}

interface FornecedorMaterial {
    id: string;
    material_id: string;
    preco: number;
    estoque: number;
    ativo: boolean;
    material_nome?: string;
    material_unidade?: string;
}

export function SupplierOffersSection() {
    const { user, profile, initialized } = useAuth();
    const [ofertas, setOfertas] = useState<Oferta[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);
    const [materiaisConfigurados, setMateriaisConfigurados] = useState<FornecedorMaterial[]>([]);

    // Form state
    const [selectedMaterialId, setSelectedMaterialId] = useState("");
    const [tipoOferta, setTipoOferta] = useState<"valor" | "percentual">("percentual");
    const [valorOferta, setValorOferta] = useState("");
    const [quantidadeMinima, setQuantidadeMinima] = useState("1");
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");
    const [savingOffer, setSavingOffer] = useState(false);

    // Load fornecedor_id
    useEffect(() => {
        if (!initialized || !user) return;

        const loadFornecedorId = async () => {
            const { data: userData } = await supabase
                .from('users')
                .select('fornecedor_id')
                .eq('id', user.id)
                .single();

            if (userData?.fornecedor_id) {
                setFornecedorId(userData.fornecedor_id);
                return;
            }

            const { data: fornecedorData } = await supabase
                .from('fornecedores')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (fornecedorData) {
                setFornecedorId(fornecedorData.id);
            }
        };

        loadFornecedorId();
    }, [user, initialized]);

    // Load ofertas and materiais configurados
    useEffect(() => {
        if (!fornecedorId) return;

        const loadData = async () => {
            setLoading(true);

            try {
                const headers = await getAuthHeaders();
                const [ofertasRes, materiaisRes] = await Promise.all([
                    supabase
                        .from('ofertas')
                        .select('*')
                        .eq('fornecedor_id', fornecedorId)
                        .order('created_at', { ascending: false }),
                    fetch(`/api/fornecedor-materiais?fornecedor_id=${fornecedorId}`, { headers })
                ]);

                if (ofertasRes.data) {
                    setOfertas(ofertasRes.data as Oferta[]);
                } else if (ofertasRes.error) {
                    console.error('Erro ao carregar ofertas:', ofertasRes.error);
                    setOfertas([]);
                }

                if (materiaisRes.ok) {
                    const json = await materiaisRes.json();
                    const ativos = (json.data || []).filter((m: any) => m.ativo !== false);

                    if (ativos.length > 0) {
                        const materialIds = ativos.map((m: any) => m.material_id);
                        const { data: matData } = await supabase
                            .from('materiais')
                            .select('id, nome, unidade')
                            .in('id', materialIds);

                        const matMap = new Map(matData?.map(m => [m.id, m]) || []);

                        setMateriaisConfigurados(ativos.map((m: any) => ({
                            id: m.id,
                            material_id: m.material_id,
                            preco: m.preco,
                            estoque: m.estoque,
                            ativo: m.ativo,
                            material_nome: matMap.get(m.material_id)?.nome || 'Material desconhecido',
                            material_unidade: matMap.get(m.material_id)?.unidade || '',
                        })));
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
            }

            setLoading(false);
        };

        loadData();

        const channel = supabase
            .channel('ofertas-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ofertas',
                    filter: `fornecedor_id=eq.${fornecedorId}`
                },
                () => loadData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fornecedorId]);

    const selectedMaterial = useMemo(() => {
        return materiaisConfigurados.find(m => m.material_id === selectedMaterialId);
    }, [materiaisConfigurados, selectedMaterialId]);

    const precoFinalCalc = useMemo(() => {
        if (!selectedMaterial || !valorOferta) return null;
        const precoOrig = selectedMaterial.preco;
        const val = parseFloat(valorOferta);
        if (isNaN(val) || val <= 0) return null;

        if (tipoOferta === "percentual") {
            return precoOrig * (1 - val / 100);
        } else {
            return precoOrig - val;
        }
    }, [selectedMaterial, valorOferta, tipoOferta]);

    const toggleOfertaAtivo = async (oferta: Oferta) => {
        try {
            const { error } = await supabase
                .from('ofertas')
                .update({ ativo: !oferta.ativo, updated_at: new Date().toISOString() })
                .eq('id', oferta.id)
                .eq('fornecedor_id', fornecedorId!);

            if (error) throw error;

            setOfertas(prev => prev.map(o =>
                o.id === oferta.id ? { ...o, ativo: !o.ativo } : o
            ));
        } catch (error) {
            console.error("Erro ao atualizar oferta:", error);
            alert("Erro ao atualizar status da oferta.");
        }
    };

    const deleteOferta = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta oferta?')) return;

        try {
            const { error } = await supabase
                .from('ofertas')
                .delete()
                .eq('id', id)
                .eq('fornecedor_id', fornecedorId!);

            if (error) throw error;

            setOfertas(prev => prev.filter(o => o.id !== id));
        } catch (error) {
            console.error("Erro ao excluir oferta:", error);
            alert("Erro ao excluir oferta.");
        }
    };

    const handleCreateOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fornecedorId || !selectedMaterial) return;

        const val = parseFloat(valorOferta);
        if (isNaN(val) || val <= 0) {
            alert("Valor da oferta inválido");
            return;
        }

        const precoOrig = selectedMaterial.preco;
        let precoFinal: number;
        let descontoPerc: number;

        if (tipoOferta === "percentual") {
            descontoPerc = val;
            precoFinal = precoOrig * (1 - val / 100);
        } else {
            precoFinal = precoOrig - val;
            descontoPerc = ((val / precoOrig) * 100);
        }

        if (precoFinal <= 0) {
            alert("O desconto não pode tornar o preço menor ou igual a zero.");
            return;
        }

        setSavingOffer(true);
        try {
            const { data, error } = await supabase
                .from('ofertas')
                .insert({
                    fornecedor_id: fornecedorId,
                    fornecedor_material_id: selectedMaterial.id,
                    material_id: selectedMaterial.material_id,
                    material_nome: selectedMaterial.material_nome,
                    material_unidade: selectedMaterial.material_unidade,
                    tipo_oferta: tipoOferta,
                    valor_oferta: val,
                    preco_original: precoOrig,
                    preco_final: parseFloat(precoFinal.toFixed(2)),
                    desconto_percentual: parseFloat(descontoPerc.toFixed(2)),
                    quantidade_minima: parseInt(quantidadeMinima) || 1,
                    estoque: selectedMaterial.estoque,
                    data_inicio: dataInicio || new Date().toISOString(),
                    data_fim: dataFim || null,
                    ativo: true
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setOfertas(prev => [data as Oferta, ...prev]);
            }

            setIsModalOpen(false);
            setSelectedMaterialId("");
            setValorOferta("");
            setQuantidadeMinima("1");
            setDataInicio("");
            setDataFim("");
        } catch (error) {
            console.error("Erro ao criar oferta:", error);
            alert("Erro ao criar oferta. Verifique os dados e tente novamente.");
        } finally {
            setSavingOffer(false);
        }
    };

    const ofertasAtivas = ofertas.filter(o => o.ativo);
    const ofertasPausadas = ofertas.filter(o => !o.ativo);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Carregando ofertas...</span>
            </div>
        );
    }

    if (!fornecedorId) {
        return (
            <div className="p-8 text-center text-gray-500">
                <MegaphoneIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">Perfil de fornecedor não encontrado</p>
                <p className="text-sm mt-1">Complete seu cadastro para criar ofertas.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Minhas Ofertas</h3>
                    <p className="text-sm text-gray-600">
                        Crie ofertas promocionais para seus materiais e atraia mais clientes.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={materiaisConfigurados.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <PlusCircleIcon className="h-5 w-5" />
                    Nova Oferta
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <TagIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total de Ofertas</p>
                            <p className="text-2xl font-bold text-gray-900">{ofertas.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Ativas</p>
                            <p className="text-2xl font-bold text-green-600">{ofertasAtivas.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <PauseIcon className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Pausadas</p>
                            <p className="text-2xl font-bold text-amber-600">{ofertasPausadas.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Materiais configurados info */}
            {materiaisConfigurados.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm text-amber-800 font-medium">
                        ⚠️ Você ainda não possui materiais configurados com preço.
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                        Vá em &quot;Cadastro de Materiais&quot; e configure preço e estoque para poder criar ofertas.
                    </p>
                </div>
            )}

            {/* Ofertas list */}
            <div className="space-y-4">
                {ofertas.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                        <MegaphoneIcon className="mx-auto h-12 w-12 text-gray-300" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma oferta criada</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {materiaisConfigurados.length > 0
                                ? "Crie uma oferta promocional para impulsionar suas vendas."
                                : "Configure seus materiais primeiro, depois crie ofertas."
                            }
                        </p>
                    </div>
                ) : (
                    ofertas.map((oferta) => (
                        <div
                            key={oferta.id}
                            className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${oferta.ativo
                                    ? 'border-green-200 hover:border-green-300'
                                    : 'border-gray-200 opacity-70'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Material info */}
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${oferta.ativo
                                            ? 'bg-green-100 text-green-600'
                                            : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        <TagIcon className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-semibold text-gray-900">{oferta.material_nome}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-sm text-gray-500">{oferta.material_unidade}</span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${oferta.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {oferta.ativo ? 'Ativa' : 'Pausada'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Pricing info */}
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Original</p>
                                        <p className="text-sm text-gray-400 line-through">R$ {oferta.preco_original.toFixed(2)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Oferta</p>
                                        <p className="text-lg font-bold text-green-600">R$ {oferta.preco_final.toFixed(2)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Desconto</p>
                                        <p className="text-sm font-semibold text-orange-600">
                                            {oferta.desconto_percentual ? `${oferta.desconto_percentual.toFixed(0)}%` : '-'}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 uppercase font-medium">Qtd Mín</p>
                                        <p className="text-sm font-medium text-gray-900">{oferta.quantidade_minima}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleOfertaAtivo(oferta)}
                                        className={`p-2 rounded-lg transition-colors ${oferta.ativo
                                                ? 'text-amber-600 hover:bg-amber-50'
                                                : 'text-green-600 hover:bg-green-50'
                                            }`}
                                        title={oferta.ativo ? 'Pausar oferta' : 'Ativar oferta'}
                                    >
                                        {oferta.ativo ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                                    </button>
                                    <button
                                        onClick={() => deleteOferta(oferta.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir oferta"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {(oferta.data_inicio || oferta.data_fim) && (
                                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                                    {oferta.data_inicio && (
                                        <span>Início: {new Date(oferta.data_inicio).toLocaleDateString('pt-BR')}</span>
                                    )}
                                    {oferta.data_fim && (
                                        <span>Fim: {new Date(oferta.data_fim).toLocaleDateString('pt-BR')}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create Offer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Nova Oferta Promocional</h3>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                Selecione um material configurado e defina o desconto.
                            </p>
                        </div>

                        <form onSubmit={handleCreateOffer} className="p-6 space-y-4">
                            {/* Material select */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Material *</label>
                                <select
                                    required
                                    value={selectedMaterialId}
                                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Selecione um material...</option>
                                    {materiaisConfigurados.map(m => (
                                        <option key={m.material_id} value={m.material_id}>
                                            {m.material_nome} — R$ {m.preco.toFixed(2)} ({m.material_unidade})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedMaterial && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-sm text-blue-800">
                                        <span className="font-medium">Preço atual:</span> R$ {selectedMaterial.preco.toFixed(2)} / {selectedMaterial.material_unidade}
                                        {' • '}
                                        <span className="font-medium">Estoque:</span> {selectedMaterial.estoque}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Desconto *</label>
                                    <select
                                        value={tipoOferta}
                                        onChange={(e) => setTipoOferta(e.target.value as "valor" | "percentual")}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="percentual">Percentual (%)</option>
                                        <option value="valor">Valor fixo (R$)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {tipoOferta === "percentual" ? "Desconto (%)" : "Desconto (R$)"} *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        value={valorOferta}
                                        onChange={(e) => setValorOferta(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder={tipoOferta === "percentual" ? "Ex: 10" : "Ex: 5.00"}
                                    />
                                </div>
                            </div>

                            {precoFinalCalc !== null && precoFinalCalc > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <p className="text-sm text-green-800">
                                        <span className="font-medium">Preço final:</span>{' '}
                                        <span className="text-lg font-bold">R$ {precoFinalCalc.toFixed(2)}</span>
                                        <span className="ml-2 text-green-600">
                                            ({tipoOferta === "percentual"
                                                ? `${valorOferta}% OFF`
                                                : `R$ ${parseFloat(valorOferta).toFixed(2)} de desconto`
                                            })
                                        </span>
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Mínima</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={quantidadeMinima}
                                    onChange={(e) => setQuantidadeMinima(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                                    <input
                                        type="date"
                                        value={dataInicio}
                                        onChange={(e) => setDataInicio(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim (opcional)</label>
                                    <input
                                        type="date"
                                        value={dataFim}
                                        onChange={(e) => setDataFim(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                    disabled={savingOffer || !selectedMaterialId || !valorOferta || (precoFinalCalc !== null && precoFinalCalc <= 0)}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {savingOffer ? 'Criando...' : 'Criar Oferta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}