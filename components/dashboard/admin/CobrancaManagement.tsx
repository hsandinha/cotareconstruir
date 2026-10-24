"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useConfirmModal } from "@/components/ConfirmModal";
import { getAuthHeaders } from "@/lib/authHeaders";
import {
    ROTULO_CICLO,
    ROTULO_MODELO,
    centavosDeTexto,
    formatarCentavos,
    type CicloCobranca,
    type ModeloCobranca,
} from "@/lib/cobrancaModelo";

type Config = {
    modelo: ModeloCobranca;
    valor_centavos: number;
    ciclo: CicloCobranca;
    dias_trial: number;
    dias_tolerancia: number;
    gateway: "asaas" | "manual";
    ambiente: "sandbox" | "producao";
    cobranca_ativa: boolean;
    afiliado_percentual_padrao: number;
    afiliado_duracao_meses_padrao: number | null;
    afiliado_janela_dias: number;
};

type Resumo = { trial: number; ativa: number; inadimplente: number; cancelada: number; encerrada: number };

const MODELOS: ModeloCobranca[] = ["por_obra", "por_cliente", "por_conta"];
const CICLOS: CicloCobranca[] = ["mensal", "trimestral", "semestral", "anual"];

/**
 * Configuração da cobrança: o que é cobrado, quanto e por qual gateway.
 *
 * O que se muda aqui vale para assinatura NOVA. As que já existem guardam o
 * próprio preço — mudar a tabela não reajusta quem já assinou.
 */
export function CobrancaManagement() {
    const { showToast } = useToast();
    const { confirm: confirmModal } = useConfirmModal();

    const [config, setConfig] = useState<Config | null>(null);
    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [mrr, setMrr] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        modelo: "por_obra" as ModeloCobranca,
        valor: "499,00",
        ciclo: "mensal" as CicloCobranca,
        diasTrial: 30,
        diasTolerancia: 5,
        gateway: "asaas" as "asaas" | "manual",
        ambiente: "sandbox" as "sandbox" | "producao",
        afiliadoPercentualPadrao: 20,
        afiliadoDuracaoMesesPadrao: "12",
        afiliadoJanelaDias: 90,
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/cobranca", { headers, credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao carregar a cobrança");

            const c: Config = json.config;
            setConfig(c);
            setResumo(json.resumo);
            setMrr(json.mrrCentavos || 0);
            setForm({
                modelo: c.modelo,
                valor: (c.valor_centavos / 100).toFixed(2).replace(".", ","),
                ciclo: c.ciclo,
                diasTrial: c.dias_trial,
                diasTolerancia: c.dias_tolerancia,
                gateway: c.gateway,
                ambiente: c.ambiente,
                afiliadoPercentualPadrao: Number(c.afiliado_percentual_padrao),
                afiliadoDuracaoMesesPadrao: c.afiliado_duracao_meses_padrao === null
                    ? ""
                    : String(c.afiliado_duracao_meses_padrao),
                afiliadoJanelaDias: c.afiliado_janela_dias,
            });
        } catch (error: any) {
            showToast("error", error?.message || "Erro ao carregar a configuração de cobrança.");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const salvar = async (extra: Record<string, unknown> = {}) => {
        const centavos = centavosDeTexto(form.valor);
        if (centavos === null || centavos < 0) {
            showToast("error", "Informe um valor válido para a assinatura.");
            return;
        }

        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/cobranca", {
                method: "PUT",
                headers: { ...headers, "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    modelo: form.modelo,
                    valor: centavos / 100,
                    ciclo: form.ciclo,
                    diasTrial: form.diasTrial,
                    diasTolerancia: form.diasTolerancia,
                    gateway: form.gateway,
                    ambiente: form.ambiente,
                    afiliadoPercentualPadrao: form.afiliadoPercentualPadrao,
                    // Vazio = vitalício, e é uma escolha explícita
                    afiliadoDuracaoMesesPadrao: form.afiliadoDuracaoMesesPadrao === ""
                        ? null
                        : Number(form.afiliadoDuracaoMesesPadrao),
                    afiliadoJanelaDias: form.afiliadoJanelaDias,
                    ...extra,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao salvar");

            showToast("success", "Configuração salva.");
            await load();
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível salvar.");
        } finally {
            setSaving(false);
        }
    };

    /**
     * Ligar a cobrança muda o que acontece com a conta de cliente real, então
     * passa por confirmação explícita com o número de quem será afetado.
     */
    const alternarCobranca = async () => {
        const ligando = !config?.cobranca_ativa;
        const emTeste = resumo?.trial ?? 0;

        const ok = await confirmModal({
            title: ligando ? "Ligar a cobrança?" : "Desligar a cobrança?",
            message: ligando
                ? `A partir de agora a plataforma passa a criar assinaturas e cobrar ${formatarCentavos(centavosDeTexto(form.valor) ?? 0)} ${ROTULO_CICLO[form.ciclo].toLowerCase()} ${ROTULO_MODELO[form.modelo].toLowerCase()}. Há ${emTeste} assinatura(s) em teste hoje.`
                : "Nenhum cliente será cobrado nem bloqueado por pagamento enquanto estiver desligada.",
            confirmLabel: ligando ? "Ligar cobrança" : "Desligar",
            cancelLabel: "Voltar",
            variant: ligando ? "warning" : "info",
        });
        if (ok !== true) return;

        await salvar({ cobrancaAtiva: ligando });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando configuração de cobrança...
            </div>
        );
    }

    const ativa = !!config?.cobranca_ativa;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <CreditCard className="h-5 w-5 text-orange-500" />
                    Cobrança
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Define o que é cobrado e quanto. As alterações valem para assinaturas novas — quem já assinou
                    mantém o preço contratado.
                </p>
            </div>

            {/* Chave geral */}
            <div className={`rounded-2xl border p-5 shadow-sm ${ativa ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className={`mt-0.5 h-5 w-5 ${ativa ? "text-emerald-600" : "text-amber-600"}`} />
                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                {ativa ? "Cobrança ligada" : "Cobrança desligada"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">
                                {ativa
                                    ? "Assinaturas são criadas e cobradas normalmente. Ninguém perde acesso antes da tolerância."
                                    : "Nenhum cliente é cobrado nem bloqueado. É o estado da turma de lançamento em teste."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={alternarCobranca}
                        disabled={saving}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${ativa ? "bg-slate-600 hover:bg-slate-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                    >
                        {ativa ? "Desligar cobrança" : "Ligar cobrança"}
                    </button>
                </div>
            </div>

            {/* Situação */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                    { rotulo: "Em teste", valor: resumo?.trial ?? 0, cor: "text-blue-600" },
                    { rotulo: "Ativas", valor: resumo?.ativa ?? 0, cor: "text-emerald-600" },
                    { rotulo: "Inadimplentes", valor: resumo?.inadimplente ?? 0, cor: "text-amber-600" },
                    { rotulo: "Receita recorrente", valor: formatarCentavos(mrr), cor: "text-slate-900" },
                ].map((card) => (
                    <div key={card.rotulo} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.rotulo}</p>
                        <p className={`mt-1 text-2xl font-bold ${card.cor}`}>{card.valor}</p>
                    </div>
                ))}
            </div>

            {/* O que é cobrado */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">O que é cobrado</h3>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Modelo</label>
                        <select
                            value={form.modelo}
                            onChange={(e) => setForm({ ...form, modelo: e.target.value as ModeloCobranca })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                            {MODELOS.map((m) => <option key={m} value={m}>{ROTULO_MODELO[m]}</option>)}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-400">
                            {form.modelo === "por_obra"
                                ? "Uma assinatura por obra cadastrada pelo cliente."
                                : form.modelo === "por_cliente"
                                    ? "Uma assinatura por cliente, com obras ilimitadas."
                                    : "Uma assinatura por conta de acesso."}
                        </p>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Valor</label>
                        <input
                            value={form.valor}
                            onChange={(e) => setForm({ ...form, valor: e.target.value })}
                            inputMode="decimal"
                            placeholder="499,00"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            {formatarCentavos(centavosDeTexto(form.valor) ?? 0)} {ROTULO_CICLO[form.ciclo].toLowerCase()}
                        </p>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Ciclo</label>
                        <select
                            value={form.ciclo}
                            onChange={(e) => setForm({ ...form, ciclo: e.target.value as CicloCobranca })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                            {CICLOS.map((c) => <option key={c} value={c}>{ROTULO_CICLO[c]}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Dias de teste grátis</label>
                        <input
                            type="number" min={0}
                            value={form.diasTrial}
                            onChange={(e) => setForm({ ...form, diasTrial: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Tolerância após vencer</label>
                        <input
                            type="number" min={0}
                            value={form.diasTolerancia}
                            onChange={(e) => setForm({ ...form, diasTolerancia: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            Dias até cortar o acesso de quem não pagou.
                        </p>
                    </div>
                </div>
            </div>

            {/* Gateway */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Gateway de pagamento</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Gateway</label>
                        <select
                            value={form.gateway}
                            onChange={(e) => setForm({ ...form, gateway: e.target.value as "asaas" | "manual" })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                            <option value="asaas">Asaas</option>
                            <option value="manual">Manual (lançamento pelo admin)</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Ambiente</label>
                        <select
                            value={form.ambiente}
                            onChange={(e) => setForm({ ...form, ambiente: e.target.value as "sandbox" | "producao" })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        >
                            <option value="sandbox">Sandbox (teste)</option>
                            <option value="producao">Produção</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Padrões de afiliado */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Padrões do programa de afiliados</h3>
                <p className="mt-1 text-xs text-slate-500">
                    Valores iniciais de um parceiro novo. Cada parceiro pode ter os seus — é negociação individual.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Comissão padrão (%)</label>
                        <input
                            type="number" min={0} max={100} step="0.5"
                            value={form.afiliadoPercentualPadrao}
                            onChange={(e) => setForm({ ...form, afiliadoPercentualPadrao: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Duração (meses)</label>
                        <input
                            type="number" min={1}
                            value={form.afiliadoDuracaoMesesPadrao}
                            onChange={(e) => setForm({ ...form, afiliadoDuracaoMesesPadrao: e.target.value })}
                            placeholder="vazio = vitalício"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            Vazio = vitalício. Conta do primeiro pagamento do cliente.
                        </p>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Janela de atribuição (dias)</label>
                        <input
                            type="number" min={1}
                            value={form.afiliadoJanelaDias}
                            onChange={(e) => setForm({ ...form, afiliadoJanelaDias: Number(e.target.value) })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            Por quanto tempo o clique no link ainda vale para atribuir o cadastro.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => salvar()}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar configuração
                </button>
            </div>
        </div>
    );
}
