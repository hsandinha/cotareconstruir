"use client";

import { useMemo, useState, useEffect, useRef, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { dedupeObraEtapas } from "@/lib/obraEtapas";
import { sendEmail } from "../../../app/actions/email";
import {
    buildCsv,
    downloadCsvFile,
    downloadXlsxFile,
    getCsvRowValue,
    normalizeCsvKey,
    parseSpreadsheetFile,
    parseFlexibleNumber
} from "@/lib/csvSpreadsheet";
import { useToast } from "@/components/ToastProvider";
import { normalizeSearchText, expandTermWithSynonyms, fetchAllRows, scoreTermMatch } from "@/lib/materialSearch";
import { AttachmentsField } from "@/components/AttachmentsField";
import { uploadAnexos } from "@/lib/anexos";
import {
    Package, Plus, Trash2, ShoppingCart, Building2, Send, Search, Check,
    AlertCircle, Loader2, ChevronRight, Sparkles, ArrowRight, X, Tag,
    FileText, Scale, MessageSquare, Boxes, CheckCircle2, ChevronDown,
    Calendar, Clock, Layers, Zap, Filter, Download, Upload, RotateCcw
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
    /** Material sem cadastro no catálogo — solicitação de aprovação enviada ao admin, mas segue na cotação normalmente */
    novoMaterial?: boolean;
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

// Chave para persistir o rascunho do carrinho entre sessões/reloads
const DRAFT_STORAGE_KEY = "cotacao_carrinho_rascunho_v1";

export function ClientSolicitationSection() {
    const { showToast } = useToast();
    const { user, initialized } = useAuth();

    // Estados principais
    const [items, setItems] = useState<CartItem[]>([]);
    // Feedback ao adicionar, desfazer remoção e persistência de rascunho
    const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);
    const [cartBump, setCartBump] = useState(false);
    const [lastRemoved, setLastRemoved] = useState<{ item: CartItem; index: number } | null>(null);
    const [draftRestored, setDraftRestored] = useState(false);
    const recentlyAddedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cartBumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const draftHydratedRef = useRef(false);
    const autoExpandedObraRef = useRef<string | null>(null);
    const [obras, setObras] = useState<Obra[]>([]);
    const [selectedObraId, setSelectedObraId] = useState<string>("");
    const [obraEtapas, setObraEtapas] = useState<ObraEtapa[]>([]);

    // Estados para estrutura de materiais
    const [fases, setFases] = useState<Fase[]>([]);
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);
    // Sinônimos de materiais (ex: bacia = vaso sanitário) para expandir a busca
    const [synonymGroups, setSynonymGroups] = useState<string[][]>([]);
    // Fabricantes cadastrados pelo admin, para o cliente escolher por item
    const [manufacturers, setManufacturers] = useState<string[]>([]);
    // Observação geral da cotação (exibida aos fornecedores)
    const [observacoesGerais, setObservacoesGerais] = useState("");
    // Anexos da cotação (projetos, detalhes, especificações)
    const [anexosFiles, setAnexosFiles] = useState<File[]>([]);

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
    const [phaseFilter, setPhaseFilter] = useState("");
    const [mobileCartOpen, setMobileCartOpen] = useState(false);
    const [remoteMaterials, setRemoteMaterials] = useState<Material[]>([]);
    const [isSearchingRemote, setIsSearchingRemote] = useState(false);
    const [isLoadingMoreRemote, setIsLoadingMoreRemote] = useState(false);
    const [remoteOffset, setRemoteOffset] = useState(0);
    const [hasMoreRemoteResults, setHasMoreRemoteResults] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchDropdownRect, setSearchDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const [uploadingList, setUploadingList] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [importMenuOpen, setImportMenuOpen] = useState(false);
    const importMenuRef = useRef<HTMLDivElement | null>(null);
    // Linhas importadas cujo grupo não pôde ser resolvido: o cliente escolhe o
    // grupo em um modal em vez de a linha ser descartada em silêncio
    const [groupFixRows, setGroupFixRows] = useState<Array<{
        nome: string;
        quantidade: number;
        unidade: string;
        fornecedor: string;
        observacao: string;
        materialId?: string;
        grupo: string;
    }> | null>(null);

    // Solicitação de novo material (envia para aprovação do admin)
    const [showRequestMaterialModal, setShowRequestMaterialModal] = useState(false);
    const [requestMaterialForm, setRequestMaterialForm] = useState({
        nome: "",
        unidade: "unid",
        descricao: "",
        grupo_sugerido: "",
    });
    const [requestMaterialSubmitting, setRequestMaterialSubmitting] = useState(false);
    const [requestMaterialSimilares, setRequestMaterialSimilares] = useState<Array<{ id: string; nome: string; unidade: string; similarity: number }>>([]);
    const [requestMaterialForce, setRequestMaterialForce] = useState(false);

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
    const uploadListInputRef = useRef<HTMLInputElement | null>(null);
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

    /**
     * "Produto-base" de um item importado: os primeiros termos do nome até a
     * primeira medida/código (ex.: "Cabo flex 750V 25mm2 PR" → "cabo flex").
     * Serve para aplicar o mesmo grupo de insumo a todas as variações de uma vez.
     */
    const baseProdutoKey = (nome: string | null | undefined) => {
        const tokens = normalizeText(nome)
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean);

        const semMedida: string[] = [];
        for (const token of tokens) {
            if (/\d/.test(token)) break;
            semMedida.push(token);
        }

        const base = semMedida.length >= 2 ? semMedida : tokens.slice(0, 2);
        return base.join(" ");
    };

    const escapeIlikePattern = (value: string) =>
        value.replace(/[\\%_]/g, "");

    const getSearchVariants = (term: string) => {
        const raw = term.trim().toLowerCase();
        const normalized = normalizeText(term);
        // Expande com os sinônimos cadastrados (ex: bacia → vaso sanitário)
        const expanded = expandTermWithSynonyms(term, synonymGroups);
        return Array.from(new Set([raw, normalized, ...expanded].filter(Boolean)));
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

        // Cada variante vira um grupo AND das suas palavras: "tubo 50" →
        // and(nome.ilike.%tubo%,nome.ilike.%50%). Variantes se combinam em OR.
        const orParts = variants
            .map(variant => {
                const tokens = variant
                    .split(/\s+/)
                    .map(token => escapeIlikePattern(token))
                    .filter(Boolean);
                if (tokens.length === 0) return null;
                if (tokens.length === 1) return `nome.ilike.%${tokens[0]}%`;
                return `and(${tokens.map(token => `nome.ilike.%${token}%`).join(',')})`;
            })
            .filter(Boolean) as string[];

        if (orParts.length === 1 && !orParts[0].startsWith('and(')) {
            query = query.ilike("nome", orParts[0].replace('nome.ilike.', ''));
        } else if (orParts.length > 0) {
            query = query.or(orParts.join(','));
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

    // Busca por palavras: todas as palavras do termo precisam existir no nome
    // (ex.: "Tubo 50" encontra "TUBO PVC SOLDA 50MM") — ver lib/materialSearch.
    const scoreMaterialMatch = (materialName: string, normalizedTerm: string) =>
        scoreTermMatch(materialName, normalizedTerm);

    // Carregar dados iniciais
    // Fecha o menu "Importar" ao clicar fora ou pressionar ESC
    useEffect(() => {
        if (!importMenuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
                setImportMenuOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setImportMenuOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [importMenuOpen]);

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
            setObraEtapas(dedupeObraEtapas(data));
        };

        loadObraEtapas();
    }, [selectedObraId]);

    // Carregar dados de estrutura (fases, serviços, materiais)
    const loadConstructionData = async () => {
        try {
            // Materiais e vínculos são paginados: o catálogo passa de 19 mil
            // itens e um select simples trunca em 1000 linhas.
            const [fasesRes, servicosRes, materiaisData, servicoFaseRes, servicoGrupoRes, materialGrupoData] = await Promise.all([
                supabase.from("fases").select("*").order("cronologia", { ascending: true }),
                supabase.from("servicos").select("*").order("ordem", { ascending: true }),
                fetchAllRows(supabase, "materiais", "id, nome, unidade", "nome"),
                supabase.from("servico_fase").select("*"),
                supabase.from("servico_grupo").select("*"),
                fetchAllRows(supabase, "material_grupo", "material_id, grupo_id")
            ]);
            const materiaisRes = { data: materiaisData };
            const materialGrupoRes = { data: materialGrupoData };

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

    // Carregar sinônimos de materiais e fabricantes (uma vez, após autenticar)
    useEffect(() => {
        if (!initialized || !user) return;

        supabase
            .from('material_sinonimos')
            .select('termos')
            .then(({ data }) => {
                setSynonymGroups((data || []).map((row: any) => (Array.isArray(row.termos) ? row.termos : [])));
            });

        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch('/api/manufacturers', { headers, credentials: 'include' });
                const json = await res.json();
                if (res.ok) {
                    setManufacturers((json.data || []).map((m: any) => String(m.name || '')).filter(Boolean));
                }
            } catch {
                // Lista de fabricantes é opcional; segue sem sugestões
            }
        })();
    }, [initialized, user]);

    // Obra selecionada
    const selectedObra = useMemo(() => {
        return obras.find(o => o.id === selectedObraId);
    }, [obras, selectedObraId]);

    // Etapas da obra disponíveis para cotação. O cronograma (datas/antecedência)
    // NÃO restringe a cotação — serve apenas para o recebimento de ofertas.
    // O cliente pode cotar qualquer etapa listada, exceto as já concluídas.
    const validEtapasForQuotation = useMemo(() => {
        if (obraEtapas.length === 0) return [];
        return obraEtapas.filter(etapa => !etapa.is_completed);
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

    // Resumo por etapa: nº de grupos com materiais e nº de materiais distintos
    const etapaResumo = useMemo(() => {
        const map = new Map<string, { materiais: number; grupos: number }>();
        for (const etapa of validEtapasForQuotation) {
            const grupoIds = groupIdsByEtapa.get(etapa.id) || new Set<string>();
            const materiaisIds = new Set<string>();
            let gruposComMateriais = 0;
            for (const grupo of grupos) {
                if (!grupoIds.has(grupo.id)) continue;
                const matsDoGrupo = materiais.filter(m => m.gruposInsumoIds.includes(grupo.id));
                if (matsDoGrupo.length > 0) {
                    gruposComMateriais += 1;
                    matsDoGrupo.forEach(m => materiaisIds.add(m.id));
                }
            }
            map.set(etapa.id, { materiais: materiaisIds.size, grupos: gruposComMateriais });
        }
        return map;
    }, [validEtapasForQuotation, groupIdsByEtapa, grupos, materiais]);

    // Árvore de fases já filtrada pelo termo do filtro inline (modo Navegar por Fases)
    const isPhaseFilterActive = phaseFilter.trim().length > 0;
    const phaseTree = useMemo(() => {
        // Busca sem diferenciar maiúsculas/acentos, expandida com sinônimos
        const filterVariants = expandTermWithSynonyms(phaseFilter, synonymGroups);
        const active = filterVariants.length > 0;
        // Busca por palavras: "tubo 50" encontra "TUBO PVC SOLDA 50MM"
        const matchesFilter = (nome: string) =>
            filterVariants.some(variant => scoreTermMatch(nome, variant) >= 0);
        return validEtapasForQuotation
            .map(etapa => {
                const grupoIds = groupIdsByEtapa.get(etapa.id) || new Set<string>();
                const gruposView = grupos
                    .filter(g => grupoIds.has(g.id))
                    .map(grupo => ({
                        grupo,
                        materiaisDoGrupo: materiais.filter(m =>
                            m.gruposInsumoIds.includes(grupo.id) &&
                            (!active || matchesFilter(m.nome))
                        ),
                    }))
                    .filter(gv => gv.materiaisDoGrupo.length > 0);
                const totalMateriais = gruposView.reduce((acc, gv) => acc + gv.materiaisDoGrupo.length, 0);
                return { etapa, gruposView, totalMateriais };
            })
            .filter(ev => !active || ev.totalMateriais > 0);
    }, [validEtapasForQuotation, groupIdsByEtapa, grupos, materiais, phaseFilter, synonymGroups]);

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

    // Restaura o rascunho salvo localmente (uma vez, ao montar)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (raw) {
                const draft = JSON.parse(raw) as { obraId?: string; items?: CartItem[] };
                if (Array.isArray(draft?.items) && draft.items.length > 0) {
                    setItems(draft.items);
                    if (draft.obraId) setSelectedObraId(draft.obraId);
                    setDraftRestored(true);
                }
            }
        } catch {
            /* rascunho corrompido ou storage indisponível: ignora */
        }
        draftHydratedRef.current = true;
    }, []);

    // Persiste o rascunho enquanto o usuário monta a cotação
    useEffect(() => {
        if (!draftHydratedRef.current) return;
        try {
            if (items.length === 0) {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            } else {
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ obraId: selectedObraId, items }));
            }
        } catch {
            /* storage indisponível: segue sem persistir */
        }
    }, [items, selectedObraId]);

    // Abre automaticamente a fase atual (uma vez por obra) para o usuário já cair pronto pra agir
    useEffect(() => {
        if (!selectedObraId || validEtapasForQuotation.length === 0) return;
        if (autoExpandedObraRef.current === selectedObraId) return;
        autoExpandedObraRef.current = selectedObraId;
        const faseAtual = validEtapasForQuotation.find(e => e.nome === selectedObra?.etapa);
        const alvo = faseAtual || validEtapasForQuotation[0];
        if (alvo) setExpandedFases(prev => new Set(prev).add(alvo.id));
    }, [selectedObraId, validEtapasForQuotation, selectedObra]);

    // Limpa timeouts pendentes ao desmontar
    useEffect(() => {
        return () => {
            if (recentlyAddedTimeoutRef.current) clearTimeout(recentlyAddedTimeoutRef.current);
            if (cartBumpTimeoutRef.current) clearTimeout(cartBumpTimeoutRef.current);
            if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        };
    }, []);

    // Realça o item recém-adicionado e dá um "pulse" no contador do carrinho
    const flashCartFeedback = (itemId: number) => {
        setRecentlyAddedId(itemId);
        setCartBump(true);
        if (recentlyAddedTimeoutRef.current) clearTimeout(recentlyAddedTimeoutRef.current);
        if (cartBumpTimeoutRef.current) clearTimeout(cartBumpTimeoutRef.current);
        recentlyAddedTimeoutRef.current = setTimeout(() => setRecentlyAddedId(null), 1400);
        cartBumpTimeoutRef.current = setTimeout(() => setCartBump(false), 350);
    };

    // Descarta o rascunho restaurado e zera o carrinho
    const discardDraft = () => {
        setItems([]);
        setSelectedObraId("");
        setDraftRestored(false);
        try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignora */ }
    };

    // Reinsere o último item removido na mesma posição
    const undoRemove = () => {
        if (!lastRemoved) return;
        const { item, index } = lastRemoved;
        setItems(prev => {
            const copy = [...prev];
            copy.splice(Math.min(index, copy.length), 0, item);
            return copy;
        });
        setLastRemoved(null);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };

    // Fecha o carrinho mobile ao sair da etapa de seleção de itens
    useEffect(() => {
        if (step !== 2) setMobileCartOpen(false);
    }, [step]);

    // Lista do carrinho agrupada por grupo (reutilizada no rail desktop e no bottom-sheet mobile)
    const renderCartGroups = () => (
        <>
            {Object.entries(groupedItems).map(([grupo, grupoItems]) => (
                <div key={grupo} className="border-b border-slate-100 last:border-0">
                    {/* Cabeçalho do grupo (fixo ao rolar) */}
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-50/95 backdrop-blur px-3 py-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <Boxes className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 truncate">{grupo}</span>
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 tabular-nums">
                            {grupoItems.length}
                        </span>
                    </div>
                    {/* Itens do grupo */}
                    <div className="divide-y divide-slate-50">
                        {grupoItems.map(item => (
                            <div key={item.id} className={`group flex items-center gap-2 px-3 py-2.5 transition-colors duration-500 ${recentlyAddedId === item.id ? "bg-emerald-50 ring-1 ring-inset ring-emerald-200" : "hover:bg-slate-50"}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{item.descricao}</p>
                                    {item.faseNome && (
                                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                                            <Layers className="h-2.5 w-2.5 shrink-0" />
                                            {item.faseNome}
                                        </p>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    min={1}
                                    value={item.quantidade}
                                    onChange={e => updateItemQuantity(item.id, Number(e.target.value))}
                                    className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-center text-sm tabular-nums focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                />
                                <span className="text-[11px] text-slate-400 w-8 truncate">{item.unidade}</span>
                                <button
                                    onClick={() => handleRemoveItem(item.id)}
                                    aria-label="Remover item"
                                    className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    );

    // Filtrar materiais na busca
    const filteredMaterials = useMemo(() => {
        if (!searchTerm) return [];

        // Variantes normalizadas do termo (inclui sinônimos cadastrados)
        const variantTerms = expandTermWithSynonyms(searchTerm, synonymGroups);
        if (variantTerms.length === 0) return [];

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
                score: Math.max(...variantTerms.map(variant => scoreMaterialMatch(material.nome, variant))),
            }))
            .filter(result => result.score >= 0)
            .sort((a, b) => {
                if (a.score !== b.score) return b.score - a.score;
                return a.material.nome.localeCompare(b.material.nome, 'pt-BR');
            })
            .slice(0, 80)
            .map(result => result.material);
    }, [searchTerm, materiais, remoteMaterials, synonymGroups]);

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

    // O modelo NÃO pede o grupo de insumo: na importação o sistema identifica
    // o grupo automaticamente comparando o nome com o catálogo.
    const TEMPLATE_HEADERS = ["material", "quantidade", "unidade", "fabricante", "observacao"];

    // Monta as linhas de exemplo do modelo com materiais reais do catálogo;
    // se o catálogo ainda não carregou, cai nos exemplos estáticos.
    const buildTemplateRows = () => {
        const catalogExamples = materiais
            .filter(m => (m.gruposInsumoIds || []).length > 0)
            .slice(0, 3)
            .map((m, index) => ({
                material: m.nome,
                quantidade: [10, 20, 50][index] || 10,
                unidade: m.unidade || "unid",
                fabricante: "",
                observacao: index === 0 ? "Exemplo — substitua pelos seus materiais" : "",
            }));

        if (catalogExamples.length > 0) return catalogExamples;

        return [
            { material: "Cimento CP II 50kg", quantidade: 120, unidade: "sc", fabricante: "", observacao: "Exemplo — substitua pelos seus materiais" },
            { material: "Areia Média Lavada", quantidade: 20, unidade: "m³", fabricante: "", observacao: "" },
            { material: "Tubo PVC 100mm", quantidade: 80, unidade: "m", fabricante: "Tigre", observacao: "" },
        ];
    };

    const handleDownloadClientTemplate = async (format: "csv" | "xlsx" = "csv") => {
        setDownloadingTemplate(true);
        try {
            const templateRows = buildTemplateRows();

            if (format === "xlsx") {
                downloadXlsxFile("modelo_lista_materiais_cliente.xlsx", TEMPLATE_HEADERS, templateRows);
            } else {
                const csv = buildCsv(templateRows, TEMPLATE_HEADERS);
                downloadCsvFile("modelo_lista_materiais_cliente.csv", csv);
            }
        } catch (error) {
            console.error("Erro ao gerar modelo de lista:", error);
            showToast("error", "Erro ao gerar arquivo modelo.");
        } finally {
            setDownloadingTemplate(false);
        }
    };

    const openUploadClientListDialog = () => {
        uploadListInputRef.current?.click();
    };

    // Materiais sem cadastro importados via lista: registra solicitações para o
    // admin em segundo plano. A aprovação NÃO bloqueia — os itens seguem na
    // cotação normalmente e vão para os fornecedores do grupo.
    const requestNewMaterialsApproval = async (novos: Array<{ nome: string; unidade: string; grupo: string }>) => {
        try {
            const headers = await getAuthHeaders();
            await Promise.allSettled(novos.map(novo =>
                fetch('/api/material-requests', {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify({
                        nome: novo.nome,
                        unidade: novo.unidade || 'unid',
                        grupo_sugerido: novo.grupo || undefined,
                        tipo_solicitante: 'cliente',
                        force: true,
                        contexto: {
                            origem: 'upload_lista',
                            obra_id: selectedObraId || null,
                        },
                    }),
                })
            ));
        } catch (error) {
            console.warn('Falha ao registrar solicitações de novos materiais:', error);
        }
    };

    const handleUploadClientList = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setUploadingList(true);
        try {
            if (materiais.length === 0 && availableGroups.length === 0) {
                showToast("error", "O catálogo de materiais ainda está carregando. Aguarde alguns segundos e tente novamente.");
                return;
            }

            const parsedRows = await parseSpreadsheetFile(file);
            if (parsedRows.length === 0) {
                showToast("error", "A lista está vazia ou inválida.");
                return;
            }

            const materialById = new Map<string, Material>();
            const materialByNormalizedName = new Map<string, Material>();
            materiais.forEach((material) => {
                materialById.set(String(material.id), material);
                materialByNormalizedName.set(normalizeCsvKey(material.nome), material);
            });

            const groupNameById = new Map<string, string>();
            grupos.forEach((group) => {
                groupNameById.set(group.id, group.nome);
            });

            const canonicalGroupByNormalized = new Map<string, string>();
            availableGroups.forEach((groupName) => {
                canonicalGroupByNormalized.set(normalizeGroupName(groupName), groupName);
            });

            let nextItemId = Math.max(
                Date.now(),
                ...items.map((item) => Number(item.id) || 0)
            );
            const importedItems: CartItem[] = [];
            let ignoredRows = 0;
            // Materiais sem cadastro no catálogo (deduplicados por nome)
            const novosMateriais = new Map<string, { nome: string; unidade: string; grupo: string }>();

            // Linhas com material mas sem grupo resolvível: vão para o modal de
            // correção (o cliente escolhe o grupo) em vez de serem descartadas
            const pendingGroupRows: NonNullable<typeof groupFixRows> = [];

            for (const row of parsedRows) {
                const rawMaterialId = getCsvRowValue(row, ["material_id", "id_material", "id"]);
                const rawMaterialName = getCsvRowValue(row, ["material", "material_nome", "descricao", "item", "nome", "produto", "insumo"]);
                const rawGroupName = getCsvRowValue(row, ["grupo", "categoria", "grupo_insumo"]);
                const rawQuantity = getCsvRowValue(row, ["quantidade", "qtd", "qtde", "volume"]);
                const rawUnit = getCsvRowValue(row, ["unidade", "unid", "und"]);
                const rawObservacao = getCsvRowValue(row, ["observacao", "observacoes", "obs"]);
                const rawFornecedor = getCsvRowValue(row, ["fabricante", "fornecedor", "marca"]);

                let matchedMaterial: Material | null = null;
                if (rawMaterialId) {
                    matchedMaterial = materialById.get(rawMaterialId.trim()) || null;
                }

                if (!matchedMaterial && rawMaterialName) {
                    matchedMaterial = materialByNormalizedName.get(normalizeCsvKey(rawMaterialName)) || null;
                }

                // Identificação automática: procura o material mais parecido do
                // catálogo. Score alto (≥900) = mesmo material; score moderado
                // (≥300) = material diferente, mas serve para deduzir o GRUPO
                // (o modelo não pede mais a coluna "grupo" do cliente).
                let grupoInferidoDe: Material | null = null;
                if (!matchedMaterial && rawMaterialName) {
                    const normalizedName = normalizeText(rawMaterialName);
                    let bestMatch: { material: Material; score: number } | null = null;

                    for (const material of materiais) {
                        const score = scoreMaterialMatch(material.nome, normalizedName);
                        if (score < 0) continue;
                        if (!bestMatch || score > bestMatch.score) {
                            bestMatch = { material, score };
                        }
                    }

                    if (bestMatch && bestMatch.score >= 900) {
                        matchedMaterial = bestMatch.material;
                    } else if (bestMatch && bestMatch.score >= 300 && (bestMatch.material.gruposInsumoIds || []).length > 0) {
                        grupoInferidoDe = bestMatch.material;
                    }
                }

                let categoryName = canonicalGroupByNormalized.get(normalizeGroupName(rawGroupName)) || "";
                const resolveGroupFromMaterial = (material: Material | null) => {
                    if (!material) return "";
                    const materialGroupName = (material.gruposInsumoIds || [])
                        .map((groupId) => groupNameById.get(groupId) || "")
                        .find(Boolean) || "";
                    return canonicalGroupByNormalized.get(normalizeGroupName(materialGroupName)) || materialGroupName;
                };
                if (!categoryName) categoryName = resolveGroupFromMaterial(matchedMaterial);
                if (!categoryName) categoryName = resolveGroupFromMaterial(grupoInferidoDe);

                const description = String(rawMaterialName || matchedMaterial?.nome || "").trim();
                if (!description) {
                    ignoredRows++;
                    continue;
                }

                const parsedQty = parseFlexibleNumber(rawQuantity);
                // Preserva quantidades decimais (ex.: 20,5 m³) com 2 casas
                const quantity = Math.max(0.01, Math.round((parsedQty ?? 1) * 100) / 100);
                const unit = String(rawUnit || matchedMaterial?.unidade || "unid").trim() || "unid";

                if (!categoryName) {
                    pendingGroupRows.push({
                        nome: description,
                        quantidade: quantity,
                        unidade: unit,
                        fornecedor: rawFornecedor || "",
                        observacao: rawObservacao || "",
                        materialId: matchedMaterial?.id || undefined,
                        grupo: "",
                    });
                    continue;
                }

                nextItemId += 1;
                const isNovoMaterial = !matchedMaterial;
                importedItems.push({
                    id: nextItemId,
                    descricao: description,
                    categoria: categoryName,
                    quantidade: quantity,
                    unidade: unit,
                    fornecedor: rawFornecedor || "",
                    observacao: rawObservacao || "",
                    materialId: matchedMaterial?.id || undefined,
                    novoMaterial: isNovoMaterial || undefined,
                });

                if (isNovoMaterial) {
                    const novoKey = normalizeCsvKey(description);
                    if (!novosMateriais.has(novoKey)) {
                        novosMateriais.set(novoKey, { nome: description, unidade: unit, grupo: categoryName });
                    }
                }
            }

            if (importedItems.length === 0 && pendingGroupRows.length === 0) {
                showToast("error", "Nenhuma linha válida foi encontrada. Verifique se a planilha tem a coluna 'material' preenchida.");
                return;
            }

            if (importedItems.length > 0) {
                const replaceExisting = items.length > 0
                    ? window.confirm("Já existem itens no carrinho. Clique OK para substituir, ou Cancelar para adicionar junto.")
                    : true;

                setItems((prev) => replaceExisting ? importedItems : [...prev, ...importedItems]);
                flashCartFeedback(importedItems[importedItems.length - 1].id);
            }

            // Em paralelo (sem bloquear): envia os materiais sem cadastro para
            // aprovação do admin — eles já seguem nesta cotação normalmente.
            if (novosMateriais.size > 0) {
                void requestNewMaterialsApproval(Array.from(novosMateriais.values()));
            }

            // Linhas sem grupo resolvível: abre o modal para o cliente escolher
            if (pendingGroupRows.length > 0) {
                setGroupFixRows(pendingGroupRows);
            }

            if (importedItems.length > 0) {
                alert(
                    `Lista importada com sucesso: ${importedItems.length} item(ns) adicionados` +
                    (ignoredRows > 0 ? `, ${ignoredRows} linha(s) ignorada(s) por não ter material informado.` : ".") +
                    (novosMateriais.size > 0
                        ? `\n\n${novosMateriais.size} material(is) sem cadastro foram enviados para aprovação do administrador. Eles seguem normalmente nesta cotação — a aprovação não bloqueia o envio.`
                        : "") +
                    (pendingGroupRows.length > 0
                        ? `\n\n${pendingGroupRows.length} item(ns) precisam que você escolha o grupo de insumo — vamos mostrar agora.`
                        : "")
                );
            }
        } catch (error: any) {
            console.error("Erro ao importar lista de materiais:", error);
            showToast("error", error?.message || "Erro ao importar lista.");
        } finally {
            setUploadingList(false);
        }
    };

    /**
     * Define o grupo de uma linha do modal.
     *
     * O valor é lido ANTES do setState: o updater do React roda depois do
     * handler e, num modal com dezenas de linhas, o <select> controlado já
     * podia ter voltado ao valor antigo ("") quando o updater lia
     * e.target.value — por isso a seleção "não pegava" e o contador
     * ficava travado.
     */
    const setGroupFixRowGroup = (index: number, grupo: string) => {
        setGroupFixRows(prev => prev
            ? prev.map((r, i) => (i === index ? { ...r, grupo } : r))
            : prev
        );
    };

    /** Aplica o grupo a todas as variações do mesmo produto-base ainda sem grupo. */
    const applyGroupToSimilarRows = (index: number) => {
        setGroupFixRows(prev => {
            if (!prev) return prev;
            const origem = prev[index];
            if (!origem?.grupo) return prev;

            const base = baseProdutoKey(origem.nome);
            if (!base) return prev;

            return prev.map((r, i) => {
                if (i === index || r.grupo) return r;
                return baseProdutoKey(r.nome) === base ? { ...r, grupo: origem.grupo } : r;
            });
        });
    };

    /** Aplica o grupo a todas as linhas ainda sem grupo, independente do produto. */
    const applyGroupToAllRows = (grupo: string) => {
        if (!grupo) return;
        setGroupFixRows(prev => prev
            ? prev.map(r => (r.grupo ? r : { ...r, grupo }))
            : prev
        );
    };

    /** Quantas linhas sem grupo seriam preenchidas por "aplicar aos semelhantes". */
    const countSimilarPendingRows = (index: number) => {
        if (!groupFixRows) return 0;
        const origem = groupFixRows[index];
        if (!origem?.grupo) return 0;
        const base = baseProdutoKey(origem.nome);
        if (!base) return 0;
        return groupFixRows.filter((r, i) => i !== index && !r.grupo && baseProdutoKey(r.nome) === base).length;
    };

    /** Options do seletor de grupo: memoizadas e reaproveitadas por todas as linhas. */
    const grupoOptionElements = useMemo(
        () => availableGroups.map(g => <option key={g} value={g}>{g}</option>),
        [availableGroups]
    );

    // Confirma o modal de correção: adiciona os itens cujo grupo foi escolhido
    const confirmGroupFixRows = () => {
        if (!groupFixRows) return;
        const readyRows = groupFixRows.filter(r => r.grupo);
        if (readyRows.length === 0) {
            showToast("error", "Escolha o grupo de pelo menos um item, ou feche para descartar.");
            return;
        }

        let nextItemId = Math.max(Date.now(), ...items.map(i => Number(i.id) || 0));
        const newItems: CartItem[] = readyRows.map(r => {
            nextItemId += 1;
            return {
                id: nextItemId,
                descricao: r.nome,
                categoria: r.grupo,
                quantidade: r.quantidade,
                unidade: r.unidade,
                fornecedor: r.fornecedor,
                observacao: r.observacao,
                materialId: r.materialId,
                novoMaterial: r.materialId ? undefined : true,
            };
        });
        setItems(prev => [...prev, ...newItems]);
        flashCartFeedback(newItems[newItems.length - 1].id);

        // Materiais sem cadastro: solicita aprovação em paralelo (não bloqueia)
        const novos = readyRows
            .filter(r => !r.materialId)
            .map(r => ({ nome: r.nome, unidade: r.unidade, grupo: r.grupo }));
        if (novos.length > 0) {
            void requestNewMaterialsApproval(novos);
        }

        const skipped = groupFixRows.length - readyRows.length;
        setGroupFixRows(null);
        showToast("success", `${newItems.length} item(ns) adicionados ao carrinho${skipped > 0 ? ` — ${skipped} sem grupo foram descartados` : ""}.`);
    };

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
        const newId = Date.now();
        setItems(prev => [...prev, {
            id: newId,
            descricao: material.nome,
            categoria: grupoNome,
            quantidade: 1,
            unidade: material.unidade,
            observacao: "",
            faseNome,
            servicoNome,
            materialId: material.id
        }]);
        flashCartFeedback(newId);
    };

    // Adicionar material da busca
    const addMaterialFromSearch = (material: Material) => {
        const grupo = grupos.find(g => material.gruposInsumoIds.includes(g.id));
        if (!grupo?.nome) {
            showToast("success", "Este material não possui grupo de insumo válido e não pode ser adicionado.");
            return;
        }
        const newId = Date.now();
        setItems(prev => [...prev, {
            id: newId,
            descricao: material.nome,
            categoria: grupo.nome,
            quantidade: 1,
            unidade: material.unidade,
            observacao: "",
            materialId: material.id
        }]);
        flashCartFeedback(newId);
        setSearchTerm("");
    };

    // Adicionar item manual
    const handleAddManualItem = () => {
        if (!form.descricao.trim() || form.quantidade < 1) return;

        const allowedGroups = new Set(availableGroups.map(g => normalizeGroupName(g)));
        if (!allowedGroups.has(normalizeGroupName(form.categoria))) {
            showToast("error", "Selecione um grupo de insumo válido para adicionar o item.");
            return;
        }

        const newId = Date.now();
        setItems(prev => [...prev, {
            id: newId,
            ...form,
        }]);
        flashCartFeedback(newId);

        setForm(prev => ({
            ...prev,
            descricao: "",
            quantidade: 1,
            fornecedor: "",
            observacao: "",
        }));
        setShowAddForm(false);
    };

    // Remover item (mantém referência para permitir Desfazer)
    const handleRemoveItem = (id: number) => {
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return;
        const removed = items[index];
        setItems(prev => prev.filter(item => item.id !== id));
        setLastRemoved({ item: removed, index });
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = setTimeout(() => setLastRemoved(null), 5000);
    };

    // Enviar solicitação de novo material (cliente) para aprovação do admin
    const submitNewMaterialRequest = async () => {
        const nome = requestMaterialForm.nome.trim();
        if (!nome) {
            showToast("error", "Informe o nome do material.");
            return;
        }
        setRequestMaterialSubmitting(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/material-requests', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    nome,
                    unidade: requestMaterialForm.unidade || 'unid',
                    descricao: requestMaterialForm.descricao,
                    grupo_sugerido: requestMaterialForm.grupo_sugerido,
                    tipo_solicitante: 'cliente',
                    force: requestMaterialForce,
                    contexto: {
                        origem: 'cart',
                        obra_id: selectedObraId || null,
                    },
                }),
            });
            const json = await res.json();
            if (res.status === 409 && json?.duplicate) {
                setRequestMaterialSimilares(json.similares || []);
                setRequestMaterialForce(true);
                showToast("info", json.message || "Encontramos material parecido. Confirme para enviar mesmo assim.");
                return;
            }
            if (!res.ok) {
                throw new Error(json?.error || 'Erro ao enviar solicitação');
            }
            if (json.alreadyPending) {
                showToast("info", "Você já enviou uma solicitação para este material. Aguarde a análise do administrador.");
            } else {
                showToast("success", "Solicitação enviada! O administrador irá analisar o novo material.");
            }
            setShowRequestMaterialModal(false);
            setRequestMaterialForce(false);
            setRequestMaterialSimilares([]);
            setRequestMaterialForm({ nome: "", unidade: "unid", descricao: "", grupo_sugerido: "" });
        } catch (e: any) {
            console.error(e);
            showToast("error", e?.message || "Erro ao enviar solicitação.");
        } finally {
            setRequestMaterialSubmitting(false);
        }
    };

    // Atualizar quantidade do item
    const updateItemQuantity = (id: number, quantidade: number) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantidade } : item
        ));
    };

    // Atualizar fabricante escolhido para o item
    const updateItemFabricante = (id: number, fornecedor: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, fornecedor } : item
        ));
    };

    // Finalizar cotação
    const handleSubmit = async () => {
        if (!user || !selectedObraId || items.length === 0) return;

        const allowedGroups = new Set(availableGroups.map(g => normalizeGroupName(g)));
        const invalidItems = items.filter(item => !allowedGroups.has(normalizeGroupName(item.categoria)));
        if (invalidItems.length > 0) {
            showToast("error", "Existem itens sem grupo de insumo válido. Corrija antes de enviar.");
            setStep(2);
            return;
        }

        setLoading(true);
        try {
            // Upload dos anexos (projetos, detalhes, especificações)
            let anexos: Awaited<ReturnType<typeof uploadAnexos>> = [];
            if (anexosFiles.length > 0) {
                try {
                    anexos = await uploadAnexos(anexosFiles, `cotacoes/${user.id}`);
                } catch (uploadError: any) {
                    showToast("error", uploadError?.message || "Erro ao enviar anexos. Tente novamente.");
                    setLoading(false);
                    return;
                }
            }

            // Obter headers com token de autenticação
            const headers = await getAuthHeaders();

            // Criar cotação via API route (bypass RLS)
            const res = await fetch('/api/cotacoes', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'create',
                    obra_id: selectedObraId,
                    observacoes: observacoesGerais.trim() || undefined,
                    anexos: anexos.length > 0 ? anexos : undefined,
                    itens: items.map(item => ({
                        material_id: item.materialId || null,
                        nome: item.descricao,
                        quantidade: item.quantidade,
                        unidade: item.unidade,
                        grupo: item.categoria,
                        fabricante: item.fornecedor?.trim() || null,
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
                        to: 'admin@comprareconstruir.com',
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
            setObservacoesGerais("");
            setAnexosFiles([]);
            setDraftRestored(false);
            setTimeout(() => {
                setSuccess(false);
                setSuccessMeta(null);
                setStep(1);
                setSelectedObraId("");
            }, 3000);
        } catch (error: any) {
            console.error("Erro ao criar cotação:", error);
            const errorMsg = error?.message || "Erro ao criar cotação. Tente novamente.";
            showToast("error", errorMsg);
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
        <div className="space-y-5">
            {/* Aviso de rascunho retomado */}
            {draftRestored && items.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <RotateCcw className="h-4 w-4 shrink-0 text-blue-600" />
                        <p className="text-sm text-blue-900">
                            <span className="font-semibold">Retomamos sua cotação anterior</span>
                            {" — "}{items.length} {items.length === 1 ? "item" : "itens"} no carrinho.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedObra && (
                            <button
                                onClick={() => { setStep(2); setDraftRestored(false); }}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                                Continuar de onde parei
                            </button>
                        )}
                        <button
                            onClick={discardDraft}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white hover:text-slate-700"
                        >
                            Descartar
                        </button>
                    </div>
                </div>
            )}

            {/* Header com Steps */}
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm" data-tour="cliente-cotacao-steps">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-600" />
                            Nova Cotação
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">Monte sua solicitação por etapas ou busca rápida, com revisão antes do envio.</p>
                    </div>
                    {items.length > 0 && (
                        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 transition-all duration-300 ${cartBump ? "bg-emerald-50 border-emerald-200 scale-105" : "bg-blue-50 border-blue-100 scale-100"}`}>
                            <ShoppingCart className={`w-4 h-4 ${cartBump ? "text-emerald-600" : "text-blue-600"}`} />
                            <span className={`text-sm font-semibold tabular-nums ${cartBump ? "text-emerald-700" : "text-blue-700"}`}>{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                        </div>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
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
                                className={`flex items-center gap-2 flex-1 min-w-[180px] rounded-lg px-3 py-2 transition-all ${step === s.num
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : step > s.num
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'bg-slate-50 text-slate-500 border border-slate-100'
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s.num
                                    ? 'bg-white/20 text-white'
                                    : step > s.num
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-200 text-slate-500'
                                    }`}>
                                    {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                                </div>
                                <span className="hidden sm:block text-sm font-medium">{s.label}</span>
                            </button>
                            {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300 mx-0.5 flex-shrink-0" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 1: Selecionar Obra */}
            {step === 1 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-tour="cliente-cotacao-obra">
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
                    {/* Toolbar unificada (Obra + Modo + Ações) */}
                    <div className="sticky top-2 z-30 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-sm">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
                            {/* Obra selecionada */}
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Obra</p>
                                    <p className="truncate text-sm font-semibold text-slate-900">{selectedObra?.nome}</p>
                                </div>
                                <button
                                    onClick={() => setStep(1)}
                                    className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                                >
                                    Alterar
                                </button>
                            </div>

                            {/* Divisor */}
                            <div className="hidden md:block h-8 w-px bg-slate-200" />

                            {/* Segmented control: modo de cotação */}
                            <div role="tablist" aria-label="Modo de cotação" className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                <button
                                    role="tab"
                                    aria-selected={quotationMode === "phases"}
                                    onClick={() => setQuotationMode("phases")}
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${quotationMode === "phases"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <Layers className="h-3.5 w-3.5" />
                                    Navegar por Fases
                                </button>
                                <button
                                    role="tab"
                                    aria-selected={quotationMode === "search"}
                                    onClick={() => setQuotationMode("search")}
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${quotationMode === "search"
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <Search className="h-3.5 w-3.5" />
                                    Busca Rápida
                                </button>
                            </div>

                            {/* Ações à direita */}
                            <div className="ml-auto flex items-center gap-2">
                                {items.length > 0 && (
                                    <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                                        <Check className="h-3 w-3" />
                                        {items.length} {items.length === 1 ? 'item' : 'itens'} no carrinho
                                    </div>
                                )}
                                <div className="relative" ref={importMenuRef}>
                                    <button
                                        onClick={() => setImportMenuOpen(o => !o)}
                                        disabled={uploadingList || downloadingTemplate}
                                        aria-haspopup="menu"
                                        aria-expanded={importMenuOpen}
                                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Upload className="h-3.5 w-3.5" />
                                        {uploadingList ? "Importando..." : downloadingTemplate ? "Gerando..." : "Importar lista"}
                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${importMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {importMenuOpen && (
                                        <div
                                            role="menu"
                                            className="absolute right-0 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5 z-40"
                                        >
                                            <button
                                                role="menuitem"
                                                onClick={() => { setImportMenuOpen(false); handleDownloadClientTemplate("xlsx"); }}
                                                disabled={uploadingList || downloadingTemplate}
                                                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                <Download className="mt-0.5 h-4 w-4 text-emerald-600" />
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">1. Baixar modelo Excel</p>
                                                    <p className="text-[11px] text-slate-500">Planilha .xlsx pronta: material, quantidade, unidade, fabricante.</p>
                                                </div>
                                            </button>
                                            <div className="h-px bg-slate-100" />
                                            <button
                                                role="menuitem"
                                                onClick={() => { setImportMenuOpen(false); handleDownloadClientTemplate("csv"); }}
                                                disabled={uploadingList || downloadingTemplate}
                                                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                <Download className="mt-0.5 h-4 w-4 text-slate-600" />
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">2. Baixar modelo CSV</p>
                                                    <p className="text-[11px] text-slate-500">Mesmo modelo em formato .csv (separado por ponto e vírgula).</p>
                                                </div>
                                            </button>
                                            <div className="h-px bg-slate-100" />
                                            <button
                                                role="menuitem"
                                                onClick={() => { setImportMenuOpen(false); openUploadClientListDialog(); }}
                                                disabled={uploadingList || downloadingTemplate}
                                                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                <Upload className="mt-0.5 h-4 w-4 text-blue-600" />
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">3. Carregar a lista preenchida</p>
                                                    <p className="text-[11px] text-slate-500">Envie o modelo preenchido — o grupo de cada material é identificado automaticamente.</p>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        ref={uploadListInputRef}
                                        type="file"
                                        accept=".csv,.xlsx,.xls,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                        className="hidden"
                                        onChange={handleUploadClientList}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                        {/* Área principal */}
                        <div className="xl:col-span-8">
                            {/* MODO NAVEGAÇÃO POR FASES */}
                            {quotationMode === "phases" && (
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                    <Layers className="w-5 h-5 text-blue-600" />
                                                    Materiais por Etapas da Obra
                                                </h2>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    Expanda a etapa, abra o grupo e adicione os materiais necessários.
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {selectedObra?.etapa && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                                        <Clock className="h-3 w-3" />
                                                        Fase atual: {selectedObra.etapa}
                                                    </span>
                                                )}
                                                {validEtapasForQuotation.length > 0 ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-100">
                                                        <Check className="h-3 w-3" />
                                                        {validEtapasForQuotation.length} etapa(s) disponível(is)
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 border border-amber-100">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Nenhuma etapa no período de cotação
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {validEtapasForQuotation.length > 0 && (
                                        <div className="px-4 py-3 border-b border-slate-100">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    value={phaseFilter}
                                                    onChange={e => setPhaseFilter(e.target.value)}
                                                    placeholder="Filtrar material nas fases (ex: cimento)..."
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                />
                                                {phaseFilter && (
                                                    <button
                                                        onClick={() => setPhaseFilter("")}
                                                        aria-label="Limpar filtro"
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

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
                                            {phaseTree.length === 0 ? (
                                                <div className="p-8 text-center">
                                                    <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                                                    <p className="text-sm font-medium text-slate-600">Nenhum material encontrado para "{phaseFilter}"</p>
                                                    <button
                                                        onClick={() => setPhaseFilter("")}
                                                        className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                                                    >
                                                        Limpar filtro
                                                    </button>
                                                </div>
                                            ) : phaseTree.map(({ etapa, gruposView, totalMateriais }, faseIdx) => {
                                                const dataPrevista = new Date(etapa.data_prevista);
                                                const dataInicioCotacao = new Date(dataPrevista);
                                                dataInicioCotacao.setDate(dataInicioCotacao.getDate() - etapa.dias_antecedencia_cotacao);
                                                const resumo = etapaResumo.get(etapa.id) || { materiais: 0, grupos: 0 };
                                                const isFaseAtual = !!selectedObra?.etapa && etapa.nome === selectedObra.etapa;
                                                const faseExpandida = isPhaseFilterActive || expandedFases.has(etapa.id);
                                                const matsBadge = isPhaseFilterActive ? totalMateriais : resumo.materiais;
                                                const gruposBadge = isPhaseFilterActive ? gruposView.length : resumo.grupos;

                                                return (
                                                    <div key={etapa.id} className={isFaseAtual ? "bg-blue-50/40" : "bg-white"}>
                                                        {/* Etapa Header */}
                                                        <button
                                                            onClick={() => toggleFase(etapa.id)}
                                                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors duration-200"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold tabular-nums ${isFaseAtual ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                    {faseIdx + 1}
                                                                </div>
                                                                <div className="text-left min-w-0">
                                                                    <p className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                                                                        {etapa.nome}
                                                                        {isFaseAtual && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                                                                <Clock className="h-2.5 w-2.5" /> Fase atual
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                                                                        <Calendar className="w-3 h-3 shrink-0" />
                                                                        Previsão: {dataPrevista.toLocaleDateString('pt-BR')}
                                                                        <span className="text-slate-300">·</span>
                                                                        <span className="text-slate-400">Cotável desde {dataInicioCotacao.toLocaleDateString('pt-BR')}</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                {matsBadge > 0 && (
                                                                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                                                        <Package className="h-3 w-3 text-slate-400" />
                                                                        {matsBadge} {matsBadge === 1 ? 'material' : 'materiais'}
                                                                        <span className="text-slate-300">·</span>
                                                                        {gruposBadge} {gruposBadge === 1 ? 'grupo' : 'grupos'}
                                                                    </span>
                                                                )}
                                                                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${faseExpandida ? 'rotate-180' : ''
                                                                    }`} />
                                                            </div>
                                                        </button>

                                                        {/* Grupos de Materiais da Etapa */}
                                                        {faseExpandida && (
                                                            <div className="pl-4 border-l-2 border-emerald-100 ml-7 mb-4">
                                                                {gruposView.length === 0 ? (
                                                                    <p className="text-sm text-slate-400 py-2 px-4">
                                                                        Nenhum grupo de insumo vinculado aos serviços desta etapa.
                                                                    </p>
                                                                ) : (
                                                                    gruposView.map(({ grupo, materiaisDoGrupo }) => {
                                                                        const grupoExpandido = isPhaseFilterActive || expandedGrupos.has(`${etapa.id}-${grupo.id}`);

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
                                                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${grupoExpandido ? 'rotate-180' : ''
                                                                                        }`} />
                                                                                </button>

                                                                                {/* Materiais do Grupo */}
                                                                                {grupoExpandido && (
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
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                                <p className="text-xs text-amber-800">
                                                    Nenhum material encontrado para "{searchTerm}". Solicite o cadastro do material novo.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRequestMaterialForm({
                                                            nome: searchTerm.trim(),
                                                            unidade: "unid",
                                                            descricao: "",
                                                            grupo_sugerido: "",
                                                        });
                                                        setRequestMaterialSimilares([]);
                                                        setRequestMaterialForce(false);
                                                        setShowRequestMaterialModal(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700"
                                                >
                                                    <Sparkles className="h-3 w-3" /> Solicitar novo material
                                                </button>
                                            </div>
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
                            {/* CTA principal sticky */}
                            <div className="sticky top-24 space-y-3">
                                {items.length === 0 ? (
                                    /* Empty-state consolidado: um único card com dica embutida */
                                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center">
                                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
                                            <ShoppingCart className="h-7 w-7 text-slate-300" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-900">Seu carrinho está vazio</h3>
                                        <p className="mt-1 text-xs text-slate-500">Adicione materiais pela lista ao lado para montar sua cotação.</p>
                                        <div className="mt-4 flex gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-left">
                                            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                                            <p className="text-[11px] leading-relaxed text-amber-800">
                                                <span className="font-semibold">Dica:</span> agrupe materiais da mesma fase (ex: elétrica e hidráulica) para aumentar seu poder de negociação.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                <>
                                <button
                                    onClick={() => setStep(3)}
                                    className="group w-full rounded-2xl bg-blue-600 px-5 py-4 text-white shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-between gap-3"
                                >
                                    <div className="flex flex-col items-start text-left min-w-0">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                                            Pronto para enviar
                                        </span>
                                        <span className="text-base font-bold truncate">
                                            {`Analisar ${items.length} ${items.length === 1 ? 'item' : 'itens'}`}
                                        </span>
                                    </div>
                                    <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                                </button>

                                {/* Itens no Carrinho */}
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                            <ShoppingCart className="w-4 h-4 text-blue-600" />
                                            Carrinho
                                        </h3>
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-all duration-300 ${cartBump ? "scale-125 bg-emerald-100 text-emerald-700" : "scale-100 bg-slate-100 text-slate-600"}`}>
                                            {items.length}
                                        </span>
                                    </div>

                                    <div className="max-h-[420px] overflow-y-auto">
                                        {renderCartGroups()}
                                    </div>
                                </div>

                                {/* Dica do Especialista (pílula sutil) */}
                                <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 flex gap-2">
                                    <Zap className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-[11px] leading-relaxed text-amber-800">
                                        <span className="font-semibold">Dica:</span> agrupe materiais da mesma fase (ex: elétrica e hidráulica) para aumentar seu poder de negociação.
                                    </p>
                                </div>
                                </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Carrinho mobile: botão flutuante + bottom-sheet */}
                    {items.length > 0 && (
                        <button
                            onClick={() => setMobileCartOpen(true)}
                            className="xl:hidden fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-95"
                        >
                            <ShoppingCart className="h-5 w-5" />
                            <span className="text-sm font-semibold">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">Ver carrinho</span>
                        </button>
                    )}

                    {mobileCartOpen && createPortal(
                        <div className="xl:hidden fixed inset-0 z-[70]">
                            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileCartOpen(false)} />
                            <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl">
                                <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200" />
                                <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 pt-3">
                                    <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                        <ShoppingCart className="h-5 w-5 text-blue-600" />
                                        Carrinho
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{items.length}</span>
                                    </h3>
                                    <button onClick={() => setMobileCartOpen(false)} aria-label="Fechar carrinho" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto overscroll-contain">
                                    {items.length === 0 ? (
                                        <div className="px-4 py-12 text-center">
                                            <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                                            <p className="text-xs text-slate-400">Carrinho vazio.</p>
                                        </div>
                                    ) : renderCartGroups()}
                                </div>
                                <div className="border-t border-slate-100 p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                                    <button
                                        onClick={() => { setMobileCartOpen(false); setStep(3); }}
                                        disabled={items.length === 0}
                                        className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                                    >
                                        <span className="text-sm font-bold">Analisar {items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                                        <ArrowRight className="h-4 w-4 transition-transform group-enabled:group-hover:translate-x-0.5" />
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

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

            {/* Snackbar: desfazer remoção de item */}
            {lastRemoved && createPortal(
                <div className="fixed bottom-4 left-4 z-[9999] flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
                    <Trash2 className="h-4 w-4 text-slate-400" />
                    <span className="max-w-[200px] truncate">
                        <span className="font-semibold">{lastRemoved.item.descricao}</span> removido
                    </span>
                    <button
                        onClick={undoRemove}
                        className="ml-1 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Desfazer
                    </button>
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
                                            <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                                                        {item.descricao}
                                                        {item.novoMaterial && (
                                                            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700" title="Material sem cadastro: enviado para aprovação do administrador, mas segue nesta cotação normalmente">
                                                                Novo material — em aprovação
                                                            </span>
                                                        )}
                                                    </p>
                                                    {item.faseNome && (
                                                        <p className="text-xs text-slate-500">
                                                            <Layers className="w-3 h-3 inline mr-1" />
                                                            {item.faseNome}
                                                            {item.servicoNome && ` → ${item.servicoNome}`}
                                                        </p>
                                                    )}
                                                    <div className="mt-1.5 flex items-center gap-1.5">
                                                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <select
                                                            value={item.fornecedor || ""}
                                                            onChange={e => updateItemFabricante(item.id, e.target.value)}
                                                            className="max-w-[220px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none cursor-pointer"
                                                        >
                                                            <option value="">Fabricante (opcional)</option>
                                                            {item.fornecedor && !manufacturers.includes(item.fornecedor) && (
                                                                <option value={item.fornecedor}>{item.fornecedor}</option>
                                                            )}
                                                            {manufacturers.map(name => (
                                                                <option key={name} value={name}>{name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {item.observacao && (
                                                        <p className="mt-1 text-xs text-slate-400">{item.observacao}</p>
                                                    )}
                                                </div>
                                                <div className="text-right shrink-0">
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

                    {/* Observações gerais da cotação (visíveis aos fornecedores) */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <label className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-600" />
                            Observações gerais (opcional)
                        </label>
                        <p className="text-xs text-slate-500 mb-3">
                            Essas informações serão exibidas aos fornecedores junto com a cotação.
                        </p>
                        <textarea
                            value={observacoesGerais}
                            onChange={e => setObservacoesGerais(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                            placeholder="Ex: Entregar preferencialmente pela manhã; rua estreita, sem acesso para carreta..."
                        />
                    </div>

                    {/* Anexos da cotação (projetos, detalhes, especificações) */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <AttachmentsField
                            label="Anexos (opcional)"
                            description="Anexe projetos, detalhes e especificações complementares — essenciais para cotar esquadrias, marcenaria, bancadas, impermeabilização, instalações etc. Os fornecedores poderão baixar os arquivos."
                            files={anexosFiles}
                            onChange={setAnexosFiles}
                            disabled={loading}
                            onError={(message) => showToast("error", message)}
                        />
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
                                    Fabricante (opcional)
                                </label>
                                <input
                                    value={form.fornecedor}
                                    onChange={e => setForm({ ...form, fornecedor: e.target.value })}
                                    list="manufacturers-suggestions"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Ex: Votorantim, Quartzolit, Tigre..."
                                />
                                <datalist id="manufacturers-suggestions">
                                    {manufacturers.map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
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

            {/* Modal de correção: itens importados sem grupo de insumo */}
            {groupFixRows && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Escolha o grupo destes itens</h2>
                                <p className="text-sm text-slate-500">
                                    Não conseguimos identificar o grupo de insumo destes materiais da sua lista.
                                    Escolha o grupo para incluí-los na cotação — sem grupo não há como direcionar aos fornecedores certos.
                                </p>
                            </div>
                            <button
                                onClick={() => setGroupFixRows(null)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                                aria-label="Fechar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {groupFixRows.some(r => !r.grupo) && (
                            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
                                <span className="text-xs font-medium text-slate-600">
                                    Aplicar a todos os {groupFixRows.filter(r => !r.grupo).length} itens sem grupo:
                                </span>
                                <select
                                    value=""
                                    onChange={e => {
                                        const grupo = e.target.value;
                                        applyGroupToAllRows(grupo);
                                    }}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value="">Escolher grupo...</option>
                                    {grupoOptionElements}
                                </select>
                            </div>
                        )}

                        <div className="p-5 space-y-3 overflow-y-auto">
                            {groupFixRows.map((row, index) => (
                                <div key={index} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                                    <div className="flex-1 min-w-[180px]">
                                        <p className="text-sm font-medium text-slate-900">{row.nome}</p>
                                        <p className="text-xs text-slate-500">
                                            {row.quantidade} {row.unidade}
                                            {!row.materialId && (
                                                <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                                    novo material
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-start gap-1">
                                        <select
                                            value={row.grupo}
                                            onChange={e => {
                                                // Lê o valor antes do setState: o updater roda
                                                // depois do handler e o select controlado já
                                                // pode ter voltado ao valor anterior.
                                                const grupo = e.target.value;
                                                setGroupFixRowGroup(index, grupo);
                                            }}
                                            className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${row.grupo ? 'border-slate-200 text-slate-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}
                                        >
                                            <option value="">Escolher grupo...</option>
                                            {grupoOptionElements}
                                        </select>
                                        {(() => {
                                            const semelhantes = countSimilarPendingRows(index);
                                            if (semelhantes === 0) return null;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => applyGroupToSimilarRows(index)}
                                                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    Aplicar a +{semelhantes} item(ns) semelhante(s)
                                                </button>
                                            );
                                        })()}
                                    </div>
                                    <button
                                        onClick={() => setGroupFixRows(prev => {
                                            const next = (prev || []).filter((_, i) => i !== index);
                                            return next.length > 0 ? next : null;
                                        })}
                                        className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50"
                                        aria-label={`Remover ${row.nome}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-5">
                            {(() => {
                                const comGrupo = groupFixRows.filter(r => r.grupo).length;
                                const semGrupo = groupFixRows.length - comGrupo;
                                return (
                                    <>
                                        <p className="text-xs text-slate-500">
                                            {comGrupo} de {groupFixRows.length} com grupo escolhido
                                            {semGrupo > 0 && (
                                                <span className="block text-amber-600">
                                                    {semGrupo} item(ns) sem grupo serão descartados.
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setGroupFixRows(null)}
                                                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                            >
                                                Descartar
                                            </button>
                                            <button
                                                onClick={confirmGroupFixRows}
                                                disabled={comGrupo === 0}
                                                title={comGrupo === 0 ? "Escolha o grupo de pelo menos um item" : undefined}
                                                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Plus className="w-4 h-4" />
                                                {comGrupo > 0 ? `Adicionar ${comGrupo} ao carrinho` : "Adicionar ao carrinho"}
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {showRequestMaterialModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                            <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-amber-100 p-2 text-amber-700"><Sparkles className="h-4 w-4" /></div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">Solicitar novo material</h3>
                                    <p className="text-xs text-slate-500">Será enviado para análise do administrador.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowRequestMaterialModal(false)}
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                aria-label="Fechar"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-3 px-5 py-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Nome do material *</label>
                                <input
                                    value={requestMaterialForm.nome}
                                    onChange={(e) => setRequestMaterialForm((p) => ({ ...p, nome: e.target.value }))}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Ex.: Cimento branco estrutural 25kg"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700">Unidade</label>
                                    <select
                                        value={requestMaterialForm.unidade}
                                        onChange={(e) => setRequestMaterialForm((p) => ({ ...p, unidade: e.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    >
                                        {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700">Grupo sugerido</label>
                                    <select
                                        value={requestMaterialForm.grupo_sugerido}
                                        onChange={(e) => setRequestMaterialForm((p) => ({ ...p, grupo_sugerido: e.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="">Selecione...</option>
                                        {availableGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Descrição (opcional)</label>
                                <textarea
                                    value={requestMaterialForm.descricao}
                                    onChange={(e) => setRequestMaterialForm((p) => ({ ...p, descricao: e.target.value }))}
                                    rows={3}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Especificações, marca, dimensões, etc."
                                />
                            </div>

                            {requestMaterialSimilares.length > 0 && (
                                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                                    <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                                        <Sparkles className="h-3.5 w-3.5" /> Encontramos materiais já cadastrados parecidos
                                    </p>
                                    <ul className="space-y-1">
                                        {requestMaterialSimilares.slice(0, 5).map((s) => (
                                            <li key={s.id} className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-xs">
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-slate-800">{s.nome}</p>
                                                    <p className="text-[11px] text-slate-500">Unidade: {s.unidade} · {Math.round((s.similarity || 0) * 100)}% similar</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSearchTerm(s.nome);
                                                        setShowRequestMaterialModal(false);
                                                    }}
                                                    className="ml-2 rounded-md border border-violet-200 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
                                                >
                                                    Usar este
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-2 text-[11px] text-violet-700">
                                        Se nenhum atende, clique em "Enviar mesmo assim" abaixo.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                            <button
                                onClick={() => setShowRequestMaterialModal(false)}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                disabled={requestMaterialSubmitting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitNewMaterialRequest}
                                disabled={requestMaterialSubmitting || !requestMaterialForm.nome.trim()}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                                {requestMaterialSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {requestMaterialForce && requestMaterialSimilares.length > 0 ? "Enviar mesmo assim" : "Enviar solicitação"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
