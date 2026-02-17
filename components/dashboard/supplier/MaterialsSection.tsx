"use client";

import { useState, useEffect, useMemo } from "react";
import {
    MagnifyingGlassIcon,
    CheckIcon,
    XMarkIcon,
    PlusCircleIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    ExclamationTriangleIcon,
    PaperAirplaneIcon,
    Squares2X2Icon
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/solid";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { getAuthHeaders } from "@/lib/authHeaders";

// Helper para obter headers com token de autenticação


// Interfaces
interface MaterialBase {
    id: string;
    nome: string;
    unidade: string;
    gruposInsumoIds: string[];
    descricao?: string;
}

interface FornecedorMaterial {
    materialId: string;
    preco: number;
    estoque: number;
    ativo: boolean;
    updatedAt: string;
}

interface GrupoInsumo {
    id: string;
    nome: string;
}

export function SupplierMaterialsSection() {
    const { user, profile, session, initialized } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);

    // Dados base do sistema
    const [materiaisBase, setMateriaisBase] = useState<MaterialBase[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [fornecedorGrupoIds, setFornecedorGrupoIds] = useState<string[]>([]);
    const [loadingMateriais, setLoadingMateriais] = useState(true);

    // Materiais do fornecedor (preços e estoque)
    const [fornecedorMateriais, setFornecedorMateriais] = useState<Map<string, FornecedorMaterial>>(new Map());

    // Filtros
    const [filterGrupo, setFilterGrupo] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "pending">("all");

    // Edição inline
    const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
    const [editPreco, setEditPreco] = useState("");
    const [editEstoque, setEditEstoque] = useState("");

    // Modal de solicitação
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestMaterialName, setRequestMaterialName] = useState("");
    const [requestMaterialDesc, setRequestMaterialDesc] = useState("");
    const [requestGrupo, setRequestGrupo] = useState("");
    const [sendingRequest, setSendingRequest] = useState(false);

    // Carregar dados do usuário e fornecedor
    useEffect(() => {
        const loadUserData = async () => {
            if (!initialized) return;

            if (user) {
                let fId: string | null = null;

                // Primeiro tenta via users.fornecedor_id
                const { data: userData } = await supabase
                    .from('users')
                    .select('fornecedor_id')
                    .eq('id', user.id)
                    .single();

                if (userData?.fornecedor_id) {
                    fId = userData.fornecedor_id;
                } else {
                    // Fallback: buscar na tabela fornecedores por user_id
                    const { data: fornecedorData } = await supabase
                        .from('fornecedores')
                        .select('id')
                        .eq('user_id', user.id)
                        .single();

                    if (fornecedorData) {
                        fId = fornecedorData.id;
                    }
                }

                if (fId) {
                    setFornecedorId(fId);

                    // Buscar grupos do fornecedor na tabela de relacionamento
                    const { data: gruposData } = await supabase
                        .from('fornecedor_grupo')
                        .select('grupo_id')
                        .eq('fornecedor_id', fId);

                    if (gruposData) {
                        setFornecedorGrupoIds(gruposData.map(g => g.grupo_id));
                    }
                }
            }
            setLoading(false);
        };

        loadUserData();
    }, [user, initialized]);

    // Carregar materiais base e grupos
    useEffect(() => {
        const loadBaseData = async () => {
            setLoadingMateriais(true);
            try {
                // Carregar grupos
                const { data: gruposData, error: gruposError } = await supabase
                    .from('grupos_insumo')
                    .select('id, nome')
                    .order('nome', { ascending: true });

                if (gruposData) {
                    setGrupos(gruposData);
                }

                // Carregar materiais (colunas reais do schema)
                const allMateriais: any[] = [];
                let page = 0;
                const pageSize = 1000;
                while (true) {
                    const { data: chunk, error: materiaisError } = await supabase
                        .from('materiais')
                        .select('id, nome, unidade, descricao')
                        .order('nome', { ascending: true })
                        .range(page * pageSize, (page + 1) * pageSize - 1);

                    if (materiaisError) {
                        console.error('Erro ao carregar materiais:', materiaisError);
                        break;
                    }
                    if (!chunk || chunk.length === 0) break;
                    allMateriais.push(...chunk);
                    if (chunk.length < pageSize) break;
                    page++;
                }

                // Carregar junction table material_grupo para mapear material -> grupos
                const allMaterialGrupo: any[] = [];
                page = 0;
                while (true) {
                    const { data: chunk, error: mgError } = await supabase
                        .from('material_grupo')
                        .select('material_id, grupo_id')
                        .range(page * pageSize, (page + 1) * pageSize - 1);

                    if (mgError) {
                        console.error('Erro ao carregar material_grupo:', mgError);
                        break;
                    }
                    if (!chunk || chunk.length === 0) break;
                    allMaterialGrupo.push(...chunk);
                    if (chunk.length < pageSize) break;
                    page++;
                }

                // Build lookup: material_id -> grupo_ids[]
                const materialGrupoMap: Record<string, string[]> = {};
                allMaterialGrupo.forEach(mg => {
                    if (!materialGrupoMap[mg.material_id]) materialGrupoMap[mg.material_id] = [];
                    materialGrupoMap[mg.material_id].push(mg.grupo_id);
                });

                const mappedMateriais = allMateriais.map(m => ({
                    id: m.id,
                    nome: m.nome,
                    unidade: m.unidade,
                    gruposInsumoIds: materialGrupoMap[m.id] || [],
                    descricao: m.descricao
                }));
                setMateriaisBase(mappedMateriais);
            } catch (error) {
                console.error("Erro ao carregar dados base:", error);
            } finally {
                setLoadingMateriais(false);
            }
        };

        loadBaseData();
    }, []);

    // Carregar materiais configurados pelo fornecedor (via API para bypass RLS)
    useEffect(() => {
        if (!fornecedorId) return;

        const loadFornecedorMateriais = async () => {
            try {
                const headers = await getAuthHeaders(session?.access_token);
                const res = await fetch(`/api/fornecedor-materiais?fornecedor_id=${fornecedorId}`, { headers, credentials: 'include' });
                const json = await res.json();

                if (!res.ok) {
                    console.error('Erro ao carregar materiais do fornecedor:', json.error);
                    setFornecedorMateriais(new Map());
                    return;
                }

                const materiaisMap = new Map<string, FornecedorMaterial>();
                json.data?.forEach((item: any) => {
                    materiaisMap.set(item.material_id, {
                        materialId: item.material_id,
                        preco: item.preco,
                        estoque: item.estoque,
                        ativo: item.ativo,
                        updatedAt: item.updated_at
                    });
                });
                setFornecedorMateriais(materiaisMap);
            } catch (error: any) {
                console.error('Erro ao carregar materiais do fornecedor:', error);
                setFornecedorMateriais(new Map());
            }
        };

        loadFornecedorMateriais();
    }, [fornecedorId]);

    // Filtrar materiais pelos grupos do fornecedor
    const materiaisDisponiveis = useMemo(() => {
        if (fornecedorGrupoIds.length === 0) return [];

        return materiaisBase.filter(material =>
            material.gruposInsumoIds?.some(grupoId => fornecedorGrupoIds.includes(grupoId))
        );
    }, [materiaisBase, fornecedorGrupoIds]);

    // Aplicar filtros e busca
    const materiaisFiltrados = useMemo(() => {
        let result = materiaisDisponiveis;

        // Filtro por busca
        if (searchTerm) {
            result = result.filter(m =>
                m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filtro por grupo
        if (filterGrupo !== "all") {
            result = result.filter(m => m.gruposInsumoIds?.includes(filterGrupo));
        }

        // Filtro por status
        if (filterStatus === "active") {
            result = result.filter(m => {
                const c = fornecedorMateriais.get(m.id);
                return c && c.ativo !== false;
            });
        } else if (filterStatus === "inactive") {
            result = result.filter(m => {
                const c = fornecedorMateriais.get(m.id);
                return c && c.ativo === false;
            });
        } else if (filterStatus === "pending") {
            result = result.filter(m => !fornecedorMateriais.has(m.id));
        }

        // Ordenação
        if (sortConfig) {
            result = [...result].sort((a, b) => {
                let aVal: any, bVal: any;

                if (sortConfig.key === 'preco') {
                    aVal = fornecedorMateriais.get(a.id)?.preco || 0;
                    bVal = fornecedorMateriais.get(b.id)?.preco || 0;
                } else if (sortConfig.key === 'estoque') {
                    aVal = fornecedorMateriais.get(a.id)?.estoque || 0;
                    bVal = fornecedorMateriais.get(b.id)?.estoque || 0;
                } else {
                    aVal = (a as any)[sortConfig.key] || '';
                    bVal = (b as any)[sortConfig.key] || '';
                }

                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [materiaisDisponiveis, searchTerm, filterGrupo, filterStatus, sortConfig, fornecedorMateriais]);

    // Stats
    const stats = useMemo(() => {
        const total = materiaisDisponiveis.length;
        const ativos = materiaisDisponiveis.filter(m => {
            const c = fornecedorMateriais.get(m.id);
            return c && c.ativo !== false;
        }).length;
        const inativos = materiaisDisponiveis.filter(m => {
            const c = fornecedorMateriais.get(m.id);
            return c && c.ativo === false;
        }).length;
        const pendentes = total - ativos - inativos;
        return { total, ativos, inativos, pendentes };
    }, [materiaisDisponiveis, fornecedorMateriais]);

    // Grupos disponíveis para o fornecedor
    const gruposDisponiveis = useMemo(() => {
        return grupos.filter(g => fornecedorGrupoIds.includes(g.id));
    }, [grupos, fornecedorGrupoIds]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const startEditing = (materialId: string) => {
        const current = fornecedorMateriais.get(materialId);
        setEditingMaterial(materialId);
        setEditPreco(current?.preco?.toString() || "");
        setEditEstoque(current?.estoque?.toString() || "");
    };

    const cancelEditing = () => {
        setEditingMaterial(null);
        setEditPreco("");
        setEditEstoque("");
    };

    const saveEditing = async () => {
        if (!fornecedorId || !editingMaterial) return;

        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch('/api/fornecedor-materiais', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    action: 'upsert',
                    fornecedor_id: fornecedorId,
                    material_id: editingMaterial,
                    preco: parseFloat(editPreco) || 0,
                    estoque: parseInt(editEstoque) || 0,
                    ativo: true
                })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Erro ao salvar');
            }

            // Atualiza o mapa local
            setFornecedorMateriais(prev => {
                const newMap = new Map(prev);
                newMap.set(editingMaterial, {
                    materialId: editingMaterial,
                    preco: parseFloat(editPreco) || 0,
                    estoque: parseInt(editEstoque) || 0,
                    ativo: true,
                    updatedAt: new Date().toISOString()
                });
                return newMap;
            });

            cancelEditing();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar. Tente novamente.");
        }
    };

    const toggleAtivoMaterial = async (materialId: string, novoAtivo: boolean) => {
        if (!fornecedorId) return;

        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch('/api/fornecedor-materiais', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    action: 'toggle_ativo',
                    fornecedor_id: fornecedorId,
                    material_id: materialId,
                    ativo: novoAtivo
                })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Erro ao alterar status');
            }

            const json = await res.json();
            const updated = json.data;

            setFornecedorMateriais(prev => {
                const newMap = new Map(prev);
                newMap.set(materialId, {
                    materialId,
                    preco: updated.preco ?? prev.get(materialId)?.preco ?? 0,
                    estoque: updated.estoque ?? prev.get(materialId)?.estoque ?? 0,
                    ativo: updated.ativo,
                    updatedAt: updated.updated_at
                });
                return newMap;
            });
        } catch (error) {
            console.error('Erro ao alterar status:', error);
            alert('Erro ao alterar status. Tente novamente.');
        }
    };

    const handleRequestMaterial = async () => {
        if (!requestMaterialName.trim()) {
            alert("Digite o nome do material");
            return;
        }

        setSendingRequest(true);
        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch('/api/fornecedor-materiais', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    action: 'request_material',
                    fornecedor_id: fornecedorId,
                    nome: requestMaterialName,
                    unidade: 'unid',
                    descricao: requestMaterialDesc,
                    grupo_sugerido: requestGrupo
                })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || 'Erro ao enviar solicitação');
            }

            alert("Solicitação enviada com sucesso! O administrador irá analisar.");
            setShowRequestModal(false);
            setRequestMaterialName("");
            setRequestMaterialDesc("");
            setRequestGrupo("");
        } catch (error) {
            console.error("Erro ao enviar solicitação:", error);
            alert("Erro ao enviar solicitação. Tente novamente.");
        } finally {
            setSendingRequest(false);
        }
    };

    const getGrupoNome = (grupoId: string) => {
        return grupos.find(g => g.id === grupoId)?.nome || grupoId;
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Carregando materiais...</span>
            </div>
        );
    }

    if (fornecedorGrupoIds.length === 0) {
        return (
            <div className="p-8">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <ExclamationTriangleIcon className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-amber-800 mb-2">Cadastro Pendente</h3>
                    <p className="text-amber-700">
                        Sua empresa ainda não foi associada a nenhum grupo de insumos.
                        Entre em contato com o administrador para completar seu cadastro.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Meus Materiais</h3>
                    <p className="text-sm text-gray-600">
                        Configure preços e estoque dos materiais disponíveis para sua empresa.
                    </p>
                </div>
                <button
                    onClick={() => setShowRequestModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                    <PlusCircleIcon className="h-5 w-5" />
                    Solicitar Novo Material
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Squares2X2Icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total</p>
                            <p className="text-2xl font-bold text-gray-900">{loadingMateriais ? '...' : stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Ativos</p>
                            <p className="text-2xl font-bold text-green-600">{loadingMateriais ? '...' : stats.ativos}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <ClockIcon className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Pendentes</p>
                            <p className="text-2xl font-bold text-amber-600">{loadingMateriais ? '...' : stats.pendentes}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <XMarkIcon className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Inativos</p>
                            <p className="text-2xl font-bold text-red-500">{loadingMateriais ? '...' : stats.inativos}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Buscar material..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                        />
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                    </div>

                    {/* Filter by Grupo */}
                    <select
                        value={filterGrupo}
                        onChange={(e) => setFilterGrupo(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Todos os Grupos</option>
                        {gruposDisponiveis.map(g => (
                            <option key={g.id} value={g.id}>{g.nome}</option>
                        ))}
                    </select>

                    {/* Filter by Status */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="active">Ativos</option>
                        <option value="pending">Pendentes</option>
                        <option value="inactive">Inativos</option>
                    </select>
                </div>
            </div>

            {/* Materials Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('nome')}
                                >
                                    <div className="flex items-center gap-2">
                                        Material
                                        {sortConfig?.key === 'nome' && (
                                            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Grupo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Unidade
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('preco')}
                                >
                                    <div className="flex items-center gap-2">
                                        Preço (R$)
                                        {sortConfig?.key === 'preco' && (
                                            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('estoque')}
                                >
                                    <div className="flex items-center gap-2">
                                        Estoque
                                        {sortConfig?.key === 'estoque' && (
                                            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loadingMateriais ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: j === 0 ? '60%' : '40%' }}></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : materiaisFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        Nenhum material encontrado
                                    </td>
                                </tr>
                            ) : (
                                materiaisFiltrados.map((material) => {
                                    const config = fornecedorMateriais.get(material.id);
                                    const isEditing = editingMaterial === material.id;
                                    const isConfigured = !!config;
                                    const isInativo = config?.ativo === false;
                                    const isAtivo = isConfigured && !isInativo;

                                    return (
                                        <tr key={material.id} className={`hover:bg-gray-50 ${isInativo ? 'bg-red-50/30 opacity-60' : !isConfigured ? 'bg-amber-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className={`text-sm font-medium ${isInativo ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{material.nome}</p>
                                                    {material.descricao && (
                                                        <p className="text-xs text-gray-500 mt-0.5">{material.descricao}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {material.gruposInsumoIds?.slice(0, 2).map(grupoId => (
                                                        <span key={grupoId} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                            {getGrupoNome(grupoId)}
                                                        </span>
                                                    ))}
                                                    {material.gruposInsumoIds?.length > 2 && (
                                                        <span className="text-xs text-gray-500">+{material.gruposInsumoIds.length - 2}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {material.unidade}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editPreco}
                                                        onChange={(e) => setEditPreco(e.target.value)}
                                                        className="w-24 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                        step="0.01"
                                                        min="0"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className={`text-sm ${isAtivo ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                                                        {isConfigured && !isInativo ? `R$ ${config.preco.toFixed(2)}` : '-'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editEstoque}
                                                        onChange={(e) => setEditEstoque(e.target.value)}
                                                        className="w-20 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                                        min="0"
                                                    />
                                                ) : (
                                                    <span className={`text-sm ${isAtivo ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                                                        {isConfigured && !isInativo ? config.estoque : '-'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isInativo ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                        <XMarkIcon className="h-3.5 w-3.5" />
                                                        Inativo
                                                    </span>
                                                ) : isAtivo ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <CheckCircleIcon className="h-3.5 w-3.5" />
                                                        Ativo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        <ClockIcon className="h-3.5 w-3.5" />
                                                        Pendente
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
                                                    <div className="flex items-center justify-end gap-2">
                                                        {!isInativo && (
                                                            <button
                                                                onClick={() => startEditing(material.id)}
                                                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                                            >
                                                                {isAtivo ? 'Editar' : 'Configurar'}
                                                            </button>
                                                        )}
                                                        {isInativo ? (
                                                            <button
                                                                onClick={() => toggleAtivoMaterial(material.id, true)}
                                                                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                                                                title="Reativar material"
                                                            >
                                                                Ativar
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => toggleAtivoMaterial(material.id, false)}
                                                                className="px-3 py-1.5 bg-white text-red-600 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                                                                title="Não ofereço este material"
                                                            >
                                                                Inativar
                                                            </button>
                                                        )}
                                                    </div>
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

            {/* Modal de Solicitação de Material */}
            {showRequestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900">Solicitar Novo Material</h3>
                                <button
                                    onClick={() => setShowRequestModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                Não encontrou o material? Solicite o cadastro ao administrador.
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nome do Material *
                                </label>
                                <input
                                    type="text"
                                    value={requestMaterialName}
                                    onChange={(e) => setRequestMaterialName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: Cimento Portland CP-II"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Descrição (Opcional)
                                </label>
                                <textarea
                                    value={requestMaterialDesc}
                                    onChange={(e) => setRequestMaterialDesc(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={3}
                                    placeholder="Especificações, marca, etc..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Grupo Sugerido
                                </label>
                                <select
                                    value={requestGrupo}
                                    onChange={(e) => setRequestGrupo(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Selecione...</option>
                                    {gruposDisponiveis.map(g => (
                                        <option key={g.id} value={g.nome}>{g.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowRequestModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRequestMaterial}
                                disabled={sendingRequest || !requestMaterialName.trim()}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PaperAirplaneIcon className="h-4 w-4" />
                                {sendingRequest ? 'Enviando...' : 'Enviar Solicitação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
