"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/authHeaders";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/components/ToastProvider";
import { useSupplierAccessContext } from "./SupplierAccessContext";

interface SupplierApiKey {
    id: string;
    fornecedor_id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
}

function formatDate(value: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function SupplierApiKeysSection() {
    const { session } = useAuth();
    const { activeSupplierId, requiresSelection } = useSupplierAccessContext();
    const { showToast } = useToast();
    const [keys, setKeys] = useState<SupplierApiKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [newApiKey, setNewApiKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [migrationPending, setMigrationPending] = useState(false);

    const loadKeys = useCallback(async () => {
        if (!activeSupplierId || requiresSelection) {
            setKeys([]);
            return;
        }

        setLoading(true);
        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch(`/api/supplier/api-keys?fornecedor_id=${encodeURIComponent(activeSupplierId)}`, {
                headers,
                credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) {
                if (json.code === "supplier_api_migration_pending") {
                    setMigrationPending(true);
                    setKeys([]);
                    return;
                }
                throw new Error(json.error || "Erro ao carregar chaves");
            }
            setMigrationPending(false);
            setKeys(json.data || []);
        } catch (error: any) {
            showToast("error", error.message || "Erro ao carregar chaves de API.");
        } finally {
            setLoading(false);
        }
    }, [activeSupplierId, requiresSelection, session?.access_token, showToast]);

    useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    const handleCreate = async () => {
        if (!activeSupplierId) return;
        if (!name.trim()) {
            showToast("error", "Informe um nome para a chave.");
            return;
        }

        setCreating(true);
        setNewApiKey(null);
        setCopied(false);
        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch("/api/supplier/api-keys", {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({
                    fornecedor_id: activeSupplierId,
                    name: name.trim(),
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                if (json.code === "supplier_api_migration_pending") {
                    setMigrationPending(true);
                    throw new Error("Migration de chaves de API pendente no banco.");
                }
                throw new Error(json.error || "Erro ao criar chave");
            }

            setNewApiKey(json.api_key);
            setName("");
            setKeys((prev) => [json.data, ...prev].filter(Boolean));
            showToast("success", "Chave criada com sucesso.");
        } catch (error: any) {
            showToast("error", error.message || "Erro ao criar chave de API.");
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = async () => {
        if (!newApiKey) return;
        try {
            await navigator.clipboard.writeText(newApiKey);
            setCopied(true);
            showToast("success", "Chave copiada.");
        } catch {
            showToast("error", "Não foi possível copiar a chave.");
        }
    };

    const handleRevoke = async (key: SupplierApiKey) => {
        if (!activeSupplierId || key.revoked_at) return;
        if (!confirm(`Revogar a chave "${key.name}"?`)) return;

        setRevokingId(key.id);
        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch("/api/supplier/api-keys", {
                method: "DELETE",
                headers,
                credentials: "include",
                body: JSON.stringify({
                    id: key.id,
                    fornecedor_id: activeSupplierId,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                if (json.code === "supplier_api_migration_pending") {
                    setMigrationPending(true);
                    throw new Error("Migration de chaves de API pendente no banco.");
                }
                throw new Error(json.error || "Erro ao revogar chave");
            }
            setKeys((prev) => prev.map((item) => item.id === key.id ? json.data : item));
            showToast("success", "Chave revogada.");
        } catch (error: any) {
            showToast("error", error.message || "Erro ao revogar chave.");
        } finally {
            setRevokingId(null);
        }
    };

    if (requiresSelection || !activeSupplierId) {
        return null;
    }

    const activeKeys = keys.filter((key) => !key.revoked_at).length;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-tour="perfil-api-keys">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Chaves de API</h2>
                        <p className="text-sm text-slate-500">
                            Integre seu ERP para atualizar materiais do fornecedor ativo.
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{activeKeys} chave(s) ativa(s)</p>
                        <a
                            href="/api-docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                            <BookOpen className="h-3.5 w-3.5" />
                            Ver documentação da API
                        </a>
                    </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={migrationPending}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:w-64"
                        placeholder="Nome da integração"
                        maxLength={120}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={creating || migrationPending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Criar
                    </button>
                </div>
            </div>

            {migrationPending && (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                        <p className="font-semibold">Migration de API keys pendente</p>
                        <p className="mt-1 text-amber-800">
                            A tabela <code className="rounded bg-amber-100 px-1">fornecedor_api_keys</code> ainda não existe no banco conectado.
                            Aplique a migration <code className="rounded bg-amber-100 px-1">20260228000000_fornecedor_api_keys.sql</code> e recarregue esta tela.
                        </p>
                    </div>
                </div>
            )}

            {newApiKey && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-emerald-900">Chave criada</p>
                            <p className="mt-1 text-xs text-emerald-700">
                                Copie agora. Depois ela não será exibida novamente.
                            </p>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-800">
                                    {newApiKey}
                                </code>
                                <button
                                    onClick={handleCopy}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    {copied ? "Copiada" : "Copiar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
                    <span>Nome</span>
                    <span>Prefixo</span>
                    <span>Criada</span>
                    <span>Último uso</span>
                    <span className="text-right">Ações</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center px-4 py-8 text-sm text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Carregando chaves...
                    </div>
                ) : migrationPending ? (
                    <div className="px-4 py-8 text-center text-sm text-amber-700">
                        Aguardando aplicação da migration de chaves de API.
                    </div>
                ) : keys.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                        Nenhuma chave criada.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {keys.map((key) => {
                            const revoked = Boolean(key.revoked_at);
                            return (
                                <div
                                    key={key.id}
                                    className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-slate-700 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center"
                                >
                                    <div>
                                        <p className="font-semibold text-slate-900">{key.name}</p>
                                        <p className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${revoked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                            {revoked ? "Revogada" : "Ativa"}
                                        </p>
                                    </div>
                                    <code className="text-xs text-slate-600">{key.key_prefix}</code>
                                    <span className="text-xs text-slate-500">{formatDate(key.created_at)}</span>
                                    <span className="text-xs text-slate-500">{formatDate(key.last_used_at)}</span>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleRevoke(key)}
                                            disabled={revoked || revokingId === key.id}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                            title="Revogar chave"
                                        >
                                            {revokingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>As chaves permitem atualizar materiais desse fornecedor. Revogue chaves que não estiverem mais em uso.</span>
            </div>
        </div>
    );
}
