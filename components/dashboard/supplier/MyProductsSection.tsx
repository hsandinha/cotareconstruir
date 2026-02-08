"use client";

import { useState, useEffect, useMemo } from "react";
import {
    MagnifyingGlassIcon,
    CheckIcon,
    XMarkIcon,
    TagIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";

// Helper para obter headers com token de autenticação
async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
}

interface ProdutoConfigurado {
    fornecedorMaterialId: string; // fornecedor_materiais.id
    materialId: string;
    materialNome: string;
    materialUnidade: string;
    preco: number;
    estoque: number;
    // Dados da oferta (da tabela ofertas)
    ofertaId?: string;
    tipoOferta?: "valor" | "percentual";
    valorOferta?: number;
    precoFinal?: number;
    descontoPercentual?: number;
    quantidadeMinima?: number;
    ofertaAtiva?: boolean;
}

export function SupplierMyProductsSection() {
    const { user, initialized } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);
    const [produtos, setProdutos] = useState<ProdutoConfigurado[]>([]);

    // Edição inline
    const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
    const [editTipoOferta, setEditTipoOferta] = useState<"valor" | "percentual">("percentual");
    const [editValorOferta, setEditValorOferta] = useState("");
    const [editQtdMinima, setEditQtdMinima] = useState("1");
    const [saving, setSaving] = useState(false);

    // Carregar fornecedor_id
    useEffect(() => {
        if (!initialized || !user) return;

        const loadFornecedorId = async () => {
            const { data: userData } = await supabase
                .from("users")
                .select("fornecedor_id")
                .eq("id", user.id)
                .single();

            if (userData?.fornecedor_id) {
                setFornecedorId(userData.fornecedor_id);
                return;
            }

            const { data: fornecedorData } = await supabase
                .from("fornecedores")
                .select("id")
                .eq("user_id", user.id)
                .single();

            if (fornecedorData) {
                setFornecedorId(fornecedorData.id);
            }
        };

        loadFornecedorId();
    }, [user, initialized]);

    // Carregar produtos configurados + ofertas
    useEffect(() => {
        if (!fornecedorId) return;

        const loadData = async () => {
            setLoading(true);
            try {
                const headers = await getAuthHeaders();

                // 1. Buscar fornecedor_materiais via API (bypass RLS)
                const fmRes = await fetch(
                    `/api/fornecedor-materiais?fornecedor_id=${fornecedorId}`,
                    { headers }
                );

                if (!fmRes.ok) {
                    console.error("Erro ao buscar fornecedor_materiais:", fmRes.status);
                    setProdutos([]);
                    setLoading(false);
                    return;
                }

                const fmJson = await fmRes.json();
                const fmData: any[] = fmJson.data || [];

                // Filtrar apenas materiais ativos com preço > 0
                const ativos = fmData.filter(
                    (m: any) => m.ativo !== false && m.preco > 0
                );

                if (ativos.length === 0) {
                    setProdutos([]);
                    setLoading(false);
                    return;
                }

                // 2. Buscar nomes dos materiais
                const materialIds = ativos.map((m: any) => m.material_id);
                const { data: matData } = await supabase
                    .from("materiais")
                    .select("id, nome, unidade")
                    .in("id", materialIds);

                const matMap = new Map(
                    matData?.map((m) => [m.id, m]) || []
                );

                // 3. Buscar ofertas existentes para este fornecedor
                const { data: ofertasData } = await supabase
                    .from("ofertas")
                    .select("*")
                    .eq("fornecedor_id", fornecedorId);

                const ofertasMap = new Map(
                    (ofertasData || []).map((o: any) => [o.material_id, o])
                );

                // 4. Montar lista de produtos
                const produtosResult: ProdutoConfigurado[] = ativos.map(
                    (fm: any) => {
                        const mat = matMap.get(fm.material_id);
                        const oferta = ofertasMap.get(fm.material_id);

                        return {
                            fornecedorMaterialId: fm.id,
                            materialId: fm.material_id,
                            materialNome: mat?.nome || "Material desconhecido",
                            materialUnidade: mat?.unidade || "",
                            preco: fm.preco,
                            estoque: fm.estoque || 0,
                            // Dados da oferta (se existir)
                            ofertaId: oferta?.id,
                            tipoOferta: oferta?.tipo_oferta,
                            valorOferta: oferta?.valor_oferta,
                            precoFinal: oferta?.preco_final,
                            descontoPercentual: oferta?.desconto_percentual,
                            quantidadeMinima: oferta?.quantidade_minima,
                            ofertaAtiva: oferta?.ativo,
                        };
                    }
                );

                setProdutos(produtosResult);
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                setProdutos([]);
            }
            setLoading(false);
        };

        loadData();
    }, [fornecedorId]);

    // Filtrar por busca
    const produtosFiltrados = useMemo(() => {
        if (!searchTerm) return produtos;
        const term = searchTerm.toLowerCase();
        return produtos.filter(
            (p) =>
                p.materialNome.toLowerCase().includes(term) ||
                p.materialUnidade.toLowerCase().includes(term)
        );
    }, [produtos, searchTerm]);

    const startEditing = (produto: ProdutoConfigurado) => {
        setEditingMaterial(produto.materialId);
        setEditTipoOferta(produto.tipoOferta || "percentual");
        setEditValorOferta(produto.valorOferta?.toString() || "");
        setEditQtdMinima(produto.quantidadeMinima?.toString() || "1");
    };

    const cancelEditing = () => {
        setEditingMaterial(null);
        setEditTipoOferta("percentual");
        setEditValorOferta("");
        setEditQtdMinima("1");
    };

    const calcularPrecoFinal = (
        preco: number,
        tipo: "valor" | "percentual",
        valor: number
    ) => {
        if (!valor || valor <= 0) return preco;
        if (tipo === "percentual") {
            return preco * (1 - valor / 100);
        }
        return preco - valor;
    };

    const saveEditing = async () => {
        if (!fornecedorId || !editingMaterial) return;

        const produto = produtos.find((p) => p.materialId === editingMaterial);
        if (!produto) return;

        const valorOferta = parseFloat(editValorOferta) || 0;
        const precoOrig = produto.preco;

        setSaving(true);
        try {
            if (valorOferta > 0 && precoOrig > 0) {
                // Calcular preço final e desconto
                let precoFinal: number;
                let descontoPerc: number;

                if (editTipoOferta === "percentual") {
                    descontoPerc = valorOferta;
                    precoFinal = precoOrig * (1 - valorOferta / 100);
                } else {
                    precoFinal = precoOrig - valorOferta;
                    descontoPerc = (valorOferta / precoOrig) * 100;
                }

                if (precoFinal <= 0) {
                    alert("O desconto não pode tornar o preço menor ou igual a zero.");
                    setSaving(false);
                    return;
                }

                // Upsert na tabela ofertas
                const ofertaData: any = {
                    fornecedor_id: fornecedorId,
                    fornecedor_material_id: produto.fornecedorMaterialId,
                    material_id: produto.materialId,
                    material_nome: produto.materialNome,
                    material_unidade: produto.materialUnidade,
                    tipo_oferta: editTipoOferta,
                    valor_oferta: valorOferta,
                    preco_original: precoOrig,
                    preco_final: parseFloat(precoFinal.toFixed(2)),
                    desconto_percentual: parseFloat(descontoPerc.toFixed(2)),
                    quantidade_minima: parseInt(editQtdMinima) || 1,
                    estoque: produto.estoque,
                    ativo: true,
                    updated_at: new Date().toISOString(),
                };

                if (produto.ofertaId) {
                    // Atualizar oferta existente
                    const { error } = await supabase
                        .from("ofertas")
                        .update(ofertaData)
                        .eq("id", produto.ofertaId);

                    if (error) throw error;
                } else {
                    // Criar nova oferta
                    ofertaData.data_inicio = new Date().toISOString();
                    const { error } = await supabase
                        .from("ofertas")
                        .insert(ofertaData);

                    if (error) throw error;
                }

                // Atualizar estado local
                setProdutos((prev) =>
                    prev.map((p) =>
                        p.materialId === editingMaterial
                            ? {
                                ...p,
                                tipoOferta: editTipoOferta,
                                valorOferta,
                                precoFinal: parseFloat(precoFinal.toFixed(2)),
                                descontoPercentual: parseFloat(descontoPerc.toFixed(2)),
                                quantidadeMinima: parseInt(editQtdMinima) || 1,
                                ofertaAtiva: true,
                            }
                            : p
                    )
                );
            } else {
                // Remover oferta se valor for 0
                if (produto.ofertaId) {
                    await supabase
                        .from("ofertas")
                        .delete()
                        .eq("id", produto.ofertaId);
                }

                // Atualizar estado local
                setProdutos((prev) =>
                    prev.map((p) =>
                        p.materialId === editingMaterial
                            ? {
                                ...p,
                                ofertaId: undefined,
                                tipoOferta: undefined,
                                valorOferta: undefined,
                                precoFinal: undefined,
                                descontoPercentual: undefined,
                                quantidadeMinima: undefined,
                                ofertaAtiva: undefined,
                            }
                            : p
                    )
                );
            }

            cancelEditing();
        } catch (error) {
            console.error("Erro ao salvar oferta:", error);
            alert("Erro ao salvar oferta. Verifique os dados e tente novamente.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Carregando produtos...</span>
            </div>
        );
    }

    if (!fornecedorId) {
        return (
            <div className="p-8 text-center text-gray-500">
                <TagIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="font-medium">Perfil de fornecedor não encontrado</p>
                <p className="text-sm mt-1">Complete seu cadastro para gerenciar produtos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-xl font-bold text-gray-900">Meus Produtos</h3>
                <p className="text-sm text-gray-600">
                    Configure ofertas e quantidades mínimas para seus produtos
                </p>
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>

            {/* Info */}
            {produtos.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm text-amber-800 font-medium">
                        ⚠️ Nenhum produto configurado com preço encontrado.
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                        Vá em &quot;Cadastro de Materiais&quot; e configure preço e estoque para seus materiais.
                    </p>
                </div>
            )}

            {/* Products Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Material
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Preço Base
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Estoque
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Tipo Oferta
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Desconto
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Preço Final
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Qtd Mínima
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {produtosFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                        {produtos.length === 0
                                            ? "Nenhum produto configurado ainda"
                                            : "Nenhum produto encontrado para a busca"}
                                    </td>
                                </tr>
                            ) : (
                                produtosFiltrados.map((produto) => {
                                    const isEditing = editingMaterial === produto.materialId;
                                    const precoFinal =
                                        produto.precoFinal ??
                                        calcularPrecoFinal(
                                            produto.preco,
                                            produto.tipoOferta || "percentual",
                                            produto.valorOferta || 0
                                        );

                                    // Preview do preço durante edição
                                    const editPrecoPreview = isEditing
                                        ? calcularPrecoFinal(
                                            produto.preco,
                                            editTipoOferta,
                                            parseFloat(editValorOferta) || 0
                                        )
                                        : null;

                                    return (
                                        <tr key={produto.materialId} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {produto.materialNome}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {produto.materialUnidade}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                R$ {produto.preco.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {produto.estoque}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <select
                                                        value={editTipoOferta}
                                                        onChange={(e) =>
                                                            setEditTipoOferta(
                                                                e.target.value as "valor" | "percentual"
                                                            )
                                                        }
                                                        className="px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="percentual">Percentual (%)</option>
                                                        <option value="valor">Valor (R$)</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-sm text-gray-600">
                                                        {produto.tipoOferta === "valor"
                                                            ? "Valor (R$)"
                                                            : produto.tipoOferta === "percentual"
                                                                ? "Percentual (%)"
                                                                : "-"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editValorOferta}
                                                        onChange={(e) => setEditValorOferta(e.target.value)}
                                                        className="w-24 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="0.00"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-gray-600">
                                                        {produto.valorOferta && produto.valorOferta > 0
                                                            ? produto.tipoOferta === "percentual"
                                                                ? `${produto.valorOferta}%`
                                                                : `R$ ${produto.valorOferta.toFixed(2)}`
                                                            : "-"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <span
                                                        className={`text-sm font-semibold ${editPrecoPreview && editPrecoPreview < produto.preco
                                                                ? "text-green-600"
                                                                : "text-gray-900"
                                                            }`}
                                                    >
                                                        R$ {(editPrecoPreview ?? produto.preco).toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`text-sm font-semibold ${produto.valorOferta && produto.valorOferta > 0
                                                                ? "text-green-600"
                                                                : "text-gray-900"
                                                            }`}
                                                    >
                                                        R$ {precoFinal.toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editQtdMinima}
                                                        onChange={(e) => setEditQtdMinima(e.target.value)}
                                                        className="w-20 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                        min="1"
                                                        placeholder="1"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-gray-600">
                                                        {produto.quantidadeMinima || "-"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={saveEditing}
                                                            disabled={saving}
                                                            className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                                                            title="Salvar"
                                                        >
                                                            <CheckIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={cancelEditing}
                                                            disabled={saving}
                                                            className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                                                            title="Cancelar"
                                                        >
                                                            <XMarkIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEditing(produto)}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${produto.ofertaId
                                                                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                                                : "bg-blue-600 text-white hover:bg-blue-700"
                                                            }`}
                                                    >
                                                        {produto.ofertaId ? "Editar Oferta" : "Configurar Oferta"}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
