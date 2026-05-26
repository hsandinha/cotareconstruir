"use client";

import { useState, useEffect, useRef, useMemo } from "react";

import { ClientComparativeSection } from "./ComparativeSection";
import { getQuotationStatusBadge } from "./quotationStatus";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/authHeaders";
import {
    ArrowRight, Calendar, MapPin, FileText, Clock, CheckCircle2, Search,
    XCircle, Inbox, Package, ShoppingCart, MoreVertical, Copy, Ban, Boxes, type LucideIcon
} from "lucide-react";

// Deve coincidir com DRAFT_STORAGE_KEY em SolicitationSection.tsx (reuso da retomada de rascunho)
const QUOTATION_DRAFT_KEY = "cotacao_carrinho_rascunho_v1";

type OrderBucket = "aguardando" | "propostas" | "finalizados" | "cancelados";

// Classifica o pedido em um grupo para os filtros
function getOrderBucket(rawStatus: string, propostas: number): OrderBucket {
    if (rawStatus === "cancelada") return "cancelados";
    if (rawStatus === "fechada") return "finalizados";
    if (rawStatus === "respondida" || rawStatus === "em_analise") return "propostas";
    if (rawStatus === "enviada") return propostas > 0 ? "propostas" : "aguardando";
    return "aguardando"; // rascunho e afins
}

// Ícone/cor por status para identificação visual imediata
function getOrderVisual(rawStatus: string, propostas: number): { icon: LucideIcon; bg: string; color: string } {
    if (rawStatus === "cancelada") return { icon: XCircle, bg: "bg-red-50", color: "text-red-500" };
    if (rawStatus === "fechada") return { icon: CheckCircle2, bg: "bg-slate-100", color: "text-slate-500" };
    if (rawStatus === "respondida" || rawStatus === "em_analise" || (rawStatus === "enviada" && propostas > 0)) {
        return { icon: Inbox, bg: "bg-emerald-50", color: "text-emerald-600" };
    }
    if (rawStatus === "enviada") return { icon: Clock, bg: "bg-amber-50", color: "text-amber-600" };
    if (rawStatus === "rascunho") return { icon: FileText, bg: "bg-slate-100", color: "text-slate-400" };
    return { icon: Package, bg: "bg-blue-50", color: "text-blue-600" };
}

// Guarda, por pedido, quantas propostas já foram vistas (para destacar novidades)
const SEEN_PROPOSALS_KEY = "pedidos_propostas_vistas_v1";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DAY_MS = 86_400_000;
const daysSince = (ts: number) => (ts ? Math.floor((Date.now() - ts) / DAY_MS) : 0);

// Data relativa amigável ("hoje", "há 3 dias", "há 2 meses")
function formatRelative(ts: number): string {
    if (!ts) return "";
    const days = daysSince(ts);
    if (days <= 0) return "hoje";
    if (days === 1) return "ontem";
    if (days < 7) return `há ${days} dias`;
    if (days < 30) { const w = Math.floor(days / 7); return `há ${w} ${w === 1 ? "semana" : "semanas"}`; }
    if (days < 365) { const m = Math.floor(days / 30); return `há ${m} ${m === 1 ? "mês" : "meses"}`; }
    const y = Math.floor(days / 365);
    return `há ${y} ${y === 1 ? "ano" : "anos"}`;
}

export function ClientOrderSection({ onCreateQuotation }: { onCreateQuotation?: () => void } = {}) {
    const { user, initialized } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
    const [filter, setFilter] = useState<"todos" | OrderBucket>("todos");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"recentes" | "propostas" | "status">("recentes");
    const [seenProposals, setSeenProposals] = useState<Record<string, number>>({});
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [worksMap, setWorksMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const deepLinkHandledRef = useRef<string | null>(null);

    // Carrega o registro de propostas já vistas
    useEffect(() => {
        try {
            const raw = localStorage.getItem(SEEN_PROPOSALS_KEY);
            if (raw) setSeenProposals(JSON.parse(raw));
        } catch {
            /* ignora registro corrompido */
        }
    }, []);

    // Marca as propostas de um pedido como vistas (ao abrir o detalhe)
    const markSeen = (orderId: string, count: number) => {
        setSeenProposals(prev => {
            if ((prev[orderId] ?? 0) >= count) return prev;
            const next = { ...prev, [orderId]: count };
            try { localStorage.setItem(SEEN_PROPOSALS_KEY, JSON.stringify(next)); } catch { /* storage indisponível */ }
            return next;
        });
    };

    // Fecha o menu kebab ao clicar fora ou apertar Esc
    useEffect(() => {
        if (!openMenuId) return;
        const onDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenuId(null); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [openMenuId]);

    // Cancela um pedido (muda status para cancelada)
    const handleCancel = async (order: any) => {
        setOpenMenuId(null);
        if (!window.confirm(`Cancelar o pedido #${order.numero}? Esta ação não pode ser desfeita.`)) return;
        try {
            const res = await authFetch('/api/cotacoes/detail', {
                method: 'POST',
                body: JSON.stringify({ action: 'cancel-order', cotacaoId: order.id }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'Falha ao cancelar.');
            }
            const badge = getQuotationStatusBadge('cancelada', order.propostas_count);
            setOrders(prev => prev.map(o => o.id === order.id
                ? { ...o, rawStatus: 'cancelada', status: badge.label, statusColor: badge.color }
                : o));
        } catch (e: any) {
            alert(e?.message || 'Não foi possível cancelar o pedido.');
        }
    };

    // Duplica a cotação: carrega os itens no rascunho e abre a Nova Cotação para revisão
    const handleDuplicate = async (order: any) => {
        setOpenMenuId(null);
        try {
            const res = await authFetch(`/api/cotacoes/detail?id=${order.id}`);
            if (!res.ok) throw new Error();
            const json = await res.json();
            const itens = json?.cotacao?.cotacao_itens || [];
            if (itens.length === 0) {
                alert('Esta cotação não possui itens para duplicar.');
                return;
            }
            const cartItems = itens.map((it: any, idx: number) => ({
                id: Date.now() + idx,
                descricao: it.nome,
                categoria: it.grupo || '',
                quantidade: it.quantidade || 1,
                unidade: it.unidade || 'unid',
                fornecedor: '',
                observacao: it.observacao || '',
                faseNome: it.fase_nome || undefined,
                servicoNome: it.servico_nome || undefined,
                materialId: it.material_id || undefined,
            }));
            // Evita sobrescrever um carrinho em andamento sem confirmar
            try {
                const existing = localStorage.getItem(QUOTATION_DRAFT_KEY);
                if (existing) {
                    const d = JSON.parse(existing);
                    if (d?.items?.length && !window.confirm('Você tem itens em uma cotação em andamento. Substituir pelos itens deste pedido?')) return;
                }
            } catch { /* ignora rascunho corrompido */ }
            localStorage.setItem(QUOTATION_DRAFT_KEY, JSON.stringify({ obraId: order.workId, items: cartItems }));
            onCreateQuotation?.();
        } catch {
            alert('Não foi possível duplicar a cotação.');
        }
    };

    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        // Buscar obras para mapear IDs para nomes
        const fetchWorks = async () => {
            try {
                const res = await authFetch('/api/cotacoes/detail?action=list-obras');
                if (!res.ok) return;
                const json = await res.json();
                const map: Record<string, string> = {};
                (json.data || []).forEach((doc: any) => {
                    map[doc.id] = doc.nome;
                });
                setWorksMap(map);
            } catch (error) {
                console.error('Erro ao buscar obras:', error);
            }
        };

        // Buscar cotações (Orders)
        const fetchQuotations = async () => {
            try {
                const res = await authFetch('/api/cotacoes/detail?action=list');
                if (!res.ok) {
                    console.error("Erro ao carregar pedidos:", res.status);
                    setOrders([]);
                    setLoading(false);
                    return;
                }
                const json = await res.json();
                const data = json.data || [];
                const ordersData = data.map((doc: any) => {
                    const statusBadge = getQuotationStatusBadge(doc.status, doc.propostas_count || 0);

                    return {
                        id: doc.id,
                        numero: doc.numero || doc.id.slice(0, 8),
                        workId: doc.obra_id,
                        date: doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-BR') : 'Data desconhecida',
                        timestamp: doc.created_at ? new Date(doc.created_at).getTime() : 0,
                        items: doc.cotacao_itens?.length || 0,
                        rawStatus: doc.status,
                        status: statusBadge.label,
                        statusColor: statusBadge.color,
                        totalEstimado: "-",
                        propostas_count: doc.propostas_count || 0,
                        melhorProposta: typeof doc.melhor_proposta === 'number' ? doc.melhor_proposta : null,
                        grupos: Array.isArray(doc.grupos) ? doc.grupos : []
                    };
                });
                ordersData.sort((a: any, b: any) => b.timestamp - a.timestamp);
                setOrders(ordersData);
            } catch (error) {
                console.error("Erro ao carregar pedidos:", error);
                setOrders([]);
            }
            setLoading(false);
        };

        fetchWorks();
        fetchQuotations();

        // Configurar subscriptions realtime - just trigger refetch
        const worksChannel = supabase
            .channel('works_orders_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'obras',
                    filter: `user_id=eq.${user.id}`
                },
                () => { fetchWorks(); }
            )
            .subscribe();

        const quotationsChannel = supabase
            .channel('quotations_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cotacoes',
                    filter: `user_id=eq.${user.id}`
                },
                () => { fetchQuotations(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(worksChannel);
            supabase.removeChannel(quotationsChannel);
        };
    }, [user, initialized]);

    useEffect(() => {
        if (orders.length === 0) return;
        if (!searchParams) return;

        const cotacaoId = String(searchParams.get('cotacaoId') || '').trim();
        if (!cotacaoId) return;

        const deepLinkKey = `cotacao:${cotacaoId}`;
        if (deepLinkHandledRef.current === deepLinkKey) return;

        const targetOrder = orders.find((order) => String(order.id) === cotacaoId);
        if (!targetOrder) return;

        setSelectedOrder(targetOrder.id);
        markSeen(targetOrder.id, targetOrder.propostas_count);
        deepLinkHandledRef.current = deepLinkKey;

        const params = new URLSearchParams(searchParams.toString());
        params.delete('cotacaoId');
        params.delete('pedidoId');
        params.delete('chatRoom');
        const nextQuery = params.toString();
        const currentPath = pathname || '/dashboard/cliente';
        router.replace(nextQuery ? `${currentPath}?${nextQuery}` : currentPath);
    }, [orders, searchParams]);

    // Contagem por grupo e lista filtrada para os chips de filtro
    const bucketCounts = useMemo(() => {
        const counts: Record<OrderBucket, number> = { aguardando: 0, propostas: 0, finalizados: 0, cancelados: 0 };
        orders.forEach(o => { counts[getOrderBucket(o.rawStatus, o.propostas_count)] += 1; });
        return counts;
    }, [orders]);

    const filteredOrders = useMemo(() => {
        const term = search.trim().toLowerCase();
        let list = orders;
        if (filter !== "todos") {
            list = list.filter(o => getOrderBucket(o.rawStatus, o.propostas_count) === filter);
        }
        if (term) {
            list = list.filter(o => {
                const obra = (worksMap[o.workId] || "").toLowerCase();
                const grupos = (o.grupos || []).join(" ").toLowerCase();
                return String(o.numero).toLowerCase().includes(term) || obra.includes(term) || grupos.includes(term);
            });
        }
        const statusPriority: Record<OrderBucket, number> = { propostas: 0, aguardando: 1, finalizados: 2, cancelados: 3 };
        return [...list].sort((a, b) => {
            if (sortBy === "propostas") {
                if (b.propostas_count !== a.propostas_count) return b.propostas_count - a.propostas_count;
                return b.timestamp - a.timestamp;
            }
            if (sortBy === "status") {
                const pa = statusPriority[getOrderBucket(a.rawStatus, a.propostas_count)];
                const pb = statusPriority[getOrderBucket(b.rawStatus, b.propostas_count)];
                if (pa !== pb) return pa - pb;
                return b.timestamp - a.timestamp;
            }
            return b.timestamp - a.timestamp; // recentes (padrão)
        });
    }, [orders, filter, search, sortBy, worksMap]);

    // Total de propostas ainda não vistas (para destaque no topo)
    const unseenTotal = useMemo(
        () => orders.reduce((acc, o) => acc + (o.propostas_count > (seenProposals[o.id] ?? 0) ? 1 : 0), 0),
        [orders, seenProposals]
    );

    const filterChips: { id: "todos" | OrderBucket; label: string; count: number }[] = [
        { id: "todos", label: "Todos", count: orders.length },
        { id: "aguardando", label: "Aguardando", count: bucketCounts.aguardando },
        { id: "propostas", label: "Com propostas", count: bucketCounts.propostas },
        { id: "finalizados", label: "Finalizados", count: bucketCounts.finalizados },
        { id: "cancelados", label: "Cancelados", count: bucketCounts.cancelados },
    ];

    if (selectedOrder) {
        const order = orders.find(o => o.id === selectedOrder);
        if (!order) return null;

        return (
            <div className="space-y-6">
                <button
                    onClick={() => setSelectedOrder(null)}
                    className="flex items-center text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
                >
                    <ArrowRight className="h-4 w-4 mr-1 rotate-180" />
                    Voltar para Meus Pedidos
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4 min-w-0">
                        {(() => {
                            const visual = getOrderVisual(order.rawStatus, order.propostas_count);
                            const Icon = visual.icon;
                            return (
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${visual.bg}`}>
                                    <Icon className={`h-6 w-6 ${visual.color}`} />
                                </div>
                            );
                        })()}
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900">Pedido #{order.numero}</h2>
                            <p className="mt-0.5 text-sm text-slate-500 truncate">{worksMap[order.workId] || "Obra não identificada"} • Criado em {order.date}</p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.statusColor}`}>
                        {order.status}
                    </span>
                </div>

                {/* Mapa Comparativo */}
                <ClientComparativeSection orderId={order.id} status={order.rawStatus} />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3" data-tour="cliente-pedidos-header">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                        <ShoppingCart className="h-6 w-6 text-blue-600" />
                        Meus Pedidos
                    </h2>
                    <p className="mt-1 text-slate-500">Acompanhe suas solicitações de cotação e pedidos de compra.</p>
                </div>
                {!loading && orders.length > 0 && (
                    <div className="flex items-center gap-2">
                        {unseenTotal > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                                <Inbox className="h-3.5 w-3.5" />
                                {unseenTotal} {unseenTotal === 1 ? 'com novidade' : 'com novidades'}
                            </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600 tabular-nums">
                            {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
                        </span>
                    </div>
                )}
            </div>

            {/* Busca + ordenação */}
            {!loading && orders.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por nº do pedido ou obra..."
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                aria-label="Limpar busca"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <label htmlFor="orders-sort" className="text-xs font-medium text-slate-400">Ordenar:</label>
                        <select
                            id="orders-sort"
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="recentes">Mais recentes</option>
                            <option value="propostas">Mais propostas</option>
                            <option value="status">Status</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Filtros por status */}
            {!loading && orders.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {filterChips.filter(c => c.id === 'todos' || c.count > 0).map(chip => {
                        const active = filter === chip.id;
                        return (
                            <button
                                key={chip.id}
                                onClick={() => setFilter(chip.id)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${active
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                {chip.label}
                                <span className={`rounded-full px-1.5 text-xs font-bold tabular-nums ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                    {chip.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="grid gap-3.5" data-tour="cliente-pedidos-lista">
                {loading ? (
                    ['s1', 's2', 's3'].map((k) => (
                        <div key={k} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                                    <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
                                </div>
                                <div className="hidden h-8 w-24 animate-pulse rounded-lg bg-slate-100 sm:block" />
                            </div>
                        </div>
                    ))
                ) : orders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                            <ShoppingCart className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-800">Nenhum pedido ainda</h3>
                        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                            Crie sua primeira cotação para começar a receber propostas dos fornecedores.
                        </p>
                        {onCreateQuotation && (
                            <button
                                onClick={onCreateQuotation}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                            >
                                <ShoppingCart className="h-4 w-4" />
                                Criar nova cotação
                            </button>
                        )}
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
                        <p className="text-sm text-slate-500">Nenhum pedido neste filtro.</p>
                        <button onClick={() => setFilter('todos')} className="mt-2 text-sm font-semibold text-blue-600 hover:underline">
                            Ver todos
                        </button>
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const visual = getOrderVisual(order.rawStatus, order.propostas_count);
                        const Icon = visual.icon;
                        const hasPropostas = order.propostas_count > 0;
                        const isUnseen = order.propostas_count > (seenProposals[order.id] ?? 0);
                        const bucket = getOrderBucket(order.rawStatus, order.propostas_count);
                        const diasAguardando = daysSince(order.timestamp);
                        const canCancel = order.rawStatus !== 'fechada' && order.rawStatus !== 'cancelada';
                        return (
                            <div key={order.id} className="relative">
                            <button
                                type="button"
                                onClick={() => { markSeen(order.id, order.propostas_count); setSelectedOrder(order.id); }}
                                className={`group flex w-full items-center gap-4 rounded-2xl border bg-white p-5 pr-12 text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${isUnseen ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200 hover:border-blue-200'}`}
                            >
                                {/* Ícone de status (com ponto de novidade) */}
                                <div className="relative shrink-0">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${visual.bg}`}>
                                        <Icon className={`h-6 w-6 ${visual.color}`} />
                                    </div>
                                    {isUnseen && (
                                        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                                        </span>
                                    )}
                                </div>

                                {/* Conteúdo */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-base font-bold text-slate-900">#{order.numero}</span>
                                        {order.grupos.length > 0 && (
                                            <span className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                                                <Boxes className="h-3 w-3 shrink-0" />
                                                <span className="truncate">
                                                    {order.grupos[0]}{order.grupos.length > 1 ? ` +${order.grupos.length - 1}` : ''}
                                                </span>
                                            </span>
                                        )}
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${order.statusColor}`}>
                                            {order.status}
                                        </span>
                                        {hasPropostas && (
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${isUnseen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                <Inbox className="h-3 w-3" />
                                                {order.propostas_count} {order.propostas_count === 1 ? 'proposta' : 'propostas'}
                                                {isUnseen ? (order.propostas_count === 1 ? ' nova' : ' novas') : ''}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                        <span className="flex min-w-0 items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <span className="truncate">{worksMap[order.workId] || "Obra não identificada"}</span>
                                        </span>
                                        <span className="flex items-center gap-1.5" title={order.date}>
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                            {order.timestamp ? formatRelative(order.timestamp) : order.date}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                                            {order.items} {order.items === 1 ? 'item' : 'itens'}
                                        </span>
                                        {bucket === 'aguardando' && diasAguardando >= 2 && (
                                            <span className="flex items-center gap-1.5 font-medium text-amber-600">
                                                <Clock className="h-3.5 w-3.5" />
                                                aguardando há {diasAguardando} dias
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Melhor proposta + seta */}
                                <div className="flex shrink-0 items-center gap-3">
                                    {order.melhorProposta != null && (
                                        <div className="text-right">
                                            <p className="text-[11px] font-medium text-slate-400">Melhor proposta</p>
                                            <p className="text-base font-bold text-emerald-600 tabular-nums">{formatBRL(order.melhorProposta)}</p>
                                        </div>
                                    )}
                                    <ArrowRight className="h-5 w-5 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500" />
                                </div>
                            </button>

                            {/* Menu de ações (kebab) */}
                            <div className="absolute right-3 top-3" ref={openMenuId === order.id ? menuRef : null}>
                                <button
                                    type="button"
                                    onClick={() => setOpenMenuId(prev => prev === order.id ? null : order.id)}
                                    aria-label="Ações do pedido"
                                    aria-haspopup="menu"
                                    aria-expanded={openMenuId === order.id}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </button>
                                {openMenuId === order.id && (
                                    <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => handleDuplicate(order)}
                                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            <Copy className="h-4 w-4 text-slate-400" />
                                            Duplicar cotação
                                        </button>
                                        {canCancel && (
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => handleCancel(order)}
                                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <Ban className="h-4 w-4" />
                                                Cancelar pedido
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
