"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useToast } from "@/components/ToastProvider";
import {
    Package, Search, RefreshCw, ChevronDown, ChevronUp,
    Eye, CheckCircle2, Clock, AlertCircle, Building2, MapPin, User, Filter, X
} from "lucide-react";

interface Fornecedor {
    fornecedor_id: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    cnpj: string | null;
    notificado_em: string | null;
    visualizado_em: string | null;
    proposta_status: string | null;
    proposta_valor: number | null;
    proposta_data: string | null;
}

interface SubPedido {
    cotacao_id: string;
    grupo: string;
    status: string;
    data_envio: string;
    itens: Array<{ id: string; nome: string; quantidade: number; unidade: string }>;
    itens_count: number;
    fornecedores: {
        invited: Fornecedor[];
        viewed: Fornecedor[];
        responded: Fornecedor[];
        not_responded: Fornecedor[];
    };
    totals: { invited: number; viewed: number; responded: number; not_responded: number };
}

interface PedidoGeral {
    pedido_geral_id: string;
    cliente: { id: string; nome: string; email: string } | null;
    obra: { id: string; nome: string; cidade?: string; estado?: string } | null;
    data_envio: string;
    sub_pedidos: SubPedido[];
    totals: { invited: number; viewed: number; responded: number; not_responded: number };
}

interface FornecedorOption {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
}

interface FornecedorStats {
    fornecedor_id: string;
    fornecedor: { razao_social?: string; nome_fantasia?: string } | null;
    total_notificados: number;
    total_visualizados: number;
    total_respondidos: number;
    total_nao_respondidos: number;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    } catch { /* ignore */ }
    return headers;
}

function formatDate(s: string | null | undefined) {
    if (!s) return '-';
    try { return new Date(s).toLocaleString('pt-BR'); } catch { return s; }
}

function formatCurrency(v: number | null) {
    if (v == null) return '-';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function supplierName(f: { razao_social: string | null; nome_fantasia: string | null }) {
    return f.nome_fantasia || f.razao_social || 'Fornecedor';
}

const STATUS_BADGE: Record<string, string> = {
    enviada: 'bg-blue-100 text-blue-800',
    em_analise: 'bg-amber-100 text-amber-800',
    respondida: 'bg-emerald-100 text-emerald-800',
    fechada: 'bg-slate-200 text-slate-700',
    cancelada: 'bg-rose-100 text-rose-700',
    rascunho: 'bg-gray-100 text-gray-700',
};

export default function OrdersOverviewManagement() {
    const { showToast } = useToast();
    const [pedidos, setPedidos] = useState<PedidoGeral[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedPedido, setExpandedPedido] = useState<string | null>(null);
    const [expandedSubPedido, setExpandedSubPedido] = useState<string | null>(null);

    const [fornecedorOptions, setFornecedorOptions] = useState<FornecedorOption[]>([]);
    const [filterFornecedorId, setFilterFornecedorId] = useState<string>('');
    const [fornecedorStats, setFornecedorStats] = useState<FornecedorStats | null>(null);

    const fetchFornecedores = async () => {
        const { data } = await supabase
            .from('fornecedores')
            .select('id, razao_social, nome_fantasia')
            .order('razao_social');
        setFornecedorOptions((data as any) || []);
    };

    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const params = new URLSearchParams();
            if (filterFornecedorId) {
                params.set('fornecedor_id', filterFornecedorId);
                params.set('supplier_stats', '1');
            }
            const qs = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`/api/admin/orders-overview${qs}`, { headers, credentials: 'include' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao carregar pedidos');
            setPedidos(json.pedidos || []);
            setFornecedorStats(json.fornecedor_stats || null);
        } catch (e: any) {
            console.error(e);
            showToast('error', e.message || 'Erro ao carregar pedidos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFornecedores();
    }, []);

    useEffect(() => {
        fetchPedidos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterFornecedorId]);

    const filteredPedidos = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return pedidos;
        return pedidos.filter(p => {
            const inCliente = p.cliente?.nome?.toLowerCase().includes(q) || p.cliente?.email?.toLowerCase().includes(q);
            const inObra = p.obra?.nome?.toLowerCase().includes(q);
            const inGrupo = p.sub_pedidos.some(s => s.grupo.toLowerCase().includes(q));
            return inCliente || inObra || inGrupo;
        });
    }, [pedidos, search]);

    const globalTotals = useMemo(() => {
        return pedidos.reduce((acc, p) => {
            acc.pedidos += 1;
            acc.sub_pedidos += p.sub_pedidos.length;
            acc.invited += p.totals.invited;
            acc.viewed += p.totals.viewed;
            acc.responded += p.totals.responded;
            return acc;
        }, { pedidos: 0, sub_pedidos: 0, invited: 0, viewed: 0, responded: 0 });
    }, [pedidos]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                            <Package className="h-5 w-5 text-violet-600" />
                            Acompanhamento de Pedidos
                        </h2>
                        <p className="text-xs text-slate-500">Pedido geral, sub-pedidos por grupo e status dos fornecedores notificados.</p>
                    </div>
                    <button
                        onClick={fetchPedidos}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                    >
                        <RefreshCw className="h-4 w-4" /> Atualizar
                    </button>
                </div>

                {/* Filtros */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por cliente, obra ou grupo..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={filterFornecedorId}
                            onChange={(e) => setFilterFornecedorId(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
                        >
                            <option value="">Todos os fornecedores</option>
                            {fornecedorOptions.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.nome_fantasia || f.razao_social}
                                </option>
                            ))}
                        </select>
                        {filterFornecedorId && (
                            <button
                                onClick={() => setFilterFornecedorId('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                aria-label="Limpar filtro"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Totais globais */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard label="Pedidos" value={globalTotals.pedidos} color="violet" />
                    <StatCard label="Sub-pedidos" value={globalTotals.sub_pedidos} color="slate" />
                    <StatCard label="Notificações" value={globalTotals.invited} color="blue" icon={<AlertCircle className="h-4 w-4" />} />
                    <StatCard label="Visualizações" value={globalTotals.viewed} color="amber" icon={<Eye className="h-4 w-4" />} />
                    <StatCard label="Respostas" value={globalTotals.responded} color="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
                </div>

                {/* Estatísticas por fornecedor */}
                {fornecedorStats && (
                    <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 p-4">
                        <p className="text-sm font-semibold text-violet-900">
                            Resumo do fornecedor: {fornecedorStats.fornecedor?.nome_fantasia || fornecedorStats.fornecedor?.razao_social || '—'}
                        </p>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="Notificados" value={fornecedorStats.total_notificados} color="blue" />
                            <StatCard label="Visualizados" value={fornecedorStats.total_visualizados} color="amber" />
                            <StatCard label="Respondidos" value={fornecedorStats.total_respondidos} color="emerald" />
                            <StatCard label="Não respondidos" value={fornecedorStats.total_nao_respondidos} color="rose" />
                        </div>
                    </div>
                )}
            </div>

            {/* Lista */}
            {loading ? (
                <div className="rounded-2xl bg-white p-10 text-center text-slate-400 border border-slate-200">Carregando...</div>
            ) : filteredPedidos.length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center text-slate-400 border border-slate-200">
                    Nenhum pedido encontrado.
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredPedidos.map(pedido => {
                        const isOpen = expandedPedido === pedido.pedido_geral_id;
                        return (
                            <div key={pedido.pedido_geral_id} className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
                                <button
                                    onClick={() => {
                                        setExpandedPedido(isOpen ? null : pedido.pedido_geral_id);
                                        setExpandedSubPedido(null);
                                    }}
                                    className="w-full flex items-start justify-between gap-4 p-4 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                                                <Package className="h-3 w-3" /> Pedido Geral
                                            </span>
                                            <span className="text-xs text-slate-500">{formatDate(pedido.data_envio)}</span>
                                        </div>
                                        <div className="mt-2 flex items-center gap-4 flex-wrap text-sm">
                                            <span className="inline-flex items-center gap-1 text-slate-700">
                                                <User className="h-4 w-4 text-slate-400" />
                                                {pedido.cliente?.nome || pedido.cliente?.email || 'Cliente desconhecido'}
                                            </span>
                                            {pedido.obra && (
                                                <span className="inline-flex items-center gap-1 text-slate-600">
                                                    <Building2 className="h-4 w-4 text-slate-400" />
                                                    {pedido.obra.nome}
                                                </span>
                                            )}
                                            {pedido.obra?.cidade && (
                                                <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                                                    <MapPin className="h-3.5 w-3.5" /> {pedido.obra.cidade}/{pedido.obra.estado}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Pill color="slate">{pedido.sub_pedidos.length} sub-pedido(s)</Pill>
                                            <Pill color="blue">{pedido.totals.invited} notificados</Pill>
                                            <Pill color="amber">{pedido.totals.viewed} visualizados</Pill>
                                            <Pill color="emerald">{pedido.totals.responded} responderam</Pill>
                                            <Pill color="rose">{pedido.totals.not_responded} não responderam</Pill>
                                        </div>
                                    </div>
                                    {isOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                                </button>

                                {isOpen && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                                        {pedido.sub_pedidos.map(sp => {
                                            const subOpen = expandedSubPedido === sp.cotacao_id;
                                            return (
                                                <div key={sp.cotacao_id} className="rounded-xl bg-white border border-slate-200">
                                                    <button
                                                        onClick={() => setExpandedSubPedido(subOpen ? null : sp.cotacao_id)}
                                                        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-slate-50 text-left"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm font-semibold text-slate-800">{sp.grupo}</span>
                                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[sp.status] || 'bg-slate-100 text-slate-700'}`}>
                                                                    {sp.status}
                                                                </span>
                                                                <span className="text-xs text-slate-500">{sp.itens_count} item(ns)</span>
                                                            </div>
                                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                <MiniPill color="blue">{sp.totals.invited} notif.</MiniPill>
                                                                <MiniPill color="amber">{sp.totals.viewed} visto</MiniPill>
                                                                <MiniPill color="emerald">{sp.totals.responded} resp.</MiniPill>
                                                                <MiniPill color="rose">{sp.totals.not_responded} pend.</MiniPill>
                                                            </div>
                                                        </div>
                                                        {subOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                                    </button>

                                                    {subOpen && (
                                                        <div className="border-t border-slate-100 p-3 space-y-3">
                                                            {sp.itens.length > 0 && (
                                                                <div>
                                                                    <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Itens</p>
                                                                    <ul className="text-xs text-slate-700 list-disc pl-5 space-y-0.5">
                                                                        {sp.itens.map((it: any) => (
                                                                            <li key={it.id}>
                                                                                {it.nome} — {it.quantidade} {it.unidade}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            <FornecedoresTabela title="Responderam" color="emerald" lista={sp.fornecedores.responded} showProposta />
                                                            <FornecedoresTabela title="Visualizaram (sem resposta)" color="amber" lista={sp.fornecedores.viewed.filter(f => !sp.fornecedores.responded.some(r => r.fornecedor_id === f.fornecedor_id))} />
                                                            <FornecedoresTabela title="Notificados (sem visualizar)" color="blue" lista={sp.fornecedores.not_responded.filter(f => !f.visualizado_em)} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
    const colorMap: Record<string, string> = {
        violet: 'bg-violet-50 text-violet-700 border-violet-100',
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
    };
    return (
        <div className={`rounded-xl border ${colorMap[color] || colorMap.slate} px-3 py-2`}>
            <div className="flex items-center justify-between text-[11px] font-medium opacity-80">
                <span>{label}</span>
                {icon}
            </div>
            <div className="mt-1 text-xl font-bold">{value}</div>
        </div>
    );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
    const map: Record<string, string> = {
        slate: 'bg-slate-100 text-slate-700',
        blue: 'bg-blue-100 text-blue-700',
        amber: 'bg-amber-100 text-amber-700',
        emerald: 'bg-emerald-100 text-emerald-700',
        rose: 'bg-rose-100 text-rose-700',
    };
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[color] || map.slate}`}>{children}</span>;
}

function MiniPill({ children, color }: { children: React.ReactNode; color: string }) {
    const map: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700',
        amber: 'bg-amber-50 text-amber-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        rose: 'bg-rose-50 text-rose-700',
    };
    return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${map[color] || 'bg-slate-50 text-slate-600'}`}>{children}</span>;
}

function FornecedoresTabela({ title, color, lista, showProposta }: { title: string; color: string; lista: Fornecedor[]; showProposta?: boolean }) {
    if (lista.length === 0) return null;
    const headerColor: Record<string, string> = {
        emerald: 'text-emerald-700',
        amber: 'text-amber-700',
        blue: 'text-blue-700',
        rose: 'text-rose-700',
    };
    return (
        <div>
            <p className={`text-[11px] font-semibold uppercase mb-1.5 ${headerColor[color] || 'text-slate-700'}`}>
                {title} ({lista.length})
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-left text-slate-500">
                            <th className="px-2 py-1 font-medium">Fornecedor</th>
                            <th className="px-2 py-1 font-medium">Notificado em</th>
                            <th className="px-2 py-1 font-medium">Visualizado em</th>
                            {showProposta && <th className="px-2 py-1 font-medium">Proposta</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {lista.map(f => (
                            <tr key={f.fornecedor_id} className="border-t border-slate-100">
                                <td className="px-2 py-1.5 text-slate-800">
                                    {supplierName(f)}
                                    {f.cnpj && <span className="block text-[10px] text-slate-400">{f.cnpj}</span>}
                                </td>
                                <td className="px-2 py-1.5 text-slate-600">{formatDate(f.notificado_em)}</td>
                                <td className="px-2 py-1.5 text-slate-600">
                                    {f.visualizado_em ? (
                                        <span className="inline-flex items-center gap-1 text-amber-700">
                                            <Eye className="h-3 w-3" /> {formatDate(f.visualizado_em)}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">—</span>
                                    )}
                                </td>
                                {showProposta && (
                                    <td className="px-2 py-1.5 text-slate-600">
                                        <span className="inline-flex items-center gap-1 text-emerald-700">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {f.proposta_status} {f.proposta_valor != null && `• ${formatCurrency(Number(f.proposta_valor))}`}
                                        </span>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
