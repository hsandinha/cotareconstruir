"use client";

import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";


import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { getAuthHeaders } from "@/lib/authHeaders";
import { useSupplierAccessContext } from "./SupplierAccessContext";
import { Search, Check as CheckIcon, X, PlusCircle as PlusCircleIcon, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon, Download, Upload, AlertTriangle, Send, Grid2X2 as Squares2X2Icon, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import {
    buildCsv,
    downloadCsvFile,
    getCsvRowValue,
    normalizeCsvKey,
    parseBooleanish,
    parseSpreadsheetFile,
    parseFlexibleNumber
} from "@/lib/csvSpreadsheet";

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
    const { showToast } = useToast();
    const { user, profile, session, initialized } = useAuth();
    const { activeSupplierId, requiresSelection } = useSupplierAccessContext();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [loading, setLoading] = useState(true);
    const fornecedorId = activeSupplierId;

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
    const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
    const [exportingSpreadsheet, setExportingSpreadsheet] = useState(false);
    const spreadsheetInputRef = useRef<HTMLInputElement | null>(null);

    // Carregar grupos do fornecedor ativo
    useEffect(() => {
        const loadSupplierContextData = async () => {
            if (!initialized) return;
            if (requiresSelection) {
                setFornecedorGrupoIds([]);
                setLoading(false);
                return;
            }

            if (user && fornecedorId) {
                const { data: gruposData } = await supabase
                    .from('fornecedor_grupo')
                    .select('grupo_id')
                    .eq('fornecedor_id', fornecedorId);

                if (gruposData) {
                    setFornecedorGrupoIds(gruposData.map(g => g.grupo_id));
                } else {
                    setFornecedorGrupoIds([]);
                }
            } else {
                setFornecedorGrupoIds([]);
            }
            setLoading(false);
        };

        loadSupplierContextData();
    }, [user, initialized, fornecedorId, requiresSelection]);

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
            showToast("error", "Erro ao salvar. Tente novamente.");
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
            showToast("error", 'Erro ao alterar status. Tente novamente.');
        }
    };

    const handleRequestMaterial = async () => {
        if (!requestMaterialName.trim()) {
            showToast("error", "Digite o nome do material");
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

            showToast("success", "Solicitação enviada com sucesso! O administrador irá analisar.");
            setShowRequestModal(false);
            setRequestMaterialName("");
            setRequestMaterialDesc("");
            setRequestGrupo("");
        } catch (error) {
            console.error("Erro ao enviar solicitação:", error);
            showToast("error", "Erro ao enviar solicitação. Tente novamente.");
        } finally {
            setSendingRequest(false);
        }
    };

    const getGrupoNome = (grupoId: string) => {
        return grupos.find(g => g.id === grupoId)?.nome || grupoId;
    };

    const handleDownloadSpreadsheet = async () => {
        if (materiaisDisponiveis.length === 0) {
            showToast("error", "Nenhum material disponível para exportar.");
            return;
        }

        setExportingSpreadsheet(true);
        try {
            const rows = materiaisDisponiveis.map((material) => {
                const config = fornecedorMateriais.get(material.id);
                return {
                    material_id: material.id,
                    material_nome: material.nome,
                    unidade: material.unidade,
                    grupos: (material.gruposInsumoIds || []).map(getGrupoNome).join(" | "),
                    preco: config?.preco ?? 0,
                    estoque: config?.estoque ?? 0,
                    ativo: config ? (config.ativo ? 1 : 0) : 1,
                };
            });

            const csv = buildCsv(rows, [
                "material_id",
                "material_nome",
                "unidade",
                "grupos",
                "preco",
                "estoque",
                "ativo",
            ]);

            const today = new Date().toISOString().slice(0, 10);
            downloadCsvFile(`materiais_fornecedor_${today}.csv`, csv);
        } catch (error) {
            console.error("Erro ao gerar planilha de materiais:", error);
            showToast("error", "Erro ao gerar planilha. Tente novamente.");
        } finally {
            setExportingSpreadsheet(false);
        }
    };

    const handleImportSpreadsheetClick = () => {
        spreadsheetInputRef.current?.click();
    };

    const handleImportSpreadsheetFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;
        if (!fornecedorId) {
            showToast("error", "Fornecedor não selecionado.");
            return;
        }

        setImportingSpreadsheet(true);
        try {
            const rows = await parseSpreadsheetFile(file);
            if (rows.length === 0) {
                showToast("error", "A planilha está vazia ou em formato inválido.");
                return;
            }

            const allowedMaterialIds = new Set(materiaisDisponiveis.map((material) => material.id));
            const materialIdByName = new Map(
                materiaisDisponiveis.map((material) => [normalizeCsvKey(material.nome), material.id])
            );

            const updatesByMaterialId = new Map<string, {
                material_id: string;
                preco: number;
                estoque: number;
                ativo: boolean;
            }>();
            let ignoredRows = 0;

            for (const row of rows) {
                const rowMaterialId = getCsvRowValue(row, ["material_id", "materialid", "id_material", "id"]);
                const rowMaterialName = getCsvRowValue(row, ["material_nome", "material", "nome"]);
                const normalizedMaterialName = normalizeCsvKey(rowMaterialName);

                const materialId = (rowMaterialId || materialIdByName.get(normalizedMaterialName) || "").trim();
                if (!materialId || !allowedMaterialIds.has(materialId)) {
                    ignoredRows++;
                    continue;
                }

                const precoValue = parseFlexibleNumber(getCsvRowValue(row, ["preco", "preco_unitario", "valor", "price"]));
                const estoqueValue = parseFlexibleNumber(getCsvRowValue(row, ["estoque", "quantidade", "stock"]));
                const ativoValue = parseBooleanish(getCsvRowValue(row, ["ativo", "status", "disponivel"]), true);

                updatesByMaterialId.set(materialId, {
                    material_id: materialId,
                    preco: Math.max(0, precoValue ?? 0),
                    estoque: Math.max(0, Math.trunc(estoqueValue ?? 0)),
                    ativo: ativoValue,
                });
            }

            const updates = Array.from(updatesByMaterialId.values());
            if (updates.length === 0) {
                showToast("error", "Nenhuma linha válida foi encontrada para importação.");
                return;
            }

            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch("/api/fornecedor-materiais", {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({
                    action: "bulk_upsert",
                    fornecedor_id: fornecedorId,
                    items: updates,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Erro ao importar planilha");
            }

            const updatedRows = Array.isArray(json.data) ? json.data : [];
            setFornecedorMateriais((prev) => {
                const next = new Map(prev);
                updatedRows.forEach((item: any) => {
                    next.set(item.material_id, {
                        materialId: item.material_id,
                        preco: item.preco ?? 0,
                        estoque: item.estoque ?? 0,
                        ativo: item.ativo ?? true,
                        updatedAt: item.updated_at || new Date().toISOString(),
                    });
                });
                return next;
            });

            const skippedCount = Number(json.skipped_count || 0) + ignoredRows;
            alert(
                `Importação concluída: ${json.updated_count || updates.length} materiais atualizados` +
                (skippedCount > 0 ? `, ${skippedCount} linhas ignoradas.` : ".")
            );
        } catch (error: any) {
            console.error("Erro ao importar planilha de materiais:", error);
            showToast("error", error.message || "Erro ao importar planilha.");
        } finally {
            setImportingSpreadsheet(false);
        }
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
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
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
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleDownloadSpreadsheet}
                        disabled={exportingSpreadsheet || importingSpreadsheet || loadingMateriais}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4" />
                        {exportingSpreadsheet ? "Gerando..." : "Baixar Lista (CSV)"}
                    </button>
                    <button
                        onClick={handleImportSpreadsheetClick}
                        disabled={importingSpreadsheet || exportingSpreadsheet}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Upload className="h-4 w-4" />
                        {importingSpreadsheet ? "Importando..." : "Importar Lista (CSV/XLSX)"}
                    </button>
                    <input
                        ref={spreadsheetInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="hidden"
                        onChange={handleImportSpreadsheetFile}
                    />
                    <button
                        onClick={() => setShowRequestModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                        Solicitar Novo Material
                    </button>
                </div>
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
                            <CheckCircle className="h-5 w-5 text-green-600" />
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
                            <Clock className="h-5 w-5 text-amber-600" />
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
                            <X className="h-5 w-5 text-red-600" />
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
                        <Search className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
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
                                                        <X className="h-3.5 w-3.5" />
                                                        Inativo
                                                    </span>
                                                ) : isAtivo ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <CheckCircle className="h-3.5 w-3.5" />
                                                        Ativo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        <Clock className="h-3.5 w-3.5" />
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
                                                            <X className="h-4 w-4" />
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
                                    <X className="h-5 w-5 text-gray-500" />
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
                                <Send className="h-4 w-4" />
                                {sendingRequest ? 'Enviando...' : 'Enviar Solicitação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
