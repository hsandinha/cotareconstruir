'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseAuth';
import {
    Search,
    ChevronDown,
    ChevronRight,
    Users,
    UserCheck,
    UserX,
    Layers,
    Download,
    RefreshCw,
    Mail,
    ExternalLink,
    Filter,
    TrendingUp,
    Building2,
} from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

// ── helpers ──────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
            return headers;
        }
    } catch (e) {
        console.warn('Erro ao obter sessão Supabase:', e);
    }
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

function normalizeEmail(value?: string | null): string {
    return (value || '').trim().toLowerCase();
}

// ── types ────────────────────────────────────────────────

interface SupplierInGroup {
    id: string;
    razaoSocial: string;
    nomeFantasia: string;
    email: string;
    cidade: string;
    estado: string;
    ativo: boolean;
    hasUserAccount: boolean;
    hasActiveAccount: boolean;
    lastLoginAt: string | null;
    userStatus: string | null;
    contato: string;
    telefone: string;
}

interface GroupData {
    id: string;
    nome: string;
    suppliers: SupplierInGroup[];
    totalSuppliers: number;
    activeWithAccount: number;
    activeWithoutAccount: number;
    inactiveSuppliers: number;
    activationRate: number;
}

// ── component ────────────────────────────────────────────

export default function SuppliersByGroupManagement() {
    const [groups, setGroups] = useState<GroupData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [filterMode, setFilterMode] = useState<'all' | 'with-pending' | 'fully-active'>('all');
    const [minActiveTarget, setMinActiveTarget] = useState<string>('');
    const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
    const { showToast } = useToast();

    // ── data loading ─────────────────────────────────────

    const loadData = async () => {
        try {
            setLoading(true);
            const headers = await getAuthHeaders();
            if (!headers['Authorization']) return;

            const res = await fetch('/api/admin/fornecedores', { headers });
            if (!res.ok) {
                if (res.status === 401) return;
                const err = await res.json();
                throw new Error(err.error || 'Erro ao carregar');
            }

            const {
                fornecedores: fornecedoresRaw,
                grupos: gruposRaw,
                users: usersRaw,
                fornecedorGrupos: fornecedorGruposRaw,
                userFornecedorAccess: userFornecedorAccessRaw,
            } = await res.json();

            // Build user maps
            const userById = new Map<string, any>();
            const userByEmail = new Map<string, any>();
            (usersRaw || []).forEach((u: any) => {
                if (u?.id) userById.set(u.id, u);
                const emailKey = normalizeEmail(u?.email);
                if (emailKey && !userByEmail.has(emailKey)) userByEmail.set(emailKey, u);
            });

            // Build fornecedor → user mapping
            const fornecedorUserMap = new Map<string, any>();
            (usersRaw || []).forEach((user: any) => {
                if (user.fornecedor_id) {
                    fornecedorUserMap.set(user.fornecedor_id, user);
                }
            });
            (userFornecedorAccessRaw || []).forEach((link: any) => {
                const fId = link?.fornecedor_id;
                const uId = link?.user_id;
                if (!fId || !uId) return;
                if (fornecedorUserMap.has(fId)) return;
                const userInfo = userById.get(uId);
                if (userInfo) fornecedorUserMap.set(fId, userInfo);
            });

            // Build fornecedor → grupo mapping
            const fornecedorGrupoMap = new Map<string, Set<string>>();
            const grupoFornecedorMap = new Map<string, Set<string>>();
            (fornecedorGruposRaw || []).forEach((fg: any) => {
                const fId = fg?.fornecedor_id;
                const gId = fg?.grupo_id;
                if (!fId || !gId) return;
                if (!fornecedorGrupoMap.has(fId)) fornecedorGrupoMap.set(fId, new Set());
                fornecedorGrupoMap.get(fId)!.add(gId);
                if (!grupoFornecedorMap.has(gId)) grupoFornecedorMap.set(gId, new Set());
                grupoFornecedorMap.get(gId)!.add(fId);
            });

            // Build fornecedor map
            const fornecedorById = new Map<string, any>();
            (fornecedoresRaw || []).forEach((f: any) => {
                fornecedorById.set(f.id, f);
            });

            // Build group data
            const groupsData: GroupData[] = (gruposRaw || []).map((grupo: any) => {
                const fornecedorIds = grupoFornecedorMap.get(grupo.id) || new Set();
                const suppliers: SupplierInGroup[] = [];

                fornecedorIds.forEach((fId) => {
                    const f = fornecedorById.get(fId);
                    if (!f) return;

                    const linkedUser = fornecedorUserMap.get(fId);
                    const hasAccount = Boolean(linkedUser);
                    const hasActiveAccount = Boolean(
                        linkedUser &&
                        (linkedUser.last_login_at || linkedUser.status === 'active')
                    );

                    suppliers.push({
                        id: f.id,
                        razaoSocial: f.razao_social || '',
                        nomeFantasia: f.nome_fantasia || '',
                        email: f.email || '',
                        cidade: f.cidade || '',
                        estado: f.estado || '',
                        ativo: f.ativo ?? true,
                        hasUserAccount: hasAccount,
                        hasActiveAccount,
                        lastLoginAt: linkedUser?.last_login_at || null,
                        userStatus: linkedUser?.status || null,
                        contato: f.contato || '',
                        telefone: f.telefone || '',
                    });
                });

                // Sort: active with account first, then active without, then inactive
                suppliers.sort((a, b) => {
                    if (a.ativo && !b.ativo) return -1;
                    if (!a.ativo && b.ativo) return 1;
                    if (a.hasActiveAccount && !b.hasActiveAccount) return -1;
                    if (!a.hasActiveAccount && b.hasActiveAccount) return 1;
                    return a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR');
                });

                const activeSuppliers = suppliers.filter(s => s.ativo);
                const activeWithAccount = activeSuppliers.filter(s => s.hasActiveAccount).length;
                const activeWithoutAccount = activeSuppliers.filter(s => !s.hasActiveAccount).length;
                const inactiveSuppliers = suppliers.filter(s => !s.ativo).length;

                return {
                    id: grupo.id,
                    nome: grupo.nome || 'Sem nome',
                    suppliers,
                    totalSuppliers: suppliers.length,
                    activeWithAccount,
                    activeWithoutAccount,
                    inactiveSuppliers,
                    activationRate: activeSuppliers.length > 0
                        ? Math.round((activeWithAccount / activeSuppliers.length) * 100)
                        : 0,
                };
            });

            // Sort groups by name
            groupsData.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

            setGroups(groupsData);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            showToast('error', 'Erro ao carregar dados dos grupos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // ── filtering ────────────────────────────────────────

    const filteredGroups = useMemo(() => {
        let result = groups;

        // Search by group name
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            result = result.filter(g => g.nome.toLowerCase().includes(query));
        }

        // Filter mode
        if (filterMode === 'with-pending') {
            result = result.filter(g => g.activeWithoutAccount > 0);
        } else if (filterMode === 'fully-active') {
            result = result.filter(g => g.activeWithAccount > 0 && g.activeWithoutAccount === 0);
        }

        // Filter by minimum active suppliers
        const targetNum = parseInt(minActiveTarget, 10);
        if (!isNaN(targetNum) && targetNum > 0) {
            result = result.filter(g => g.activeWithAccount < targetNum);
        }

        return result;
    }, [groups, searchQuery, filterMode, minActiveTarget]);

    // Count groups below the specific target
    const groupsBelowTargetCount = useMemo(() => {
        const targetNum = parseInt(minActiveTarget, 10);
        if (isNaN(targetNum) || targetNum <= 0) return 0;
        return groups.filter(g => g.activeWithAccount < targetNum).length;
    }, [groups, minActiveTarget]);

    // ── summary stats ────────────────────────────────────

    const summaryStats = useMemo(() => {
        const totalGroups = groups.length;

        // Deduplicate suppliers across groups using Sets of IDs
        const allSupplierIds = new Set<string>();
        const activeWithAccountIds = new Set<string>();
        const activeWithoutAccountIds = new Set<string>();

        groups.forEach(g => {
            g.suppliers.forEach(s => {
                allSupplierIds.add(s.id);
                if (s.ativo && s.hasActiveAccount) {
                    activeWithAccountIds.add(s.id);
                } else if (s.ativo && !s.hasActiveAccount) {
                    activeWithoutAccountIds.add(s.id);
                }
            });
        });

        const totalSuppliers = allSupplierIds.size;
        const totalActiveWithAccount = activeWithAccountIds.size;
        const totalActiveWithoutAccount = activeWithoutAccountIds.size;
        const globalActivationRate = totalActiveWithAccount + totalActiveWithoutAccount > 0
            ? Math.round((totalActiveWithAccount / (totalActiveWithAccount + totalActiveWithoutAccount)) * 100)
            : 0;

        return { totalGroups, totalActiveWithAccount, totalActiveWithoutAccount, totalSuppliers, globalActivationRate };
    }, [groups]);

    // ── toggle expand ────────────────────────────────────

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedGroups(new Set(filteredGroups.map(g => g.id)));
    };

    const collapseAll = () => {
        setExpandedGroups(new Set());
    };

    // ── CSV export ───────────────────────────────────────

    const exportCSV = () => {
        const rows: string[] = [];
        rows.push('Grupo,Fornecedor,Email,Cidade,Estado,Ativo,Conta Ativa,Último Login');

        filteredGroups.forEach(g => {
            g.suppliers.forEach(s => {
                rows.push([
                    `"${g.nome}"`,
                    `"${s.razaoSocial}"`,
                    `"${s.email}"`,
                    `"${s.cidade}"`,
                    `"${s.estado}"`,
                    s.ativo ? 'Sim' : 'Não',
                    s.hasActiveAccount ? 'Sim' : (s.hasUserAccount ? 'Pendente' : 'Sem conta'),
                    s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString('pt-BR') : '-',
                ].join(','));
            });
        });

        const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fornecedores-por-grupo-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Arquivo CSV exportado com sucesso!');
    };

    // ── format helpers ───────────────────────────────────

    const formatLastLogin = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getAccountStatusBadge = (supplier: SupplierInGroup) => {
        if (supplier.hasActiveAccount) {
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Conta Ativa
                </span>
            );
        }
        if (supplier.hasUserAccount) {
            return (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Pendente
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Sem conta
            </span>
        );
    };

    // ── progress bar ─────────────────────────────────────

    const ProgressBar = ({ value, total, className = '' }: { value: number; total: number; className?: string }) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : pct > 0 ? 'bg-rose-400' : 'bg-slate-200'
                        }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 min-w-[36px] text-right">{pct}%</span>
            </div>
        );
    };

    // ── render ────────────────────────────────────────────

    if (loading) {
        return (
            <div className="space-y-4">
                {/* Skeleton cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white/80 p-5">
                            <div className="h-3 w-20 rounded bg-slate-200 mb-3" />
                            <div className="h-8 w-16 rounded bg-slate-200" />
                        </div>
                    ))}
                </div>
                {/* Skeleton table */}
                <div className="animate-pulse rounded-2xl border border-slate-100 bg-white/80 p-5">
                    <div className="h-4 w-48 rounded bg-slate-200 mb-4" />
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex gap-4 py-3 border-t border-slate-100">
                            <div className="h-4 flex-1 rounded bg-slate-200" />
                            <div className="h-4 w-16 rounded bg-slate-200" />
                            <div className="h-4 w-16 rounded bg-slate-200" />
                            <div className="h-4 w-24 rounded bg-slate-200" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Summary Cards ─────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                        <Layers className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grupos</p>
                        <p className="mt-0.5 text-2xl font-semibold text-slate-900">{summaryStats.totalGroups}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
                        <Building2 className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Fornecedores</p>
                        <p className="mt-0.5 text-2xl font-semibold text-slate-900">{summaryStats.totalSuppliers}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                        <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Com Conta Ativa</p>
                        <p className="mt-0.5 text-2xl font-semibold text-emerald-700">{summaryStats.totalActiveWithAccount}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50">
                        <UserX className="h-5 w-5 text-rose-500" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sem Conta Ativa</p>
                        <p className="mt-0.5 text-2xl font-semibold text-rose-600">{summaryStats.totalActiveWithoutAccount}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                        <TrendingUp className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Taxa Ativação</p>
                        <p className="mt-0.5 text-2xl font-semibold text-slate-900">{summaryStats.globalActivationRate}%</p>
                    </div>
                </div>
            </div>

            {/* ── Controls ──────────────────────────────── */}
            <div className="rounded-2xl border border-slate-100 bg-white/80 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Fornecedores por Grupo</p>
                        <h3 className="text-lg font-semibold text-slate-900">Visão por Grupo de Insumo</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadData()}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            title="Atualizar dados"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Atualizar
                        </button>
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            title="Exportar CSV"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Exportar CSV
                        </button>
                    </div>
                </div>

                {/* Filters bar */}
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar grupo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-slate-400" />
                        <select
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value as any)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-blue-400 focus:outline-none"
                        >
                            <option value="all">Todos os Grupos</option>
                            <option value="with-pending">Com Pendências</option>
                            <option value="fully-active">100% Ativos</option>
                        </select>
                    </div>

                    {/* Meta de ativos por grupo */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Abaixo da Meta:</span>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                placeholder="Qtd. ativos"
                                value={minActiveTarget}
                                onChange={(e) => setMinActiveTarget(e.target.value)}
                                className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            {minActiveTarget && parseInt(minActiveTarget, 10) > 0 && (
                                <span title={`${groupsBelowTargetCount} grupos estão abaixo da meta`} className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                                    {groupsBelowTargetCount}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={expandAll}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            Expandir todos
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            onClick={collapseAll}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            Recolher todos
                        </button>
                    </div>
                </div>

                {/* Groups table */}
                <div className="divide-y divide-slate-100">
                    {filteredGroups.length === 0 && (
                        <div className="py-12 text-center text-sm text-slate-500">
                            Nenhum grupo encontrado.
                        </div>
                    )}

                    {filteredGroups.map((group) => {
                        const isExpanded = expandedGroups.has(group.id);
                        const activeCount = group.activeWithAccount + group.activeWithoutAccount;

                        return (
                            <div key={group.id}>
                                {/* Group row */}
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/80 transition-colors"
                                >
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-transform duration-200"
                                        style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(0deg)' }}
                                    >
                                        {isExpanded
                                            ? <ChevronDown className="h-4 w-4" />
                                            : <ChevronRight className="h-4 w-4" />
                                        }
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{group.nome}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {group.totalSuppliers} fornecedor{group.totalSuppliers !== 1 ? 'es' : ''}
                                        </p>
                                    </div>

                                    {/* Metrics */}
                                    <div className="hidden sm:flex items-center gap-6">
                                        <div className="text-center min-w-[60px]">
                                            <p className="text-lg font-semibold text-emerald-700">{group.activeWithAccount}</p>
                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Ativos</p>
                                        </div>
                                        <div className="text-center min-w-[60px]">
                                            <p className="text-lg font-semibold text-rose-500">{group.activeWithoutAccount}</p>
                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Pendentes</p>
                                        </div>
                                        <div className="text-center min-w-[60px]">
                                            <p className="text-lg font-semibold text-slate-400">{group.inactiveSuppliers}</p>
                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Inativos</p>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="hidden md:block w-32">
                                        <ProgressBar value={group.activeWithAccount} total={activeCount} />
                                    </div>
                                </button>

                                {/* Expanded: suppliers list */}
                                {isExpanded && (
                                    <div className="bg-slate-50/60 border-t border-slate-100">
                                        {/* Mobile summary */}
                                        <div className="sm:hidden flex items-center gap-4 px-5 py-3 border-b border-slate-100">
                                            <span className="text-xs text-emerald-700 font-semibold">{group.activeWithAccount} ativos</span>
                                            <span className="text-xs text-rose-500 font-semibold">{group.activeWithoutAccount} pendentes</span>
                                            <span className="text-xs text-slate-400 font-semibold">{group.inactiveSuppliers} inativos</span>
                                        </div>

                                        {group.suppliers.length === 0 ? (
                                            <div className="px-5 py-6 text-center text-sm text-slate-500">
                                                Nenhum fornecedor neste grupo.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-200/80">
                                                            <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fornecedor</th>
                                                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</th>
                                                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cidade/UF</th>
                                                            <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cadastro</th>
                                                            <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status Conta</th>
                                                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Último Login</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {group.suppliers.map((supplier) => (
                                                            <tr
                                                                key={supplier.id}
                                                                className={`hover:bg-white/60 transition-colors ${!supplier.ativo ? 'opacity-50' : ''}`}
                                                            >
                                                                <td className="px-5 py-3">
                                                                    <div>
                                                                        <p className="font-medium text-slate-900 text-[13px]">{supplier.razaoSocial}</p>
                                                                        {supplier.nomeFantasia && supplier.nomeFantasia !== supplier.razaoSocial && (
                                                                            <p className="text-[11px] text-slate-500 mt-0.5">{supplier.nomeFantasia}</p>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    <span className="text-[12px] text-slate-600">{supplier.email || '-'}</span>
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    <span className="text-[12px] text-slate-600">
                                                                        {supplier.cidade && supplier.estado
                                                                            ? `${supplier.cidade}/${supplier.estado}`
                                                                            : supplier.cidade || supplier.estado || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    {supplier.ativo ? (
                                                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Ativo</span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Inativo</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    {getAccountStatusBadge(supplier)}
                                                                </td>
                                                                <td className="px-3 py-3">
                                                                    <span className="text-[12px] text-slate-500">
                                                                        {formatLastLogin(supplier.lastLoginAt)}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer info */}
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                    <p className="text-[11px] text-slate-500">
                        Exibindo {filteredGroups.length} de {groups.length} grupos
                    </p>
                    <p className="text-[11px] text-slate-500">
                        {filteredGroups.reduce((acc, g) => acc + g.totalSuppliers, 0)} fornecedores
                    </p>
                </div>
            </div>
        </div>
    );
}
