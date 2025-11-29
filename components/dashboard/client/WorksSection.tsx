"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon, CalendarIcon, CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { initialWorks, Work, WorkStage, constructionStages } from "../../../lib/clientDashboardMocks";

type DaySchedule = {
    enabled: boolean;
    startTime: string;
    endTime: string;
};

type WeekSchedule = {
    [key: string]: DaySchedule;
};

export function ClientWorksSection() {
    const [works, setWorks] = useState<Work[]>(initialWorks);
    const [selectedWork, setSelectedWork] = useState<number | null>(null);
    const [showStageModal, setShowStageModal] = useState(false);
    const [isWorkFormVisible, setIsWorkFormVisible] = useState(false);
    const [collapsedWorks, setCollapsedWorks] = useState<Record<number, boolean>>({});
    const [form, setForm] = useState({
        obra: "",
        centroCustos: "",
        cep: "",
        bairro: "",
        cidade: "",
        endereco: "",
        restricoesEntrega: "",
        etapa: "",
        tipoObra: "",
        area: "",
        padrao: "",
        dataInicio: "",
        previsaoTermino: "",
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
        quotationAdvanceDays: 15,
    });

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

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!form.obra || !form.bairro) return;
        setWorks((prev) => [...prev, { id: Date.now(), ...form, stages: [] } as Work]);
        setForm({
            obra: "",
            centroCustos: "",
            cep: "",
            bairro: "",
            cidade: "",
            endereco: "",
            restricoesEntrega: "",
            etapa: "",
            tipoObra: "",
            area: "",
            padrao: "",
            dataInicio: "",
            previsaoTermino: "",
            horarioEntrega: "",
        });
        setIsWorkFormVisible(false);
    }

    function handleAddStage(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!selectedWork || !stageForm.stageId || !stageForm.predictedDate) return;

        const selectedStageInfo = constructionStages.find(s => s.id === stageForm.stageId);
        if (!selectedStageInfo) return;

        const newStage: WorkStage = {
            id: stageForm.stageId,
            name: selectedStageInfo.name,
            category: selectedStageInfo.category,
            predictedDate: stageForm.predictedDate,
            isCompleted: false,
            quotationAdvanceDays: stageForm.quotationAdvanceDays,
        };

        setWorks((prev) =>
            prev.map((work) =>
                work.id === selectedWork
                    ? { ...work, stages: [...(work.stages || []), newStage] }
                    : work
            )
        );

        setStageForm({ stageId: "", predictedDate: "", quotationAdvanceDays: 15 });
        setShowStageModal(false);
    }

    function toggleStageCompletion(workId: number, stageId: string) {
        setWorks((prev) =>
            prev.map((work) =>
                work.id === workId
                    ? {
                        ...work,
                        stages: work.stages?.map((stage) =>
                            stage.id === stageId
                                ? {
                                    ...stage,
                                    isCompleted: !stage.isCompleted,
                                    completedDate: !stage.isCompleted ? new Date().toISOString().split('T')[0] : undefined,
                                }
                                : stage
                        ),
                    }
                    : work
            )
        );
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
        ? constructionStages.filter(
            cs => !works.find(w => w.id === selectedWork)?.stages?.some(s => s.id === cs.id)
        )
        : [];

    const toggleWorkVisibility = (workId: number) => {
        setCollapsedWorks((prev) => ({
            ...prev,
            [workId]: !prev[workId],
        }));
    };

    return (
        <div className="space-y-6">
            {/* Formulário de Nova Obra */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Cadastrar Nova Obra</h2>
                        <p className="text-sm text-gray-500">Preencha os dados completos da obra para melhor gestão.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsWorkFormVisible((prev) => !prev)}
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
                                        onChange={(e) => setForm({ ...form, cep: e.target.value })}
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
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Restrições de Entrega?</span>
                                    <input
                                        value={form.restricoesEntrega}
                                        onChange={(e) => setForm({ ...form, restricoesEntrega: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Descreva se houver..."
                                    />
                                </label>
                            </div>
                        </div>

                        {/* 3. Características */}
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">3. Características</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                <label className="block">
                                    <span className="text-xs font-semibold text-gray-700">Etapa Atual</span>
                                    <select
                                        value={form.etapa}
                                        onChange={(e) => setForm({ ...form, etapa: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="Preliminares">Preliminares</option>
                                        <option value="Terraplenagem">Terraplenagem</option>
                                        <option value="Fundações">Fundações</option>
                                        <option value="Estrutura">Estrutura</option>
                                        <option value="Instalações Brutas">Instalações Brutas</option>
                                        <option value="Impermeabilização">Impermeabilização</option>
                                        <option value="Alvenaria e Vedações">Alvenaria e Vedações</option>
                                        <option value="Cobertura">Cobertura</option>
                                        <option value="Instalações">Instalações</option>
                                        <option value="Esquadrias">Esquadrias</option>
                                        <option value="Revestimentos">Revestimentos</option>
                                        <option value="Pintura">Pintura</option>
                                        <option value="Acabamentos Finais">Acabamentos Finais</option>
                                        <option value="Urbanização">Urbanização</option>
                                        <option value="Finalização">Finalização</option>
                                        <option value="Entrega">Entrega</option>
                                    </select>
                                </label>
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

                        {/* 4. Datas e Horários */}
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600 mb-4">4. Datas e Recebimento</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                                    <span className="text-xs font-semibold text-gray-700">Previsão Término</span>
                                    <input
                                        type="date"
                                        value={form.previsaoTermino}
                                        onChange={(e) => setForm({ ...form, previsaoTermino: e.target.value })}
                                        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </label>
                            </div>

                            {/* Dias e Horários de Entrega */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-3">Dias e Horários de Entrega</h4>
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
                                        onClick={() => {
                                            setSelectedWork(work.id);
                                            setShowStageModal(true);
                                        }}
                                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Adicionar Etapa
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
                                        {Object.entries(
                                            availableStages.reduce((acc, stage) => {
                                                if (!acc[stage.category]) acc[stage.category] = [];
                                                acc[stage.category].push(stage);
                                                return acc;
                                            }, {} as { [key: string]: typeof availableStages })
                                        ).map(([category, stages]) => (
                                            <optgroup key={category} label={category}>
                                                {stages.map((stage) => (
                                                    <option key={stage.id} value={stage.id}>
                                                        {stage.name}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Data Prevista para Execução *
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
                                        Antecedência para Receber Cotações (dias)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={stageForm.quotationAdvanceDays}
                                        onChange={(e) => setStageForm({ ...stageForm, quotationAdvanceDays: parseInt(e.target.value) || 15 })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-600 mt-1">
                                        Você começará a receber cotações{' '}
                                        {stageForm.predictedDate && (
                                            <span className="font-medium text-orange-700">
                                                a partir de {formatDate(calculateQuotationDate(stageForm.predictedDate, stageForm.quotationAdvanceDays))}
                                            </span>
                                        )}
                                    </p>
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
                                        setStageForm({ stageId: "", predictedDate: "", quotationAdvanceDays: 15 });
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
