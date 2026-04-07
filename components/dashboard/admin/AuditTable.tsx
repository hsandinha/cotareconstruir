"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useToast } from "@/components/ToastProvider";
import { EmptyState } from "@/components/EmptyState";
import { usePolling } from "@/lib/hooks";

const SkeletonRow = ({ cols }: { cols: number }) => (
    <tr className="animate-pulse border-t border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="px-4 py-4">
                <div className="h-4 w-full rounded bg-slate-200"></div>
            </td>
        ))}
    </tr>
);

export function AuditTable() {
    const { showToast } = useToast();
    const pageSize = 10;
    
    const [auditPage, setAuditPage] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditPageIndex, setAuditPageIndex] = useState(0);
    const [auditHasNext, setAuditHasNext] = useState(false);
    const [auditHasPrev, setAuditHasPrev] = useState(false);
    const [auditSortDir, setAuditSortDir] = useState<"asc" | "desc">("desc");
    const [auditSearchInput, setAuditSearchInput] = useState("");
    const [auditSearchTerm, setAuditSearchTerm] = useState("");
    const [auditActionFilter, setAuditActionFilter] = useState<string>("all");

    const fetchAuditPage = async (targetPage = 0) => {
        setAuditLoading(true);
        try {
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' });

            if (auditSearchTerm.trim()) {
                query = query.eq('user_id', auditSearchTerm.trim()); // The original uses user_id
            }
            if (auditActionFilter !== "all") {
                query = query.eq('action', auditActionFilter);
            }

            query = query
                .order('created_at', { ascending: auditSortDir === 'asc' })
                .range(targetPage * pageSize, (targetPage + 1) * pageSize - 1);

            const { data, count, error } = await query;

            if (error) throw error;

            setAuditPage(data || []);
            setAuditHasNext((count || 0) > (targetPage + 1) * pageSize);
            setAuditHasPrev(targetPage > 0);
            setAuditPageIndex(targetPage);
        } catch (e) {
            console.error("Error fetching audit logs:", e);
            showToast("error", "Erro ao carregar auditoria.");
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        fetchAuditPage(0);
    }, [auditSortDir, auditSearchTerm, auditActionFilter]);

    usePolling(() => {
        fetchAuditPage(auditPageIndex);
    }, 30000);

    return (
        <div className="rounded-[20px] border border-slate-100 bg-white/80 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Auditoria do Sistema</h3>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">
                        Página {auditPageIndex + 1}
                    </p>
                </div>
            </div>
            <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3 pb-3">
                    <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            setAuditPageIndex(0);
                            setAuditSearchTerm(auditSearchInput.trim());
                        }}
                    >
                        <input
                            value={auditSearchInput}
                            onChange={(e) => setAuditSearchInput(e.target.value)}
                            placeholder="Filtrar por User ID"
                            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                        <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Buscar</button>
                        {auditSearchTerm && (
                            <button
                                type="button"
                                onClick={() => { setAuditSearchTerm(""); setAuditSearchInput(""); setAuditPageIndex(0); }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Limpar
                            </button>
                        )}
                    </form>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="font-semibold">Ação</span>
                        <select
                            value={auditActionFilter}
                            onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPageIndex(0); }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                        >
                            <option value="all">Todas</option>
                            <option value="LOGIN">LOGIN</option>
                            <option value="CHAT_MESSAGE_BLOCKED">CHAT_MESSAGE_BLOCKED</option>
                            <option value="RESOLVE_REPORT">RESOLVE_REPORT</option>
                            <option value="TOGGLE_STATUS">TOGGLE_STATUS</option>
                            <option value="UPDATE_ROLE">UPDATE_ROLE</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="font-semibold">Ordenar</span>
                        <button
                            type="button"
                            onClick={() => { setAuditSortDir(prev => prev === "desc" ? "asc" : "desc"); setAuditPageIndex(0); }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                        >
                            {auditSortDir === "desc" ? "Recentes → Antigos" : "Antigos → Recentes"}
                        </button>
                    </div>
                </div>
                
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm text-slate-800">
                        <thead>
                            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-2">Data</th>
                                <th className="px-4 py-2">Usuário</th>
                                <th className="px-4 py-2">Ação</th>
                                <th className="px-4 py-2">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLoading && auditPage.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
                            ) : auditPage.length === 0 ? (
                                <tr>
                                    <td colSpan={4}>
                                        <EmptyState
                                            title="Nenhum evento encontrado"
                                            description="Os registros de auditoria aparecerão aqui à medida que ações forem realizadas."
                                            icon={
                                                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            }
                                        />
                                    </td>
                                </tr>
                            ) : (
                                auditPage.map((log) => (
                                    <tr key={log.id} className="border-t border-slate-100">
                                        <td className="px-4 py-3 text-sm text-slate-600">{log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 font-mono text-[11px]">{log.user_id || log.userId || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{log.action}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-pre-wrap break-words max-w-md">
                                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="md:hidden space-y-4">
                    {auditLoading && auditPage.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="animate-pulse flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="h-4 w-1/3 rounded bg-slate-200"></div>
                                <div className="h-3 w-1/2 rounded bg-slate-200"></div>
                                <div className="h-10 w-full rounded bg-slate-200"></div>
                            </div>
                        ))
                    ) : auditPage.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">Nenhum evento encontrado.</div>
                    ) : (
                        auditPage.map((log) => (
                            <div key={log.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="font-semibold text-slate-900 text-sm">{log.action}</span>
                                    <span className="text-xs text-slate-500">{log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : 'N/A'}</span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 mb-2 border-b justify-between flex pb-2 mb-2">User ID: {log.user_id || log.userId || '-'}</div>
                                <div className="text-sm text-slate-600 whitespace-pre-wrap break-words">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})}</div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                    <button
                        onClick={() => fetchAuditPage(auditPageIndex - 1)}
                        disabled={!auditHasPrev || auditLoading}
                        className="rounded border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Anterior
                    </button>
                    <span className="text-slate-500">Página {auditPageIndex + 1}</span>
                    <button
                        onClick={() => fetchAuditPage(auditPageIndex + 1)}
                        disabled={!auditHasNext || auditLoading}
                        className="rounded border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Próxima
                    </button>
                </div>
            </div>
        </div>
    );
}
