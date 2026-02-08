"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { sendEmail } from "../../../app/actions/email";
import {
    Package, Plus, Trash2, ShoppingCart, Building2, Send, Search, Check,
    AlertCircle, Loader2, ChevronRight, Sparkles, ArrowRight, X, Tag,
    FileText, Scale, MessageSquare, Boxes, CheckCircle2, ChevronDown,
    Calendar, Clock, Layers, Zap, Filter
} from "lucide-react";

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
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);

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
                supabase.from("materiais").select("*"),
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

            return hoje >= dataInicioCotacao;
        });
    }, [obraEtapas]);

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
        if (!searchTerm || materiais.length === 0) return [];
        return materiais.filter(m =>
            m.nome.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10);
    }, [searchTerm, materiais]);

    // Filtrar categorias
    const filteredGroups = useMemo(() => {
        if (!searchTerm) return availableGroups;
        return availableGroups.filter(g =>
            g.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [availableGroups, searchTerm]);

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
        setItems(prev => [...prev, {
            id: Date.now(),
            descricao: material.nome,
            categoria: grupo?.nome || "Outros",
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

        setLoading(true);
        try {
            // Obter token de autenticação
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

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
                throw new Error(err.error || 'Erro ao criar cotação');
            }

            const result = await res.json();

            // Notificar fornecedores da região por email (best effort)
            if (selectedObra?.cidade && result.suppliers_notified > 0) {
                try {
                    await sendEmail({
                        to: 'admin@cotareconstruir.com.br',
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
            setItems([]);
            setTimeout(() => {
                setSuccess(false);
                setStep(1);
                setSelectedObraId("");
            }, 3000);
        } catch (error) {
            console.error("Erro ao criar cotação:", error);
            alert("Erro ao criar cotação.");
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
                    <p className="text-slate-500 mb-6">Fornecedores da região serão notificados</p>
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecionando...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header com Steps */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-blue-600" />
                            Nova Cotação Inteligente
                        </h1>
                        <p className="text-slate-500 mt-1">Solicite materiais baseado nas fases da sua obra</p>
                    </div>
                    {items.length > 0 && (
                        <div className="flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2">
                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-600">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                        </div>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2">
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
                                className={`flex items-center gap-2 flex-1 rounded-xl px-4 py-3 transition-all ${step === s.num
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
                <div className="space-y-4">
                    {/* Obra selecionada */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
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
                    <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="text-sm font-semibold text-slate-700">Modo de Cotação:</span>
                            <div className="flex gap-2">
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
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Área principal */}
                        <div className="lg:col-span-2">
                            {/* MODO NAVEGAÇÃO POR FASES */}
                            {quotationMode === "phases" && (
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-slate-100">
                                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                            <Layers className="w-5 h-5 text-blue-600" />
                                            Navegação por Etapas da Obra
                                        </h2>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Selecione materiais das etapas que estão dentro do período de cotação
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
                                        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                            {validEtapasForQuotation.map(etapa => {
                                                const dataPrevista = new Date(etapa.data_prevista);
                                                const dataInicioCotacao = new Date(dataPrevista);
                                                dataInicioCotacao.setDate(dataInicioCotacao.getDate() - etapa.dias_antecedencia_cotacao);

                                                return (
                                                    <div key={etapa.id} className="bg-white">
                                                        {/* Etapa Header */}
                                                        <button
                                                            onClick={() => toggleFase(etapa.id)}
                                                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
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
                                                                {grupos.length === 0 ? (
                                                                    <p className="text-sm text-slate-400 py-2 px-4">
                                                                        Nenhum grupo de materiais cadastrado
                                                                    </p>
                                                                ) : (
                                                                    grupos.map(grupo => {
                                                                        const materiaisDoGrupo = materiais.filter(m =>
                                                                            m.gruposInsumoIds.includes(grupo.id)
                                                                        );
                                                                        if (materiaisDoGrupo.length === 0) return null;

                                                                        return (
                                                                            <div key={grupo.id} className="mb-2">
                                                                                <button
                                                                                    onClick={() => toggleGrupo(`${etapa.id}-${grupo.id}`)}
                                                                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50"
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
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                                <Search className="w-5 h-5 text-blue-600" />
                                                Busca Rápida
                                            </h2>
                                            <p className="text-sm text-slate-500">Busque materiais ou adicione manualmente</p>
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
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                placeholder="Digite o nome do material (ex: Cimento, Areia)..."
                                            />
                                        </div>

                                        {/* Sugestões */}
                                        {filteredMaterials.length > 0 && (
                                            <div className="absolute left-4 right-4 top-full mt-1 z-10 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                {filteredMaterials.map(material => {
                                                    const isAdded = items.some(i => i.materialId === material.id);
                                                    return (
                                                        <button
                                                            key={material.id}
                                                            onClick={() => !isAdded && addMaterialFromSearch(material)}
                                                            disabled={isAdded}
                                                            className={`w-full text-left px-4 py-3 flex justify-between items-center border-b border-slate-50 last:border-0 ${isAdded ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <span className="font-medium text-slate-700">{material.nome}</span>
                                                            {isAdded ? (
                                                                <span className="text-xs text-emerald-600 font-medium">✓ Adicionado</span>
                                                            ) : (
                                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{material.unidade}</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Lista de categorias */}
                                    <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
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
                        <div className="space-y-4">
                            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg sticky top-4">
                                <h3 className="font-bold text-lg mb-4">Resumo da Cotação</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-blue-100">Itens totais</span>
                                        <span className="font-semibold">{items.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-blue-100">Grupos</span>
                                        <span className="font-semibold">{Object.keys(groupedItems).length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-blue-100">Obra</span>
                                        <span className="font-semibold truncate max-w-[120px]">{selectedObra?.nome}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => items.length > 0 && setStep(3)}
                                    disabled={items.length === 0}
                                    className="w-full mt-5 py-3 rounded-xl bg-white text-blue-600 font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Analisar Lista
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Itens no Carrinho */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                                    Itens no Carrinho ({items.length})
                                </h3>

                                {items.length === 0 ? (
                                    <div className="text-center py-6">
                                        <ShoppingCart className="w-10 h-10 mx-auto text-slate-200 mb-2" />
                                        <p className="text-sm text-slate-400">Seu carrinho está vazio.</p>
                                        <p className="text-xs text-slate-400">Comece buscando materiais acima.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {items.map(item => (
                                            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
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
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
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

                    {/* Botão avançar */}
                    {items.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                onClick={() => setStep(3)}
                                className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-800"
                            >
                                Revisar Cotação
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
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
