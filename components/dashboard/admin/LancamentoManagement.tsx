"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket, Users, Clock, Check, X, Mail, Trash2, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useConfirmModal } from "@/components/ConfirmModal";
import { getAuthHeaders } from "@/lib/authHeaders";
import { diasRestantesDoTeste, type StatusTurma } from "@/lib/lancamentoService";

type Vaga = {
    id: string;
    user_id: string;
    posicao: number;
    nome: string | null;
    email: string | null;
    teste_inicio: string;
    teste_fim: string;
    status: "ativo" | "expirado" | "convertido" | "cancelado";
};

type LeadFila = {
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
    razao_social: string | null;
    convidado_em: string | null;
    convite_expira_em: string | null;
    cadastrado_em: string | null;
    created_at: string;
};

const STATUS_META: Record<Vaga["status"], { label: string; cor: string }> = {
    ativo: { label: "Em teste", cor: "bg-emerald-100 text-emerald-700" },
    convertido: { label: "Convertido", cor: "bg-blue-100 text-blue-700" },
    expirado: { label: "Expirado", cor: "bg-amber-100 text-amber-700" },
    cancelado: { label: "Cancelado", cor: "bg-slate-100 text-slate-500" },
};

const dataBr = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const conviteExpirado = (lead: { convite_expira_em: string | null }) =>
    Boolean(lead.convite_expira_em) && new Date(lead.convite_expira_em!).getTime() < Date.now();

/**
 * Controlador da turma de lançamento: quantas vagas de teste gratuito
 * existem, quem ocupa cada uma e quem está na fila de espera.
 */
export function LancamentoManagement() {
    const { showToast } = useToast();
    const { confirm: confirmModal } = useConfirmModal();

    const [status, setStatus] = useState<StatusTurma | null>(null);
    const [vagas, setVagas] = useState<Vaga[]>([]);
    const [fila, setFila] = useState<LeadFila[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Formulário de configuração
    const [form, setForm] = useState({ vagasTotal: 20, diasTeste: 30, obrasPorConta: 1, inscricoesAbertas: true });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/lancamento", { headers, credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao carregar a turma");

            setStatus(json.status);
            setVagas(json.vagas || []);
            setFila(json.fila || []);
            setForm({
                vagasTotal: json.status?.vagasTotal ?? 20,
                diasTeste: json.status?.diasTeste ?? 30,
                obrasPorConta: json.status?.obrasPorConta ?? 1,
                // `inscricoesAbertas` da API já considera as vagas esgotadas;
                // aqui o toggle representa a intenção do admin.
                inscricoesAbertas: json.status ? json.status.vagasRestantes > 0 || json.status.inscricoesAbertas : true,
            });
        } catch (error: any) {
            console.error(error);
            showToast("error", error?.message || "Erro ao carregar a turma de lançamento.");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const chamarApi = async (payload: Record<string, unknown>, sucesso: string) => {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/admin/lancamento", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Falha na operação");
        showToast("success", sucesso);
        await load();
        return json;
    };

    const salvarConfig = async () => {
        setSaving(true);
        try {
            await chamarApi({ action: "update_config", ...form }, "Configuração da turma salva.");
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível salvar.");
        } finally {
            setSaving(false);
        }
    };

    const mudarStatusVaga = async (vaga: Vaga, novoStatus: Vaga["status"]) => {
        if (novoStatus === "cancelado") {
            const ok = await confirmModal({
                title: "Cancelar vaga?",
                message: `A vaga #${vaga.posicao} de ${vaga.nome || vaga.email} será liberada para a fila de espera. A conta do construtor continua existindo.`,
                confirmLabel: "Cancelar vaga",
                cancelLabel: "Voltar",
                variant: "warning",
            });
            if (ok !== true) return;
        }

        try {
            await chamarApi({ action: "update_vaga", vagaId: vaga.id, status: novoStatus }, "Vaga atualizada.");
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível atualizar a vaga.");
        }
    };

    const estenderTeste = async (vaga: Vaga, dias: number) => {
        try {
            await chamarApi({ action: "estender_teste", vagaId: vaga.id, dias }, `Teste estendido em ${dias} dias.`);
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível estender o teste.");
        }
    };

    const convidarDaFila = async (lead: LeadFila) => {
        try {
            const json = await chamarApi(
                { action: "convidar_fila", filaId: lead.id },
                `Convite enviado para ${lead.email}.`
            );

            // E-mail pode falhar (Resend fora, endereço recusado): o token
            // continua valendo, então entregamos o link para envio manual.
            if (json?.emailEnviado === false && json?.cadastroUrl) {
                await confirmModal({
                    title: "Convite gerado, e-mail não saiu",
                    message: `Copie e envie este link para ${lead.email}:\n\n${json.cadastroUrl}`,
                    confirmLabel: "Entendi",
                    cancelLabel: "Fechar",
                    variant: "warning",
                });
            }
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível enviar o convite.");
        }
    };

    const removerDaFila = async (lead: LeadFila) => {
        const ok = await confirmModal({
            title: "Remover da fila?",
            message: `${lead.nome} (${lead.email}) sai da fila de espera. Esta ação não pode ser desfeita.`,
            confirmLabel: "Remover",
            cancelLabel: "Voltar",
            variant: "danger",
        });
        if (ok !== true) return;

        try {
            await chamarApi({ action: "remover_fila", filaId: lead.id }, "Removido da fila.");
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível remover.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando turma de lançamento...
            </div>
        );
    }

    const ocupadas = status?.vagasOcupadas ?? 0;
    const total = status?.vagasTotal ?? 0;
    const restantes = status?.vagasRestantes ?? 0;
    const percentual = total > 0 ? Math.min((ocupadas / total) * 100, 100) : 0;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <Rocket className="h-5 w-5 text-orange-500" />
                    Turma de Lançamento
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Controla as vagas de teste gratuito anunciadas na página inicial. Esgotadas as vagas, novos
                    cadastros não criam conta — entram na fila de espera.
                </p>
            </div>

            {/* Ocupação */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vagas ocupadas</p>
                        <p className="mt-1 text-3xl font-bold text-slate-900">
                            {ocupadas}<span className="text-lg font-medium text-slate-400"> / {total}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Restantes</p>
                        <p className={`mt-1 text-3xl font-bold ${restantes > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                            {restantes}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fila de espera</p>
                        <p className="mt-1 text-3xl font-bold text-slate-900">{fila.length}</p>
                    </div>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                        className={`h-full rounded-full transition-all ${restantes > 0 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${percentual}%` }}
                    />
                </div>
            </div>

            {/* Configuração */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Condições do teste gratuito</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Vagas na turma</label>
                        <input
                            type="number"
                            min={0}
                            value={form.vagasTotal}
                            onChange={(e) => setForm({ ...form, vagasTotal: Number(e.target.value) })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Dias de teste</label>
                        <input
                            type="number"
                            min={1}
                            value={form.diasTeste}
                            onChange={(e) => setForm({ ...form, diasTeste: Number(e.target.value) })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Obras por conta</label>
                        <input
                            type="number"
                            min={1}
                            value={form.obrasPorConta}
                            onChange={(e) => setForm({ ...form, obrasPorConta: Number(e.target.value) })}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={form.inscricoesAbertas}
                            onChange={(e) => setForm({ ...form, inscricoesAbertas: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300"
                        />
                        Inscrições abertas
                        <span className="text-xs text-slate-400">(desmarque para mandar todo mundo para a fila)</span>
                    </label>
                    <button
                        onClick={salvarConfig}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "Salvando..." : "Salvar condições"}
                    </button>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                    O limite de obras por conta é informativo por enquanto — a plataforma ainda não bloqueia a segunda obra.
                </p>
            </div>

            {/* Vagas ocupadas */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                    <Users className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Construtores da turma ({vagas.length})</h3>
                </div>

                {vagas.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma vaga ocupada ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">#</th>
                                    <th className="px-4 py-3 text-left">Construtor</th>
                                    <th className="px-4 py-3 text-left">Início</th>
                                    <th className="px-4 py-3 text-left">Fim do teste</th>
                                    <th className="px-4 py-3 text-left">Situação</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {vagas.map((vaga) => {
                                    const restam = diasRestantesDoTeste(vaga.teste_fim);
                                    const meta = STATUS_META[vaga.status];
                                    return (
                                        <tr key={vaga.id} className={vaga.status === "cancelado" ? "opacity-50" : ""}>
                                            <td className="px-4 py-3 font-mono font-bold text-slate-400">{vaga.posicao}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900">{vaga.nome || "—"}</p>
                                                <p className="text-xs text-slate-500">{vaga.email}</p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{dataBr(vaga.teste_inicio)}</td>
                                            <td className="px-4 py-3">
                                                <p className="text-slate-600">{dataBr(vaga.teste_fim)}</p>
                                                {vaga.status === "ativo" && (
                                                    <p className={`text-xs ${restam <= 5 ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                                                        {restam > 0 ? `restam ${restam} dias` : "vencido"}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cor}`}>
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => estenderTeste(vaga, 30)}
                                                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                                        title="Estender o teste em 30 dias"
                                                    >
                                                        <Clock className="mr-1 inline h-3 w-3" />+30d
                                                    </button>
                                                    {vaga.status !== "convertido" && (
                                                        <button
                                                            onClick={() => mudarStatusVaga(vaga, "convertido")}
                                                            className="rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                                                            title="Marcar como cliente pagante"
                                                        >
                                                            <Check className="mr-1 inline h-3 w-3" />Converteu
                                                        </button>
                                                    )}
                                                    {vaga.status !== "cancelado" && (
                                                        <button
                                                            onClick={() => mudarStatusVaga(vaga, "cancelado")}
                                                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                                            title="Liberar a vaga"
                                                        >
                                                            <X className="mr-1 inline h-3 w-3" />Liberar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Fila de espera */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Fila de espera ({fila.length})</h3>
                </div>

                {fila.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">Ninguém na fila.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">Lead</th>
                                    <th className="px-4 py-3 text-left">Contato</th>
                                    <th className="px-4 py-3 text-left">Entrou em</th>
                                    <th className="px-4 py-3 text-left">Convite</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fila.map((lead) => (
                                    <tr key={lead.id}>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-900">{lead.nome}</p>
                                            {lead.razao_social && <p className="text-xs text-slate-500">{lead.razao_social}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-slate-600">{lead.email}</p>
                                            {lead.telefone && <p className="text-xs text-slate-500">{lead.telefone}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{dataBr(lead.created_at)}</td>
                                        <td className="px-4 py-3">
                                            {lead.cadastrado_em ? (
                                                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                                    Cadastrado em {dataBr(lead.cadastrado_em)}
                                                </span>
                                            ) : lead.convidado_em ? (
                                                <div>
                                                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                        Convidado em {dataBr(lead.convidado_em)}
                                                    </span>
                                                    {lead.convite_expira_em && (
                                                        <p className={`mt-0.5 text-xs ${conviteExpirado(lead) ? "font-semibold text-amber-600" : "text-slate-400"}`}>
                                                            {conviteExpirado(lead)
                                                                ? "convite expirado"
                                                                : `vale até ${dataBr(lead.convite_expira_em)}`}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">Aguardando</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {!lead.cadastrado_em && (
                                                    <button
                                                        onClick={() => convidarDaFila(lead)}
                                                        disabled={restantes === 0}
                                                        title={restantes === 0 ? "Libere uma vaga antes de convidar" : "Enviar convite por e-mail"}
                                                        className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <Check className="mr-1 inline h-3 w-3" />
                                                        {lead.convidado_em ? "Reenviar" : "Convidar"}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => removerDaFila(lead)}
                                                    className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                    title="Remover da fila"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
