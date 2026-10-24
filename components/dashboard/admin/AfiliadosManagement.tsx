"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Handshake, Loader2, Plus, Copy, Check, X, ChevronLeft, Wallet } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { useConfirmModal } from "@/components/ConfirmModal";
import { getAuthHeaders } from "@/lib/authHeaders";
import { formatarCentavos } from "@/lib/cobrancaModelo";

type Afiliado = {
    id: string;
    codigo: string;
    nome: string;
    email: string;
    telefone: string | null;
    documento: string | null;
    chave_pix: string | null;
    percentual: number;
    duracao_meses: number | null;
    status: "ativo" | "pausado" | "encerrado";
    observacoes: string | null;
    created_at: string;
    cliques?: number;
    indicados?: number;
    pagantes?: number;
    comissaoPrevistaCentavos?: number;
    comissaoPagaCentavos?: number;
};

type Indicacao = {
    id: string;
    codigo: string;
    percentual: number;
    duracao_meses: number | null;
    cadastrou_em: string;
    comissao_inicio: string | null;
    comissao_fim: string | null;
    status: "cadastrado" | "pagante" | "encerrado" | "cancelado";
    clientes?: { nome: string; email: string } | null;
};

type Comissao = {
    id: string;
    competencia: string;
    base_centavos: number;
    percentual: number;
    valor_centavos: number;
    status: "prevista" | "aprovada" | "paga" | "cancelada";
    pago_em: string | null;
};

const STATUS_AFILIADO: Record<Afiliado["status"], { label: string; cor: string }> = {
    ativo: { label: "Ativo", cor: "bg-emerald-100 text-emerald-700" },
    pausado: { label: "Pausado", cor: "bg-amber-100 text-amber-700" },
    encerrado: { label: "Encerrado", cor: "bg-slate-100 text-slate-500" },
};

const STATUS_INDICACAO: Record<Indicacao["status"], { label: string; cor: string }> = {
    cadastrado: { label: "Cadastrado", cor: "bg-blue-100 text-blue-700" },
    pagante: { label: "Pagante", cor: "bg-emerald-100 text-emerald-700" },
    encerrado: { label: "Janela encerrada", cor: "bg-slate-100 text-slate-500" },
    cancelado: { label: "Cancelado", cor: "bg-rose-100 text-rose-700" },
};

const STATUS_COMISSAO: Record<Comissao["status"], { label: string; cor: string }> = {
    prevista: { label: "Prevista", cor: "bg-blue-100 text-blue-700" },
    aprovada: { label: "Aprovada", cor: "bg-indigo-100 text-indigo-700" },
    paga: { label: "Paga", cor: "bg-emerald-100 text-emerald-700" },
    cancelada: { label: "Cancelada", cor: "bg-slate-100 text-slate-500" },
};

const dataBr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const competenciaBr = (iso: string) => {
    const [ano, mes] = iso.split("-");
    return `${mes}/${ano}`;
};

const duracaoTexto = (meses: number | null) => (meses === null ? "Vitalício" : `${meses} meses`);

const BASE_LINK = typeof window !== "undefined"
    ? window.location.origin
    : "https://comprareconstruir.com";

/**
 * Parceiros do programa de afiliados.
 *
 * Percentual e duração ficam em cada parceiro, não numa regra global: cada
 * negociação é própria. Mudá-los vale para quem ele trouxer DEPOIS — as
 * indicações já feitas guardam os termos do dia do cadastro.
 */
export function AfiliadosManagement() {
    const { showToast } = useToast();
    const { confirm: confirmModal } = useConfirmModal();

    const [afiliados, setAfiliados] = useState<Afiliado[]>([]);
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [copiado, setCopiado] = useState<string | null>(null);

    const [novoAberto, setNovoAberto] = useState(false);
    const [novo, setNovo] = useState({
        nome: "", email: "", telefone: "", documento: "", chavePix: "",
        codigo: "", percentual: "", duracaoMeses: "", observacoes: "",
    });

    // Detalhe de um parceiro
    const [abertoId, setAbertoId] = useState<string | null>(null);
    const [detalhe, setDetalhe] = useState<{ afiliado: Afiliado; indicacoes: Indicacao[]; comissoes: Comissao[] } | null>(null);
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
    const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/afiliados", { headers, credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao carregar parceiros");
            setAfiliados(json.afiliados || []);
        } catch (error: any) {
            showToast("error", error?.message || "Erro ao carregar os parceiros.");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { load(); }, [load]);

    const abrirDetalhe = useCallback(async (id: string) => {
        setAbertoId(id);
        setCarregandoDetalhe(true);
        setSelecionadas(new Set());
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/admin/afiliados?id=${encodeURIComponent(id)}`, { headers, credentials: "include" });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao carregar o parceiro");
            setDetalhe(json);
        } catch (error: any) {
            showToast("error", error?.message || "Erro ao carregar o parceiro.");
            setAbertoId(null);
        } finally {
            setCarregandoDetalhe(false);
        }
    }, [showToast]);

    const copiarLink = async (codigo: string) => {
        const link = `${BASE_LINK}/?ref=${codigo}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiado(codigo);
            setTimeout(() => setCopiado(null), 2000);
            showToast("success", "Link copiado.");
        } catch {
            showToast("error", `Copie manualmente: ${link}`);
        }
    };

    const criar = async () => {
        if (!novo.nome.trim() || !novo.email.trim()) {
            showToast("error", "Nome e e-mail são obrigatórios.");
            return;
        }
        setSalvando(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/afiliados", {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    nome: novo.nome,
                    email: novo.email,
                    telefone: novo.telefone || undefined,
                    documento: novo.documento || undefined,
                    chavePix: novo.chavePix || undefined,
                    codigo: novo.codigo || undefined,
                    percentual: novo.percentual === "" ? undefined : Number(novo.percentual),
                    // "" aqui é escolha de vitalício, não campo em branco
                    duracaoMeses: novo.duracaoMeses === "" ? null : Number(novo.duracaoMeses),
                    observacoes: novo.observacoes || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao cadastrar");

            showToast("success", `Parceiro cadastrado. Código: ${json.afiliado.codigo}`);
            setNovoAberto(false);
            setNovo({ nome: "", email: "", telefone: "", documento: "", chavePix: "", codigo: "", percentual: "", duracaoMeses: "", observacoes: "" });
            await load();
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível cadastrar.");
        } finally {
            setSalvando(false);
        }
    };

    const atualizar = async (payload: Record<string, unknown>, sucesso: string) => {
        setSalvando(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/afiliados", {
                method: "PATCH",
                headers: { ...headers, "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao salvar");
            showToast("success", sucesso);
            await load();
            if (abertoId) await abrirDetalhe(abertoId);
        } catch (error: any) {
            showToast("error", error?.message || "Não foi possível salvar.");
        } finally {
            setSalvando(false);
        }
    };

    const totalSelecionado = useMemo(() => {
        if (!detalhe) return 0;
        return detalhe.comissoes
            .filter((c) => selecionadas.has(c.id))
            .reduce((s, c) => s + c.valor_centavos, 0);
    }, [detalhe, selecionadas]);

    const quitar = async () => {
        if (selecionadas.size === 0) return;
        const ok = await confirmModal({
            title: "Marcar como pagas?",
            message: `${selecionadas.size} comissão(ões), somando ${formatarCentavos(totalSelecionado)}. Use depois de fazer o repasse — isto não transfere dinheiro, só registra que saiu.`,
            confirmLabel: "Marcar como pagas",
            cancelLabel: "Voltar",
            variant: "warning",
        });
        if (ok !== true) return;
        await atualizar({ acao: "quitar", comissaoIds: [...selecionadas] }, "Comissões quitadas.");
        setSelecionadas(new Set());
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando parceiros...
            </div>
        );
    }

    // ---------- Detalhe ----------
    if (abertoId && detalhe) {
        const a = detalhe.afiliado;
        const aPagar = detalhe.comissoes.filter((c) => c.status === "prevista" || c.status === "aprovada");

        return (
            <div className="space-y-6">
                <button
                    onClick={() => { setAbertoId(null); setDetalhe(null); }}
                    className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                    <ChevronLeft className="h-4 w-4" /> Voltar aos parceiros
                </button>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">{a.nome}</h2>
                            <p className="text-sm text-slate-500">{a.email}{a.telefone ? ` · ${a.telefone}` : ""}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">{a.codigo}</span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_AFILIADO[a.status].cor}`}>
                                    {STATUS_AFILIADO[a.status].label}
                                </span>
                                <span className="text-xs text-slate-500">
                                    {Number(a.percentual)}% · {duracaoTexto(a.duracao_meses)}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => copiarLink(a.codigo)}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            {copiado === a.codigo ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            Copiar link
                        </button>
                    </div>
                    {a.chave_pix && (
                        <p className="mt-3 text-xs text-slate-500">PIX para repasse: <span className="font-medium text-slate-700">{a.chave_pix}</span></p>
                    )}
                </div>

                {/* Indicados */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">
                        Indicados ({detalhe.indicacoes.length})
                    </h3>
                    {detalhe.indicacoes.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-400">
                            Nenhum cadastro atribuído a este parceiro ainda.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3 text-left">Cliente</th>
                                        <th className="px-5 py-3 text-left">Cadastro</th>
                                        <th className="px-5 py-3 text-left">Termos</th>
                                        <th className="px-5 py-3 text-left">Janela</th>
                                        <th className="px-5 py-3 text-left">Situação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {detalhe.indicacoes.map((i) => (
                                        <tr key={i.id}>
                                            <td className="px-5 py-3">
                                                <p className="font-medium text-slate-900">{i.clientes?.nome || "—"}</p>
                                                <p className="text-xs text-slate-400">{i.clientes?.email || ""}</p>
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">{dataBr(i.cadastrou_em)}</td>
                                            <td className="px-5 py-3 text-slate-600">
                                                {Number(i.percentual)}% · {duracaoTexto(i.duracao_meses)}
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">
                                                {i.comissao_inicio
                                                    ? `${dataBr(i.comissao_inicio)} → ${i.comissao_fim ? dataBr(i.comissao_fim) : "vitalício"}`
                                                    : <span className="text-slate-400">aguarda 1º pagamento</span>}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_INDICACAO[i.status].cor}`}>
                                                    {STATUS_INDICACAO[i.status].label}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Extrato */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                        <h3 className="text-sm font-semibold text-slate-900">Extrato de comissões</h3>
                        {aPagar.length > 0 && (
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">
                                    {selecionadas.size > 0
                                        ? `${selecionadas.size} selecionada(s) · ${formatarCentavos(totalSelecionado)}`
                                        : `A pagar: ${formatarCentavos(aPagar.reduce((s, c) => s + c.valor_centavos, 0))}`}
                                </span>
                                <button
                                    onClick={quitar}
                                    disabled={selecionadas.size === 0 || salvando}
                                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                                >
                                    <Wallet className="h-4 w-4" /> Marcar como pagas
                                </button>
                            </div>
                        )}
                    </div>

                    {detalhe.comissoes.length === 0 ? (
                        <p className="px-5 py-8 text-center text-sm text-slate-400">
                            Nenhuma comissão gerada. Elas aparecem aqui quando um pagamento de indicado é confirmado.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="w-10 px-5 py-3"></th>
                                        <th className="px-5 py-3 text-left">Competência</th>
                                        <th className="px-5 py-3 text-right">Base</th>
                                        <th className="px-5 py-3 text-right">%</th>
                                        <th className="px-5 py-3 text-right">Comissão</th>
                                        <th className="px-5 py-3 text-left">Situação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {detalhe.comissoes.map((c) => {
                                        const quitavel = c.status === "prevista" || c.status === "aprovada";
                                        return (
                                            <tr key={c.id} className={c.status === "cancelada" ? "opacity-50" : ""}>
                                                <td className="px-5 py-3">
                                                    {quitavel && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selecionadas.has(c.id)}
                                                            onChange={(e) => {
                                                                const prox = new Set(selecionadas);
                                                                if (e.target.checked) prox.add(c.id); else prox.delete(c.id);
                                                                setSelecionadas(prox);
                                                            }}
                                                            className="h-4 w-4 rounded border-slate-300"
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 font-medium text-slate-900">{competenciaBr(c.competencia)}</td>
                                                <td className="px-5 py-3 text-right text-slate-600">{formatarCentavos(c.base_centavos)}</td>
                                                <td className="px-5 py-3 text-right text-slate-600">{Number(c.percentual)}%</td>
                                                <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatarCentavos(c.valor_centavos)}</td>
                                                <td className="px-5 py-3">
                                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COMISSAO[c.status].cor}`}>
                                                        {STATUS_COMISSAO[c.status].label}
                                                    </span>
                                                    {c.pago_em && <span className="ml-2 text-xs text-slate-400">{dataBr(c.pago_em)}</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Renegociação */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">Termos do parceiro</h3>
                    <p className="mt-1 text-xs text-slate-500">
                        Vale para quem ele trouxer a partir de agora. Os indicados atuais mantêm os termos do dia do cadastro.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Comissão (%)</label>
                            <input
                                type="number" min={0} max={100} step="0.5"
                                defaultValue={Number(a.percentual)}
                                onBlur={(e) => {
                                    const v = Number(e.target.value);
                                    if (v !== Number(a.percentual)) atualizar({ id: a.id, percentual: v }, "Percentual atualizado.");
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Duração (meses)</label>
                            <input
                                type="number" min={1}
                                defaultValue={a.duracao_meses ?? ""}
                                placeholder="vazio = vitalício"
                                onBlur={(e) => {
                                    const v = e.target.value === "" ? null : Number(e.target.value);
                                    if (v !== a.duracao_meses) atualizar({ id: a.id, duracaoMeses: v }, "Duração atualizada.");
                                }}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Situação</label>
                            <select
                                value={a.status}
                                onChange={(e) => atualizar({ id: a.id, status: e.target.value }, "Situação atualizada.")}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                            >
                                <option value="ativo">Ativo</option>
                                <option value="pausado">Pausado</option>
                                <option value="encerrado">Encerrado</option>
                            </select>
                            <p className="mt-1 text-[11px] text-slate-400">
                                Pausado/encerrado faz o link parar de atribuir novos cadastros.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (abertoId && carregandoDetalhe) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Carregando parceiro...
            </div>
        );
    }

    // ---------- Lista ----------
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                        <Handshake className="h-5 w-5 text-orange-500" />
                        Parceiros / Afiliados
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Cada parceiro tem um link próprio. Quem se cadastrar por ele fica vinculado, e a comissão
                        entra quando o pagamento é confirmado.
                    </p>
                </div>
                <button
                    onClick={() => setNovoAberto((v) => !v)}
                    className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                    {novoAberto ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {novoAberto ? "Cancelar" : "Novo parceiro"}
                </button>
            </div>

            {novoAberto && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900">Cadastrar parceiro</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {([
                            ["nome", "Nome *", "Marcos Vieira"],
                            ["email", "E-mail *", "marcos@exemplo.com"],
                            ["telefone", "Telefone", "(31) 99999-8888"],
                            ["documento", "CPF/CNPJ", "para o repasse"],
                            ["chavePix", "Chave PIX", "para o repasse"],
                            ["codigo", "Código do link", "deixe vazio para gerar"],
                        ] as const).map(([campo, rotulo, placeholder]) => (
                            <div key={campo}>
                                <label className="mb-1 block text-xs font-medium text-slate-600">{rotulo}</label>
                                <input
                                    value={(novo as any)[campo]}
                                    onChange={(e) => setNovo({ ...novo, [campo]: e.target.value })}
                                    placeholder={placeholder}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                                />
                            </div>
                        ))}
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Comissão (%)</label>
                            <input
                                type="number" min={0} max={100} step="0.5"
                                value={novo.percentual}
                                onChange={(e) => setNovo({ ...novo, percentual: e.target.value })}
                                placeholder="padrão da configuração"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Duração (meses)</label>
                            <input
                                type="number" min={1}
                                value={novo.duracaoMeses}
                                onChange={(e) => setNovo({ ...novo, duracaoMeses: e.target.value })}
                                placeholder="vazio = vitalício"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="mb-1 block text-xs font-medium text-slate-600">Observações da negociação</label>
                        <textarea
                            value={novo.observacoes}
                            onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })}
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                        />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={criar}
                            disabled={salvando}
                            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                            Cadastrar
                        </button>
                    </div>
                </div>
            )}

            {afiliados.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                    <Handshake className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-600">Nenhum parceiro cadastrado</p>
                    <p className="mt-1 text-xs text-slate-400">
                        Cadastre o primeiro para gerar o link de indicação dele.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-5 py-3 text-left">Parceiro</th>
                                    <th className="px-5 py-3 text-left">Link</th>
                                    <th className="px-5 py-3 text-left">Termos</th>
                                    <th className="px-5 py-3 text-right">Cliques</th>
                                    <th className="px-5 py-3 text-right">Indicados</th>
                                    <th className="px-5 py-3 text-right">Pagantes</th>
                                    <th className="px-5 py-3 text-right">A pagar</th>
                                    <th className="px-5 py-3 text-left">Situação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {afiliados.map((a) => (
                                    <tr
                                        key={a.id}
                                        onClick={() => abrirDetalhe(a.id)}
                                        className="cursor-pointer hover:bg-slate-50"
                                    >
                                        <td className="px-5 py-3">
                                            <p className="font-medium text-slate-900">{a.nome}</p>
                                            <p className="text-xs text-slate-400">{a.email}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); copiarLink(a.codigo); }}
                                                className="flex items-center gap-2 rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white hover:bg-slate-700"
                                            >
                                                {a.codigo}
                                                {copiado === a.codigo ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600">
                                            {Number(a.percentual)}%<br />
                                            <span className="text-slate-400">{duracaoTexto(a.duracao_meses)}</span>
                                        </td>
                                        <td className="px-5 py-3 text-right text-slate-600">{a.cliques ?? 0}</td>
                                        <td className="px-5 py-3 text-right font-medium text-slate-900">{a.indicados ?? 0}</td>
                                        <td className="px-5 py-3 text-right font-medium text-emerald-600">{a.pagantes ?? 0}</td>
                                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                                            {formatarCentavos(a.comissaoPrevistaCentavos ?? 0)}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_AFILIADO[a.status].cor}`}>
                                                {STATUS_AFILIADO[a.status].label}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
