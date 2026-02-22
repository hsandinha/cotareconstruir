"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { sendEmail } from "../../../app/actions/email";
import {
    Package, Plus, Trash2, ShoppingCart, Building2, Send, Search, Check,
    AlertCircle, Loader2, ChevronRight, Sparkles, ArrowRight, X, Tag,
    FileText, Scale, MessageSquare, Boxes, CheckCircle2, ChevronDown,
    Calendar, Clock, Layers, Zap, Filter
} from "lucide-react";

// Helper para obter headers com token (com fallback para localStorage)
async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Tentar Supabase session primeiro
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
            return headers;
        }
    } catch (e) {
        console.warn('Erro ao obter sessão Supabase:', e);
    }

    // Fallback: localStorage (setado pelo login)
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
}

// Types
interface Fase {
    id: string;
    cronologia: number;
    nome: string;
}

interface Servico {
    id: string;
    nome: string;
    ordem?: number;
    faseIds: string[];
    gruposInsumoIds: string[];
}

interface GrupoInsumo {
    id: string;
    nome: string;
}

interface Material {
    id: string;
    nome: string;
    unidade: string;
    gruposInsumoIds: string[];
}

interface ObraEtapa {
    id: string;
    obra_id: string;
    fase_id: string;
    nome: string;
    categoria: string;
    data_prevista: string;
    data_fim_prevista?: string;
    data_conclusao?: string;
    dias_antecedencia_cotacao: number;
    is_completed: boolean;
    ordem: number;
}

interface CartItem {
    id: number;
    descricao: string;
    categoria: string;
    quantidade: number;
    unidade: string;
    fornecedor?: string;
    observacao: string;
    faseNome?: string;
    servicoNome?: string;
    materialId?: string;
}

interface Obra {
    id: string;
    nome: string;
    bairro?: string;
    cidade?: string;
    etapa?: string;
    status?: string;
}

interface RemoteSearchCacheEntry {
    materials: Material[];
    nextOffset: number;
    hasMore: boolean;
}

export function ClientSolicitationSection() {
    const { user, initialized } = useAuth();

    // Estados principais
    const [items, setItems] = useState<CartItem[]>([]);
    const [obras, setObras] = useState<Obra[]>([]);
    const [selectedObraId, setSelectedObraId] = useState<string>("");
    const [obraEtapas, setObraEtapas] = useState<ObraEtapa[]>([]);

    // Estados para estrutura de materiais
    const [fases, setFases] = useState<Fase[]>([]);
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);

    // Estados de navegação por fases
    const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set());
    const [expandedServicos, setExpandedServicos] = useState<Set<string>>(new Set());
    const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set());

    // Estados de UI
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [quotationMode, setQuotationMode] = useState<"search" | "phases">("phases");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [successMeta, setSuccessMeta] = useState<{ cotacoes: number; grupos: number } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [remoteMaterials, setRemoteMaterials] = useState<Material[]>([]);
    const [isSearchingRemote, setIsSearchingRemote] = useState(false);
    const [isLoadingMoreRemote, setIsLoadingMoreRemote] = useState(false);
    const [remoteOffset, setRemoteOffset] = useState(0);
    const [hasMoreRemoteResults, setHasMoreRemoteResults] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchDropdownRect, setSearchDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

    // Formulário de item manual
    const [form, setForm] = useState({
        descricao: "",
        categoria: "",
        quantidade: 1,
        unidade: "unid",
        fornecedor: "",
        observacao: "",
    });

    const unidades = ["unid", "kg", "m", "m²", "m³", "L", "pç", "sc", "cx", "tn"];
    const searchInputWrapperRef = useRef<HTMLDivElement | null>(null);
    const searchDropdownRef = useRef<HTMLDivElement | null>(null);
    const remoteSearchCacheRef = useRef<Map<string, RemoteSearchCacheEntry>>(new Map());
    const REMOTE_SEARCH_PAGE_SIZE = 80;
    const MAX_REMOTE_SEARCH_CACHE_TERMS = 30;

    const normalizeGroupName = (value: string | null | undefined) =>
        String(value || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    const normalizeText = (value: string | null | undefined) =>
        String(value || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    const escapeIlikePattern = (value: string) =>
        value.replace(/[\\%_]/g, "");

    const getSearchVariants = (term: string) => {
        const raw = term.trim().toLowerCase();
        const normalized = normalizeText(term);
        return Array.from(new Set([raw, normalized].filter(Boolean)));
    };

    const getRemoteSearchCacheKey = (term: string) => normalizeText(term);

    const setRemoteSearchCacheEntry = (key: string, entry: RemoteSearchCacheEntry) => {
        const cache = remoteSearchCacheRef.current;

        if (cache.has(key)) {
            cache.delete(key);
        }
        cache.set(key, entry);

        if (cache.size > MAX_REMOTE_SEARCH_CACHE_TERMS) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey) cache.delete(oldestKey);
        }
    };

    const fetchRemoteMaterialsPage = async (term: string, offset: number) => {
        const variants = getSearchVariants(term);
        const from = offset;
        const to = offset + REMOTE_SEARCH_PAGE_SIZE - 1;

        let query = supabase
            .from("materiais")
            .select("id, nome, unidade")
            .order("nome", { ascending: true });

        if (variants.length === 1) {
            query = query.ilike("nome", `%${escapeIlikePattern(variants[0])}%`);
        } else {
            const orFilter = variants
                .map(variant => `nome.ilike.%${escapeIlikePattern(variant)}%`)
                .join(',');
            query = query.or(orFilter);
        }

        const { data: materiaisData, error: materiaisError } = await query.range(from, to);

        if (materiaisError) throw materiaisError;

        const materialRows = materiaisData || [];
        if (materialRows.length === 0) {
            return {
                materials: [] as Material[],
                nextOffset: offset,
                hasMore: false,
            };
        }

        const materialIds = materialRows.map(material => material.id);
        const { data: materialGrupoRows } = await supabase
            .from("material_grupo")
            .select("material_id, grupo_id")
            .in("material_id", materialIds);

        const materialGroupMap: Record<string, string[]> = {};
        (materialGrupoRows || []).forEach(link => {
            if (!materialGroupMap[link.material_id]) {
                materialGroupMap[link.material_id] = [];
            }
            materialGroupMap[link.material_id].push(link.grupo_id);
        });

        const mappedMaterials: Material[] = materialRows.map(material => ({
            id: material.id,
            nome: material.nome,
            unidade: material.unidade,
            gruposInsumoIds: materialGroupMap[material.id] || [],
        }));

        return {
            materials: mappedMaterials,
            nextOffset: offset + mappedMaterials.length,
            hasMore: materialRows.length === REMOTE_SEARCH_PAGE_SIZE,
        };
    };

    const scoreMaterialMatch = (materialName: string, normalizedTerm: string) => {
        const name = normalizeText(materialName);
        if (!name || !normalizedTerm) return -1;

        const term = normalizedTerm.replace(/[^a-z0-9]/g, "");
        const compactName = name.replace(/[^a-z0-9]/g, "");
        const words = name.split(/[^a-z0-9]+/).filter(Boolean);

        if (name === normalizedTerm || compactName === term) return 1000;
        if (name.startsWith(normalizedTerm)) return 900;
        if (words.some(word => word === normalizedTerm)) return 850;
        if (words.some(word => word.startsWith(normalizedTerm))) return 760;

        // Match parcial ainda é válido, mas com baixa prioridade para evitar ruído (ex.: "saco" ao buscar "aço")
        if (words.some(word => word.includes(normalizedTerm))) return 240;
        if (name.includes(normalizedTerm) || compactName.includes(term)) return 150;

        return -1;
    };

    // Carregar dados iniciais
    useEffect(() => {
        if (!initialized || !user) return;

        const loadInitialData = async () => {
            // Carregar grupos
            const { data: gruposData } = await supabase
                .from('grupos_insumo')
                .select('id, nome')
                .order('nome');

            const groupsList = (gruposData || []);
            setGrupos(groupsList.map(g => ({ id: g.id, nome: g.nome })));
            setAvailableGroups(groupsList.map(g => g.nome));
            if (groupsList.length > 0) {
                setForm(prev => ({ ...prev, categoria: groupsList[0].nome }));
            }

            // Carregar obras do usuário
            const { data: obrasData, error: obrasError } = await supabase
                .from('obras')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (obrasError) {
                console.error("Erro ao carregar obras:", obrasError);
            }
            setObras(obrasData || []);

            // Carregar estrutura de fases, serviços e materiais
            await loadConstructionData();
        };

        loadInitialData();
    }, [user, initialized]);

    // Carregar etapas quando selecionar obra
    useEffect(() => {
        if (!selectedObraId) {
            setObraEtapas([]);
            return;
        }

        const loadObraEtapas = async () => {
            const { data, error } = await supabase
                .from('obra_etapas')
                .select('*')
                .eq('obra_id', selectedObraId)
                .order('ordem', { ascending: true });

            if (error) {
                console.error("Erro ao carregar etapas:", error);
            }
            console.log("Etapas carregadas:", data);
            setObraEtapas(data || []);
        };

        loadObraEtapas();
    }, [selectedObraId]);

    // Carregar dados de estrutura (fases, serviços, materiais)
    const loadConstructionData = async () => {
        try {
            const [fasesRes, servicosRes, materiaisRes, servicoFaseRes, servicoGrupoRes, materialGrupoRes] = await Promise.all([
                supabase.from("fases").select("*").order("cronologia", { ascending: true }),
                supabase.from("servicos").select("*").order("ordem", { ascending: true }),
                supabase.from("materiais").select("*").range(0, 4999),
                supabase.from("servico_fase").select("*"),
                supabase.from("servico_grupo").select("*"),
                supabase.from("material_grupo").select("*")
            ]);

            // Build lookup maps
            const servicoFaseMap: Record<string, string[]> = {};
            (servicoFaseRes.data || []).forEach(sf => {
                if (!servicoFaseMap[sf.servico_id]) servicoFaseMap[sf.servico_id] = [];
                servicoFaseMap[sf.servico_id].push(sf.fase_id);
            });

            const servicoGrupoMap: Record<string, string[]> = {};
            (servicoGrupoRes.data || []).forEach(sg => {
                if (!servicoGrupoMap[sg.servico_id]) servicoGrupoMap[sg.servico_id] = [];
                servicoGrupoMap[sg.servico_id].push(sg.grupo_id);
            });

            const materialGrupoMap: Record<string, string[]> = {};
            (materialGrupoRes.data || []).forEach(mg => {
                if (!materialGrupoMap[mg.material_id]) materialGrupoMap[mg.material_id] = [];
                materialGrupoMap[mg.material_id].push(mg.grupo_id);
            });

            setFases((fasesRes.data || []).map(f => ({
                id: f.id,
                cronologia: f.cronologia,
                nome: f.nome
            })));

            setServicos((servicosRes.data || []).map(s => ({
                id: s.id,
                nome: s.nome,
                ordem: s.ordem,
                faseIds: servicoFaseMap[s.id] || [],
                gruposInsumoIds: servicoGrupoMap[s.id] || []
            })));

            setMateriais((materiaisRes.data || []).map(m => ({
                id: m.id,
                nome: m.nome,
                unidade: m.unidade,
                gruposInsumoIds: materialGrupoMap[m.id] || []
            })));
        } catch (error) {
            console.error("Erro ao carregar dados da estrutura:", error);
        }
    };

    // Obra selecionada
    const selectedObra = useMemo(() => {
        return obras.find(o => o.id === selectedObraId);
    }, [obras, selectedObraId]);

    // Etapas da obra válidas para cotação (data atual >= data_prevista - dias_antecedencia_cotacao)
    const validEtapasForQuotation = useMemo(() => {
        if (obraEtapas.length === 0) return [];

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return obraEtapas.filter(etapa => {
            const dataPrevista = new Date(etapa.data_prevista);
            dataPrevista.setHours(0, 0, 0, 0);
            const dataInicioCotacao = new Date(dataPrevista);
            dataInicioCotacao.setDate(dataInicioCotacao.getDate() - etapa.dias_antecedencia_cotacao);

            console.log(`Etapa: ${etapa.nome}, Prevista: ${dataPrevista.toLocaleDateString()}, Início Cotação: ${dataInicioCotacao.toLocaleDateString()}, Hoje: ${hoje.toLocaleDateString()}, Válida: ${hoje >= dataInicioCotacao}`);

            return hoje >= dataInicioCotacao && !etapa.is_completed;
        });
    }, [obraEtapas]);

    const groupIdsByEtapa = useMemo(() => {
        const map = new Map<string, Set<string>>();

        for (const etapa of validEtapasForQuotation) {
            const gruposDaEtapa = new Set<string>();
            const servicosDaEtapa = servicos.filter(servico => servico.faseIds?.includes(etapa.fase_id));

            for (const servico of servicosDaEtapa) {
                (servico.gruposInsumoIds || []).forEach(grupoId => gruposDaEtapa.add(grupoId));
            }

            map.set(etapa.id, gruposDaEtapa);
        }

        return map;
    }, [validEtapasForQuotation, servicos]);

    // Itens agrupados por categoria
    const groupedItems = useMemo(() => {
        const groups: Record<string, CartItem[]> = {};
        items.forEach(item => {
            if (!groups[item.categoria]) {
                groups[item.categoria] = [];
            }
            groups[item.categoria].push(item);
        });
        return groups;
    }, [items]);

    // Filtrar materiais na busca
    const filteredMaterials = useMemo(() => {
        if (!searchTerm) return [];

        const normalizedTerm = normalizeText(searchTerm);
        if (!normalizedTerm) return [];

        const mergedMap = new Map<string, Material>();
        [...remoteMaterials, ...materiais].forEach(material => {
            const existing = mergedMap.get(material.id);
            if (!existing) {
                mergedMap.set(material.id, material);
                return;
            }

            const existingGroupsCount = existing.gruposInsumoIds?.length || 0;
            const incomingGroupsCount = material.gruposInsumoIds?.length || 0;
            if (incomingGroupsCount > existingGroupsCount) {
                mergedMap.set(material.id, material);
            }
        });

        const searchableMaterials = Array.from(mergedMap.values());

        return searchableMaterials
            .map(material => ({
                material,
                score: scoreMaterialMatch(material.nome, normalizedTerm),
            }))
            .filter(result => result.score >= 0)
            .sort((a, b) => {
                if (a.score !== b.score) return b.score - a.score;
                return a.material.nome.localeCompare(b.material.nome, 'pt-BR');
            })
            .slice(0, 80)
            .map(result => result.material);
    }, [searchTerm, materiais, remoteMaterials]);

    useEffect(() => {
        const trimmedTerm = searchTerm.trim();
        const cacheKey = getRemoteSearchCacheKey(trimmedTerm);

        if (
            step !== 2 ||
            quotationMode !== "search" ||
            trimmedTerm.length < 2
        ) {
            setRemoteMaterials([]);
            setIsSearchingRemote(false);
            setIsLoadingMoreRemote(false);
            setRemoteOffset(0);
            setHasMoreRemoteResults(false);
            return;
        }

        let isCancelled = false;

        const timeoutId = window.setTimeout(async () => {
            setIsSearchingRemote(true);
            setIsLoadingMoreRemote(false);

            try {
                const cached = remoteSearchCacheRef.current.get(cacheKey);
                if (cached) {
                    if (!isCancelled) {
                        setRemoteMaterials(cached.materials);
                        setRemoteOffset(cached.nextOffset);
                        setHasMoreRemoteResults(cached.hasMore);
                    }
                    return;
                }

                const firstPage = await fetchRemoteMaterialsPage(trimmedTerm, 0);

                if (!isCancelled) {
                    setRemoteMaterials(firstPage.materials);
                    setRemoteOffset(firstPage.nextOffset);
                    setHasMoreRemoteResults(firstPage.hasMore);
                    setRemoteSearchCacheEntry(cacheKey, {
                        materials: firstPage.materials,
                        nextOffset: firstPage.nextOffset,
                        hasMore: firstPage.hasMore,
                    });
                }
            } catch (error) {
                console.error("Erro na busca remota de materiais:", error);
                if (!isCancelled) {
                    setRemoteMaterials([]);
                    setRemoteOffset(0);
                    setHasMoreRemoteResults(false);
                }
            } finally {
                if (!isCancelled) setIsSearchingRemote(false);
            }
        }, 280);

        return () => {
            isCancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [searchTerm, step, quotationMode]);

    const handleSearchDropdownScroll = async (event: React.UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 64;

        if (!nearBottom) return;
        if (isSearchingRemote || isLoadingMoreRemote || !hasMoreRemoteResults) return;

        const trimmedTerm = searchTerm.trim();
        const cacheKey = getRemoteSearchCacheKey(trimmedTerm);
        if (step !== 2 || quotationMode !== "search" || trimmedTerm.length < 2) return;

        setIsLoadingMoreRemote(true);
        try {
            const nextPage = await fetchRemoteMaterialsPage(trimmedTerm, remoteOffset);
            const merged = new Map<string, Material>();
            [...remoteMaterials, ...nextPage.materials].forEach(material => merged.set(material.id, material));
            const mergedMaterials = Array.from(merged.values());

            setRemoteMaterials(mergedMaterials);
            setRemoteOffset(nextPage.nextOffset);
            setHasMoreRemoteResults(nextPage.hasMore);
            setRemoteSearchCacheEntry(cacheKey, {
                materials: mergedMaterials,
                nextOffset: nextPage.nextOffset,
                hasMore: nextPage.hasMore,
            });
        } catch (error) {
            console.error("Erro ao carregar mais materiais:", error);
            setHasMoreRemoteResults(false);
        } finally {
            setIsLoadingMoreRemote(false);
        }
    };

    // Filtrar categorias
    const filteredGroups = useMemo(() => {
        if (!searchTerm) return availableGroups;
        return availableGroups.filter(g =>
            normalizeText(g).includes(normalizeText(searchTerm))
        );
    }, [availableGroups, searchTerm]);

    const showExternalSearchDropdown =
        step === 2 &&
        quotationMode === "search" &&
        isSearchFocused &&
        searchTerm.trim().length > 0 &&
        (filteredMaterials.length > 0 || isSearchingRemote || isLoadingMoreRemote);

    useEffect(() => {
        if (!showExternalSearchDropdown) {
            setSearchDropdownRect(null);
            return;
        }

        const updateRect = () => {
            const wrapper = searchInputWrapperRef.current;
            if (!wrapper) return;

            const rect = wrapper.getBoundingClientRect();
            setSearchDropdownRect({
                top: rect.bottom + 6,
                left: rect.left,
                width: rect.width,
            });
        };

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (searchInputWrapperRef.current?.contains(target)) return;
            if (searchDropdownRef.current?.contains(target)) return;
            setIsSearchFocused(false);
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExternalSearchDropdown]);

    // Toggle expandir fase
    const toggleFase = (faseId: string) => {
        const newSet = new Set(expandedFases);
        if (newSet.has(faseId)) newSet.delete(faseId);
        else newSet.add(faseId);
        setExpandedFases(newSet);
    };

    const toggleServico = (servicoId: string) => {
        const newSet = new Set(expandedServicos);
        if (newSet.has(servicoId)) newSet.delete(servicoId);
        else newSet.add(servicoId);
        setExpandedServicos(newSet);
    };

    const toggleGrupo = (grupoId: string) => {
        const newSet = new Set(expandedGrupos);
        if (newSet.has(grupoId)) newSet.delete(grupoId);
        else newSet.add(grupoId);
        setExpandedGrupos(newSet);
    };

    // Adicionar material da árvore
    const addMaterialFromTree = (material: Material, faseNome: string, servicoNome: string, grupoNome: string) => {
        setItems(prev => [...prev, {
            id: Date.now(),
            descricao: material.nome,
            categoria: grupoNome,
            quantidade: 1,
            unidade: material.unidade,
            observacao: "",
            faseNome,
            servicoNome,
            materialId: material.id
        }]);
    };

    // Adicionar material da busca
    const addMaterialFromSearch = (material: Material) => {
        const grupo = grupos.find(g => material.gruposInsumoIds.includes(g.id));
        if (!grupo?.nome) {
            alert("Este material não possui grupo de insumo válido e não pode ser adicionado.");
            return;
        }
        setItems(prev => [...prev, {
            id: Date.now(),
            descricao: material.nome,
            categoria: grupo.nome,
            quantidade: 1,
            unidade: material.unidade,
            observacao: "",
            materialId: material.id
        }]);
        setSearchTerm("");
    };

    // Adicionar item manual
    const handleAddManualItem = () => {
        if (!form.descricao.trim() || form.quantidade < 1) return;

        const allowedGroups = new Set(availableGroups.map(g => normalizeGroupName(g)));
        if (!allowedGroups.has(normalizeGroupName(form.categoria))) {
            alert("Selecione um grupo de insumo válido para adicionar o item.");
            return;
        }

        setItems(prev => [...prev, {
            id: Date.now(),
            ...form,
        }]);

        setForm(prev => ({
            ...prev,
            descricao: "",
            quantidade: 1,
            fornecedor: "",
            observacao: "",
        }));
        setShowAddForm(false);
    };

    // Remover item
    const handleRemoveItem = (id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // Atualizar quantidade do item
    const updateItemQuantity = (id: number, quantidade: number) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantidade } : item
        ));
    };

    // Finalizar cotação
    const handleSubmit = async () => {
        if (!user || !selectedObraId || items.length === 0) return;

        const allowedGroups = new Set(availableGroups.map(g => normalizeGroupName(g)));
        const invalidItems = items.filter(item => !allowedGroups.has(normalizeGroupName(item.categoria)));
        if (invalidItems.length > 0) {
            alert("Existem itens sem grupo de insumo válido. Corrija antes de enviar.");
            setStep(2);
            return;
        }

        setLoading(true);
        try {
            // Obter headers com token de autenticação
            const headers = await getAuthHeaders();

            // Criar cotação via API route (bypass RLS)
            const res = await fetch('/api/cotacoes', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'create',
                    obra_id: selectedObraId,
                    itens: items.map(item => ({
                        material_id: item.materialId || null,
                        nome: item.descricao,
                        quantidade: item.quantidade,
                        unidade: item.unidade,
                        grupo: item.categoria,
                        observacao: item.observacao || null,
                        fase_nome: item.faseNome || null,
                        servico_nome: item.servicoNome || null,
                    }))
                })
            });

            if (!res.ok) {
                const err = await res.json();
                const errorMsg = err.error || 'Erro ao criar cotação';
                console.error('Erro na criação da cotação:', { status: res.status, error: errorMsg, details: err });
                throw new Error(errorMsg);
            }

            const result = await res.json();
            const cotacoesCreated = Number(result?.cotacoes_created || 1);
            const gruposCreated = Number(result?.groups_created || cotacoesCreated);

            // Notificar fornecedores da região por email (best effort)
            if (selectedObra?.cidade && result.suppliers_notified > 0) {
                try {
                    await sendEmail({
                        to: 'admin@Comprareconstruir.com.br',
                        subject: `Nova cotação em ${selectedObra.cidade} - Cota Reconstruir`,
                        html: `
                            <h1>Nova cotação criada!</h1>
                            <p>Obra: <strong>${selectedObra.nome}</strong> em ${selectedObra.bairro}, ${selectedObra.cidade}</p>
                            <p><strong>${items.length} itens</strong> aguardando proposta.</p>
                            <p>${result.suppliers_notified} fornecedores na região.</p>
                        `
                    });
                } catch (emailErr) {
                    console.warn('Erro ao enviar notificação por email:', emailErr);
                }
            }

            setSuccess(true);
            setSuccessMeta({ cotacoes: cotacoesCreated, grupos: gruposCreated });
            setItems([]);
            setTimeout(() => {
                setSuccess(false);
                setSuccessMeta(null);
                setStep(1);
                setSelectedObraId("");
            }, 3000);
        } catch (error: any) {
            console.error("Erro ao criar cotação:", error);
            const errorMsg = error?.message || "Erro ao criar cotação. Tente novamente.";
            alert(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Tela de sucesso
    if (success) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
                        <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Cotação Enviada!</h2>
                    <p className="text-slate-500 mb-6">
                        {successMeta
                            ? `${successMeta.cotacoes} solicitação${successMeta.cotacoes > 1 ? 'ões' : ''} gerada${successMeta.cotacoes > 1 ? 's' : ''} em ${successMeta.grupos} grupo${successMeta.grupos > 1 ? 's' : ''}`
                            : 'Fornecedores da região serão notificados'}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecionando...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-7">
            {/* Header com Steps */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-blue-600" />
                            Nova Cotação
                        </h1>
                        <p className="text-slate-500 mt-2">Monte sua solicitação por etapas ou busca rápida, com revisão antes do envio.</p>
                    </div>
                    {items.length > 0 && (
                        <div className="flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2">
                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-600">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                        </div>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {[
                        { num: 1, label: "Selecionar Obra", icon: Building2 },
                        { num: 2, label: "Adicionar Itens", icon: Package },
                        { num: 3, label: "Revisar e Enviar", icon: Send },
                    ].map((s, i) => (
                        <div key={s.num} className="flex items-center flex-1">
                            <button
                                onClick={() => {
                                    if (s.num === 1) setStep(1);
                                    else if (s.num === 2 && selectedObraId) setStep(2);
                                    else if (s.num === 3 && items.length > 0) setStep(3);
                                }}
                                disabled={
                                    (s.num === 2 && !selectedObraId) ||
                                    (s.num === 3 && items.length === 0)
                                }
                                className={`flex items-center gap-2 flex-1 min-w-[220px] rounded-xl px-4 py-3 transition-all ${step === s.num
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : step > s.num
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === s.num
                                    ? 'bg-white/20 text-white'
                                    : step > s.num
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-200 text-slate-500'
                                    }`}>
                                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                                </div>
                                <span className="hidden sm:block text-sm font-medium">{s.label}</span>
                            </button>
                            {i < 2 && <ChevronRight className="w-5 h-5 text-slate-300 mx-1 flex-shrink-0" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 1: Selecionar Obra */}
            {step === 1 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Para qual obra é essa cotação?</h2>
                            <p className="text-sm text-slate-500">Selecione a obra que receberá os materiais</p>
                        </div>
                    </div>

                    {obras.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma obra cadastrada</h3>
                            <p className="text-sm text-slate-500 mb-4">Cadastre uma obra primeiro para poder criar cotações</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {obras.map(obra => (
                                <button
                                    key={obra.id}
                                    onClick={() => {
                                        setSelectedObraId(obra.id);
                                        setStep(2);
                                    }}
                                    className={`group relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 ${selectedObraId === obra.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 bg-white'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedObraId === obra.id
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                                        }`}>
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-900 truncate">{obra.nome}</h3>
                                        {(obra.bairro || obra.cidade) && (
                                            <p className="text-sm text-slate-500 truncate">
                                                {[obra.bairro, obra.cidade].filter(Boolean).join(' • ')}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            {obra.status && (
                                                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${obra.status === 'ativa'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {obra.status}
                                                </span>
                                            )}
                                            {obra.etapa && (
                                                <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                                                    <Layers className="w-3 h-3" />
                                                    {obra.etapa}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className={`w-5 h-5 transition-transform ${selectedObraId === obra.id ? 'text-blue-500' : 'text-slate-300 group-hover:translate-x-1'
                                        }`} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Adicionar Itens */}
            {step === 2 && (
                <div className="space-y-5">
                    {/* Obra selecionada */}
                    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between shadow-sm transition-all duration-200 hover:shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Obra selecionada</p>
                                <p className="font-semibold text-slate-900">{selectedObra?.nome}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setStep(1)}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Alterar
                        </button>
                    </div>

                    {/* Toggle de modo */}
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 transition-all duration-200">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="text-sm font-semibold text-slate-700">Modo de Cotação:</span>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setQuotationMode("phases")}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${quotationMode === "phases"
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    <Layers className="w-4 h-4" />
                                    Navegação por Fases
                                </button>
                                <button
                                    onClick={() => setQuotationMode("search")}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${quotationMode === "search"
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    <Search className="w-4 h-4" />
                                    Busca Rápida
                                </button>
                            </div>
                        </div>

                        {/* Info sobre fases disponíveis */}
                        {quotationMode === "phases" && (
                            <div className="mt-3 text-sm text-slate-600">
                                <span className="font-medium">Fase Atual:</span>{" "}
                                {selectedObra?.etapa || "Não definida"}
                                {validEtapasForQuotation.length > 0 ? (
                                    <span className="ml-4 text-emerald-600">
                                        ✓ {validEtapasForQuotation.length} etapa(s) disponível(is) para cotação
                                    </span>
                                ) : (
                                    <span className="ml-4 text-amber-600">
                                        ⚠ Nenhuma etapa dentro do período de cotação
                                    </span>
                                )}
                            </div>
                        )}

                        {items.length > 0 && (
                            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                                {items.length} item(ns) no carrinho. Continue adicionando ou clique em <span className="font-semibold">Analisar Lista</span>.
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
                        {/* Área principal */}
                        <div className="xl:col-span-8">
                            {/* MODO NAVEGAÇÃO POR FASES */}
                            {quotationMode === "phases" && (
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                                    <div className="p-6 border-b border-slate-100">
                                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                            <Layers className="w-5 h-5 text-blue-600" />
                                            Materiais por Etapas da Obra
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Expanda a etapa, abra o grupo e adicione os materiais necessários.
                                        </p>
                                    </div>

                                    {validEtapasForQuotation.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                                            <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                                Nenhuma etapa disponível para cotação no momento
                                            </h3>
                                            <p className="text-sm text-slate-500 mb-4">
                                                Verifique as etapas e datas de previsão da obra.
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                Dica: Cadastre etapas na aba "Obras & Endereços" com datas de previsão e antecedência.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                                            {validEtapasForQuotation.map(etapa => {
                                                const dataPrevista = new Date(etapa.data_prevista);
                                                const dataInicioCotacao = new Date(dataPrevista);
                                                dataInicioCotacao.setDate(dataInicioCotacao.getDate() - etapa.dias_antecedencia_cotacao);
                                                const grupoIdsPermitidos = groupIdsByEtapa.get(etapa.id) || new Set<string>();
                                                const gruposDaEtapa = grupos.filter(grupo => grupoIdsPermitidos.has(grupo.id));

                                                return (
                                                    <div key={etapa.id} className="bg-white">
                                                        {/* Etapa Header */}
                                                        <button
                                                            onClick={() => toggleFase(etapa.id)}
                                                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors duration-200"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                                    <Layers className="w-5 h-5" />
                                                                </div>
                                                                <div className="text-left">
                                                                    <p className="font-semibold text-slate-900">{etapa.nome}</p>
                                                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                                                        <Calendar className="w-3 h-3" />
                                                                        Previsão: {dataPrevista.toLocaleDateString('pt-BR')}
                                                                        <span className="text-emerald-600 font-medium ml-2">
                                                                            ✓ Cotações desde {dataInicioCotacao.toLocaleDateString('pt-BR')}
                                                                        </span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedFases.has(etapa.id) ? 'rotate-180' : ''
                                                                }`} />
                                                        </button>

                                                        {/* Grupos de Materiais da Etapa */}
                                                        {expandedFases.has(etapa.id) && (
                                                            <div className="pl-4 border-l-2 border-emerald-100 ml-7 mb-4">
                                                                {gruposDaEtapa.length === 0 ? (
                                                                    <p className="text-sm text-slate-400 py-2 px-4">
                                                                        Nenhum grupo de insumo vinculado aos serviços desta etapa.
                                                                    </p>
                                                                ) : (
                                                                    gruposDaEtapa.map(grupo => {
                                                                        const materiaisDoGrupo = materiais.filter(m =>
                                                                            m.gruposInsumoIds.includes(grupo.id)
                                                                        );
                                                                        if (materiaisDoGrupo.length === 0) return null;

                                                                        return (
                                                                            <div key={grupo.id} className="mb-2 transition-all duration-200">
                                                                                <button
                                                                                    onClick={() => toggleGrupo(`${etapa.id}-${grupo.id}`)}
                                                                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                                                                                >
                                                                                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                                                                        <Boxes className="w-4 h-4 text-slate-400" />
                                                                                        {grupo.nome}
                                                                                        <span className="text-xs text-slate-400">({materiaisDoGrupo.length})</span>
                                                                                    </span>
                                                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedGrupos.has(`${etapa.id}-${grupo.id}`) ? 'rotate-180' : ''
                                                                                        }`} />
                                                                                </button>

                                                                                {/* Materiais do Grupo */}
                                                                                {expandedGrupos.has(`${etapa.id}-${grupo.id}`) && (
                                                                                    <div className="pl-4 space-y-1 mt-1 border-l border-slate-200 ml-4">
                                                                                        {materiaisDoGrupo.map(material => {
                                                                                            const isAdded = items.some(i => i.materialId === material.id && i.faseNome === etapa.nome);
                                                                                            return (
                                                                                                <div
                                                                                                    key={material.id}
                                                                                                    className={`flex items-center justify-between p-2 rounded text-sm ${isAdded ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                                                                                        }`}
                                                                                                >
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <Package className={`w-3 h-3 ${isAdded ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                                                                        <span className="text-slate-700">{material.nome}</span>
                                                                                                        <span className="text-xs text-slate-400">({material.unidade})</span>
                                                                                                    </div>
                                                                                                    {isAdded ? (
                                                                                                        <span className="text-xs text-emerald-600 font-medium">✓ Adicionado</span>
                                                                                                    ) : (
                                                                                                        <button
                                                                                                            onClick={() => addMaterialFromTree(material, etapa.nome, "", grupo.nome)}
                                                                                                            className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
                                                                                                        >
                                                                                                            + Adicionar
                                                                                                        </button>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* MODO BUSCA RÁPIDA */}
                            {quotationMode === "search" && (
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                                    <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                <Search className="w-5 h-5 text-blue-600" />
                                                Busca Rápida
                                            </h2>
                                            <p className="text-sm text-slate-500">Busque materiais e monte o carrinho por grupo.</p>
                                        </div>
                                        <button
                                            onClick={() => setShowAddForm(true)}
                                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-shadow"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Adicionar Manual
                                        </button>
                                    </div>

                                    {/* Campo de busca */}
                                    <div className="p-4 border-b border-slate-100 relative">
                                        <div className="relative" ref={(el) => { searchInputWrapperRef.current = el; }}>
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                onFocus={() => setIsSearchFocused(true)}
                                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                placeholder="Digite o nome do material (ex: Cimento, Areia)..."
                                            />
                                        </div>

                                        {searchTerm.trim().length > 0 && filteredMaterials.length === 0 && (
                                            <p className="mt-2 text-xs text-slate-500">Nenhum material encontrado para "{searchTerm}". Tente termo parcial (ex.: "arei").</p>
                                        )}

                                        {isSearchingRemote && searchTerm.trim().length >= 2 && (
                                            <p className="mt-2 text-xs text-blue-600">Buscando materiais no catálogo completo...</p>
                                        )}

                                        {searchTerm.trim().length === 0 && items.length === 0 && (
                                            <p className="mt-2 text-xs text-slate-500">Dica: digite parte do nome do material para ver sugestões rápidas.</p>
                                        )}
                                    </div>

                                    {/* Lista de categorias */}
                                    <div className="divide-y divide-slate-100 max-h-[430px] overflow-y-auto">
                                        {filteredGroups.map(categoria => {
                                            const categoryItems = groupedItems[categoria] || [];
                                            const hasItems = categoryItems.length > 0;

                                            return (
                                                <div
                                                    key={categoria}
                                                    className={`p-4 ${hasItems ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasItems ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                                                                }`}>
                                                                <Boxes className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-900">{categoria}</p>
                                                                <p className="text-xs text-slate-500">
                                                                    {hasItems ? `${categoryItems.length} item(s) adicionado(s)` : 'Nenhum item'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setForm(prev => ({ ...prev, categoria }));
                                                                setShowAddForm(true);
                                                            }}
                                                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Items da categoria */}
                                                    {hasItems && (
                                                        <div className="mt-3 space-y-2">
                                                            {categoryItems.map(item => (
                                                                <div
                                                                    key={item.id}
                                                                    className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <Package className="w-4 h-4 text-blue-500" />
                                                                        <div>
                                                                            <p className="text-sm font-medium text-slate-900">{item.descricao}</p>
                                                                            <p className="text-xs text-slate-500">
                                                                                {item.quantidade} {item.unidade}
                                                                                {item.fornecedor && ` • ${item.fornecedor}`}
                                                                                {item.observacao && ` • ${item.observacao}`}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveItem(item.id)}
                                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar - Resumo da Cotação */}
                        <div className="xl:col-span-4 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sticky top-6 transition-all duration-200 hover:shadow-md">
                                <h3 className="font-bold text-lg text-slate-900 mb-4">Resumo da Cotação</h3>
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                                        <p className="text-xs text-slate-500">Itens</p>
                                        <p className="text-lg font-semibold text-slate-900">{items.length}</p>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                                        <p className="text-xs text-slate-500">Grupos</p>
                                        <p className="text-lg font-semibold text-slate-900">{Object.keys(groupedItems).length}</p>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                                        <p className="text-xs text-slate-500">Obra</p>
                                        <p className="text-sm font-semibold text-slate-900 truncate">{selectedObra?.nome || '-'}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => items.length > 0 && setStep(3)}
                                    disabled={items.length === 0}
                                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Analisar Lista
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                {items.length === 0 && (
                                    <p className="mt-2 text-[11px] text-slate-500 text-center">Adicione pelo menos 1 item para avançar.</p>
                                )}
                            </div>

                            {/* Itens no Carrinho */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
                                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                                    Itens no Carrinho ({items.length})
                                </h3>

                                {items.length === 0 ? (
                                    <div className="text-center py-6">
                                        <ShoppingCart className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                                        <p className="text-sm text-slate-400">Seu carrinho está vazio.</p>
                                        <p className="text-xs text-slate-400">Adicione materiais na área principal.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                                        {items.map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">{item.descricao}</p>
                                                    <p className="text-xs text-slate-400">{item.categoria}</p>
                                                </div>
                                                <div className="flex items-center gap-2 ml-2">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={item.quantidade}
                                                        onChange={e => updateItemQuantity(item.id, Number(e.target.value))}
                                                        className="w-14 text-center text-sm border border-slate-200 rounded px-1 py-0.5"
                                                    />
                                                    <span className="text-xs text-slate-500">{item.unidade}</span>
                                                    <button
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="p-1 text-slate-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Dica do Especialista */}
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 transition-all duration-200 hover:border-amber-300">
                                <h4 className="font-semibold text-amber-800 text-sm flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    Dica do Especialista
                                </h4>
                                <p className="text-xs text-amber-700 mt-1">
                                    Agrupar materiais da mesma fase (ex: elétrica e hidráulica) pode aumentar seu poder de negociação com fornecedores especializados.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {showExternalSearchDropdown && searchDropdownRect && createPortal(
                <div
                    ref={(el) => { searchDropdownRef.current = el; }}
                    className="fixed z-[80] bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto"
                    onScroll={handleSearchDropdownScroll}
                    style={{
                        top: `${searchDropdownRect.top}px`,
                        left: `${searchDropdownRect.left}px`,
                        width: `${searchDropdownRect.width}px`,
                    }}
                >
                    {filteredMaterials.map(material => {
                        const isAdded = items.some(i => i.materialId === material.id);
                        return (
                            <button
                                key={material.id}
                                onClick={() => {
                                    if (isAdded) return;
                                    addMaterialFromSearch(material);
                                    setIsSearchFocused(false);
                                }}
                                disabled={isAdded}
                                className={`w-full text-left px-4 py-3 flex justify-between items-center border-b border-slate-50 last:border-0 ${isAdded ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                            >
                                <span className="font-medium text-slate-700 pr-3">{material.nome}</span>
                                {isAdded ? (
                                    <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">✓ Adicionado</span>
                                ) : (
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full whitespace-nowrap">{material.unidade}</span>
                                )}
                            </button>
                        );
                    })}

                    {isSearchingRemote && filteredMaterials.length === 0 && (
                        <div className="px-4 py-3 text-xs text-blue-600">Buscando materiais...</div>
                    )}

                    {isLoadingMoreRemote && filteredMaterials.length > 0 && (
                        <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">Carregando mais resultados...</div>
                    )}
                </div>,
                document.body
            )}

            {/* Step 3: Revisar e Enviar */}
            {step === 3 && (
                <div className="space-y-4">
                    {/* Resumo da obra */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            Resumo da Cotação
                        </h2>

                        <div className="grid gap-4 md:grid-cols-3 mb-6">
                            <div className="rounded-xl bg-slate-50 p-4">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Obra</p>
                                <p className="font-semibold text-slate-900">{selectedObra?.nome}</p>
                                {selectedObra?.cidade && (
                                    <p className="text-sm text-slate-500">{selectedObra.bairro}, {selectedObra.cidade}</p>
                                )}
                            </div>
                            <div className="rounded-xl bg-blue-50 p-4">
                                <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Total de Itens</p>
                                <p className="text-2xl font-bold text-blue-700">{items.length}</p>
                            </div>
                            <div className="rounded-xl bg-violet-50 p-4">
                                <p className="text-xs text-violet-600 uppercase tracking-wide mb-1">Categorias</p>
                                <p className="text-2xl font-bold text-violet-700">{Object.keys(groupedItems).length}</p>
                            </div>
                        </div>

                        {/* Lista de itens por categoria */}
                        <div className="space-y-4">
                            {Object.entries(groupedItems).map(([categoria, catItems]) => (
                                <div key={categoria} className="rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Tag className="w-4 h-4 text-slate-500" />
                                            <span className="font-semibold text-slate-700">{categoria}</span>
                                        </div>
                                        <span className="text-sm text-slate-500">{catItems.length} item(s)</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {catItems.map(item => (
                                            <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-slate-900">{item.descricao}</p>
                                                    {item.faseNome && (
                                                        <p className="text-xs text-slate-500">
                                                            <Layers className="w-3 h-3 inline mr-1" />
                                                            {item.faseNome}
                                                            {item.servicoNome && ` → ${item.servicoNome}`}
                                                        </p>
                                                    )}
                                                    {item.fornecedor && (
                                                        <p className="text-xs text-blue-600">
                                                            <Building2 className="w-3 h-3 inline mr-1" />
                                                            {item.fornecedor}
                                                        </p>
                                                    )}
                                                    {item.observacao && (
                                                        <p className="text-xs text-slate-400">{item.observacao}</p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-slate-700">{item.quantidade}</p>
                                                    <p className="text-xs text-slate-500">{item.unidade}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Botões */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setStep(2)}
                            className="text-slate-600 hover:text-slate-900"
                        >
                            ← Voltar e editar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 hover:shadow-xl transition-shadow disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Enviar Cotação
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar Item Manual */}
            {showAddForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Adicionar Item</h2>
                                <p className="text-sm text-slate-500">Preencha os dados do material</p>
                            </div>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Categoria */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    <Tag className="w-3 h-3 inline mr-1" />
                                    Categoria *
                                </label>
                                <select
                                    value={form.categoria}
                                    onChange={e => setForm({ ...form, categoria: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    required
                                >
                                    {availableGroups.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Descrição */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    <Package className="w-3 h-3 inline mr-1" />
                                    Item / Material *
                                </label>
                                <input
                                    value={form.descricao}
                                    onChange={e => setForm({ ...form, descricao: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Ex: Cimento CP II 50kg"
                                    required
                                />
                            </div>

                            {/* Quantidade e Unidade */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                        <Scale className="w-3 h-3 inline mr-1" />
                                        Quantidade *
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.quantidade}
                                        onChange={e => setForm({ ...form, quantidade: Number(e.target.value) })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                        Unidade *
                                    </label>
                                    <select
                                        value={form.unidade}
                                        onChange={e => setForm({ ...form, unidade: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    >
                                        {unidades.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Fornecedor / Fabricante Preferencial */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    <Building2 className="w-3 h-3 inline mr-1" />
                                    Fornecedor / Fabricante (opcional)
                                </label>
                                <input
                                    value={form.fornecedor}
                                    onChange={e => setForm({ ...form, fornecedor: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Ex: Votorantim, Quartzolit, Tigre..."
                                />
                            </div>

                            {/* Observação */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    <MessageSquare className="w-3 h-3 inline mr-1" />
                                    Observações (opcional)
                                </label>
                                <textarea
                                    value={form.observacao}
                                    onChange={e => setForm({ ...form, observacao: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Ex: Entrega urgente, especificações técnicas..."
                                    rows={2}
                                />
                            </div>

                            {/* Botões */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddManualItem}
                                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
