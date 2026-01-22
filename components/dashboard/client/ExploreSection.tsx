"use client";

import { useState, useMemo, useEffect } from "react";
import { PlusIcon, MagnifyingGlassIcon, ShoppingCartIcon, WrenchScrewdriverIcon, ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";

// Interfaces for Supabase data
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

interface CartItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    group: string;
    observation?: string;
    faseNome?: string;
    servicoNome?: string;
    materialId?: string;
}

export function ClientExploreSection() {
    const { user } = useAuth();
    const [currentView, setCurrentView] = useState<"search" | "analysis" | "success">("search");
    const [searchTerm, setSearchTerm] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedWork, setSelectedWork] = useState("");
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [works, setWorks] = useState<any[]>([]);
    const [selectedWorkData, setSelectedWorkData] = useState<any>(null);
    const [quotationMode, setQuotationMode] = useState<"search" | "tree">("search");

    // Estados para modo árvore
    const [fases, setFases] = useState<Fase[]>([]);
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);
    const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set());
    const [expandedServicos, setExpandedServicos] = useState<Set<string>>(new Set());
    const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set());
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);

    // Load user's works
    useEffect(() => {
        const loadWorks = async () => {
            if (!user?.id) {
                setWorks([]);
                return;
            }

            const { data, error } = await supabase
                .from("obras")
                .select("*")
                .eq("user_id", user.id);

            if (error) {
                console.error("Erro ao carregar obras:", error);
                return;
            }

            setWorks(data || []);
        };

        loadWorks();
    }, [user?.id]);

    // Carregar grupos de insumo disponíveis
    useEffect(() => {
        const loadGroups = async () => {
            try {
                const { data, error } = await supabase
                    .from("grupos_insumo")
                    .select("nome")
                    .order("nome");

                if (error) throw error;
                const groups = (data || []).map(g => g.nome);
                setAvailableGroups(groups);
            } catch (error) {
                console.error("Erro ao carregar grupos:", error);
            }
        };
        loadGroups();
    }, []);

    // Carregar dados da estrutura sempre que uma obra for selecionada (para busca funcionar)
    useEffect(() => {
        if (selectedWork) {
            loadConstructionData();
        }
    }, [selectedWork]);

    // Quando selecionar uma obra, buscar seus dados
    useEffect(() => {
        if (selectedWork) {
            const loadWorkData = async () => {
                try {
                    const { data, error } = await supabase
                        .from("obras")
                        .select("*")
                        .eq("id", selectedWork)
                        .single();

                    if (error) throw error;
                    setSelectedWorkData(data);
                } catch (error) {
                    console.error("Erro ao carregar dados da obra:", error);
                }
            };
            loadWorkData();
        } else {
            setSelectedWorkData(null);
        }
    }, [selectedWork]);

    const loadConstructionData = async () => {
        try {
            // Load all data in parallel
            const [fasesResult, servicosResult, gruposResult, materiaisResult, servicoFaseResult, servicoGrupoResult, materialGrupoResult] = await Promise.all([
                supabase.from("fases").select("*").order("cronologia", { ascending: true }),
                supabase.from("servicos").select("*").order("ordem", { ascending: true }),
                supabase.from("grupos_insumo").select("*"),
                supabase.from("materiais").select("*"),
                supabase.from("servico_fase").select("*"),
                supabase.from("servico_grupo").select("*"),
                supabase.from("material_grupo").select("*")
            ]);

            if (fasesResult.error) throw fasesResult.error;
            if (servicosResult.error) throw servicosResult.error;
            if (gruposResult.error) throw gruposResult.error;
            if (materiaisResult.error) throw materiaisResult.error;
            if (servicoFaseResult.error) throw servicoFaseResult.error;
            if (servicoGrupoResult.error) throw servicoGrupoResult.error;
            if (materialGrupoResult.error) throw materialGrupoResult.error;

            // Build lookup maps for relationships
            const servicoFaseMap: Record<string, string[]> = {};
            (servicoFaseResult.data || []).forEach(sf => {
                if (!servicoFaseMap[sf.servico_id]) servicoFaseMap[sf.servico_id] = [];
                servicoFaseMap[sf.servico_id].push(sf.fase_id);
            });

            const servicoGrupoMap: Record<string, string[]> = {};
            (servicoGrupoResult.data || []).forEach(sg => {
                if (!servicoGrupoMap[sg.servico_id]) servicoGrupoMap[sg.servico_id] = [];
                servicoGrupoMap[sg.servico_id].push(sg.grupo_id);
            });

            const materialGrupoMap: Record<string, string[]> = {};
            (materialGrupoResult.data || []).forEach(mg => {
                if (!materialGrupoMap[mg.material_id]) materialGrupoMap[mg.material_id] = [];
                materialGrupoMap[mg.material_id].push(mg.grupo_id);
            });

            // Transform data with relationships
            setFases((fasesResult.data || []).map(f => ({
                id: f.id,
                cronologia: f.cronologia,
                nome: f.nome
            })));

            setServicos((servicosResult.data || []).map(s => ({
                id: s.id,
                nome: s.nome,
                ordem: s.ordem,
                faseIds: servicoFaseMap[s.id] || [],
                gruposInsumoIds: servicoGrupoMap[s.id] || []
            })));

            setGrupos((gruposResult.data || []).map(g => ({
                id: g.id,
                nome: g.nome
            })));

            setMateriais((materiaisResult.data || []).map(m => ({
                id: m.id,
                nome: m.nome,
                unidade: m.unidade,
                gruposInsumoIds: materialGrupoMap[m.id] || []
            })));
        } catch (error) {
            console.error("Erro ao carregar dados da estrutura:", error);
        }
    };

    // Função para verificar se uma fase está na data válida para receber propostas
    const isFaseValidForQuotation = (faseNome: string): boolean => {
        if (!selectedWorkData) return false;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas a data

        // Verifica se é a fase atual da obra e se já está na data de recebimento
        if (faseNome === selectedWorkData.etapa && selectedWorkData.inicio_recebimento_oferta) {
            const inicioOferta = new Date(selectedWorkData.inicio_recebimento_oferta);
            inicioOferta.setHours(0, 0, 0, 0);
            if (hoje >= inicioOferta) {
                return true;
            }
        }

        // Verifica se existe uma etapa cadastrada para essa fase
        if (selectedWorkData.stages && selectedWorkData.stages.length > 0) {
            const stage = selectedWorkData.stages.find((s: any) => s.name === faseNome);

            if (stage && stage.predictedDate && stage.quotationAdvanceDays) {
                // Calcula a data de início de recebimento de ofertas
                const dataInicio = new Date(stage.predictedDate);
                dataInicio.setHours(0, 0, 0, 0);
                const inicioRecebimento = new Date(dataInicio);
                inicioRecebimento.setDate(inicioRecebimento.getDate() - stage.quotationAdvanceDays);

                // Verifica se hoje já está dentro do período de recebimento
                return hoje >= inicioRecebimento;
            }
        }

        return false;
    };

    // Função para validar material adicionado via busca
    const validateMaterialFase = (material: Material): { valid: boolean; faseNome?: string } => {
        // Se não tem dados carregados ainda, não valida (permite adicionar)
        if (!selectedWorkData) return { valid: true };
        if (fases.length === 0 || servicos.length === 0) return { valid: true };

        const faseAtualObra = selectedWorkData.etapa;
        if (!faseAtualObra) return { valid: true }; // Se obra não tem fase definida, permite

        // Encontrar a fase do material através dos grupos e serviços
        let materialFase: Fase | null = null;

        // Buscar grupos do material
        if (material.gruposInsumoIds && material.gruposInsumoIds.length > 0) {
            for (const grupoId of material.gruposInsumoIds) {
                // Buscar serviços que usam esse grupo
                const servicosDoGrupo = servicos.filter(s =>
                    s.gruposInsumoIds && s.gruposInsumoIds.includes(grupoId)
                );

                for (const servico of servicosDoGrupo) {
                    // Buscar fases do serviço
                    if (servico.faseIds && servico.faseIds.length > 0) {
                        for (const faseId of servico.faseIds) {
                            const fase = fases.find(f => f.id === faseId);
                            if (fase && (!materialFase || fase.cronologia < materialFase.cronologia)) {
                                materialFase = fase;
                            }
                        }
                    }
                }
            }
        }

        // Se encontrou fase e é a mesma da obra atual, está válido
        if (materialFase && materialFase.nome === faseAtualObra) {
            return { valid: true, faseNome: materialFase.nome };
        }

        // Se não encontrou fase ou é diferente da atual, retorna inválido
        return { valid: false, faseNome: materialFase?.nome };
    };

    // Filtrar fases válidas para exibir no modo árvore
    const validFasesForQuotation = useMemo(() => {
        if (!selectedWorkData) return [];
        return fases.filter(f => isFaseValidForQuotation(f.nome));
    }, [selectedWorkData, fases]);

    // Estado para entrada manual
    const [manualItem, setManualItem] = useState({
        name: "",
        group: "",
        quantity: 1,
        unit: "unid",
        observation: ""
    });

    // Agora busca nos materiais reais do Firestore
    const filteredMaterialSuggestions = useMemo(() => {
        if (!searchTerm || materiais.length === 0) return [];
        return materiais.filter(m =>
            m.nome.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10); // Limita a 10 sugestões
    }, [searchTerm, materiais]);

    const addToCart = (material: Material) => {
        // Verificar fase do material
        const validation = validateMaterialFase(material);
        const faseAtualObra = selectedWorkData?.etapa;

        // Se não for válido (material não é da fase atual), perguntar ao usuário
        if (!validation.valid && faseAtualObra) {
            const confirmMessage = `⚠️ Atenção: Este material não pertence à fase atual da obra.\n\nFase atual da obra: ${faseAtualObra}\n\nDeseja adicionar mesmo assim?`;

            if (!confirm(confirmMessage)) {
                return; // Usuário cancelou, não adiciona
            }
        }

        setCart([...cart, {
            id: Date.now().toString(),
            name: material.nome,
            quantity: 1,
            unit: material.unidade,
            group: "Material",
            observation: "",
            faseNome: validation.faseNome,
            materialId: material.id
        }]);
        setSearchTerm("");
    };

    const addMaterialFromTree = (material: Material, faseNome: string, servicoNome: string) => {
        setCart([...cart, {
            id: Date.now().toString(),
            name: material.nome,
            quantity: 1,
            unit: material.unidade,
            group: servicoNome,
            observation: "",
            faseNome: faseNome,
            servicoNome: servicoNome,
            materialId: material.id
        }]);
    };

    const toggleFase = (faseId: string) => {
        const newSet = new Set(expandedFases);
        if (newSet.has(faseId)) {
            newSet.delete(faseId);
        } else {
            newSet.add(faseId);
        }
        setExpandedFases(newSet);
    };

    const toggleServico = (servicoId: string) => {
        const newSet = new Set(expandedServicos);
        if (newSet.has(servicoId)) {
            newSet.delete(servicoId);
        } else {
            newSet.add(servicoId);
        }
        setExpandedServicos(newSet);
    };

    const toggleGrupo = (grupoId: string) => {
        const newSet = new Set(expandedGrupos);
        if (newSet.has(grupoId)) {
            newSet.delete(grupoId);
        } else {
            newSet.add(grupoId);
        }
        setExpandedGrupos(newSet);
    };

    const addManualItem = () => {
        if (!manualItem.name) return;
        setCart([...cart, {
            id: Date.now().toString(),
            name: manualItem.name,
            quantity: manualItem.quantity,
            unit: manualItem.unit,
            group: manualItem.group,
            observation: manualItem.observation
        }]);
        setManualItem({ name: "", group: availableGroups[0] || "", quantity: 1, unit: "unid", observation: "" });
        setShowManualEntry(false);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setCart(cart.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const groupedCart = useMemo(() => {
        const groups: { [key: string]: typeof cart } = {};
        cart.forEach(item => {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push(item);
        });
        return groups;
    }, [cart]);

    const handleSendQuotation = async () => {
        if (!selectedWork) {
            alert("Por favor, selecione uma obra para vincular à cotação.");
            return;
        }
        if (cart.length === 0) {
            alert("Adicione itens ao carrinho antes de enviar.");
            return;
        }
        if (!user?.id) {
            alert("Usuário não autenticado.");
            return;
        }

        try {
            // Insert cotacao
            const { data: cotacao, error: cotacaoError } = await supabase
                .from("cotacoes")
                .insert({
                    user_id: user.id,
                    obra_id: selectedWork,
                    status: "pending",
                    total_itens: cart.length,
                    economia_estimada: "15-25%",
                })
                .select()
                .single();

            if (cotacaoError) throw cotacaoError;

            // Insert cotacao_itens
            const itens = cart.map(item => ({
                cotacao_id: cotacao.id,
                material_id: item.materialId || null,
                nome: item.name,
                quantidade: item.quantity,
                unidade: item.unit,
                grupo: item.group,
                observacao: item.observation || null,
                fase_nome: item.faseNome || null,
                servico_nome: item.servicoNome || null,
            }));

            const { error: itensError } = await supabase
                .from("cotacao_itens")
                .insert(itens);

            if (itensError) throw itensError;

            setCurrentView("success");
            setCart([]); // Clear cart after success
            setSelectedWork("");
        } catch (error) {
            console.error("Erro ao enviar cotação:", error);
            alert("Erro ao enviar cotação. Tente novamente.");
        }
    };

    // Renderização baseada na view atual
    if (currentView === "search") {
        return (
            <div className="space-y-6">
                {/* Header Principal */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Nova Cotação Inteligente</h2>
                        <p className="text-slate-500 text-sm">
                            Busque materiais ou adicione manualmente. Nossa IA agrupa tudo para você.
                        </p>
                    </div>
                    <div className="w-full md:w-64">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                            Vincular à Obra *
                        </label>
                        <select
                            value={selectedWork}
                            onChange={(e) => setSelectedWork(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {works.map((work) => (
                                <option key={work.id} value={work.id}>
                                    {work.nome}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Só mostra o resto do formulário se uma obra foi selecionada */}
                {selectedWork && (
                    <>
                        {/* Seletor de Modo */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-semibold text-slate-700">Modo de Cotação:</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setQuotationMode("search")}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${quotationMode === "search"
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "bg-white text-slate-600 hover:bg-slate-50"
                                            }`}
                                    >
                                        🔍 Busca Rápida
                                    </button>
                                    <button
                                        onClick={() => setQuotationMode("tree")}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${quotationMode === "tree"
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "bg-white text-slate-600 hover:bg-slate-50"
                                            }`}
                                    >
                                        🌳 Navegação por Fases
                                    </button>
                                </div>
                            </div>
                            {selectedWorkData && (
                                <div className="mt-3 text-sm text-slate-600">
                                    <span className="font-medium">Fase Atual:</span> {selectedWorkData.etapa || "Não definida"}
                                    {selectedWorkData.inicio_recebimento_oferta && (
                                        <span className="ml-4">
                                            <span className="font-medium">Recebe ofertas desde:</span> {new Date(selectedWorkData.inicio_recebimento_oferta).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Área de Pesquisa e Adição */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* MODO BUSCA */}
                                {quotationMode === "search" && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                                <MagnifyingGlassIcon className="h-5 w-5 text-blue-600" />
                                                O que você precisa comprar?
                                            </h3>
                                            <button
                                                onClick={() => setShowManualEntry(!showManualEntry)}
                                                className="text-sm text-blue-600 font-medium hover:underline"
                                            >
                                                {showManualEntry ? "Voltar para busca" : "Não encontrou? Adicionar manual"}
                                            </button>
                                        </div>

                                        {!showManualEntry ? (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full px-4 py-4 pl-12 border border-slate-200 rounded-xl text-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                                    placeholder="Digite o nome do material (ex: Cimento, Areia)..."
                                                />
                                                <MagnifyingGlassIcon className="h-6 w-6 text-slate-400 absolute left-4 top-4" />

                                                {/* Sugestões Dropdown */}
                                                {filteredMaterialSuggestions.length > 0 && (
                                                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                        {filteredMaterialSuggestions.map((material) => (
                                                            <button
                                                                key={material.id}
                                                                onClick={() => addToCart(material)}
                                                                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center border-b border-slate-50 last:border-0"
                                                            >
                                                                <span className="font-medium text-slate-700">{material.nome}</span>
                                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{material.unidade}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Material</label>
                                                        <input
                                                            value={manualItem.name}
                                                            onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Ex: Porcelanato 60x60"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Categoria</label>
                                                        <select
                                                            value={manualItem.group}
                                                            onChange={(e) => setManualItem({ ...manualItem, group: e.target.value })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Quantidade</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={manualItem.quantity}
                                                                onChange={(e) => setManualItem({ ...manualItem, quantity: Number(e.target.value) })}
                                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Unidade</label>
                                                            <input
                                                                value={manualItem.unit}
                                                                onChange={(e) => setManualItem({ ...manualItem, unit: e.target.value })}
                                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="unid, m², kg"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Observação</label>
                                                        <input
                                                            value={manualItem.observation}
                                                            onChange={(e) => setManualItem({ ...manualItem, observation: e.target.value })}
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Detalhes técnicos..."
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={addManualItem}
                                                    className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
                                                >
                                                    Adicionar Item
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* MODO ÁRVORE */}
                                {quotationMode === "tree" && (
                                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                            🌳 Navegação por Fases
                                        </h3>

                                        {validFasesForQuotation.length === 0 ? (
                                            <div className="text-center py-8 bg-slate-50 rounded-xl">
                                                <p className="text-slate-500">Nenhuma fase disponível para cotação no momento.</p>
                                                <p className="text-xs text-slate-400 mt-2">Verifique a fase atual e data de recebimento de ofertas da obra.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {validFasesForQuotation.map((fase) => {
                                                    const isFaseExpanded = expandedFases.has(fase.id);
                                                    const servicosDaFase = servicos.filter(s => s.faseIds.includes(fase.id));

                                                    return (
                                                        <div key={fase.id} className="border border-slate-200 rounded-lg overflow-hidden">
                                                            {/* Fase Header */}
                                                            <div
                                                                onClick={() => toggleFase(fase.id)}
                                                                className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 cursor-pointer hover:from-blue-100 hover:to-blue-200 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {isFaseExpanded ? (
                                                                        <ChevronDownIcon className="h-4 w-4 text-blue-600" />
                                                                    ) : (
                                                                        <ChevronRightIcon className="h-4 w-4 text-blue-600" />
                                                                    )}
                                                                    <span className="font-bold text-blue-900">
                                                                        {fase.cronologia}. {fase.nome}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded-full">
                                                                    {servicosDaFase.length} serviços
                                                                </span>
                                                            </div>

                                                            {/* Serviços */}
                                                            {isFaseExpanded && (
                                                                <div className="bg-white">
                                                                    {servicosDaFase.map((servico) => {
                                                                        const isServicoExpanded = expandedServicos.has(servico.id);
                                                                        const gruposDoServico = grupos.filter(g =>
                                                                            servico.gruposInsumoIds.includes(g.id)
                                                                        );

                                                                        return (
                                                                            <div key={servico.id} className="border-t border-slate-100">
                                                                                {/* Serviço Header */}
                                                                                <div
                                                                                    onClick={() => toggleServico(servico.id)}
                                                                                    className="flex items-center justify-between p-3 pl-8 bg-gradient-to-r from-indigo-50 to-indigo-100 cursor-pointer hover:from-indigo-100 hover:to-indigo-200 transition-colors"
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        {isServicoExpanded ? (
                                                                                            <ChevronDownIcon className="h-4 w-4 text-indigo-600" />
                                                                                        ) : (
                                                                                            <ChevronRightIcon className="h-4 w-4 text-indigo-600" />
                                                                                        )}
                                                                                        <span className="font-semibold text-indigo-900 text-sm">
                                                                                            {servico.nome}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className="text-xs bg-indigo-200 text-indigo-700 px-2 py-1 rounded-full">
                                                                                        {gruposDoServico.length} grupos
                                                                                    </span>
                                                                                </div>

                                                                                {/* Grupos */}
                                                                                {isServicoExpanded && (
                                                                                    <div className="bg-white">
                                                                                        {gruposDoServico.map((grupo) => {
                                                                                            const isGrupoExpanded = expandedGrupos.has(grupo.id);
                                                                                            const materiaisDoGrupo = materiais.filter(m =>
                                                                                                m.gruposInsumoIds.includes(grupo.id)
                                                                                            );

                                                                                            return (
                                                                                                <div key={grupo.id} className="border-t border-slate-100">
                                                                                                    {/* Grupo Header */}
                                                                                                    <div
                                                                                                        onClick={() => toggleGrupo(grupo.id)}
                                                                                                        className="flex items-center justify-between p-3 pl-16 bg-gradient-to-r from-violet-50 to-violet-100 cursor-pointer hover:from-violet-100 hover:to-violet-200 transition-colors"
                                                                                                    >
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            {isGrupoExpanded ? (
                                                                                                                <ChevronDownIcon className="h-4 w-4 text-violet-600" />
                                                                                                            ) : (
                                                                                                                <ChevronRightIcon className="h-4 w-4 text-violet-600" />
                                                                                                            )}
                                                                                                            <span className="font-medium text-violet-900 text-sm">
                                                                                                                {grupo.nome}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <span className="text-xs bg-violet-200 text-violet-700 px-2 py-1 rounded-full">
                                                                                                            {materiaisDoGrupo.length} materiais
                                                                                                        </span>
                                                                                                    </div>

                                                                                                    {/* Materiais */}
                                                                                                    {isGrupoExpanded && (
                                                                                                        <div className="bg-white pl-24 pr-4 py-2 space-y-1">
                                                                                                            {materiaisDoGrupo.map((material) => (
                                                                                                                <div
                                                                                                                    key={material.id}
                                                                                                                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                                                                                                >
                                                                                                                    <div className="flex items-center gap-2">
                                                                                                                        <span className="text-sm text-slate-700">
                                                                                                                            {material.nome}
                                                                                                                        </span>
                                                                                                                        <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                                                                                                                            {material.unidade}
                                                                                                                        </span>
                                                                                                                    </div>
                                                                                                                    <button
                                                                                                                        onClick={() => addMaterialFromTree(material, fase.nome, servico.nome)}
                                                                                                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                                                                                                                    >
                                                                                                                        + Adicionar
                                                                                                                    </button>
                                                                                                                </div>
                                                                                                            ))}
                                                                                                            {materiaisDoGrupo.length === 0 && (
                                                                                                                <p className="text-xs text-slate-400 italic py-2">
                                                                                                                    Nenhum material cadastrado neste grupo
                                                                                                                </p>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                        {gruposDoServico.length === 0 && (
                                                                                            <p className="text-xs text-slate-400 italic py-2 pl-16">
                                                                                                Nenhum grupo vinculado a este serviço
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {servicosDaFase.length === 0 && (
                                                                        <p className="text-xs text-slate-400 italic py-2 pl-8">
                                                                            Nenhum serviço cadastrado nesta fase
                                                                        </p>
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

                                {/* Lista do Carrinho */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <ShoppingCartIcon className="h-5 w-5 text-blue-600" />
                                        Itens no Carrinho ({cart.length})
                                    </h3>

                                    {cart.length === 0 ? (
                                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                            <p className="text-slate-500">Seu carrinho está vazio.</p>
                                            <p className="text-sm text-slate-400">Comece buscando materiais acima.</p>
                                        </div>
                                    ) : (
                                        Object.entries(groupedCart).map(([group, items]) => (
                                            <div key={group} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                    <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{group}</span>
                                                    <span className="text-xs text-slate-500">{items.length} itens</span>
                                                </div>
                                                <div className="divide-y divide-slate-100">
                                                    {items.map((item) => (
                                                        <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-slate-900">{item.name}</p>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Adicionar observação..."
                                                                        value={item.observation}
                                                                        onChange={(e) => updateItem(item.id, 'observation', e.target.value)}
                                                                        className="mt-1 w-full text-sm text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none placeholder-slate-400"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            value={item.quantity}
                                                                            onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                                            className="w-16 px-2 py-1 text-center text-sm text-slate-900 focus:outline-none bg-transparent"
                                                                        />
                                                                        <span className="px-2 text-xs text-slate-500 border-l border-slate-200 bg-slate-50 h-full flex items-center rounded-r-lg">
                                                                            {item.unit}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => removeFromCart(item.id)}
                                                                        className="text-slate-400 hover:text-red-500 p-1"
                                                                    >
                                                                        <span className="sr-only">Remover</span>
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Sidebar de Resumo e Ação */}
                            <div className="space-y-6">
                                <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                                    <h3 className="text-lg font-bold mb-2">Resumo da Cotação</h3>
                                    <div className="space-y-2 mb-6 text-blue-100 text-sm">
                                        <div className="flex justify-between">
                                            <span>Itens totais</span>
                                            <span className="font-semibold">{cart.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Grupos</span>
                                            <span className="font-semibold">{Object.keys(groupedCart).length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Obra</span>
                                            <span className="font-semibold truncate max-w-[150px]">
                                                {selectedWork ? works.find(w => w.id === selectedWork)?.nome : "Não selecionada"}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCurrentView("analysis")}
                                        disabled={cart.length === 0}
                                        className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                    >
                                        Analisar Lista →
                                    </button>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                    <div className="flex items-start gap-3">
                                        <WrenchScrewdriverIcon className="h-6 w-6 text-orange-500 mt-1" />
                                        <div>
                                            <h4 className="font-semibold text-slate-900 text-sm">Dica do Especialista</h4>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Agrupar materiais da mesma fase (ex: elétrica e hidráulica) pode aumentar seu poder de negociação com fornecedores Especializados.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    }

    if (currentView === "success") {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 bg-white rounded-lg border border-gray-200">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Solicitação Enviada!</h2>
                    <p className="text-gray-600 mt-2 max-w-md">
                        Sua solicitação de cotação foi enviada para os fornecedores parceiros.
                        Você será notificado assim que as propostas chegarem.
                    </p>
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={() => {
                            setCart([]);
                            setSearchTerm("");
                            setCurrentView("search");
                        }}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                    >
                        Nova Cotação
                    </button>
                    <button
                        onClick={() => {
                            // Idealmente redirecionaria para a aba de pedidos
                            // Como estamos no mesmo componente, apenas resetamos por enquanto
                            setCart([]);
                            setSearchTerm("");
                            setCurrentView("search");
                        }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        Ir para Meus Pedidos
                    </button>
                </div>
            </div>
        );
    }

    if (currentView === "analysis") {
        return (
            <div className="space-y-6">
                {/* Navigation */}
                <div className="flex items-center space-x-2 text-sm text-slate-800">
                    <button onClick={() => setCurrentView("search")} className="hover:text-blue-600">Lista de Materiais</button>
                    <span>→</span>
                    <span className="text-blue-600 font-medium">Análise Técnica</span>
                    <span>→</span>
                    <span className="text-slate-600">Solicitação</span>
                </div>

                {/* Header */}
                <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Análise Técnica e Sugestões</h2>
                    <p className="text-slate-900 max-w-2xl mx-auto">
                        Eliminamos a incerteza apresentando opções técnicas claras e embasadas.
                        Veja onde estão as oportunidades de redução de custos.
                    </p>
                </div>

                {/* Resumo da lista */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <ShoppingCartIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-700">Total de Itens</p>
                                <p className="text-2xl font-semibold text-slate-900">{cart.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <WrenchScrewdriverIcon className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-700">Grupos Técnicos</p>
                                <p className="text-2xl font-semibold text-slate-900">{Object.keys(groupedCart).length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-700">Economia Estimada</p>
                                <p className="text-2xl font-semibold text-green-600">15-25%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Análise por grupos */}
                <div className="space-y-4">
                    {Object.entries(groupedCart).map(([group, items]) => (
                        <div key={group} className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-slate-900">{group}</h3>
                                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Lista de itens */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3">Materiais Solicitados</h4>
                                    <div className="space-y-2">
                                        {items.map((item) => (
                                            <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                                                    <span className="text-xs text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                                                        {item.quantity} {item.unit}
                                                    </span>
                                                </div>
                                                {item.observation && (
                                                    <p className="text-xs text-slate-500 mt-1 italic">Obs: {item.observation}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Oportunidades identificadas */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3">Oportunidades Identificadas</h4>
                                    <div className="space-y-2">
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span className="text-sm font-medium text-green-800">Compra em Volume</span>
                                            </div>
                                            <p className="text-xs text-green-700 mt-1">Economia de 8-12% possível</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-sm font-medium text-blue-800">Antecipação Recomendada</span>
                                            </div>
                                            <p className="text-xs text-blue-700 mt-1">Comprar 5-7 dias antes do uso</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Padrões técnicos */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3">Padrões Técnicos</h4>
                                    <div className="space-y-2">
                                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-sm font-medium text-purple-800">Qualidade Garantida</span>
                                            </div>
                                            <p className="text-xs text-purple-700 mt-1">Materiais certificados ABNT</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Ações */}
                <div className="flex justify-between pt-6">
                    <button
                        onClick={() => setCurrentView("search")}
                        className="px-6 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
                    >
                        ← Voltar à Lista
                    </button>
                    <button
                        onClick={handleSendQuotation}
                        className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold shadow-lg shadow-green-200 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Enviar Solicitação de Cotação
                    </button>
                </div>
            </div>
        );
    }



    return null;
}
