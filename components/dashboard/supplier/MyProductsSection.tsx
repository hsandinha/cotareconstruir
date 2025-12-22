"use client";

import { useState, useEffect, useMemo } from "react";
import {
    MagnifyingGlassIcon,
    CheckIcon,
    XMarkIcon,
    TagIcon,
    PercentBadgeIcon,
    CurrencyDollarIcon
} from "@heroicons/react/24/outline";
import { auth, db } from "../../../lib/firebase";
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Interfaces
interface MaterialBase {
    id: string;
    nome: string;
    unidade: string;
    gruposInsumoIds: string[];
    descricao?: string;
    fabricante?: string;
}

interface FornecedorMaterial {
    materialId: string;
    preco: number;
    estoque: number;
    ativo: boolean;
    dataAtualizacao: string;
    // Campos de oferta
    tipoOferta?: 'valor' | 'percentual';
    valorOferta?: number;
    quantidadeMinima?: number;
}

interface GrupoInsumo {
    id: string;
    nome: string;
}

export function SupplierMyProductsSection() {
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [userUid, setUserUid] = useState<string | null>(null);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);

    const [materiaisBase, setMateriaisBase] = useState<MaterialBase[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [fornecedorMateriais, setFornecedorMateriais] = useState<Map<string, FornecedorMaterial>>(new Map());

    // Edição inline
    const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
    const [editTipoOferta, setEditTipoOferta] = useState<'valor' | 'percentual'>('percentual');
    const [editValorOferta, setEditValorOferta] = useState("");
    const [editQtdMinima, setEditQtdMinima] = useState("");

    // Carregar dados do usuário e fornecedor
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserUid(user.uid);

                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.fornecedorId) {
                        setFornecedorId(userData.fornecedorId);
                    }
                }
            }
            setLoading(false);
        });

        return () => unsubscribeAuth();
    }, []);

    // Carregar materiais base e grupos
    useEffect(() => {
        const loadBaseData = async () => {
            try {
                const [gruposSnap, materiaisSnap] = await Promise.all([
                    getDocs(collection(db, "grupos_insumo")),
                    getDocs(collection(db, "materiais"))
                ]);

                const gruposData = gruposSnap.docs.map(doc => ({
                    id: doc.id,
                    nome: doc.data().nome
                }));
                setGrupos(gruposData);

                const materiaisData = materiaisSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as MaterialBase[];
                setMateriaisBase(materiaisData);
            } catch (error) {
                console.error("Erro ao carregar dados base:", error);
            }
        };

        loadBaseData();
    }, []);

    // Carregar materiais configurados pelo fornecedor
    useEffect(() => {
        if (!fornecedorId) return;

        const loadFornecedorMateriais = async () => {
            try {
                const snapshot = await getDocs(collection(db, "fornecedores", fornecedorId, "materiais"));
                const materiaisMap = new Map<string, FornecedorMaterial>();
                snapshot.forEach(doc => {
                    materiaisMap.set(doc.id, doc.data() as FornecedorMaterial);
                });
                setFornecedorMateriais(materiaisMap);
            } catch (error: any) {
                console.error("Erro ao carregar materiais:", error);
                setFornecedorMateriais(new Map());
            }
        };

        loadFornecedorMateriais();
    }, [fornecedorId]);

    // Filtrar apenas materiais com preço e estoque configurados
    const materiaisConfigurados = useMemo(() => {
        const materiais: Array<MaterialBase & { config: FornecedorMaterial }> = [];

        fornecedorMateriais.forEach((config, materialId) => {
            const material = materiaisBase.find(m => m.id === materialId);
            if (material && config.preco > 0) {
                materiais.push({ ...material, config });
            }
        });

        // Filtrar por busca
        if (searchTerm) {
            return materiais.filter(m =>
                m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return materiais;
    }, [materiaisBase, fornecedorMateriais, searchTerm]);

    const getGrupoNome = (grupoId: string) => {
        return grupos.find(g => g.id === grupoId)?.nome || grupoId;
    };

    const startEditing = (materialId: string, config: FornecedorMaterial) => {
        setEditingMaterial(materialId);
        setEditTipoOferta(config.tipoOferta || 'percentual');
        setEditValorOferta(config.valorOferta?.toString() || "");
        setEditQtdMinima(config.quantidadeMinima?.toString() || "");
    };

    const cancelEditing = () => {
        setEditingMaterial(null);
        setEditTipoOferta('percentual');
        setEditValorOferta("");
        setEditQtdMinima("");
    };

    const saveEditing = async () => {
        if (!fornecedorId || !editingMaterial) return;

        try {
            const materialRef = doc(db, "fornecedores", fornecedorId, "materiais", editingMaterial);
            const currentConfig = fornecedorMateriais.get(editingMaterial);
            const materialBase = materiaisBase.find(m => m.id === editingMaterial);

            const valorOferta = parseFloat(editValorOferta) || 0;
            const preco = currentConfig?.preco || 0;
            const dataAtualizacao = new Date().toISOString();

            // Atualizar material do fornecedor
            await updateDoc(materialRef, {
                ...currentConfig,
                tipoOferta: editTipoOferta,
                valorOferta,
                quantidadeMinima: parseInt(editQtdMinima) || 0,
                dataAtualizacao
            });

            // Gerenciar coleção global de ofertas
            const ofertaId = `${fornecedorId}_${editingMaterial}`;
            const ofertaRef = doc(db, "ofertas", ofertaId);

            if (valorOferta > 0 && preco > 0 && materialBase) {
                // Buscar dados do fornecedor para nome
                const fornecedorDoc = await getDoc(doc(db, "fornecedores", fornecedorId));
                const fornecedorData = fornecedorDoc.data();
                const fornecedorNome = fornecedorData?.nomeFantasia || fornecedorData?.razaoSocial || "Fornecedor";

                // Calcular preço final
                let precoFinal = preco;
                let descontoPercentual = 0;
                if (editTipoOferta === 'percentual') {
                    precoFinal = preco * (1 - valorOferta / 100);
                    descontoPercentual = valorOferta;
                } else {
                    precoFinal = preco - valorOferta;
                    descontoPercentual = Math.round((valorOferta / preco) * 100);
                }

                // Criar/atualizar oferta global
                await setDoc(ofertaRef, {
                    materialId: editingMaterial,
                    materialNome: materialBase.nome,
                    materialUnidade: materialBase.unidade,
                    materialDescricao: materialBase.descricao || null,
                    gruposInsumoIds: materialBase.gruposInsumoIds || [],
                    fornecedorId,
                    fornecedorNome,
                    preco,
                    precoFinal,
                    tipoOferta: editTipoOferta,
                    valorOferta,
                    descontoPercentual,
                    quantidadeMinima: parseInt(editQtdMinima) || 1,
                    estoque: currentConfig?.estoque || 0,
                    ativo: true,
                    dataAtualizacao
                });
                console.log("Oferta salva na coleção global:", ofertaId);
            } else {
                // Remover oferta se valor for 0
                try {
                    await deleteDoc(ofertaRef);
                    console.log("Oferta removida:", ofertaId);
                } catch (e) {
                    // Ignora se não existia
                }
            }

            // Recarregar dados
            const snapshot = await getDocs(collection(db, "fornecedores", fornecedorId, "materiais"));
            const materiaisMap = new Map<string, FornecedorMaterial>();
            snapshot.forEach(doc => {
                materiaisMap.set(doc.id, doc.data() as FornecedorMaterial);
            });
            setFornecedorMateriais(materiaisMap);

            cancelEditing();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar. Tente novamente.");
        }
    };

    const calcularPrecoComOferta = (preco: number, config: FornecedorMaterial) => {
        if (!config.valorOferta || config.valorOferta === 0) return preco;

        if (config.tipoOferta === 'percentual') {
            return preco * (1 - config.valorOferta / 100);
        } else {
            return preco - config.valorOferta;
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
                            {materiaisConfigurados.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                        Nenhum produto configurado ainda
                                    </td>
                                </tr>
                            ) : (
                                materiaisConfigurados.map((material) => {
                                    const isEditing = editingMaterial === material.id;
                                    const precoFinal = calcularPrecoComOferta(material.config.preco, material.config);

                                    return (
                                        <tr key={material.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{material.nome}</p>
                                                    {material.descricao && (
                                                        <p className="text-xs text-gray-500 mt-0.5">{material.descricao}</p>
                                                    )}
                                                    <div className="flex gap-1 mt-1">
                                                        {material.gruposInsumoIds?.slice(0, 2).map(grupoId => (
                                                            <span key={grupoId} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                                                {getGrupoNome(grupoId)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                R$ {material.config.preco.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {material.config.estoque} {material.unidade}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <select
                                                        value={editTipoOferta}
                                                        onChange={(e) => setEditTipoOferta(e.target.value as 'valor' | 'percentual')}
                                                        className="px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="percentual">Percentual (%)</option>
                                                        <option value="valor">Valor (R$)</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-sm text-gray-600">
                                                        {material.config.tipoOferta === 'valor' ? 'Valor (R$)' : 'Percentual (%)'}
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
                                                        {material.config.valorOferta ?
                                                            (material.config.tipoOferta === 'percentual' ?
                                                                `${material.config.valorOferta}%` :
                                                                `R$ ${material.config.valorOferta.toFixed(2)}`)
                                                            : '-'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-sm font-semibold ${material.config.valorOferta && material.config.valorOferta > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                                    R$ {precoFinal.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editQtdMinima}
                                                        onChange={(e) => setEditQtdMinima(e.target.value)}
                                                        className="w-20 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                ) : (
                                                    <span className="text-sm text-gray-600">
                                                        {material.config.quantidadeMinima || '-'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={saveEditing}
                                                            className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                                                            title="Salvar"
                                                        >
                                                            <CheckIcon className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={cancelEditing}
                                                            className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                                            title="Cancelar"
                                                        >
                                                            <XMarkIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEditing(material.id, material.config)}
                                                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Configurar Oferta
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
