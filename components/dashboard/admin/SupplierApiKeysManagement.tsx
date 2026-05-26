'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Clock, KeyRound, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseAuth';
import { useToast } from '@/components/ToastProvider';
import { useConfirmModal } from '@/components/ConfirmModal';

interface SupplierApiKeyRow {
    id: string;
    fornecedor_id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    status: 'active' | 'revoked' | 'expired';
    fornecedor: {
        id: string;
        razao_social: string | null;
        nome_fantasia: string | null;
        cnpj: string | null;
        email: string | null;
        ativo: boolean | null;
        status: string | null;
    } | null;
    created_by_user: {
        id: string;
        nome: string | null;
        email: string | null;
        role: string | null;
        roles: string[] | null;
    } | null;
}

interface SupplierApiKeysSummary {
    total_keys: number;
    active_keys: number;
    revoked_keys: number;
    expired_keys: number;
    suppliers_with_keys: number;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
            return headers;
        }
    } catch (error) {
        console.warn('Erro ao obter sessão Supabase:', error);
    }

    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function formatDate(value: string | null) {
    if (!value) return 'Nunca';
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function supplierName(row: SupplierApiKeyRow) {
    return row.fornecedor?.nome_fantasia || row.fornecedor?.razao_social || 'Fornecedor não encontrado';
}

function statusBadge(status: SupplierApiKeyRow['status']) {
    if (status === 'active') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (status === 'expired') {
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    return 'bg-rose-50 text-rose-700 border-rose-200';
}

function statusLabel(status: SupplierApiKeyRow['status']) {
    if (status === 'active') return 'Ativa';
    if (status === 'expired') return 'Expirada';
    return 'Revogada';
}

export default function SupplierApiKeysManagement() {
    const [rows, setRows] = useState<SupplierApiKeyRow[]>([]);
    const [summary, setSummary] = useState<SupplierApiKeysSummary>({
        total_keys: 0,
        active_keys: 0,
        revoked_keys: 0,
        expired_keys: 0,
        suppliers_with_keys: 0,
    });
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<'all' | 'active' | 'revoked' | 'expired'>('all');
    const [loading, setLoading] = useState(true);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [migrationPending, setMigrationPending] = useState(false);
    const { showToast } = useToast();
    const { confirm } = useConfirmModal();

    const query = useMemo(() => {
        const params = new URLSearchParams({
            page: '1',
            page_size: '200',
        });
        if (search.trim()) params.set('q', search.trim());
        if (status !== 'all') params.set('status', status);
        return params.toString();
    }, [search, status]);

    const fetchApiKeys = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`/api/admin/supplier-api-keys?${query}`, { headers });
            const payload = await response.json();

            if (!response.ok) {
                if (payload.code === 'supplier_api_migration_pending') {
                    setMigrationPending(true);
                    setRows([]);
                    setSummary({
                        total_keys: 0,
                        active_keys: 0,
                        revoked_keys: 0,
                        expired_keys: 0,
                        suppliers_with_keys: 0,
                    });
                    return;
                }
                throw new Error(payload.error || 'Erro ao carregar chaves de API');
            }

            setMigrationPending(false);
            setRows(payload.data || []);
            setSummary(payload.summary || {
                total_keys: 0,
                active_keys: 0,
                revoked_keys: 0,
                expired_keys: 0,
                suppliers_with_keys: 0,
            });
        } catch (error: any) {
            console.error('Erro ao carregar chaves de API:', error);
            showToast('error', error.message || 'Erro ao carregar chaves de API');
        } finally {
            setLoading(false);
        }
    }, [query, showToast]);

    useEffect(() => {
        fetchApiKeys();
    }, [fetchApiKeys]);

    const handleRevoke = async (row: SupplierApiKeyRow) => {
        const ok = await confirm({
            title: 'Revogar chave de API',
            message: `Revogar a chave "${row.name}" de ${supplierName(row)}? Integrações que usam esta chave pararão imediatamente.`,
            confirmLabel: 'Revogar',
            cancelLabel: 'Cancelar',
            variant: 'danger',
        });

        if (!ok) return;

        setRevokingId(row.id);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch('/api/admin/supplier-api-keys', {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ id: row.id }),
            });
            const payload = await response.json();

            if (!response.ok) {
                if (payload.code === 'supplier_api_migration_pending') {
                    setMigrationPending(true);
                    throw new Error('Migration de chaves de API pendente no banco.');
                }
                throw new Error(payload.error || 'Erro ao revogar chave');
            }

            showToast('success', 'Chave revogada com sucesso');
            await fetchApiKeys();
        } catch (error: any) {
            console.error('Erro ao revogar chave:', error);
            showToast('error', error.message || 'Erro ao revogar chave');
        } finally {
            setRevokingId(null);
        }
    };

    const summaryCards = [
        { label: 'Fornecedores com API', value: summary.suppliers_with_keys, icon: Users, color: 'text-blue-700 bg-blue-50' },
        { label: 'Chaves ativas', value: summary.active_keys, icon: ShieldCheck, color: 'text-emerald-700 bg-emerald-50' },
        { label: 'Expiradas', value: summary.expired_keys, icon: Clock, color: 'text-amber-700 bg-amber-50' },
        { label: 'Revogadas', value: summary.revoked_keys, icon: Ban, color: 'text-rose-700 bg-rose-50' },
    ];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                                    <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
                                </div>
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-slate-900">Chaves de API de fornecedores</h3>
                        <p className="text-sm text-slate-500">
                            Controle quais fornecedores configuraram integração, quem criou a chave e quando ela foi usada.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchApiKeys}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>

                {migrationPending && (
                    <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                            <p className="font-semibold">Migration de API keys pendente</p>
                            <p className="mt-1 text-amber-800">
                                A tabela <code className="rounded bg-amber-100 px-1">fornecedor_api_keys</code> ainda não existe no banco conectado.
                                Aplique a migration <code className="rounded bg-amber-100 px-1">20260228000000_fornecedor_api_keys.sql</code> para liberar este painel.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por fornecedor, CNPJ, criador, nome ou prefixo da chave"
                            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        />
                    </div>
                    <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                        {[
                            ['all', 'Todas'],
                            ['active', 'Ativas'],
                            ['expired', 'Expiradas'],
                            ['revoked', 'Revogadas'],
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setStatus(value as typeof status)}
                                className={`min-w-20 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${status === value
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Chave</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Criada por</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Uso</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, index) => (
                                    <tr key={index}>
                                        {Array.from({ length: 6 }).map((__, cellIndex) => (
                                            <td key={cellIndex} className="px-4 py-4">
                                                <div className="h-4 w-full max-w-40 animate-pulse rounded bg-slate-100" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : migrationPending ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-amber-700">
                                        Aguardando aplicação da migration de chaves de API.
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center">
                                        <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
                                        <p className="mt-2 text-sm font-semibold text-slate-700">Nenhuma chave encontrada</p>
                                        <p className="text-sm text-slate-500">Ajuste os filtros ou aguarde fornecedores criarem chaves no dashboard.</p>
                                    </td>
                                </tr>
                            ) : rows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50/70">
                                    <td className="px-4 py-4 align-top">
                                        <div className="max-w-64">
                                            <p className="font-semibold text-slate-900">{supplierName(row)}</p>
                                            <p className="text-xs text-slate-500">{row.fornecedor?.cnpj || 'CNPJ não informado'}</p>
                                            <p className="text-xs text-slate-500">{row.fornecedor?.email || 'Email não informado'}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <div className="space-y-1">
                                            <p className="font-semibold text-slate-900">{row.name}</p>
                                            <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.key_prefix}...</code>
                                            <p className="text-xs text-slate-500">{row.scopes?.length || 0} permissões</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <p className="font-medium text-slate-900">{row.created_by_user?.nome || 'Usuário não identificado'}</p>
                                        <p className="text-xs text-slate-500">{row.created_by_user?.email || row.created_by || 'Sem created_by'}</p>
                                        <p className="text-xs text-slate-500">em {formatDate(row.created_at)}</p>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <p className="text-sm text-slate-700">Último uso: {formatDate(row.last_used_at)}</p>
                                        <p className="text-xs text-slate-500">Expira: {row.expires_at ? formatDate(row.expires_at) : 'Sem expiração'}</p>
                                    </td>
                                    <td className="px-4 py-4 align-top">
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(row.status)}`}>
                                            {statusLabel(row.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right align-top">
                                        <button
                                            type="button"
                                            onClick={() => handleRevoke(row)}
                                            disabled={row.status === 'revoked' || revokingId === row.id}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Revogar chave"
                                        >
                                            <Ban className="h-4 w-4" />
                                            {revokingId === row.id ? 'Revogando...' : 'Revogar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
