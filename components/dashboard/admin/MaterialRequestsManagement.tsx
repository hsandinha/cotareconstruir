"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useToast } from "@/components/ToastProvider";
import {
    Package, Check, X, AlertTriangle, Loader2, Search, RefreshCw,
    CheckCircle2, XCircle, Clock, Link2, Sparkles, ChevronDown, ChevronUp
} from "lucide-react";

interface Similar {
    id: string;
    nome: string;
    unidade: string;
    descricao?: string | null;
    similarity: number;
}

interface SolicitacaoMaterial {
    id: string;
    fornecedor_id: string | null;
    solicitante_user_id: string | null;
    tipo_solicitante: 'cliente' | 'fornecedor';
    nome: string;
    unidade: string;
    descricao: string | null;
    grupo_sugerido: string | null;
    status: 'pendente' | 'aprovada' | 'recusada';
    resposta_admin: string | null;
    similares: Similar[] | null;
    contexto: any;
    material_aprovado_id: string | null;
    created_at: string;
    updated_at: string;
    fornecedor?: { id: string; razao_social: string; nome_fantasia?: string; cnpj?: string } | null;
    solicitante?: { id: string; nome?: string; email?: string; role?: string } | null;
}

interface Grupo {
    id: string;
    nome: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    } catch {
        // ignore
    }
    return headers;
}

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: any }> = {
    pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800', icon: Clock },
    aprovada: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
    recusada: { label: 'Recusada', cls: 'bg-rose-100 text-rose-800', icon: XCircle },
};

export default function MaterialRequestsManagement() {
    const { showToast } = useToast();
    const [items, setItems] = useState<SolicitacaoMaterial[]>([]);
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'pendente' | 'aprovada' | 'recusada' | 'all'>('pendente');
    const [search, setSearch] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editState, setEditState] = useState<Record<string, { nome: string; unidade: string; descricao: string; grupo_ids: string[]; resposta: string }>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
            const res = await fetch(`/api/admin/material-requests${qs}`, { headers, credentials: 'include' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao carregar solicitações');
            setItems(json.data || []);
        } catch (e: any) {
            console.error(e);
            showToast('error', e.message || 'Erro ao carregar solicitações');
        } finally {
            setLoading(false);
        }
    };

    const fetchGrupos = async () => {
        const { data } = await supabase.from('grupos_insumo').select('id, nome').order('nome');
        setGrupos(data || []);
    };

    useEffect(() => { fetchGrupos(); }, []);
    useEffect(() => { fetchData(); }, [statusFilter]);

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter((i) =>
            i.nome.toLowerCase().includes(q)
            || (i.descricao || '').toLowerCase().includes(q)
            || (i.fornecedor?.razao_social || '').toLowerCase().includes(q)
            || (i.solicitante?.email || '').toLowerCase().includes(q)
        );
    }, [items, search]);

    const ensureEditState = (item: SolicitacaoMaterial) => {
        if (editState[item.id]) return editState[item.id];
        const init = {
            nome: item.nome,
            unidade: item.unidade || 'unid',
            descricao: item.descricao || '',
            grupo_ids: [] as string[],
            resposta: '',
        };
        setEditState((prev) => ({ ...prev, [item.id]: init }));
        return init;
    };

    const updateEdit = (id: string, patch: Partial<{ nome: string; unidade: string; descricao: string; grupo_ids: string[]; resposta: string }>) => {
        setEditState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } as any }));
    };

    const handleApprove = async (item: SolicitacaoMaterial) => {
        const state = editState[item.id] || ensureEditState(item);
        setProcessingId(item.id);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/material-requests', {
                method: 'PATCH',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    id: item.id,
                    action: 'approve',
                    nome: state.nome,
                    unidade: state.unidade,
                    descricao: state.descricao,
                    grupo_ids: state.grupo_ids,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao aprovar');
            showToast('success', 'Material aprovado e cadastrado!');
            await fetchData();
        } catch (e: any) {
            showToast('error', e.message || 'Erro ao aprovar');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (item: SolicitacaoMaterial) => {
        const state = editState[item.id] || ensureEditState(item);
        if (!confirm('Recusar essa solicitação?')) return;
        setProcessingId(item.id);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/material-requests', {
                method: 'PATCH',
                headers,
                credentials: 'include',
                body: JSON.stringify({ id: item.id, action: 'reject', resposta_admin: state.resposta }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao recusar');
            showToast('success', 'Solicitação recusada.');
            await fetchData();
        } catch (e: any) {
            showToast('error', e.message || 'Erro ao recusar');
        } finally {
            setProcessingId(null);
        }
    };

    const handleLinkExisting = async (item: SolicitacaoMaterial, materialId: string, nome: string) => {
        if (!confirm(`Vincular esta solicitação ao material já cadastrado "${nome}"?`)) return;
        setProcessingId(item.id);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/material-requests', {
                method: 'PATCH',
                headers,
                credentials: 'include',
                body: JSON.stringify({ id: item.id, action: 'link_existing', material_id: materialId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao vincular');
            showToast('success', 'Solicitação vinculada ao material existente.');
            await fetchData();
        } catch (e: any) {
            showToast('error', e.message || 'Erro ao vincular');
        } finally {
            setProcessingId(null);
        }
    };

    const pendingCount = items.filter((i) => i.status === 'pendente').length;

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Package className="h-5 w-5" /></div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Materiais Novos</h3>
                            <p className="text-xs text-slate-500">Pré-cadastros enviados por clientes e fornecedores, aguardando sua análise.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nome, fornecedor ou e-mail"
                                className="rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <button
                            onClick={fetchData}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            <RefreshCw className="h-4 w-4" /> Atualizar
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    {(['pendente', 'aprovada', 'recusada', 'all'] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === s
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                        >
                            {s === 'all' ? 'Todas' : STATUS_LABELS[s].label}
                            {s === 'pendente' && pendingCount > 0 && statusFilter !== 'pendente' && (
                                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingCount}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando solicitações...
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
                    <Package className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">Nenhuma solicitação encontrada</p>
                    <p className="mt-1 text-xs text-slate-500">
                        Quando um cliente ou fornecedor solicitar um material novo, ele aparecerá aqui para sua aprovação.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((item) => {
                        const StatusIcon = STATUS_LABELS[item.status].icon;
                        const expanded = expandedId === item.id;
                        const state = editState[item.id] || {
                            nome: item.nome,
                            unidade: item.unidade,
                            descricao: item.descricao || '',
                            grupo_ids: [] as string[],
                            resposta: '',
                        };
                        const similares = Array.isArray(item.similares) ? item.similares : [];
                        const topSimilar = similares[0];

                        return (
                            <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_LABELS[item.status].cls}`}>
                                                <StatusIcon className="h-3 w-3" /> {STATUS_LABELS[item.status].label}
                                            </span>
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-700">
                                                {item.tipo_solicitante}
                                            </span>
                                            {topSimilar && topSimilar.similarity >= 0.65 && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                                                    <Sparkles className="h-3 w-3" /> Possível duplicata: {topSimilar.nome} ({Math.round(topSimilar.similarity * 100)}%)
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="mt-2 text-base font-semibold text-slate-900">{item.nome}</h4>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            Unidade: <span className="font-semibold text-slate-700">{item.unidade}</span>
                                            {item.grupo_sugerido && <> · Grupo sugerido: <span className="font-semibold text-slate-700">{item.grupo_sugerido}</span></>}
                                        </p>
                                        {item.descricao && <p className="mt-1 text-sm text-slate-600">{item.descricao}</p>}
                                        <p className="mt-2 text-[11px] text-slate-500">
                                            Solicitado em {new Date(item.created_at).toLocaleString('pt-BR')}
                                            {item.solicitante?.email && <> · por {item.solicitante.nome || item.solicitante.email}</>}
                                            {item.fornecedor && <> · Fornecedor: {item.fornecedor.nome_fantasia || item.fornecedor.razao_social}</>}
                                        </p>
                                    </div>

                                    {item.status === 'pendente' && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                onClick={() => { ensureEditState(item); setExpandedId(expanded ? null : item.id); }}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                {expanded ? 'Fechar' : 'Analisar'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {expanded && item.status === 'pendente' && (
                                    <div className="border-t border-slate-100 bg-slate-50 p-4">
                                        {similares.length > 0 && (
                                            <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                                                <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                                                    <Sparkles className="h-3.5 w-3.5" /> Materiais já cadastrados parecidos (sugestões da IA)
                                                </p>
                                                <ul className="space-y-1">
                                                    {similares.map((s) => (
                                                        <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                                                            <div className="min-w-0">
                                                                <p className="truncate font-semibold text-slate-800">{s.nome}</p>
                                                                <p className="text-[11px] text-slate-500">Unidade: {s.unidade} · {Math.round(s.similarity * 100)}% similar</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleLinkExisting(item, s.id, s.nome)}
                                                                disabled={processingId === item.id}
                                                                className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                                                            >
                                                                <Link2 className="h-3 w-3" /> Vincular
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700">Nome do material</label>
                                                <input
                                                    value={state.nome}
                                                    onChange={(e) => updateEdit(item.id, { nome: e.target.value })}
                                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700">Unidade</label>
                                                <input
                                                    value={state.unidade}
                                                    onChange={(e) => updateEdit(item.id, { unidade: e.target.value })}
                                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-slate-700">Descrição</label>
                                                <textarea
                                                    value={state.descricao}
                                                    onChange={(e) => updateEdit(item.id, { descricao: e.target.value })}
                                                    rows={2}
                                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-slate-700">Grupos de insumo</label>
                                                <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                                                    {grupos.map((g) => {
                                                        const selected = state.grupo_ids.includes(g.id);
                                                        return (
                                                            <button
                                                                key={g.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = selected
                                                                        ? state.grupo_ids.filter((x) => x !== g.id)
                                                                        : [...state.grupo_ids, g.id];
                                                                    updateEdit(item.id, { grupo_ids: next });
                                                                }}
                                                                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${selected
                                                                    ? 'border-blue-600 bg-blue-600 text-white'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                                                    }`}
                                                            >
                                                                {g.nome}
                                                            </button>
                                                        );
                                                    })}
                                                    {grupos.length === 0 && (
                                                        <span className="text-xs text-slate-400">Nenhum grupo cadastrado.</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-slate-700">Resposta ao solicitante (opcional)</label>
                                                <input
                                                    value={state.resposta}
                                                    onChange={(e) => updateEdit(item.id, { resposta: e.target.value })}
                                                    placeholder="Mensagem opcional, usada se você recusar."
                                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                                            <button
                                                onClick={() => handleReject(item)}
                                                disabled={processingId === item.id}
                                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                            >
                                                <X className="h-4 w-4" /> Recusar
                                            </button>
                                            <button
                                                onClick={() => handleApprove(item)}
                                                disabled={processingId === item.id || !state.nome.trim()}
                                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {processingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                Aprovar e cadastrar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {item.status !== 'pendente' && (
                                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                                        {item.resposta_admin && <p><span className="font-semibold text-slate-700">Resposta:</span> {item.resposta_admin}</p>}
                                        {item.material_aprovado_id && (
                                            <p>Material aprovado vinculado (ID: <span className="font-mono">{item.material_aprovado_id}</span>)</p>
                                        )}
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

export { MaterialRequestsManagement };
