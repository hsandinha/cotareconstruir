"use client";

import { useState, useEffect, type FormEvent } from "react";
import { PlusIcon, CalendarIcon, CheckCircleIcon, ClockIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Work, WorkStage } from "../../../lib/clientDashboardMocks";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { formatCepBr } from "../../../lib/utils";

type DaySchedule = {
    enabled: boolean;
    startTime: string;
    endTime: string;
};

type WeekSchedule = {
    [key: string]: DaySchedule;
};

export function ClientWorksSection() {
    const { user, initialized } = useAuth();
    const [works, setWorks] = useState<Work[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedWork, setSelectedWork] = useState<string | number | null>(null);
    const [showStageModal, setShowStageModal] = useState(false);
    const [isWorkFormVisible, setIsWorkFormVisible] = useState(false);
    const [editingWorkId, setEditingWorkId] = useState<string | number | null>(null);
    const [collapsedWorks, setCollapsedWorks] = useState<Record<string | number, boolean>>({});
    const [fases, setFases] = useState<Array<{ id: string; nome: string; ordem: number }>>([]);
    const [form, setForm] = useState({
        obra: "",
        centroCustos: "",
        cep: "",
        bairro: "",
        cidade: "",
        endereco: "",
        numero: "",
        complemento: "",
        restricoesEntrega: "",
        etapa: "",
        tipoObra: "",
        area: "",
        padrao: "",
        dataInicio: "",
        previsaoTermino: "",
        diasAntecedenciaOferta: 15,
        horarioEntrega: "",
    });
    const [deliverySchedule, setDeliverySchedule] = useState<WeekSchedule>({
        monday: { enabled: true, startTime: "08:00", endTime: "17:00" },
        tuesday: { enabled: true, startTime: "08:00", endTime: "17:00" },
        wednesday: { enabled: true, startTime: "08:00", endTime: "17:00" },
        thursday: { enabled: true, startTime: "08:00", endTime: "17:00" },
        friday: { enabled: true, startTime: "08:00", endTime: "17:00" },
        saturday: { enabled: false, startTime: "08:00", endTime: "12:00" },
        sunday: { enabled: false, startTime: "08:00", endTime: "12:00" },
    });
    const [stageForm, setStageForm] = useState({
        stageId: "",
        predictedDate: "",
        endDate: "",
        quotationAdvanceDays: 15,
    });

    useEffect(() => {
        // Carregar fases do Supabase
        const loadFases = async () => {
            try {
                const { data, error } = await supabase
                    .from('fases')
                    .select('id, nome, cronologia')
                    .order('cronologia', { ascending: true });

                if (error) throw error;

                const fasesData = (data || []).map(doc => ({
                    id: doc.id,
                    nome: doc.nome,
                    ordem: doc.cronologia || 0
                }));
                setFases(fasesData);
            } catch (error) {
                console.error("Erro ao carregar fases:", error);
            }
        };

        loadFases();
    }, []);

    // Carregar obras do usuário com realtime
    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            setWorks([]);
            setLoading(false);
            return;
        }

        // Buscar obras inicialmente
        const fetchWorks = async () => {
            const { data, error } = await supabase
                .from('works')
                .select('*')
                .eq('user_id', user.id);

            if (error) {
                console.error("Erro ao carregar obras:", error);
                setWorks([]);
            } else {
                const worksData = (data || []).map(doc => ({
                    id: doc.id,
                    ...doc
                })) as unknown as Work[];
                setWorks(worksData);
            }
            setLoading(false);
        };

        fetchWorks();

        // Configurar subscription realtime
        const channel = supabase
            .channel('works_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'works',
                    filter: `user_id=eq.${user.id}`
                },
                async () => {
                    // Recarregar dados quando houver mudanças
                    const { data } = await supabase
                        .from('works')
                        .select('*')
                        .eq('user_id', user.id);

                    const worksData = (data || []).map(doc => ({
                        id: doc.id,
                        ...doc
                    })) as unknown as Work[];
                    setWorks(worksData);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, initialized]);

    const dayNames: { [key: string]: string } = {
        monday: "Segunda",
        tuesday: "Terça",
        wednesday: "Quarta",
        thursday: "Quinta",
        friday: "Sexta",
        saturday: "Sábado",
        sunday: "Domingo",
    };

    const toggleDeliveryDay = (day: string) => {
        setDeliverySchedule((prev) => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled },
        }));
    };

    const updateDeliveryTime = (day: string, field: "startTime" | "endTime", value: string) => {
        setDeliverySchedule((prev) => ({
            ...prev,
            [day]: { ...prev[day], [field]: value },
        }));
    };

    const handleCepLookup = async (cepValue: string) => {
        const clean = (cepValue || "").replace(/\D/g, "");
        if (clean.length !== 8) return;

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();
            setForm((prev) => ({
                ...prev,
                cep: formatCepBr(clean),
                bairro: data.neighborhood || prev.bairro,
                cidade: data.city && data.state ? `${data.city} - ${data.state}` : prev.cidade,
                endereco: data.street || prev.endereco,
            }));
        } catch (error) {
            alert("Não foi possível buscar o CEP. Verifique o número ou tente novamente.");
        }
    };

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!form.obra || !form.bairro || !user) return;

        // Calcular data de início de recebimento de oferta
        let inicioRecebimentoOferta = "";
        if (form.dataInicio && form.diasAntecedenciaOferta) {
            const date = new Date(form.dataInicio);
            date.setDate(date.getDate() - form.diasAntecedenciaOferta);
            inicioRecebimentoOferta = date.toISOString().split('T')[0];
        }

        try {
            if (editingWorkId) {
                // Atualizar obra existente
                const { error } = await supabase
                    .from('works')
                    .update({
                        ...form,
                        inicio_recebimento_oferta: inicioRecebimentoOferta,
                        delivery_schedule: deliverySchedule,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', String(editingWorkId));

                if (error) throw error;
            } else {
                // Criar nova obra
                const { error } = await supabase
                    .from('works')
                    .insert({
                        ...form,
                        inicio_recebimento_oferta: inicioRecebimentoOferta,
                        user_id: user.id,
                        stages: [],
                        delivery_schedule: deliverySchedule,
                        created_at: new Date().toISOString(),
                    });

                if (error) throw error;
            }

            setForm({
                obra: "",
                centroCustos: "",
                cep: "",
                bairro: "",
                cidade: "",
                endereco: "",
                numero: "",
                complemento: "",
                restricoesEntrega: "",
                etapa: "",
                tipoObra: "",
                area: "",
                padrao: "",
                dataInicio: "",
                previsaoTermino: "",
                diasAntecedenciaOferta: 15,
                horarioEntrega: "",
            });
            setEditingWorkId(null);
            setIsWorkFormVisible(false);
        } catch (error) {
            console.error("Erro ao salvar obra:", error);
            alert("Erro ao salvar obra.");
        }
    }

    function handleEditWork(work: Work) {
        setForm({
            obra: work.obra || "",
            centroCustos: work.centroCustos || "",
            cep: work.cep || "",
            bairro: work.bairro || "",
            cidade: work.cidade || "",
            endereco: work.endereco || "",
            numero: work.numero || "",
            complemento: work.complemento || "",
            restricoesEntrega: work.restricoesEntrega || "",
            etapa: work.etapa || "",
            tipoObra: work.tipoObra || "",
            area: work.area || "",
            padrao: work.padrao || "",
            dataInicio: work.dataInicio || "",
            previsaoTermino: work.previsaoTermino || "",
            diasAntecedenciaOferta: work.diasAntecedenciaOferta || 15,
            horarioEntrega: work.horarioEntrega || "",
        });
        if (work.deliverySchedule) {
            setDeliverySchedule(work.deliverySchedule);
        }
        setEditingWorkId(work.id);
        setIsWorkFormVisible(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleAddStage(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedWork || !stageForm.stageId || !stageForm.predictedDate) return;

        const selectedFase = fases.find(f => f.id === stageForm.stageId);
        if (!selectedFase) return;

        const newStage: WorkStage = {
            id: stageForm.stageId,
            name: selectedFase.nome,
            category: "Fase da Obra", // Pode ser ajustado se houver categorias nas fases
            predictedDate: stageForm.predictedDate,
            isCompleted: false,
            quotationAdvanceDays: stageForm.quotationAdvanceDays,
        };

        try {
            // Buscar obra atual para adicionar ao array de stages
            const { data: workData, error: fetchError } = await supabase
                .from('works')
                .select('stages')
                .eq('id', String(selectedWork))
                .single();

            if (fetchError) throw fetchError;

            const currentStages = workData?.stages || [];
            const updatedStages = [...currentStages, newStage];

            const { error } = await supabase
                .from('works')
                .update({ stages: updatedStages })
                .eq('id', String(selectedWork));

            if (error) throw error;

            setStageForm({ stageId: "", predictedDate: "", endDate: "", quotationAdvanceDays: 15 });
            setShowStageModal(false);
        } catch (error) {
            console.error("Erro ao adicionar etapa:", error);
            alert("Erro ao adicionar etapa.");
        }
    }

    async function toggleStageCompletion(workId: string | number, stageId: string) {
        const work = works.find(w => w.id === workId);
        if (!work) return;

        const updatedStages = work.stages?.map((stage) =>
            stage.id === stageId
                ? {
                    ...stage,
                    isCompleted: !stage.isCompleted,
                    completedDate: !stage.isCompleted ? new Date().toISOString().split('T')[0] : undefined,
                }
                : stage
        );

        try {
            const { error } = await supabase
                .from('works')
                .update({ stages: updatedStages })
                .eq('id', String(workId));

            if (error) throw error;
        } catch (error) {
            console.error("Erro ao atualizar etapa:", error);
        }
    }

    async function handleDeleteWork(workId: string | number) {
        if (!confirm("Tem certeza que deseja excluir esta obra?")) return;
        try {
            const { error } = await supabase
                .from('works')
                .delete()
                .eq('id', String(workId));

            if (error) throw error;
        } catch (error) {
            console.error("Erro ao excluir obra:", error);
            alert("Erro ao excluir obra.");
        }
    }

    function calculateQuotationDate(predictedDate: string, advanceDays: number): string {
        const date = new Date(predictedDate);
        date.setDate(date.getDate() - advanceDays);
        return date.toISOString().split('T')[0];
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function getStagesByCategory(stages: WorkStage[]) {
        const grouped: { [key: string]: WorkStage[] } = {};
        stages.forEach(stage => {
            if (!grouped[stage.category]) {
                grouped[stage.category] = [];
            }
            grouped[stage.category].push(stage);
        });
        return grouped;
    }

    const availableStages = selectedWork
        ? fases.filter(
            fase => !works.find(w => w.id === selectedWork)?.stages?.some(s => s.name === fase.nome)
        )
        : [];

    const toggleWorkVisibility = (workId: string | number) => {
        setCollapsedWorks((prev) => ({
            ...prev,
            [workId]: !prev[workId],
        }));
    };

    if (loading) return <div className="p-6 text-center">Carregando obras...</div>;

    return (
        <div className="space-y-6">
            {/* Formulário de Nova Obra */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {editingWorkId ? "Editar Obra" : "Cadastrar Nova Obra"}
                        </h2>
                        <p className="text-sm text-gray-500">Preencha os dados completos da obra para melhor gestão.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setIsWorkFormVisible((prev) => !prev);
                            if (isWorkFormVisible) {
                                setEditingWorkId(null);
                                setForm({
                                    obra: "",
                                    centroCustos: "",
                                    cep: "",
                                    bairro: "",
                                    cidade: "",
                                    endereco: "",
                                    numero: "",
                                    complemento: "",
                                    restricoesEntrega: "",
                                    etapa: "",
                                    tipoObra: "",
                                    area: "",
                                    padrao: "",
                                    dataInicio: "",
                                    previsaoTermino: "",
                                    diasAntecedenciaOferta: 15,
                                    horarioEntrega: "",
                                });
                            }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        <PlusIcon className="h-5 w-5" />
                        {isWorkFormVisible ? "Ocultar" : "Cadastrar Obra"}
                    </button>
                </div>

                {isWorkFormVisible && (
                    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
                        {/* 1. Identificação */}
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">1. Identificação</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Nome da Obra / Projeto *</span>
                                    <input
                                        required
                                        value={form.obra}
                                        onChange={(e) => setForm({ ...form, obra: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Ex: Edifício Horizonte"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Centro de Custos (Opcional)</span>
                                    <input
                                        value={form.centroCustos}
                                        onChange={(e) => setForm({ ...form, centroCustos: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* 2. Logística */}
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">2. Onde é a obra? (Logística)</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">CEP</span>
                                    <input
                                        value={form.cep}
                                        onChange={(e) => setForm({ ...form, cep: formatCepBr(e.target.value) })}
                                        onBlur={() => handleCepLookup(form.cep)}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="00000-000"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Bairro *</span>
                                    <input
                                        required
                                        value={form.bairro}
                                        onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Cidade / UF</span>
                                    <input
                                        value={form.cidade}
                                        onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block md:col-span-2">
                                    <span className="text-xs font-semibold text-gray-700">Endereço Completo</span>
                                    <input
                                        value={form.endereco}
                                        onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                                <div className="grid grid-cols-1 gap-4 md:col-span-3 md:grid-cols-2">
                                    <label className="block">
                                        <span className="text-xs font-semibold text-gray-700">Número</span>
                                        <input
                                            value={form.numero}
                                            onChange={(e) => setForm({ ...form, numero: e.target.value })}
                                            className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Ex: 123"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="text-xs font-semibold text-gray-700">Complemento</span>
                                        <input
                                            value={form.complemento}
                                            onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                                            className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Apto, bloco, sala..."
                                        />
                                    </label>
                                </div>

                            </div>
                        </div>

                        {/* 3. Características */}
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">3. Características</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Tipo de Obra</span>
                                    <select
                                        value={form.tipoObra}
                                        onChange={(e) => setForm({ ...form, tipoObra: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="Casa">Casa</option>
                                        <option value="Prédio">Prédio</option>
                                        <option value="Reforma">Reforma</option>
                                        <option value="Comercial">Comercial</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Área em m²</span>
                                    <input
                                        type="number"
                                        value={form.area}
                                        onChange={(e) => setForm({ ...form, area: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Padrão</span>
                                    <select
                                        value={form.padrao}
                                        onChange={(e) => setForm({ ...form, padrao: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="Baixo">Baixo</option>
                                        <option value="Médio">Médio</option>
                                        <option value="Alto">Alto</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        {/* 4. Datas e Recebimento */}
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">4. Etapas da Obra</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Etapa Atual</span>
                                    <select
                                        value={form.etapa}
                                        onChange={(e) => setForm({ ...form, etapa: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione...</option>
                                        {fases.map((fase) => (
                                            <option key={fase.id} value={fase.nome}>
                                                {fase.nome}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Data Início</span>
                                    <input
                                        type="date"
                                        value={form.dataInicio}
                                        onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Data Fim da Etapa</span>
                                    <input
                                        type="date"
                                        value={form.previsaoTermino}
                                        onChange={(e) => setForm({ ...form, previsaoTermino: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Antecedência para Receber Ofertas (dias)</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.diasAntecedenciaOferta}
                                        onChange={(e) => setForm({ ...form, diasAntecedenciaOferta: Number(e.target.value) })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="15"
                                    />
                                    {form.dataInicio && form.diasAntecedenciaOferta && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            Início do recebimento: {(() => {
                                                const date = new Date(form.dataInicio);
                                                date.setDate(date.getDate() - form.diasAntecedenciaOferta);
                                                return date.toLocaleDateString('pt-BR');
                                            })()}
                                        </p>
                                    )}
                                </label>
                            </div>
                        </div>

                        {/* 5. Horário de Entregas de Materiais */}
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">5. Horário de Entregas de Materiais</h3>

                            <label className="block mb-4">
                                <span className="text-xs font-semibold text-gray-700">Restrições de Entrega?</span>
                                <input
                                    value={form.restricoesEntrega}
                                    onChange={(e) => setForm({ ...form, restricoesEntrega: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Descreva se houver..."
                                />
                            </label>

                            <div className="space-y-2">
                                {Object.entries(dayNames).map(([dayKey, dayLabel]) => (
                                    <div
                                        key={dayKey}
                                        className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-1">
                                            <input
                                                type="checkbox"
                                                checked={deliverySchedule[dayKey].enabled}
                                                onChange={() => toggleDeliveryDay(dayKey)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className={`text-sm font-medium min-w-[70px] ${deliverySchedule[dayKey].enabled ? "text-gray-900" : "text-gray-400"}`}>
                                                {dayLabel}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="time"
                                                value={deliverySchedule[dayKey].startTime}
                                                onChange={(e) => updateDeliveryTime(dayKey, "startTime", e.target.value)}
                                                disabled={!deliverySchedule[dayKey].enabled}
                                                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 text-gray-900"
                                            />
                                            <span className="text-gray-400">às</span>
                                            <input
                                                type="time"
                                                value={deliverySchedule[dayKey].endTime}
                                                onChange={(e) => updateDeliveryTime(dayKey, "endTime", e.target.value)}
                                                disabled={!deliverySchedule[dayKey].enabled}
                                                className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 text-gray-900"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700"
                            >
                                <CheckCircleIcon className="h-5 w-5" />
                                Salvar Obra
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Lista de Obras */}
            <div className="space-y-4">
                {works.map((work) => (
                    <div
                        key={work.id}
                        className="rounded-lg border border-gray-200 bg-white shadow-sm"
                    >
                        {/* Header da Obra */}
                        <div className="border-b border-gray-200 p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{work.obra}</h3>
                                    <p className="text-sm text-gray-700 mt-1">
                                        Bairro {work.bairro} • {work.cidade}
                                    </p>
                                    <span className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                                        {work.etapa || "Etapa não informada"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleWorkVisibility(work.id)}
                                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        {collapsedWorks[work.id] ? "Mostrar detalhes" : "Ocultar detalhes"}
                                    </button>
                                    <button
                                        onClick={() => handleEditWork(work)}
                                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50"
                                        title="Editar Obra"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedWork(work.id);
                                            setShowStageModal(true);
                                        }}
                                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Adicionar Etapa
                                    </button>
                                    <button
                                        onClick={() => handleDeleteWork(work.id)}
                                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                                        title="Excluir Obra"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Etapas da Obra */}
                        {!collapsedWorks[work.id] && (
                            work.stages && work.stages.length > 0 ? (
                                <div className="p-6">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-4">
                                        Cronograma de Etapas ({work.stages.length})
                                    </h4>

                                    {Object.entries(getStagesByCategory(work.stages)).map(([category, stages]) => (
                                        <div key={category} className="mb-6 last:mb-0">
                                            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3 bg-gray-50 px-3 py-2 rounded">
                                                {category}
                                            </h5>
                                            <div className="space-y-3">
                                                {stages.map((stage) => (
                                                    <div
                                                        key={stage.id}
                                                        className={`rounded-lg border p-4 ${stage.isCompleted
                                                            ? 'border-green-200 bg-green-50'
                                                            : 'border-gray-200 bg-gray-50'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-start space-x-3 flex-1">
                                                                <button
                                                                    onClick={() => toggleStageCompletion(work.id, stage.id)}
                                                                    className={`mt-1 flex-shrink-0 ${stage.isCompleted
                                                                        ? 'text-green-600'
                                                                        : 'text-gray-400 hover:text-green-600'
                                                                        }`}
                                                                >
                                                                    <CheckCircleIcon className="h-6 w-6" />
                                                                </button>
                                                                <div className="flex-1">
                                                                    <h6 className={`text-sm font-medium ${stage.isCompleted
                                                                        ? 'text-green-900 line-through'
                                                                        : 'text-gray-900'
                                                                        }`}>
                                                                        {stage.name}
                                                                    </h6>
                                                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                                                        <div className="flex items-center space-x-2">
                                                                            <CalendarIcon className="h-4 w-4 text-blue-600" />
                                                                            <div>
                                                                                <span className="text-gray-600">Previsão: </span>
                                                                                <span className="font-medium text-gray-900">
                                                                                    {formatDate(stage.predictedDate)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center space-x-2">
                                                                            <ClockIcon className="h-4 w-4 text-orange-600" />
                                                                            <div>
                                                                                <span className="text-gray-600">Cotações a partir de: </span>
                                                                                <span className="font-medium text-orange-700">
                                                                                    {formatDate(calculateQuotationDate(stage.predictedDate, stage.quotationAdvanceDays))}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center space-x-2">
                                                                            <div className="text-gray-600">
                                                                                Antecedência:
                                                                                <span className="ml-1 font-medium text-gray-900">
                                                                                    {stage.quotationAdvanceDays} dias
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {stage.isCompleted && stage.completedDate && (
                                                                        <div className="mt-2 text-xs text-green-700">
                                                                            ✓ Concluída em {formatDate(stage.completedDate)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-6 text-center text-gray-500">
                                    <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm">Nenhuma etapa cadastrada ainda</p>
                                    <p className="text-xs mt-1">Clique em "Adicionar Etapa" para planejar o cronograma</p>
                                </div>
                            )
                        )}
                    </div>
                ))}
            </div>

            {/* Modal de Adicionar Etapa */}
            {showStageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="border-b border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Adicionar Etapa ao Cronograma
                            </h3>
                            <p className="text-sm text-gray-700 mt-1">
                                Planeje quando a etapa será executada e com quanto tempo de antecedência deseja receber cotações
                            </p>
                        </div>

                        <form onSubmit={handleAddStage} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Selecione a Etapa *
                                    </label>
                                    <select
                                        value={stageForm.stageId}
                                        onChange={(e) => setStageForm({ ...stageForm, stageId: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Escolha uma etapa da construção</option>
                                        {availableStages.map((fase) => (
                                            <option key={fase.id} value={fase.id}>
                                                {fase.ordem}. {fase.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Data Início *
                                    </label>
                                    <input
                                        type="date"
                                        value={stageForm.predictedDate}
                                        onChange={(e) => setStageForm({ ...stageForm, predictedDate: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Data Fim da Etapa
                                    </label>
                                    <input
                                        type="date"
                                        value={stageForm.endDate}
                                        onChange={(e) => setStageForm({ ...stageForm, endDate: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Antecedência para Receber Ofertas (dias)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={stageForm.quotationAdvanceDays}
                                        onChange={(e) => setStageForm({ ...stageForm, quotationAdvanceDays: parseInt(e.target.value) || 15 })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {stageForm.predictedDate && stageForm.quotationAdvanceDays && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            Início do recebimento: {(() => {
                                                const date = new Date(stageForm.predictedDate);
                                                date.setDate(date.getDate() - stageForm.quotationAdvanceDays);
                                                return date.toLocaleDateString('pt-BR');
                                            })()}
                                        </p>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start space-x-3">
                                        <ClockIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="text-sm font-medium text-blue-900">Planejamento de Suprimentos</h4>
                                            <p className="text-xs text-blue-800 mt-1">
                                                A antecedência permite que você compare preços com calma, negocie melhores condições
                                                e garanta a disponibilidade dos materiais antes do início da etapa.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowStageModal(false);
                                        setStageForm({ stageId: "", predictedDate: "", endDate: "", quotationAdvanceDays: 15 });
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                                >
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
