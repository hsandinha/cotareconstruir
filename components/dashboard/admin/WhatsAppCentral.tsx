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
    Smartphone, Megaphone, Users, ChevronLeft, ChevronRight, ShieldAlert,
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

/** O número da plataforma, como a Meta o descreve. */
interface NumeroPlataforma {
    configurado: boolean;
    numero?: string | null;
    nome?: string | null;
    qualidade?: string | null;
    verificacao?: string | null;
    erro?: string;
}

/** Uma mensagem de saída na fila geral de disparos. */
interface Disparo {
    id: string;
    tipo: string;
    texto: string | null;
    template_nome: string | null;
    status: string;
    erro: any;
    origem: "automatica" | "central";
    criada_em: string;
    conversa: { id: string; telefone: string; nome_contato: string | null } | null;
    autor?: { id: string; nome: string | null } | null;
}

type Vista = "conversas" | "disparos";

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

    const [vista, setVista] = useState<Vista>("conversas");
    const [numero, setNumero] = useState<NumeroPlataforma | null>(null);

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

    // De qual número as mensagens saem. Vem da Meta, não do banco.
    useEffect(() => {
        let ativo = true;
        (async () => {
            try {
                const res = await authFetch("/api/admin/whatsapp/numero");
                const json = await res.json();
                if (ativo) setNumero(json);
            } catch {
                if (ativo) setNumero({ configurado: false, erro: "Não foi possível consultar o número." });
            }
        })();
        return () => { ativo = false; };
    }, []);

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
            <div className="flex flex-wrap items-start justify-between gap-3">
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

                <div className="flex flex-wrap items-center gap-2">
                    <NumeroDaPlataforma numero={numero} />
                    <button
                        onClick={() => carregarConversas()}
                        className="flex items-center gap-2 rounded-[12px] border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${carregandoLista ? "animate-spin" : ""}`} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Número sem token válido: o envio vai falhar, melhor dizer antes */}
            {numero && !numero.configurado && (
                <div className="flex items-start gap-2 rounded-[12px] bg-rose-50 p-3 text-sm text-rose-800">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        <strong>O número da plataforma não respondeu.</strong> {numero.erro}
                    </p>
                </div>
            )}

            {/* Duas perguntas diferentes: "o que me falaram" e "o que eu mandei" */}
            <div className="flex gap-1.5">
                {([
                    ["conversas", "Conversas", Users],
                    ["disparos", "Disparos do sistema", Megaphone],
                ] as [Vista, string, any][]).map(([id, label, Icone]) => (
                    <button
                        key={id}
                        onClick={() => setVista(id)}
                        className={`flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-medium transition ${
                            vista === id
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                        <Icone className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {vista === "disparos" && (
                <PainelDisparos
                    aoAbrirConversa={(conversaId) => {
                        setVista("conversas");
                        abrirConversa(conversaId);
                    }}
                />
            )}

            <div className={`grid gap-4 lg:grid-cols-[340px_1fr] ${vista === "disparos" ? "hidden" : ""}`}>
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

// ============================================================
// NÚMERO DA PLATAFORMA
// ============================================================

const COR_QUALIDADE: Record<string, string> = {
    GREEN: "bg-emerald-100 text-emerald-700",
    YELLOW: "bg-amber-100 text-amber-700",
    RED: "bg-rose-100 text-rose-700",
};

/**
 * De qual número as mensagens saem.
 *
 * A qualidade vem junto porque é o que antecede o estrago: a Meta rebaixa o
 * número (verde → amarelo → vermelho) quando as pessoas bloqueiam ou
 * denunciam, e quem está disparando precisa ver isso antes do limite cair.
 */
function NumeroDaPlataforma({ numero }: { numero: NumeroPlataforma | null }) {
    if (!numero) {
        return (
            <span className="flex items-center gap-2 rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando número…
            </span>
        );
    }

    if (!numero.configurado) {
        return (
            <span className="flex items-center gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                <ShieldAlert className="h-4 w-4" />
                Número indisponível
            </span>
        );
    }

    return (
        <span className="flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            <span className="text-slate-500">Enviando por</span>
            <strong className="text-slate-900">{numero.numero}</strong>
            {numero.nome && <span className="hidden text-slate-500 sm:inline">· {numero.nome}</span>}
            {numero.qualidade && (
                <span className={`rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold ${
                    COR_QUALIDADE[numero.qualidade] || "bg-slate-100 text-slate-600"
                }`}>
                    {numero.qualidade}
                </span>
            )}
        </span>
    );
}

// ============================================================
// DISPAROS DO SISTEMA
// ============================================================

const ROTULO_STATUS: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-slate-100 text-slate-600" },
    enviada: { label: "Enviada", cls: "bg-blue-100 text-blue-700" },
    entregue: { label: "Entregue", cls: "bg-indigo-100 text-indigo-700" },
    lida: { label: "Lida", cls: "bg-emerald-100 text-emerald-700" },
    falhou: { label: "Falhou", cls: "bg-rose-100 text-rose-700" },
};

/**
 * Fila de tudo que saiu do número, do disparo automático de cotação à
 * resposta escrita na Central — com o status de entrega e o erro quando a
 * Meta recusa (template não aprovado, janela fechada, número inválido).
 */
function PainelDisparos({ aoAbrirConversa }: { aoAbrirConversa: (conversaId: string) => void }) {
    const { showToast } = useToast();
    const [disparos, setDisparos] = useState<Disparo[]>([]);
    const [resumo, setResumo] = useState({ total: 0, falhas: 0, automaticas: 0, manuais: 0 });
    const [totalFiltrado, setTotalFiltrado] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [origem, setOrigem] = useState<"" | "automatica" | "central">("");
    const [status, setStatus] = useState("");
    const [busca, setBusca] = useState("");
    const [pagina, setPagina] = useState(0);

    const carregar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCarregando(true);
        try {
            const params = new URLSearchParams({ pagina: String(pagina) });
            if (origem) params.set("origem", origem);
            if (status) params.set("status", status);
            if (busca.trim()) params.set("busca", busca.trim());

            const res = await authFetch(`/api/admin/whatsapp/disparos?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Erro ao carregar os disparos");

            setDisparos(json.data || []);
            setResumo(json.resumo);
            setTotalFiltrado(json.total_filtrado || 0);
        } catch (e: any) {
            if (!silencioso) showToast("error", e.message || "Erro ao carregar os disparos");
        } finally {
            setCarregando(false);
        }
    }, [origem, status, busca, pagina, showToast]);

    useEffect(() => {
        const t = setTimeout(() => carregar(), busca ? 350 : 0);
        return () => clearTimeout(t);
    }, [carregar, busca]);

    // Filtro novo com a página velha devolveria lista vazia sem motivo
    useEffect(() => { setPagina(0); }, [origem, status, busca]);

    usePolling(() => carregar(true), 20000);

    const porPagina = 50;
    const ultimaPagina = Math.max(0, Math.ceil(totalFiltrado / porPagina) - 1);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <CartaoDisparo rotulo="Total enviado" valor={resumo.total} />
                <CartaoDisparo rotulo="Automáticas" valor={resumo.automaticas} />
                <CartaoDisparo rotulo="Respondidas na Central" valor={resumo.manuais} />
                <CartaoDisparo rotulo="Falhas" valor={resumo.falhas} alerta={resumo.falhas > 0} />
            </div>

            <div className="rounded-[20px] border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
                    <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar no texto ou no template"
                            className="w-full rounded-[12px] border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
                        />
                    </div>
                    <select
                        value={origem}
                        onChange={(e) => setOrigem(e.target.value as any)}
                        className="rounded-[12px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                        <option value="">Toda origem</option>
                        <option value="automatica">Automáticas</option>
                        <option value="central">Da Central</option>
                    </select>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="rounded-[12px] border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                        <option value="">Todo status</option>
                        <option value="enviada">Enviada</option>
                        <option value="entregue">Entregue</option>
                        <option value="lida">Lida</option>
                        <option value="falhou">Falhou</option>
                    </select>
                </div>

                {carregando && disparos.length === 0 ? (
                    <div className="flex h-40 items-center justify-center text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : disparos.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-400">
                        <Megaphone className="h-7 w-7" />
                        {busca || origem || status
                            ? "Nenhum disparo com esses filtros."
                            : "Nada disparado ainda. Cada notificação de cotação, proposta ou pedido aparece aqui assim que sai."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 text-left">Quando</th>
                                    <th className="px-4 py-2 text-left">Destinatário</th>
                                    <th className="px-4 py-2 text-left">Mensagem</th>
                                    <th className="px-4 py-2 text-left">Origem</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {disparos.map((d) => {
                                    const rotulo = ROTULO_STATUS[d.status] || ROTULO_STATUS.enviada;
                                    return (
                                        <tr
                                            key={d.id}
                                            onClick={() => d.conversa && aoAbrirConversa(d.conversa.id)}
                                            className="cursor-pointer transition hover:bg-slate-50"
                                        >
                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                                                {horaCheia(d.criada_em)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-800">
                                                    {d.conversa?.nome_contato || "—"}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {d.conversa ? telefoneBonito(d.conversa.telefone) : "—"}
                                                </p>
                                            </td>
                                            <td className="max-w-md px-4 py-3">
                                                <p className="truncate text-slate-700">{d.texto || `[${d.tipo}]`}</p>
                                                {d.template_nome && (
                                                    <p className="truncate text-[11px] text-slate-400">{d.template_nome}</p>
                                                )}
                                                {d.status === "falhou" && d.erro?.message && (
                                                    <p className="truncate text-[11px] text-rose-600">{d.erro.message}</p>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                {d.origem === "automatica" ? (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                                        <Bot className="h-3 w-3" /> Sistema
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-500">
                                                        {d.autor?.nome || "Central"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span className={`rounded-[3px] px-2 py-0.5 text-[11px] font-semibold ${rotulo.cls}`}>
                                                    {rotulo.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {ultimaPagina > 0 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
                        <span className="text-slate-500">
                            Página {pagina + 1} de {ultimaPagina + 1} · {totalFiltrado} disparos
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                                disabled={pagina === 0}
                                className="rounded-[10px] border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30 hover:bg-slate-50"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setPagina((p) => Math.min(ultimaPagina, p + 1))}
                                disabled={pagina >= ultimaPagina}
                                className="rounded-[10px] border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30 hover:bg-slate-50"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function CartaoDisparo({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
    return (
        <div className={`rounded-[12px] border p-3 ${alerta ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
            <p className="text-xs text-slate-500">{rotulo}</p>
            <p className={`mt-0.5 text-lg font-bold ${alerta ? "text-rose-700" : "text-slate-900"}`}>{valor}</p>
        </div>
    );
}
