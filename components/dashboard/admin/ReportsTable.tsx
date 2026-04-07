"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useToast } from "@/components/ToastProvider";
import { EmptyState } from "@/components/EmptyState";
import { usePolling } from "@/lib/hooks";
import { useConfirmModal } from "@/components/ConfirmModal";

const SkeletonRow = ({ cols }: { cols: number }) => (
    <tr className="animate-pulse border-t border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="px-4 py-4">
                <div className="h-4 w-full rounded bg-slate-200"></div>
            </td>
        ))}
    </tr>
);

export function ReportsTable() {
    const { showToast } = useToast();
    const { confirm: confirmModal } = useConfirmModal();
    const pageSize = 10;
    
    const [reportsPage, setReportsPage] = useState<any[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsPageIndex, setReportsPageIndex] = useState(0);
    const [reportsHasNext, setReportsHasNext] = useState(false);
    const [reportsHasPrev, setReportsHasPrev] = useState(false);
    const [reportsSortDir, setReportsSortDir] = useState<"asc" | "desc">("desc");
    const [reportStatusFilter, setReportStatusFilter] = useState<"all" | "pending" | "resolved">("all");
    const [reportTypeFilter, setReportTypeFilter] = useState<string>("all");

    const fetchReportsPage = async (targetPage = 0) => {
        setReportsLoading(true);
        try {
            let query = supabase.from('reports').select('*', { count: 'exact' });

            if (reportStatusFilter !== 'all') {
                query = query.eq('status', reportStatusFilter);
            }
            if (reportTypeFilter !== 'all') {
                query = query.eq('type', reportTypeFilter);
            }

            query = query.order('created_at', { ascending: reportsSortDir === 'asc' });

            const from = targetPage * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, count, error } = await query;

            if (error) throw error;

            setReportsPage(data || []);
            setReportsPageIndex(targetPage);
            setReportsHasNext(count ? from + pageSize < count : false);
            setReportsHasPrev(targetPage > 0);
        } catch (e) {
            console.error("Error fetching reports:", e);
            showToast("error", "Erro ao carregar denúncias.");
        } finally {
            setReportsLoading(false);
        }
    };

    useEffect(() => {
        fetchReportsPage(0);
    }, [reportStatusFilter, reportTypeFilter, reportsSortDir]);

    usePolling(() => {
        fetchReportsPage(reportsPageIndex);
    }, 30000);

    const handleResolveReport = async (reportId: string) => {
        const ok = await confirmModal({
            title: "Resolver Denúncia",
            message: "Tem certeza que deseja marcar esta denúncia como resolvida?",
            confirmLabel: "Resolver",
            variant: "info",
        });
        if (!ok) return;
        try {
            const { error } = await supabase
                .from('reports')
                .update({ status: 'resolved' })
                .eq('id', reportId);

            if (error) throw error;

            showToast("success", "Denúncia resolvida com sucesso!");
            fetchReportsPage(reportsPageIndex);
        } catch (error) {
            console.error("Error resolving report:", error);
            showToast("error", "Erro ao resolver denúncia.");
        }
    };

    return (
        <div className="rounded-[20px] border border-slate-100 bg-white/80 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Denúncias</h3>
                    <p className="text-xs font-semibold tracking-wide text-slate-500">
                        Página {reportsPageIndex + 1}
                    </p>
                </div>
            </div>
            
            <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 pb-3 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Status</span>
                        <select
                            value={reportStatusFilter}
                            onChange={(e) => { setReportStatusFilter(e.target.value as any); setReportsPageIndex(0); }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendentes</option>
                            <option value="resolved">Resolvidas</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Tipo</span>
                        <select
                            value={reportTypeFilter}
                            onChange={(e) => { setReportTypeFilter(e.target.value); setReportsPageIndex(0); }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                        >
                            <option value="all">Todos</option>
                            <option value="abuso">Abuso</option>
                            <option value="fraude">Fraude</option>
                            <option value="conteudo">Conteúdo</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Ordenar</span>
                        <button
                            type="button"
                            onClick={() => { setReportsSortDir(prev => prev === "desc" ? "asc" : "desc"); setReportsPageIndex(0); }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                        >
                            {reportsSortDir === "desc" ? "Recentes → Antigos" : "Antigos → Recentes"}
                        </button>
                    </div>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm text-slate-800">
                        <thead>
                            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-2">Data</th>
                                <th className="px-4 py-2">Tipo</th>
                                <th className="px-4 py-2">Motivo</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportsLoading && reportsPage.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                            ) : reportsPage.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState
                                            title="Nenhuma denúncia encontrada"
                                            description="Todas as denúncias foram resolvidas ou nenhuma foi registrada."
                                            icon={
                                                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                                </svg>
                                            }
                                        />
                                    </td>
                                </tr>
                            ) : (
                                reportsPage.map((report) => (
                                    <tr key={report.id} className="border-t border-slate-100">
                                        <td className="px-4 py-3 text-sm text-slate-600">{report.created_at ? new Date(report.created_at).toLocaleString('pt-BR') : 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{report.type}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                            {report.reason}
                                            <div className="text-xs font-normal text-slate-500">{report.description}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${report.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {report.status !== 'resolved' && (
                                                <button
                                                    onClick={() => handleResolveReport(report.id)}
                                                    className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                                >
                                                    Resolver
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View for Reports */}
                <div className="md:hidden space-y-4">
                    {reportsLoading && reportsPage.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="h-4 w-1/3 rounded bg-slate-200 mb-2"></div>
                                <div className="h-3 w-1/2 rounded bg-slate-200 mb-2"></div>
                                <div className="h-8 w-full rounded bg-slate-200"></div>
                            </div>
                        ))
                    ) : reportsPage.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">Nenhuma denúncia encontrada.</div>
                    ) : (
                        reportsPage.map((report) => (
                            <div key={report.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-semibold text-slate-900">{report.reason}</div>
                                        <div className="text-xs text-slate-500">{report.type}</div>
                                    </div>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${report.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        {report.status}
                                    </span>
                                </div>

                                <div className="text-xs text-slate-500 mb-3">
                                    {report.created_at ? new Date(report.created_at).toLocaleString('pt-BR') : 'N/A'}
                                </div>

                                <div className="text-sm text-slate-700 mb-4 bg-slate-50 p-2 rounded border border-slate-100">
                                    {report.description}
                                </div>

                                {report.status !== 'resolved' && (
                                    <button
                                        onClick={() => handleResolveReport(report.id)}
                                        className="w-full rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 text-center"
                                    >
                                        Resolver Denúncia
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                    <div>
                        Página {reportsPageIndex + 1}{reportsHasNext ? "" : " (última)"}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchReportsPage(Math.max(reportsPageIndex - 1, 0))}
                            disabled={!reportsHasPrev || reportsLoading}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >Anterior</button>
                        <button
                            onClick={() => fetchReportsPage(reportsPageIndex + 1)}
                            disabled={!reportsHasNext || reportsLoading}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >Próxima</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
