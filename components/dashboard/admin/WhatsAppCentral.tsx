"use client";

/**
 * Central de WhatsApp
 *
 * Os dois lados do canal na mesma tela: o que a plataforma disparou
 * (cotação, proposta, pedido) e o que o cliente respondeu — com uma caixa
 * para responder de volta.
 *
 * A janela de 24h da Meta manda no rodapé: dentro dela dá para escrever
 * livremente; fora dela só template aprovado, e a tela troca sozinha.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    MessageCircle, Search, Send, RefreshCw, Loader2, Archive, ArchiveRestore,
    Check, CheckCheck, AlertTriangle, Clock, Bot, Paperclip, Building2, UserCircle2, Inbox,
} from "lucide-react";
import { authFetch } from "@/lib/authHeaders";
import { useToast } from "@/components/ToastProvider";
import { usePolling } from "@/lib/hooks";

// ============================================================
// TIPOS
// ============================================================

interface Conversa {
    id: string;
    telefone: string;
    nome_contato: string | null;
    nome_exibicao: string;
    vinculo: "fornecedor" | "cliente" | "usuario" | null;
    nao_lidas: number;
    arquivada: boolean;
    ultima_mensagem_texto: string | null;
    ultima_mensagem_em: string | null;
    ultima_mensagem_direcao: "entrada" | "saida" | null;
    janela_aberta: boolean;
    janela_expira_em: string | null;
    fornecedor?: { id: string; razao_social: string; nome_fantasia: string | null } | null;
    cliente?: { id: string; nome: string; razao_social: string | null } | null;
    usuario?: { id: string; nome: string | null; email: string } | null;
}

interface Mensagem {
    id: string;
    direcao: "entrada" | "saida";
    tipo: string;
    texto: string | null;
    template_nome: string | null;
    template_params: string[] | null;
    media_id: string | null;
    media_mime: string | null;
    media_nome: string | null;
    status: string;
    erro: any;
    origem: "automatica" | "central" | "recebida";
    criada_em: string;
    autor?: { id: string; nome: string | null } | null;
}

interface Template {
    nome: string;
    corpo: string;
    variaveis: number;
}

type Filtro = "todas" | "nao_lidas" | "arquivadas";

// ============================================================
// HELPERS DE APRESENTAÇÃO
// ============================================================

function telefoneBonito(telefone: string): string {
    const d = (telefone || "").replace(/\D/g, "");
    const semDdi = d.startsWith("55") ? d.slice(2) : d;
    if (semDdi.length === 11) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`;
    if (semDdi.length === 10) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
    return `+${d}`;
}

/** Hoje vira hora; esta semana vira dia; o resto vira data. */
function quando(iso: string | null): string {
    if (!iso) return "";
    const data = new Date(iso);
    const agora = new Date();
    const mesmoDia = data.toDateString() === agora.toDateString();
    if (mesmoDia) return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const diasAtras = Math.floor((agora.getTime() - data.getTime()) / 86400000);
    if (diasAtras < 7) return data.toLocaleDateString("pt-BR", { weekday: "short" });
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function horaCheia(iso: string): string {
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
}

/** Quanto falta da janela de 24h, em texto curto para o rodapé. */
function restanteDaJanela(expiraEm: string | null): string {
    if (!expiraEm) return "";
    const ms = new Date(expiraEm).getTime() - Date.now();
    if (ms <= 0) return "";
    const horas = Math.floor(ms / 3600000);
    if (horas >= 1) return `${horas}h restantes`;
    return `${Math.max(1, Math.floor(ms / 60000))} min restantes`;
}

const SELO_VINCULO: Record<string, { label: string; cls: string; icon: any }> = {
    fornecedor: { label: "Fornecedor", cls: "bg-indigo-100 text-indigo-700", icon: Building2 },
    cliente: { label: "Cliente", cls: "bg-emerald-100 text-emerald-700", icon: UserCircle2 },
    usuario: { label: "Usuário", cls: "bg-slate-100 text-slate-600", icon: UserCircle2 },
};

/** Os ✓ do WhatsApp, no canto da bolha enviada. */
function IconeStatus({ status }: { status: string }) {
    if (status === "falhou") return <AlertTriangle className="h-3.5 w-3.5 text-rose-200" />;
    if (status === "lida") return <CheckCheck className="h-3.5 w-3.5 text-sky-200" />;
    if (status === "entregue") return <CheckCheck className="h-3.5 w-3.5 text-blue-200" />;
    if (status === "enviada") return <Check className="h-3.5 w-3.5 text-blue-200" />;
    return <Clock className="h-3.5 w-3.5 text-blue-200" />;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function WhatsAppCentral() {
    const { showToast } = useToast();

    const [conversas, setConversas] = useState<Conversa[]>([]);
    const [carregandoLista, setCarregandoLista] = useState(true);
    const [busca, setBusca] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("todas");

    const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
    const [mensagens, setMensagens] = useState<Mensagem[]>([]);
    const [carregandoThread, setCarregandoThread] = useState(false);
    const [janelaAberta, setJanelaAberta] = useState(true);
    const [janelaExpiraEm, setJanelaExpiraEm] = useState<string | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);

    const [rascunho, setRascunho] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [templateEscolhido, setTemplateEscolhido] = useState("");
    const [variaveis, setVariaveis] = useState<string[]>([]);

    const fimDaThread = useRef<HTMLDivElement>(null);

    const selecionada = useMemo(
        () => conversas.find((c) => c.id === selecionadaId) || null,
        [conversas, selecionadaId],
    );

    // ---------- Lista ----------

    const carregarConversas = useCallback(async (silencioso = false) => {
        if (!silencioso) setCarregandoLista(true);
        try {
            const params = new URLSearchParams();
            if (busca.trim()) params.set("busca", busca.trim());
            if (filtro === "arquivadas") params.set("arquivadas", "1");

            const res = await authFetch(`/api/admin/whatsapp/conversas?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Erro ao carregar conversas");
            setConversas(json.data || []);
        } catch (e: any) {
            if (!silencioso) showToast("error", e.message || "Erro ao carregar conversas");
        } finally {
            setCarregandoLista(false);
        }
    }, [busca, filtro, showToast]);

    useEffect(() => {
        const t = setTimeout(() => carregarConversas(), busca ? 350 : 0);
        return () => clearTimeout(t);
    }, [carregarConversas, busca]);

    // ---------- Conversa aberta ----------

    const carregarThread = useCallback(async (conversaId: string, silencioso = false) => {
        if (!silencioso) setCarregandoThread(true);
        try {
            const res = await authFetch(`/api/admin/whatsapp/mensagens?conversa_id=${conversaId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Erro ao carregar mensagens");

            setMensagens(json.data || []);
            setJanelaAberta(Boolean(json.janela_aberta));
            setJanelaExpiraEm(json.janela_expira_em || null);
            setTemplates(json.templates || []);

            // O GET zerou o contador no banco; a lista precisa acompanhar
            setConversas((atual) =>
                atual.map((c) => (c.id === conversaId ? { ...c, nao_lidas: 0 } : c)),
            );
        } catch (e: any) {
            if (!silencioso) showToast("error", e.message || "Erro ao carregar mensagens");
        } finally {
            setCarregandoThread(false);
        }
    }, [showToast]);

    // Mensagem nova chega pelo webhook, não por aqui — só o relógio avisa
    usePolling(() => {
        carregarConversas(true);
        if (selecionadaId) carregarThread(selecionadaId, true);
    }, 15000);

    const abrirConversa = (conversaId: string) => {
        setSelecionadaId(conversaId);
        setRascunho("");
        setTemplateEscolhido("");
        setVariaveis([]);
        setMensagens([]);
        carregarThread(conversaId);
    };

    // Chegou mensagem nova: rola para o fim
    useEffect(() => {
        fimDaThread.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensagens.length]);

    // ---------- Envio ----------

    const enviarTexto = async () => {
        const corpo = rascunho.trim();
        if (!corpo || !selecionadaId || enviando) return;

        setEnviando(true);
        try {
            const res = await authFetch("/api/admin/whatsapp/mensagens", {
                method: "POST",
                body: JSON.stringify({ conversa_id: selecionadaId, texto: corpo }),
            });
            const json = await res.json();
            if (!res.ok) {
                // 422 = a janela fechou enquanto a tela estava aberta
                if (json.janela_aberta === false) setJanelaAberta(false);
                throw new Error(json.error || "Falha ao enviar");
            }
            setRascunho("");
            await carregarThread(selecionadaId, true);
            carregarConversas(true);
        } catch (e: any) {
            showToast("error", e.message || "Falha ao enviar");
        } finally {
            setEnviando(false);
        }
    };

    const enviarTemplate = async () => {
        if (!templateEscolhido || !selecionadaId || enviando) return;

        setEnviando(true);
        try {
            const res = await authFetch("/api/admin/whatsapp/mensagens", {
                method: "POST",
                body: JSON.stringify({
                    conversa_id: selecionadaId,
                    template: templateEscolhido,
                    params: variaveis,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Falha ao enviar template");

            showToast("success", "Template enviado");
            setTemplateEscolhido("");
            setVariaveis([]);
            await carregarThread(selecionadaId, true);
            carregarConversas(true);
        } catch (e: any) {
            showToast("error", e.message || "Falha ao enviar template");
        } finally {
            setEnviando(false);
        }
    };

    const alternarArquivo = async (conversa: Conversa) => {
        try {
            const res = await authFetch("/api/admin/whatsapp/conversas", {
                method: "PATCH",
                body: JSON.stringify({ id: conversa.id, arquivada: !conversa.arquivada }),
            });
            if (!res.ok) throw new Error((await res.json()).error || "Erro ao arquivar");
            showToast("success", conversa.arquivada ? "Conversa reaberta" : "Conversa arquivada");
            if (conversa.id === selecionadaId) setSelecionadaId(null);
            carregarConversas(true);
        } catch (e: any) {
            showToast("error", e.message || "Erro ao arquivar");
        }
    };

    // ---------- Derivados ----------

    const listaVisivel = useMemo(
        () => (filtro === "nao_lidas" ? conversas.filter((c) => c.nao_lidas > 0) : conversas),
        [conversas, filtro],
    );

    const totalNaoLidas = useMemo(
        () => conversas.reduce((t, c) => t + (c.nao_lidas || 0), 0),
        [conversas],
    );

    const templateAtual = templates.find((t) => t.nome === templateEscolhido);

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Atendimento</p>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        Central de WhatsApp
                        {totalNaoLidas > 0 && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                                {totalNaoLidas}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-slate-500">
                        Tudo que a plataforma disparou e tudo que responderam, na mesma linha do tempo.
                    </p>
                </div>
                <button
                    onClick={() => carregarConversas()}
                    className="flex items-center gap-2 rounded-[12px] border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                    <RefreshCw className={`h-4 w-4 ${carregandoLista ? "animate-spin" : ""}`} />
                    Atualizar
                </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
                {/* -------- Lista de conversas -------- */}
                <div className={`rounded-[20px] border border-slate-100 bg-white shadow-sm ${selecionadaId ? "hidden lg:block" : ""}`}>
                    <div className="space-y-3 border-b border-slate-100 p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar por nome ou telefone"
                                className="w-full rounded-[12px] border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
                            />
                        </div>
                        <div className="flex gap-1.5">
                            {([
                                ["todas", "Todas"],
                                ["nao_lidas", "Não lidas"],
                                ["arquivadas", "Arquivadas"],
                            ] as [Filtro, string][]).map(([id, label]) => (
                                <button
                                    key={id}
                                    onClick={() => setFiltro(id)}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                        filtro === id
                                            ? "bg-blue-600 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="max-h-[calc(100vh-320px)] min-h-[320px] overflow-y-auto">
                        {carregandoLista && conversas.length === 0 ? (
                            <div className="flex h-40 items-center justify-center text-slate-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : listaVisivel.length === 0 ? (
                            <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-400">
                                <Inbox className="h-7 w-7" />
                                {busca
                                    ? "Nenhuma conversa com esse termo."
                                    : filtro === "nao_lidas"
                                        ? "Nenhuma mensagem esperando resposta."
                                        : "Ainda não há conversas. Elas aparecem aqui assim que a plataforma disparar uma notificação ou alguém escrever para o número."}
                            </div>
                        ) : (
                            listaVisivel.map((c) => {
                                const selo = c.vinculo ? SELO_VINCULO[c.vinculo] : null;
                                const ativa = c.id === selecionadaId;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => abrirConversa(c.id)}
                                        className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                                            ativa ? "bg-blue-50/60" : ""
                                        }`}
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                                            {(c.nome_exibicao || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className="truncate text-sm font-semibold text-slate-900">
                                                    {c.nome_exibicao || telefoneBonito(c.telefone)}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-slate-400">
                                                    {quando(c.ultima_mensagem_em)}
                                                </span>
                                            </div>
                                            <p className="truncate text-xs text-slate-500">
                                                {c.ultima_mensagem_direcao === "saida" && (
                                                    <span className="text-slate-400">Você: </span>
                                                )}
                                                {c.ultima_mensagem_texto || telefoneBonito(c.telefone)}
                                            </p>
                                            <div className="mt-1 flex items-center gap-1.5">
                                                {selo && (
                                                    <span className={`rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium ${selo.cls}`}>
                                                        {selo.label}
                                                    </span>
                                                )}
                                                {c.nao_lidas > 0 && (
                                                    <span className="ml-auto rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                                        {c.nao_lidas}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* -------- Conversa aberta -------- */}
                <div className="flex min-h-[520px] flex-col rounded-[20px] border border-slate-100 bg-white shadow-sm">
                    {!selecionada ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-slate-400">
                            <MessageCircle className="h-10 w-10" />
                            <p className="text-sm">Escolha uma conversa para ver o histórico e responder.</p>
                        </div>
                    ) : (
                        <>
                            {/* Cabeçalho */}
                            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                                <button
                                    onClick={() => setSelecionadaId(null)}
                                    className="rounded-[8px] px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 lg:hidden"
                                >
                                    ←
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {selecionada.nome_exibicao || telefoneBonito(selecionada.telefone)}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                        {telefoneBonito(selecionada.telefone)}
                                        {selecionada.fornecedor && ` · ${selecionada.fornecedor.razao_social}`}
                                        {selecionada.cliente && ` · ${selecionada.cliente.nome}`}
                                    </p>
                                </div>
                                <button
                                    onClick={() => alternarArquivo(selecionada)}
                                    title={selecionada.arquivada ? "Reabrir conversa" : "Arquivar conversa"}
                                    className="rounded-[10px] border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                                >
                                    {selecionada.arquivada
                                        ? <ArchiveRestore className="h-4 w-4" />
                                        : <Archive className="h-4 w-4" />}
                                </button>
                            </div>

                            {/* Mensagens */}
                            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4 max-h-[calc(100vh-420px)]">
                                {carregandoThread ? (
                                    <div className="flex h-32 items-center justify-center text-slate-400">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    </div>
                                ) : mensagens.length === 0 ? (
                                    <p className="py-10 text-center text-sm text-slate-400">
                                        Nenhuma mensagem nesta conversa ainda.
                                    </p>
                                ) : (
                                    mensagens.map((m) => <Bolha key={m.id} mensagem={m} />)
                                )}
                                <div ref={fimDaThread} />
                            </div>

                            {/* Composer */}
                            <div className="border-t border-slate-100 p-3">
                                {janelaAberta ? (
                                    <>
                                        <div className="flex items-end gap-2">
                                            <textarea
                                                value={rascunho}
                                                onChange={(e) => setRascunho(e.target.value)}
                                                onKeyDown={(e) => {
                                                    // Enter envia; Shift+Enter quebra linha
                                                    if (e.key === "Enter" && !e.shiftKey) {
                                                        e.preventDefault();
                                                        enviarTexto();
                                                    }
                                                }}
                                                rows={2}
                                                maxLength={4096}
                                                placeholder="Escreva sua resposta…"
                                                className="flex-1 resize-none rounded-[12px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                                            />
                                            <button
                                                onClick={enviarTexto}
                                                disabled={enviando || !rascunho.trim()}
                                                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
                                            >
                                                {enviando
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Send className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {janelaExpiraEm && (
                                            <p className="mt-1.5 text-[11px] text-slate-400">
                                                Janela de 24h aberta · {restanteDaJanela(janelaExpiraEm)}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex gap-2 rounded-[12px] bg-amber-50 p-3 text-xs text-amber-800">
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <p>
                                                A janela de 24h fechou. A Meta só entrega <strong>template aprovado</strong> até
                                                o contato responder — aí a conversa livre reabre.
                                            </p>
                                        </div>

                                        <select
                                            value={templateEscolhido}
                                            onChange={(e) => {
                                                const nome = e.target.value;
                                                setTemplateEscolhido(nome);
                                                const t = templates.find((x) => x.nome === nome);
                                                setVariaveis(Array(t?.variaveis || 0).fill(""));
                                            }}
                                            className="w-full rounded-[12px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                                        >
                                            <option value="">Escolha um template aprovado…</option>
                                            {templates.map((t) => (
                                                <option key={t.nome} value={t.nome}>{t.nome}</option>
                                            ))}
                                        </select>

                                        {templateAtual && (
                                            <>
                                                <p className="whitespace-pre-wrap rounded-[12px] bg-slate-50 p-3 text-xs text-slate-600">
                                                    {templateAtual.corpo.replace(
                                                        /\{\{(\d+)\}\}/g,
                                                        (_, i) => variaveis[Number(i) - 1] || `{{${i}}}`,
                                                    )}
                                                </p>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {variaveis.map((valor, i) => (
                                                        <input
                                                            key={i}
                                                            value={valor}
                                                            onChange={(e) => {
                                                                const novo = [...variaveis];
                                                                novo[i] = e.target.value;
                                                                setVariaveis(novo);
                                                            }}
                                                            placeholder={`Variável {{${i + 1}}}`}
                                                            className="rounded-[12px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                                                        />
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={enviarTemplate}
                                                    disabled={enviando || variaveis.some((v) => !v.trim())}
                                                    className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                                                >
                                                    {enviando
                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                        : <Send className="h-4 w-4" />}
                                                    Enviar template
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// BOLHA
// ============================================================

function Bolha({ mensagem: m }: { mensagem: Mensagem }) {
    const saida = m.direcao === "saida";
    const falhou = m.status === "falhou";
    const imagem = m.media_id && m.media_mime?.startsWith("image/");

    return (
        <div className={`flex ${saida ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] rounded-[12px] px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                    falhou
                        ? "bg-rose-50 text-rose-900 ring-1 ring-rose-200"
                        : saida
                            ? "bg-blue-600 text-white"
                            : "bg-white text-slate-800 ring-1 ring-slate-100"
                }`}
            >
                {/* Disparo do sistema: dá para diferenciar do que a equipe escreveu */}
                {saida && m.origem === "automatica" && (
                    <p className={`mb-1 flex items-center gap-1 text-[10px] font-medium ${falhou ? "text-rose-600" : "text-blue-100"}`}>
                        <Bot className="h-3 w-3" />
                        Automática{m.template_nome ? ` · ${m.template_nome}` : ""}
                    </p>
                )}
                {saida && m.origem === "central" && m.autor?.nome && (
                    <p className={`mb-1 text-[10px] font-medium ${falhou ? "text-rose-600" : "text-blue-100"}`}>
                        {m.autor.nome}
                    </p>
                )}

                {imagem && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={`/api/admin/whatsapp/media?id=${m.media_id}`}
                        alt={m.media_nome || "Imagem recebida"}
                        className="mb-1.5 max-h-72 rounded-[8px] object-contain"
                    />
                )}
                {m.media_id && !imagem && (
                    <a
                        href={`/api/admin/whatsapp/media?id=${m.media_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`mb-1.5 flex items-center gap-1.5 text-xs underline ${saida ? "text-blue-100" : "text-blue-600"}`}
                    >
                        <Paperclip className="h-3.5 w-3.5" />
                        {m.media_nome || `Abrir ${m.tipo}`}
                    </a>
                )}

                {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}

                {falhou && m.erro?.message && (
                    <p className="mt-1 text-[11px] text-rose-700">Falhou: {m.erro.message}</p>
                )}

                <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                    falhou ? "text-rose-500" : saida ? "text-blue-200" : "text-slate-400"
                }`}>
                    <span>{horaCheia(m.criada_em)}</span>
                    {saida && <IconeStatus status={m.status} />}
                </div>
            </div>
        </div>
    );
}
