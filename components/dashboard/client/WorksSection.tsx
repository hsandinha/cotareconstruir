"use client";

import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { formatCepBr } from "../../../lib/utils";
import {
    Building2, MapPin, Calendar, Clock, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
    CheckCircle2, Circle, AlertCircle, Loader2, Save, X, Search, Eye, EyeOff
} from "lucide-react";

// Tipos
type Obra = {
    id: string;
    nome: string;
    descricao?: string;
    tipo?: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    data_inicio?: string;
    data_previsao_fim?: string;
    status: string;
    created_at: string;
    restricoes_entrega?: string;
    horario_entrega?: Record<string, DaySchedule>;
};

type DaySchedule = {
    enabled: boolean;
    startTime: string;
    endTime: string;
};

type WeekSchedule = {
    [key: string]: DaySchedule;
};

type ObraEtapa = {
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
};

type Fase = {
    id: string;
    nome: string;
    ordem: number;
};

export function ClientWorksSection() {
    const { user, initialized } = useAuth();

    // Estados principais
    const [obras, setObras] = useState<Obra[]>([]);
    const [obraEtapas, setObraEtapas] = useState<Record<string, ObraEtapa[]>>({});
    const [fases, setFases] = useState<Fase[]>([]);
    const [loading, setLoading] = useState(true);

    // Estados de UI
    const [expandedObra, setExpandedObra] = useState<string | null>(null);
    const [showObraForm, setShowObraForm] = useState(false);
    const [showEtapaModal, setShowEtapaModal] = useState(false);
    const [editingObra, setEditingObra] = useState<Obra | null>(null);
    const [selectedObraId, setSelectedObraId] = useState<string | null>(null);

    // Estados de loading
    const [savingObra, setSavingObra] = useState(false);
    const [savingEtapa, setSavingEtapa] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    // Formulário de obra
    const [obraForm, setObraForm] = useState({
        nome: "",
        descricao: "",
        tipo: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        data_inicio: "",
        data_previsao_fim: "",
        restricoes_entrega: "",
    });

    // Horário de entrega
    const [deliverySchedule, setDeliverySchedule] = useState<WeekSchedule>({
        segunda: { enabled: true, startTime: "08:00", endTime: "17:00" },
        terca: { enabled: true, startTime: "08:00", endTime: "17:00" },
        quarta: { enabled: true, startTime: "08:00", endTime: "17:00" },
        quinta: { enabled: true, startTime: "08:00", endTime: "17:00" },
        sexta: { enabled: true, startTime: "08:00", endTime: "17:00" },
        sabado: { enabled: false, startTime: "08:00", endTime: "12:00" },
        domingo: { enabled: false, startTime: "08:00", endTime: "12:00" },
    });

    const dayLabels: Record<string, string> = {
        segunda: "Segunda-feira",
        terca: "Terça-feira",
        quarta: "Quarta-feira",
        quinta: "Quinta-feira",
        sexta: "Sexta-feira",
        sabado: "Sábado",
        domingo: "Domingo",
    };

    // Formulário de etapa
    const [etapaForm, setEtapaForm] = useState({
        fase_id: "",
        data_prevista: "",
        data_fim_prevista: "",
        dias_antecedencia_cotacao: 15,
    });

    // Carregar dados iniciais
    useEffect(() => {
        if (!initialized || !user) {
            setLoading(false);
            return;
        }

        loadData();
    }, [user, initialized]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Carregar fases
            const { data: fasesData } = await supabase
                .from('fases')
                .select('id, nome, cronologia')
                .order('cronologia', { ascending: true });

            setFases((fasesData || []).map(f => ({
                id: f.id,
                nome: f.nome,
                ordem: f.cronologia || 0
            })));

            // Carregar obras do usuário
            const { data: obrasData, error: obrasError } = await supabase
                .from('obras')
                .select('*')
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false });

            if (obrasError) throw obrasError;

            const obrasList = obrasData || [];
            setObras(obrasList);

            // Carregar etapas de todas as obras
            if (obrasList.length > 0) {
                const obraIds = obrasList.map(o => o.id);
                const { data: etapasData } = await supabase
                    .from('obra_etapas')
                    .select('*')
                    .in('obra_id', obraIds)
                    .order('ordem', { ascending: true });

                const etapasPorObra: Record<string, ObraEtapa[]> = {};
                (etapasData || []).forEach((etapa: ObraEtapa) => {
                    if (!etapasPorObra[etapa.obra_id]) {
                        etapasPorObra[etapa.obra_id] = [];
                    }
                    etapasPorObra[etapa.obra_id].push(etapa);
                });
                setObraEtapas(etapasPorObra);
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    // Buscar CEP
    const handleCepLookup = async () => {
        const clean = obraForm.cep.replace(/\D/g, "");
        if (clean.length !== 8) return;

        setLoadingCep(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();

            setObraForm(prev => ({
                ...prev,
                cep: formatCepBr(clean),
                logradouro: data.street || "",
                bairro: data.neighborhood || "",
                cidade: data.city || "",
                estado: data.state || "",
            }));
        } catch {
            alert("CEP não encontrado.");
        } finally {
            setLoadingCep(false);
        }
    };

    // Salvar obra
    const handleSaveObra = async (e: FormEvent) => {
        e.preventDefault();
        if (!user || !obraForm.nome.trim()) return;

        setSavingObra(true);
        try {
            const obraData = {
                nome: obraForm.nome,
                descricao: obraForm.descricao || null,
                tipo: obraForm.tipo || null,
                cep: obraForm.cep?.replace(/\D/g, '') || null,
                logradouro: obraForm.logradouro || null,
                numero: obraForm.numero || null,
                complemento: obraForm.complemento || null,
                bairro: obraForm.bairro || null,
                cidade: obraForm.cidade || null,
                estado: obraForm.estado || null,
                data_inicio: obraForm.data_inicio || null,
                data_previsao_fim: obraForm.data_previsao_fim || null,
                restricoes_entrega: obraForm.restricoes_entrega || null,
                horario_entrega: deliverySchedule,
                status: 'ativa',
            };

            if (editingObra) {
                const { error } = await supabase
                    .from('obras')
                    .update({ ...obraData, updated_at: new Date().toISOString() })
                    .eq('id', editingObra.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('obras')
                    .insert({ ...obraData, user_id: user.id });

                if (error) throw error;
            }

            resetObraForm();
            await loadData();
        } catch (error) {
            console.error("Erro ao salvar obra:", error);
            alert("Erro ao salvar obra.");
        } finally {
            setSavingObra(false);
        }
    };

    // Salvar etapa
    const handleSaveEtapa = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedObraId || !etapaForm.fase_id || !etapaForm.data_prevista) return;

        const fase = fases.find(f => f.id === etapaForm.fase_id);
        if (!fase) return;

        setSavingEtapa(true);
        try {
            const currentEtapas = obraEtapas[selectedObraId] || [];
            const nextOrdem = currentEtapas.length > 0
                ? Math.max(...currentEtapas.map(e => e.ordem)) + 1
                : 1;

            const { error } = await supabase
                .from('obra_etapas')
                .insert({
                    obra_id: selectedObraId,
                    fase_id: etapaForm.fase_id,
                    nome: fase.nome,
                    categoria: 'Fase da Obra',
                    data_prevista: etapaForm.data_prevista,
                    data_fim_prevista: etapaForm.data_fim_prevista || null,
                    dias_antecedencia_cotacao: etapaForm.dias_antecedencia_cotacao,
                    is_completed: false,
                    ordem: nextOrdem,
                });

            if (error) throw error;

            resetEtapaForm();
            await loadData();
        } catch (error) {
            console.error("Erro ao adicionar etapa:", error);
            alert("Erro ao adicionar etapa.");
        } finally {
            setSavingEtapa(false);
        }
    };

    // Toggle conclusão da etapa
    const toggleEtapaCompletion = async (etapa: ObraEtapa) => {
        const newCompleted = !etapa.is_completed;
        try {
            const { error } = await supabase
                .from('obra_etapas')
                .update({
                    is_completed: newCompleted,
                    data_conclusao: newCompleted ? new Date().toISOString().split('T')[0] : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', etapa.id);

            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error("Erro ao atualizar etapa:", error);
        }
    };

    // Deletar obra
    const handleDeleteObra = async (obraId: string) => {
        if (!confirm("Tem certeza que deseja excluir esta obra e todas as suas etapas?")) return;

        try {
            const { error } = await supabase.from('obras').delete().eq('id', obraId);
            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error("Erro ao excluir obra:", error);
            alert("Erro ao excluir obra.");
        }
    };

    // Deletar etapa
    const handleDeleteEtapa = async (etapaId: string) => {
        if (!confirm("Excluir esta etapa?")) return;

        try {
            const { error } = await supabase.from('obra_etapas').delete().eq('id', etapaId);
            if (error) throw error;
            await loadData();
        } catch (error) {
            console.error("Erro ao excluir etapa:", error);
        }
    };

    // Reset forms
    const resetObraForm = () => {
        setObraForm({
            nome: "", descricao: "", tipo: "", cep: "", logradouro: "", numero: "",
            complemento: "", bairro: "", cidade: "", estado: "", data_inicio: "", data_previsao_fim: "",
            restricoes_entrega: ""
        });
        setDeliverySchedule({
            segunda: { enabled: true, startTime: "08:00", endTime: "17:00" },
            terca: { enabled: true, startTime: "08:00", endTime: "17:00" },
            quarta: { enabled: true, startTime: "08:00", endTime: "17:00" },
            quinta: { enabled: true, startTime: "08:00", endTime: "17:00" },
            sexta: { enabled: true, startTime: "08:00", endTime: "17:00" },
            sabado: { enabled: false, startTime: "08:00", endTime: "12:00" },
            domingo: { enabled: false, startTime: "08:00", endTime: "12:00" },
        });
        setEditingObra(null);
        setShowObraForm(false);
    };

    const resetEtapaForm = () => {
        setEtapaForm({ fase_id: "", data_prevista: "", data_fim_prevista: "", dias_antecedencia_cotacao: 15 });
        setShowEtapaModal(false);
        setSelectedObraId(null);
    };

    // Editar obra
    const handleEditObra = (obra: Obra) => {
        setObraForm({
            nome: obra.nome || "",
            descricao: obra.descricao || "",
            tipo: obra.tipo || "",
            cep: formatCepBr(obra.cep || ""),
            logradouro: obra.logradouro || "",
            numero: obra.numero || "",
            complemento: obra.complemento || "",
            bairro: obra.bairro || "",
            cidade: obra.cidade || "",
            estado: obra.estado || "",
            data_inicio: obra.data_inicio || "",
            data_previsao_fim: obra.data_previsao_fim || "",
            restricoes_entrega: obra.restricoes_entrega || "",
        });
        // Carregar horários salvos ou usar padrão
        if (obra.horario_entrega) {
            setDeliverySchedule(obra.horario_entrega);
        } else {
            setDeliverySchedule({
                segunda: { enabled: true, startTime: "08:00", endTime: "17:00" },
                terca: { enabled: true, startTime: "08:00", endTime: "17:00" },
                quarta: { enabled: true, startTime: "08:00", endTime: "17:00" },
                quinta: { enabled: true, startTime: "08:00", endTime: "17:00" },
                sexta: { enabled: true, startTime: "08:00", endTime: "17:00" },
                sabado: { enabled: false, startTime: "08:00", endTime: "12:00" },
                domingo: { enabled: false, startTime: "08:00", endTime: "12:00" },
            });
        }
        setEditingObra(obra);
        setShowObraForm(true);
    };

    // Abrir modal de etapa
    const openEtapaModal = (obraId: string) => {
        setSelectedObraId(obraId);
        setShowEtapaModal(true);
    };

    // Helpers
    const formatDate = (date?: string) => {
        if (!date) return "-";
        return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
    };

    const calculateQuotationDate = (date: string, days: number) => {
        const d = new Date(date + 'T00:00:00');
        d.setDate(d.getDate() - days);
        return d.toLocaleDateString('pt-BR');
    };

    const getProgressPercent = (etapas: ObraEtapa[]) => {
        if (!etapas || etapas.length === 0) return 0;
        const completed = etapas.filter(e => e.is_completed).length;
        return Math.round((completed / etapas.length) * 100);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-slate-600">Carregando obras...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Minhas Obras</h1>
                    <p className="text-sm text-slate-500 mt-1">Gerencie suas obras e cronograma de etapas</p>
                </div>
                <button
                    onClick={() => { resetObraForm(); setShowObraForm(true); }}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Nova Obra
                </button>
            </div>

            {/* Lista de Obras */}
            {obras.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700">Nenhuma obra cadastrada</h3>
                    <p className="text-sm text-slate-500 mt-1 mb-4">Comece cadastrando sua primeira obra</p>
                    <button
                        onClick={() => setShowObraForm(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" />
                        Cadastrar Obra
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {obras.map(obra => {
                        const etapas = obraEtapas[obra.id] || [];
                        const isExpanded = expandedObra === obra.id;
                        const progress = getProgressPercent(etapas);

                        return (
                            <div key={obra.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                {/* Card Header */}
                                <div className="p-5 bg-gradient-to-r from-slate-50 to-white">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-slate-900 truncate">{obra.nome}</h3>
                                                    {obra.bairro && (
                                                        <p className="text-sm text-slate-500 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />
                                                            {obra.bairro}{obra.cidade ? ` • ${obra.cidade}` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info badges */}
                                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                                {obra.tipo && (
                                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                                        {obra.tipo}
                                                    </span>
                                                )}
                                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${obra.status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {obra.status === 'ativa' ? 'Ativa' : obra.status}
                                                </span>
                                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                                    {etapas.length} etapa{etapas.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress circle */}
                                        <div className="flex items-center gap-4">
                                            <div className="text-center">
                                                <div className="relative w-14 h-14">
                                                    <svg className="w-14 h-14 transform -rotate-90">
                                                        <circle cx="28" cy="28" r="24" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                                                        <circle cx="28" cy="28" r="24" stroke={progress === 100 ? "#22c55e" : "#3b82f6"}
                                                            strokeWidth="4" fill="none"
                                                            strokeDasharray={`${progress * 1.51} 151`}
                                                            className="transition-all duration-500" />
                                                    </svg>
                                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                                                        {progress}%
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1">Progresso</p>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setExpandedObra(isExpanded ? null : obra.id)}
                                                    className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
                                                >
                                                    {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    {isExpanded ? "Ocultar" : "Detalhes"}
                                                </button>
                                                <button
                                                    onClick={() => handleEditObra(obra)}
                                                    className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteObra(obra.id)}
                                                    className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100">
                                        {/* Detalhes da Obra */}
                                        <div className="p-5 bg-slate-50/50">
                                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                <Building2 className="w-4 h-4" />
                                                Detalhes da Obra
                                            </h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-500">Tipo</p>
                                                    <p className="text-sm font-medium text-slate-900">{obra.tipo || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Data Início</p>
                                                    <p className="text-sm font-medium text-slate-900">{formatDate(obra.data_inicio)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Previsão Fim</p>
                                                    <p className="text-sm font-medium text-slate-900">{formatDate(obra.data_previsao_fim)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Status</p>
                                                    <p className="text-sm font-medium text-slate-900">{obra.status}</p>
                                                </div>
                                            </div>

                                            {/* Endereço */}
                                            {(obra.logradouro || obra.bairro) && (
                                                <div className="mt-4 pt-4 border-t border-slate-200">
                                                    <h5 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> ENDEREÇO
                                                    </h5>
                                                    <p className="text-sm text-slate-700">
                                                        {[
                                                            obra.logradouro,
                                                            obra.numero && `nº ${obra.numero}`,
                                                            obra.complemento,
                                                            obra.bairro,
                                                            obra.cidade && obra.estado && `${obra.cidade}/${obra.estado}`,
                                                            obra.cep && `CEP: ${formatCepBr(obra.cep)}`
                                                        ].filter(Boolean).join(', ')}
                                                    </p>
                                                </div>
                                            )}

                                            {obra.descricao && (
                                                <div className="mt-4 pt-4 border-t border-slate-200">
                                                    <h5 className="text-xs font-semibold text-slate-500 mb-2">DESCRIÇÃO / CENTRO DE CUSTOS</h5>
                                                    <p className="text-sm text-slate-700">{obra.descricao}</p>
                                                </div>
                                            )}

                                            {/* Horários de Entrega */}
                                            {obra.horario_entrega && (
                                                <div className="mt-4 pt-4 border-t border-slate-200">
                                                    <h5 className="text-xs font-semibold text-slate-500 mb-3 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> HORÁRIO DE ENTREGAS
                                                    </h5>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                        {Object.entries(obra.horario_entrega).map(([day, schedule]) => {
                                                            const s = schedule as DaySchedule;
                                                            if (!s.enabled) return null;
                                                            return (
                                                                <div key={day} className="rounded-lg bg-blue-50 px-3 py-2 text-xs">
                                                                    <span className="font-medium text-blue-700">{dayLabels[day]?.slice(0, 3)}</span>
                                                                    <span className="text-blue-600 ml-1">{s.startTime} - {s.endTime}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {obra.restricoes_entrega && (
                                                        <p className="mt-2 text-xs text-orange-600 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" />
                                                            {obra.restricoes_entrega}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Etapas */}
                                        <div className="p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    Cronograma de Etapas ({etapas.length})
                                                </h4>
                                                <button
                                                    onClick={() => openEtapaModal(obra.id)}
                                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Adicionar Etapa
                                                </button>
                                            </div>

                                            {etapas.length === 0 ? (
                                                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                                                    <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                                    <p className="text-sm text-slate-500">Nenhuma etapa cadastrada</p>
                                                    <p className="text-xs text-slate-400 mt-1">Adicione etapas para organizar o cronograma</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {etapas.map((etapa, index) => (
                                                        <div
                                                            key={etapa.id}
                                                            className={`rounded-xl border p-4 transition-all ${etapa.is_completed
                                                                    ? 'border-green-200 bg-green-50'
                                                                    : 'border-slate-200 bg-white hover:border-blue-200'
                                                                }`}
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <button
                                                                    onClick={() => toggleEtapaCompletion(etapa)}
                                                                    className={`mt-0.5 flex-shrink-0 transition-colors ${etapa.is_completed ? 'text-green-600' : 'text-slate-300 hover:text-green-500'
                                                                        }`}
                                                                >
                                                                    {etapa.is_completed ? (
                                                                        <CheckCircle2 className="w-6 h-6" />
                                                                    ) : (
                                                                        <Circle className="w-6 h-6" />
                                                                    )}
                                                                </button>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div>
                                                                            <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                                                                            <h5 className={`font-medium ${etapa.is_completed ? 'text-green-800 line-through' : 'text-slate-900'}`}>
                                                                                {etapa.nome}
                                                                            </h5>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteEtapa(etapa.id)}
                                                                            className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>

                                                                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                                                                        <div className="flex items-center gap-1 text-blue-600">
                                                                            <Calendar className="w-3 h-3" />
                                                                            <span>Previsão: <strong>{formatDate(etapa.data_prevista)}</strong></span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-orange-600">
                                                                            <Clock className="w-3 h-3" />
                                                                            <span>Cotações: <strong>{calculateQuotationDate(etapa.data_prevista, etapa.dias_antecedencia_cotacao)}</strong></span>
                                                                        </div>
                                                                        <div className="text-slate-500">
                                                                            Antecedência: {etapa.dias_antecedencia_cotacao} dias
                                                                        </div>
                                                                    </div>

                                                                    {etapa.is_completed && etapa.data_conclusao && (
                                                                        <p className="mt-2 text-xs text-green-700">
                                                                            ✓ Concluída em {formatDate(etapa.data_conclusao)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Formulário de Obra */}
            {showObraForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {editingObra ? "Editar Obra" : "Nova Obra"}
                                </h2>
                                <p className="text-sm text-slate-500">Preencha os dados da obra</p>
                            </div>
                            <button onClick={resetObraForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveObra} className="p-5 space-y-5">
                            {/* Nome */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Nome da Obra *</label>
                                <input
                                    value={obraForm.nome}
                                    onChange={e => setObraForm({ ...obraForm, nome: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Ex: Residência João Silva"
                                    required
                                />
                            </div>

                            {/* Tipo e Descrição */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Tipo de Obra</label>
                                    <select
                                        value={obraForm.tipo}
                                        onChange={e => setObraForm({ ...obraForm, tipo: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="Residencial">Residencial</option>
                                        <option value="Comercial">Comercial</option>
                                        <option value="Industrial">Industrial</option>
                                        <option value="Reforma">Reforma</option>
                                        <option value="Outro">Outro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Centro de Custos</label>
                                    <input
                                        value={obraForm.descricao}
                                        onChange={e => setObraForm({ ...obraForm, descricao: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                        placeholder="Código ou descrição"
                                    />
                                </div>
                            </div>

                            {/* Datas */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Data Início</label>
                                    <input
                                        type="date"
                                        value={obraForm.data_inicio}
                                        onChange={e => setObraForm({ ...obraForm, data_inicio: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Previsão Término</label>
                                    <input
                                        type="date"
                                        value={obraForm.data_previsao_fim}
                                        onChange={e => setObraForm({ ...obraForm, data_previsao_fim: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Endereço */}
                            <div className="border-t border-slate-200 pt-5">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> Endereço da Obra
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">CEP</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={obraForm.cep}
                                                onChange={e => setObraForm({ ...obraForm, cep: formatCepBr(e.target.value) })}
                                                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                placeholder="00000-000"
                                                maxLength={9}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCepLookup}
                                                disabled={loadingCep}
                                                className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                                            >
                                                {loadingCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                                Buscar
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Logradouro</label>
                                        <input
                                            value={obraForm.logradouro}
                                            onChange={e => setObraForm({ ...obraForm, logradouro: e.target.value })}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                            placeholder="Rua, Avenida..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Número</label>
                                            <input
                                                value={obraForm.numero}
                                                onChange={e => setObraForm({ ...obraForm, numero: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                placeholder="123"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Complemento</label>
                                            <input
                                                value={obraForm.complemento}
                                                onChange={e => setObraForm({ ...obraForm, complemento: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                placeholder="Apto, Bloco..."
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Bairro</label>
                                            <input
                                                value={obraForm.bairro}
                                                onChange={e => setObraForm({ ...obraForm, bairro: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                placeholder="Bairro"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Cidade</label>
                                            <input
                                                value={obraForm.cidade}
                                                onChange={e => setObraForm({ ...obraForm, cidade: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                                placeholder="Cidade"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">UF</label>
                                            <select
                                                value={obraForm.estado}
                                                onChange={e => setObraForm({ ...obraForm, estado: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                            >
                                                <option value="">UF</option>
                                                {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map(uf => (
                                                    <option key={uf} value={uf}>{uf}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Horário de Entregas */}
                            <div className="border-t border-slate-200 pt-5">
                                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Horários de Entrega de Materiais
                                </h3>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Restrições de Entrega</label>
                                    <textarea
                                        value={obraForm.restricoes_entrega}
                                        onChange={e => setObraForm({ ...obraForm, restricoes_entrega: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                        placeholder="Ex: Não há elevador, entrar pela lateral..."
                                        rows={2}
                                    />
                                </div>

                                <div className="mt-4 space-y-3">
                                    {Object.entries(deliverySchedule).map(([day, schedule]) => (
                                        <div key={day} className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 w-36">
                                                <input
                                                    type="checkbox"
                                                    checked={schedule.enabled}
                                                    onChange={() => setDeliverySchedule(prev => ({
                                                        ...prev,
                                                        [day]: { ...prev[day], enabled: !prev[day].enabled }
                                                    }))}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className={`text-sm ${schedule.enabled ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                                                    {dayLabels[day]}
                                                </span>
                                            </label>

                                            {schedule.enabled && (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="time"
                                                        value={schedule.startTime}
                                                        onChange={e => setDeliverySchedule(prev => ({
                                                            ...prev,
                                                            [day]: { ...prev[day], startTime: e.target.value }
                                                        }))}
                                                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                                                    />
                                                    <span className="text-slate-400">às</span>
                                                    <input
                                                        type="time"
                                                        value={schedule.endTime}
                                                        onChange={e => setDeliverySchedule(prev => ({
                                                            ...prev,
                                                            [day]: { ...prev[day], endTime: e.target.value }
                                                        }))}
                                                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Botões */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={resetObraForm}
                                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingObra}
                                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {savingObra ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editingObra ? "Salvar Alterações" : "Cadastrar Obra"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Adicionar Etapa */}
            {showEtapaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Adicionar Etapa</h2>
                                <p className="text-sm text-slate-500">Planeje quando a etapa será executada</p>
                            </div>
                            <button onClick={resetEtapaForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEtapa} className="p-5 space-y-5">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Etapa / Fase *</label>
                                <select
                                    value={etapaForm.fase_id}
                                    onChange={e => setEtapaForm({ ...etapaForm, fase_id: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    required
                                >
                                    <option value="">Selecione a fase...</option>
                                    {fases.map(fase => (
                                        <option key={fase.id} value={fase.id}>
                                            {fase.ordem}. {fase.nome}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Data Início *</label>
                                    <input
                                        type="date"
                                        value={etapaForm.data_prevista}
                                        onChange={e => setEtapaForm({ ...etapaForm, data_prevista: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Data Fim</label>
                                    <input
                                        type="date"
                                        value={etapaForm.data_fim_prevista}
                                        onChange={e => setEtapaForm({ ...etapaForm, data_fim_prevista: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    Antecedência para Cotações (dias)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={etapaForm.dias_antecedencia_cotacao}
                                    onChange={e => setEtapaForm({ ...etapaForm, dias_antecedencia_cotacao: parseInt(e.target.value) || 15 })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                />
                                {etapaForm.data_prevista && (
                                    <p className="mt-2 text-xs text-orange-600">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        Início do recebimento: {calculateQuotationDate(etapaForm.data_prevista, etapaForm.dias_antecedencia_cotacao)}
                                    </p>
                                )}
                            </div>

                            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-blue-900">Planejamento de Suprimentos</h4>
                                        <p className="text-xs text-blue-700 mt-1">
                                            A antecedência permite que você compare preços com calma, negocie melhores condições
                                            e garanta a disponibilidade dos materiais antes do início da etapa.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={resetEtapaForm}
                                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEtapa}
                                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {savingEtapa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Adicionar Etapa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
