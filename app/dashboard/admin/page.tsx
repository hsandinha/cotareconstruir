"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { collection, getCountFromServer, query, where, getDocs, orderBy, limit, doc, updateDoc, deleteDoc, getDoc, startAfter, DocumentSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { NotificationBell } from "../../../components/NotificationBell";
import { logAction } from "../../../lib/services";
import { useToast } from "@/components/ToastProvider";

const SkeletonRow = ({ cols }: { cols: number }) => (
    <tr className="animate-pulse border-t border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="px-4 py-4">
                <div className="h-4 w-full rounded bg-slate-200"></div>
            </td>
        ))}
    </tr>
);

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "audit" | "reports">("overview");
    const [stats, setStats] = useState({
        users: 0,
        suppliers: 0,
        quotations: 0
    });
    const [recentUsers, setRecentUsers] = useState<any[]>([]);
    const [usersPage, setUsersPage] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersPageIndex, setUsersPageIndex] = useState(0);
    const [userCursors, setUserCursors] = useState<DocumentSnapshot[]>([]);
    const [usersHasNext, setUsersHasNext] = useState(false);
    const [usersHasPrev, setUsersHasPrev] = useState(false);
    const [roleFilter, setRoleFilter] = useState<"all" | "cliente" | "fornecedor" | "admin">("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("desc");

    const [auditPage, setAuditPage] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditPageIndex, setAuditPageIndex] = useState(0);
    const [auditCursors, setAuditCursors] = useState<DocumentSnapshot[]>([]);
    const [auditHasNext, setAuditHasNext] = useState(false);
    const [auditHasPrev, setAuditHasPrev] = useState(false);
    const [auditSortDir, setAuditSortDir] = useState<"asc" | "desc">("desc");
    const [auditSearchInput, setAuditSearchInput] = useState("");
    const [auditSearchTerm, setAuditSearchTerm] = useState("");
    const [auditActionFilter, setAuditActionFilter] = useState<string>("all");

    const [reportsPage, setReportsPage] = useState<any[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsPageIndex, setReportsPageIndex] = useState(0);
    const [reportsCursors, setReportsCursors] = useState<DocumentSnapshot[]>([]);
    const [reportsHasNext, setReportsHasNext] = useState(false);
    const [reportsHasPrev, setReportsHasPrev] = useState(false);
    const [reportsSortDir, setReportsSortDir] = useState<"asc" | "desc">("desc");
    const [reportStatusFilter, setReportStatusFilter] = useState<"all" | "pending" | "resolved">("all");
    const [reportTypeFilter, setReportTypeFilter] = useState<string>("all");
    const { showToast } = useToast();
    const [recentQuotations, setRecentQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("Admin");
    const [userInitial, setUserInitial] = useState("A");
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    const adminTabs: { id: typeof activeTab; label: string }[] = [
        { id: "overview", label: "Visão Geral" },
        { id: "users", label: "Gerenciar Usuários" },
        { id: "audit", label: "Auditoria" },
        { id: "reports", label: "Denúncias" },
    ];

    const fetchOverview = async () => {
        try {
            const usersColl = collection(db, "users");
            const suppliersQuery = query(usersColl, where("role", "==", "fornecedor"));
            const quotationsColl = collection(db, "quotations");

            const [usersSnap, suppliersSnap, quotationsSnap] = await Promise.all([
                getCountFromServer(usersColl),
                getCountFromServer(suppliersQuery),
                getCountFromServer(quotationsColl)
            ]);

            setStats({
                users: usersSnap.data().count,
                suppliers: suppliersSnap.data().count,
                quotations: quotationsSnap.data().count
            });

            try {
                const recentUsersQuery = query(usersColl, orderBy("createdAt", "desc"), limit(5));
                const recentUsersSnap = await getDocs(recentUsersQuery);
                setRecentUsers(recentUsersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.warn("Error fetching recent users (likely missing index):", e);
                const fallbackQuery = query(usersColl, limit(5));
                const fallbackSnap = await getDocs(fallbackQuery);
                setRecentUsers(fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            }

            try {
                const quotationsColl = collection(db, "quotations");
                const recentQuotationsQuery = query(quotationsColl, orderBy("createdAt", "desc"), limit(5));
                const recentQuotationsSnap = await getDocs(recentQuotationsQuery);
                setRecentQuotations(recentQuotationsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.warn("Error fetching recent quotations (likely missing index):", e);
                const fallbackQuery = query(quotationsColl, limit(5));
                const fallbackSnap = await getDocs(fallbackQuery);
                setRecentQuotations(fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            }
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) return;

            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                const data = userDoc.exists() ? userDoc.data() : {};
                const role = data.role || "cliente";

                const name = data.companyName || data.name || user.displayName || user.email || "Admin";
                console.log("Admin Check - User:", user.uid, "Role:", role, "Data:", data); // Debug log
                setUserName(name);
                setUserInitial(name.charAt(0).toUpperCase());

                setIsAdmin(true);
                setAuthLoading(false);
                await fetchOverview();
            } catch (e) {
                console.error("Erro ao carregar dados do admin:", e);
                setAuthLoading(false);
            }
        });

        return () => {
            unsubAuth();
        };
    }, [router]);

    const pageSize = 10;

    const fetchUsersPage = async (targetPage = 0) => {
        setUsersLoading(true);
        try {
            const usersColl = collection(db, "users");

            const applyBaseFilters = () => {
                const base: any[] = [];
                if (roleFilter !== "all") base.push(where("role", "==", roleFilter));
                if (statusFilter !== "all") base.push(where("isActive", "==", statusFilter === "active"));
                return base;
            };

            let snap;

            if (searchTerm.trim()) {
                const term = searchTerm.trim().toLowerCase();
                snap = await getDocs(query(usersColl, where("email", "==", term), limit(pageSize)));
            } else {
                const startCursor = targetPage > 0 ? userCursors[targetPage - 1] : null;
                const constraints = [...applyBaseFilters(), orderBy("createdAt", userSortDir), limit(pageSize + 1)];
                if (startCursor) constraints.push(startAfter(startCursor));

                try {
                    snap = await getDocs(query(usersColl, ...constraints));
                } catch (err) {
                    // fallback ordering if createdAt missing
                    const fallbackConstraints = [...applyBaseFilters(), orderBy("email"), limit(pageSize + 1)];
                    if (startCursor) fallbackConstraints.push(startAfter(startCursor));
                    snap = await getDocs(query(usersColl, ...fallbackConstraints));
                }
            }

            const docs = snap.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() }));
            setUsersPage(docs);

            if (!searchTerm.trim()) {
                const hasNext = snap.docs.length > pageSize;
                setUsersHasNext(hasNext);
                setUsersHasPrev(targetPage > 0);
                const lastDoc = snap.docs.length ? snap.docs[Math.min(pageSize - 1, snap.docs.length - 1)] : undefined;
                if (lastDoc) {
                    setUserCursors((prev) => {
                        const next = [...prev];
                        next[targetPage] = lastDoc;
                        return next;
                    });
                }
                setUsersPageIndex(targetPage);
            } else {
                setUsersHasNext(false);
                setUsersHasPrev(false);
                setUsersPageIndex(0);
            }
        } catch (error) {
            console.error("Error fetching users page:", error);
            showToast("error", "Erro ao carregar usuários. Tente novamente.");
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchAuditPage = async (targetPage = 0) => {
        setAuditLoading(true);
        try {
            const auditColl = collection(db, "audit_logs");
            const startCursor = targetPage > 0 ? auditCursors[targetPage - 1] : null;
            const constraints: any[] = [];
            if (auditSearchTerm.trim()) constraints.push(where("userId", "==", auditSearchTerm.trim()));
            if (auditActionFilter !== "all") constraints.push(where("action", "==", auditActionFilter));
            constraints.push(orderBy("timestamp", auditSortDir));
            constraints.push(limit(pageSize + 1));
            if (startCursor) constraints.push(startAfter(startCursor));

            const snap = await getDocs(query(auditColl, ...constraints));
            const docs = snap.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() }));
            setAuditPage(docs);

            const hasNext = snap.docs.length > pageSize;
            setAuditHasNext(hasNext);
            setAuditHasPrev(targetPage > 0);
            const lastDoc = snap.docs.length ? snap.docs[Math.min(pageSize - 1, snap.docs.length - 1)] : undefined;
            if (lastDoc) {
                setAuditCursors((prev) => {
                    const next = [...prev];
                    next[targetPage] = lastDoc;
                    return next;
                });
            }
            setAuditPageIndex(targetPage);
        } catch (e) {
            console.error("Error fetching audit logs:", e);
            showToast("error", "Erro ao carregar auditoria.");
        } finally {
            setAuditLoading(false);
        }
    };

    const fetchReportsPage = async (targetPage = 0) => {
        setReportsLoading(true);
        try {
            const reportsColl = collection(db, "reports");
            const startCursor = targetPage > 0 ? reportsCursors[targetPage - 1] : null;
            const constraints: any[] = [];
            if (reportStatusFilter !== "all") constraints.push(where("status", "==", reportStatusFilter));
            if (reportTypeFilter !== "all") constraints.push(where("type", "==", reportTypeFilter));
            constraints.push(orderBy("timestamp", reportsSortDir));
            constraints.push(limit(pageSize + 1));
            if (startCursor) constraints.push(startAfter(startCursor));

            const snap = await getDocs(query(reportsColl, ...constraints));
            const docs = snap.docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() }));
            setReportsPage(docs);

            const hasNext = snap.docs.length > pageSize;
            setReportsHasNext(hasNext);
            setReportsHasPrev(targetPage > 0);
            const lastDoc = snap.docs.length ? snap.docs[Math.min(pageSize - 1, snap.docs.length - 1)] : undefined;
            if (lastDoc) {
                setReportsCursors((prev) => {
                    const next = [...prev];
                    next[targetPage] = lastDoc;
                    return next;
                });
            }
            setReportsPageIndex(targetPage);
        } catch (e) {
            console.error("Error fetching reports:", e);
            showToast("error", "Erro ao carregar denúncias.");
        } finally {
            setReportsLoading(false);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;
        if (activeTab === "users") {
            setUserCursors([]);
            setUsersPageIndex(0);
            fetchUsersPage(0);
        }
        if (activeTab === "audit") {
            setAuditCursors([]);
            setAuditPageIndex(0);
            fetchAuditPage(0);
        }
        if (activeTab === "reports") {
            setReportsCursors([]);
            setReportsPageIndex(0);
            fetchReportsPage(0);
        }
    }, [activeTab, isAdmin, roleFilter, statusFilter, userSortDir, searchTerm, auditSortDir, auditSearchTerm, auditActionFilter, reportStatusFilter, reportsSortDir, reportTypeFilter]);

    const handleResolveReport = async (reportId: string) => {
        if (!confirm("Marcar denúncia como resolvida?")) return;
        try {
            await updateDoc(doc(db, "reports", reportId), { status: "resolved" });
            showToast("success", "Denúncia resolvida!");
            fetchReportsPage(reportsPageIndex);
            logAction("ADMIN", "RESOLVE_REPORT", `Resolved report ${reportId}`);
        } catch (error) {
            console.error("Error resolving report:", error);
            showToast("error", "Erro ao resolver denúncia.");
        }
    };

    const handleUpdateRole = async (userId: string, newRole: string) => {
        if (!confirm(`Tem certeza que deseja alterar o perfil deste usuário para ${newRole}?`)) return;
        try {
            await updateDoc(doc(db, "users", userId), { role: newRole });
            showToast("success", "Perfil atualizado com sucesso!");
            fetchUsersPage(usersPageIndex);
        } catch (error) {
            console.error("Error updating role:", error);
            showToast("error", "Erro ao atualizar perfil.");
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        const action = newStatus ? "ativar" : "inativar";
        if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) return;
        try {
            await updateDoc(doc(db, "users", userId), { isActive: newStatus });
            showToast("success", `Usuário ${action === "ativar" ? "ativado" : "inativado"}.`);
            fetchUsersPage(usersPageIndex);
            logAction("ADMIN", "TOGGLE_STATUS", `${action.toUpperCase()} user ${userId}`);
        } catch (error) {
            console.error("Error updating status:", error);
            showToast("error", "Erro ao atualizar status.");
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;
        try {
            await deleteDoc(doc(db, "users", userId));
            showToast("success", "Usuário excluído com sucesso!");
            fetchUsersPage(usersPageIndex);
        } catch (error) {
            console.error("Error deleting user:", error);
            showToast("error", "Erro ao excluir usuário.");
        }
    };

    if (authLoading) return <div className="p-8 text-center">Carregando dashboard...</div>;
    if (!isAdmin) return <div className="p-8 text-center">Redirecionando...</div>;

    const StatCard = ({ title, value, accent }: { title: string; value: number; accent: string }) => (
        <div className="flex items-center justify-between rounded-[20px] border border-slate-100 bg-white/80 p-5 shadow-sm">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${accent}`}>{title.split(" ")[0]}</span>
        </div>
    );

    const CardShell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
        <div className="rounded-[20px] border border-slate-100 bg-white/80 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{subtitle || ""}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                </div>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm">
                <div className="section-shell">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-lg font-semibold text-gray-900">Cotar</span>
                            <span className="ml-1 text-lg font-light text-gray-600">& Construir</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <NotificationBell />
                            <div className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                                    {userInitial}
                                </div>
                                <div className="hidden sm:block text-left">
                                    <p className="text-xs text-slate-500">Bem vindo</p>
                                    <p className="text-sm font-semibold text-slate-900">{userName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Header */}
            <div className="bg-white border-b border-slate-200/80">
                <div className="section-shell">
                    <nav className="flex space-x-6 overflow-x-auto">
                        {adminTabs.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`tab-button ${activeTab === item.id
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="section-shell space-y-6 py-8">
                {activeTab === "overview" && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <StatCard title="Total de Usuários" value={stats.users} accent="bg-blue-600" />
                            <StatCard title="Fornecedores" value={stats.suppliers} accent="bg-violet-600" />
                            <StatCard title="Cotações" value={stats.quotations} accent="bg-emerald-600" />
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <CardShell title="Últimos Usuários" subtitle="Lista recente">
                                <ul className="divide-y divide-slate-100">
                                    {recentUsers.map((user) => (
                                        <li key={user.id} className="py-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{user.name || user.companyName || "Sem Nome"}</p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{user.email}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span>{user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('pt-BR') : 'Data N/A'}</span>
                                                    </div>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${user.role === 'fornecedor' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {user.role === 'fornecedor' ? 'Fornecedor' : user.role === 'cliente' ? 'Cliente' : user.role}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                    {recentUsers.length === 0 && (
                                        <li className="py-3 text-sm text-slate-500">Nenhum usuário encontrado</li>
                                    )}
                                </ul>
                            </CardShell>

                            <CardShell title="Últimas Cotações" subtitle="Movimentação">
                                <ul className="divide-y divide-slate-100">
                                    {recentQuotations.map((quotation) => (
                                        <li key={quotation.id} className="py-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {quotation.items ? `${quotation.items.length} itens` : 'Cotação'}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {quotation.createdAt?.toDate ? quotation.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Data N/A'}
                                                    </p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${quotation.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                    quotation.status === 'finished' ? 'bg-emerald-100 text-emerald-800' :
                                                        'bg-slate-100 text-slate-800'
                                                    }`}>
                                                    {quotation.status === 'pending' ? 'Pendente' :
                                                        quotation.status === 'finished' ? 'Finalizada' :
                                                            quotation.status === 'active' ? 'Ativa' :
                                                                quotation.status === 'canceled' ? 'Cancelada' : quotation.status}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                    {recentQuotations.length === 0 && (
                                        <li className="py-3 text-sm text-slate-500">Nenhuma cotação encontrada</li>
                                    )}
                                </ul>
                            </CardShell>
                        </div>
                    </>
                )}

                {activeTab === "users" && (
                    <CardShell title="Gerenciamento de Usuários" subtitle={`Página ${usersPageIndex + 1}`}>
                        <div className="flex flex-wrap items-center gap-3 pb-3">
                            <form
                                className="flex flex-wrap items-center gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setUserCursors([]);
                                    setUsersPageIndex(0);
                                    setSearchTerm(searchInput.trim());
                                }}
                            >
                                <input
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Buscar por email"
                                    className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                />
                                <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Buscar</button>
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearchTerm(""); setSearchInput(""); setUserCursors([]); setUsersPageIndex(0); }}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </form>

                            <div className="flex items-center gap-2 text-xs text-slate-700">
                                <label className="font-semibold">Perfil</label>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => { setRoleFilter(e.target.value as any); setUserCursors([]); setUsersPageIndex(0); }}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                                >
                                    <option value="all">Todos</option>
                                    <option value="cliente">Cliente</option>
                                    <option value="fornecedor">Fornecedor</option>
                                    <option value="admin">Admin</option>
                                </select>

                                <label className="font-semibold">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => { setStatusFilter(e.target.value as any); setUserCursors([]); setUsersPageIndex(0); }}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                                >
                                    <option value="all">Todos</option>
                                    <option value="active">Ativo</option>
                                    <option value="inactive">Inativo</option>
                                </select>

                                <label className="font-semibold">Ordenar</label>
                                <button
                                    type="button"
                                    onClick={() => { setUserSortDir(prev => prev === "desc" ? "asc" : "desc"); setUserCursors([]); setUsersPageIndex(0); }}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                                >
                                    {userSortDir === "desc" ? "Novos → Antigos" : "Antigos → Novos"}
                                </button>
                            </div>
                        </div>

                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full border-collapse text-sm text-slate-800">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-2">Usuário</th>
                                        <th className="px-4 py-2">Email</th>
                                        <th className="px-4 py-2">Perfil Atual</th>
                                        <th className="px-4 py-2">Status</th>
                                        <th className="px-4 py-2">Última Atualização</th>
                                        <th className="px-4 py-2 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usersLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                                    ) : usersPage.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">Nenhum usuário encontrado.</td>
                                        </tr>
                                    ) : (
                                        usersPage.map((user) => (
                                            <tr key={user.id} className="border-t border-slate-100">
                                                <td className="px-4 py-3 align-top">
                                                    <div className="text-sm font-semibold text-slate-900">{user.name || user.companyName || "Sem Nome"}</div>
                                                    <div className="text-[11px] text-slate-500">ID: {user.id.slice(0, 8)}...</div>
                                                </td>
                                                <td className="px-4 py-3 align-top text-sm text-slate-600">{user.email}</td>
                                                <td className="px-4 py-3 align-top">
                                                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                        user.role === 'fornecedor' ? 'bg-purple-100 text-purple-800' :
                                                            'bg-blue-100 text-blue-800'
                                                        }`}>
                                                        {user.role || 'cliente'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, user.isActive !== false)}
                                                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${user.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                                                    >
                                                        {user.isActive !== false ? 'Ativo' : 'Inativo'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 align-top text-sm text-slate-600">
                                                    {(() => {
                                                        if (!user.lastProductUpdate && !user.createdAt) return "Nunca";
                                                        const baseDate = user.lastProductUpdate ? new Date(user.lastProductUpdate) : user.createdAt?.toDate ? user.createdAt.toDate() : null;
                                                        if (!baseDate) return "Nunca";
                                                        const diffTime = Math.abs(new Date().getTime() - baseDate.getTime());
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                        return diffDays > 1 ? `${diffDays} dias atrás` : "Hoje";
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 align-top text-right text-sm font-medium space-x-2">
                                                    <select
                                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
                                                        value={user.role || 'cliente'}
                                                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                                    >
                                                        <option value="cliente">Cliente</option>
                                                        <option value="fornecedor">Fornecedor</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                                                    >
                                                        Excluir
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View for Users */}
                        <div className="md:hidden space-y-4">
                            {usersLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="h-4 w-1/2 rounded bg-slate-200 mb-2"></div>
                                        <div className="h-3 w-3/4 rounded bg-slate-200 mb-4"></div>
                                        <div className="h-8 w-full rounded bg-slate-200"></div>
                                    </div>
                                ))
                            ) : usersPage.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-500">Nenhum usuário encontrado.</div>
                            ) : (
                                usersPage.map((user) => (
                                    <div key={user.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="font-semibold text-slate-900">{user.name || user.companyName || "Sem Nome"}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </div>
                                            <button
                                                onClick={() => handleToggleStatus(user.id, user.isActive !== false)}
                                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${user.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                                            >
                                                {user.isActive !== false ? 'Ativo' : 'Inativo'}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                user.role === 'fornecedor' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-blue-100 text-blue-800'
                                                }`}>
                                                {user.role || 'cliente'}
                                            </span>
                                            <span className="text-xs text-slate-400">•</span>
                                            <span className="text-xs text-slate-500">
                                                {(() => {
                                                    if (!user.lastProductUpdate && !user.createdAt) return "Nunca";
                                                    const baseDate = user.lastProductUpdate ? new Date(user.lastProductUpdate) : user.createdAt?.toDate ? user.createdAt.toDate() : null;
                                                    if (!baseDate) return "Nunca";
                                                    const diffTime = Math.abs(new Date().getTime() - baseDate.getTime());
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    return diffDays > 1 ? `${diffDays}d atrás` : "Hoje";
                                                })()}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                            <select
                                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
                                                value={user.role || 'cliente'}
                                                onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                            >
                                                <option value="cliente">Cliente</option>
                                                <option value="fornecedor">Fornecedor</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
                                            >
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                            <div>
                                {searchTerm
                                    ? `Busca por "${searchTerm}"`
                                    : `Página ${usersPageIndex + 1}${usersHasNext ? "" : " (última)"}`}
                            </div>
                            {!searchTerm && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => fetchUsersPage(Math.max(usersPageIndex - 1, 0))}
                                        disabled={!usersHasPrev || usersLoading}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        onClick={() => fetchUsersPage(usersPageIndex + 1)}
                                        disabled={!usersHasNext || usersLoading}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Próxima
                                    </button>
                                </div>
                            )}
                        </div>
                    </CardShell>
                )}

                {activeTab === "audit" && (
                    <CardShell title="Logs de Auditoria" subtitle={`Página ${auditPageIndex + 1}`}>
                        <div className="flex flex-wrap items-center gap-2 pb-3 text-xs text-slate-700">
                            <form
                                className="flex items-center gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setAuditCursors([]);
                                    setAuditPageIndex(0);
                                    setAuditSearchTerm(auditSearchInput.trim());
                                }}
                            >
                                <input
                                    value={auditSearchInput}
                                    onChange={(e) => setAuditSearchInput(e.target.value)}
                                    placeholder="Filtrar por userId"
                                    className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                />
                                <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Buscar</button>
                                {auditSearchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => { setAuditSearchTerm(""); setAuditSearchInput(""); setAuditCursors([]); setAuditPageIndex(0); fetchAuditPage(0); }}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Limpar
                                    </button>
                                )}
                            </form>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">Ação</span>
                                <select
                                    value={auditActionFilter}
                                    onChange={(e) => { setAuditActionFilter(e.target.value); setAuditCursors([]); setAuditPageIndex(0); }}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                                >
                                    <option value="all">Todas</option>
                                    <option value="LOGIN">LOGIN</option>
                                    <option value="RESOLVE_REPORT">RESOLVE_REPORT</option>
                                    <option value="TOGGLE_STATUS">TOGGLE_STATUS</option>
                                    <option value="UPDATE_ROLE">UPDATE_ROLE</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">Ordenar</span>
                                <button
                                    type="button"
                                    onClick={() => { setAuditSortDir(prev => prev === "desc" ? "asc" : "desc"); setAuditCursors([]); setAuditPageIndex(0); }}
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
                                    {auditLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
                                    ) : auditPage.length === 0 ? (
                                        <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">Nenhum evento encontrado.</td></tr>
                                    ) : (
                                        auditPage.map((log) => (
                                            <tr key={log.id} className="border-t border-slate-100">
                                                <td className="px-4 py-3 text-sm text-slate-600">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{log.userId}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{log.action}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{log.details}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View for Audit */}
                        <div className="md:hidden space-y-4">
                            {auditLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="h-4 w-1/3 rounded bg-slate-200 mb-2"></div>
                                        <div className="h-3 w-1/2 rounded bg-slate-200 mb-2"></div>
                                        <div className="h-3 w-full rounded bg-slate-200"></div>
                                    </div>
                                ))
                            ) : auditPage.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-500">Nenhum evento encontrado.</div>
                            ) : (
                                auditPage.map((log) => (
                                    <div key={log.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-900">{log.action}</span>
                                            <span className="text-[10px] text-slate-500">
                                                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 mb-1">
                                            <span className="font-medium">User:</span> {log.userId}
                                        </div>
                                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                            {log.details}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                            <div>
                                {auditSearchTerm ? `Filtro por userId "${auditSearchTerm}"` : `Página ${auditPageIndex + 1}${auditHasNext ? "" : " (última)"}`}
                            </div>
                            {!auditSearchTerm && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => fetchAuditPage(Math.max(auditPageIndex - 1, 0))}
                                        disabled={!auditHasPrev || auditLoading}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >Anterior</button>
                                    <button
                                        onClick={() => fetchAuditPage(auditPageIndex + 1)}
                                        disabled={!auditHasNext || auditLoading}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >Próxima</button>
                                </div>
                            )}
                        </div>
                    </CardShell>
                )}

                {activeTab === "reports" && (
                    <CardShell title="Denúncias" subtitle={`Página ${reportsPageIndex + 1}`}>
                        <div className="flex flex-wrap items-center gap-2 pb-3 text-xs text-slate-700">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">Status</span>
                                <select
                                    value={reportStatusFilter}
                                    onChange={(e) => { setReportStatusFilter(e.target.value as any); setReportsCursors([]); setReportsPageIndex(0); }}
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
                                    onChange={(e) => { setReportTypeFilter(e.target.value); setReportsCursors([]); setReportsPageIndex(0); }}
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
                                    onClick={() => { setReportsSortDir(prev => prev === "desc" ? "asc" : "desc"); setReportsCursors([]); setReportsPageIndex(0); }}
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
                                    {reportsLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                                    ) : reportsPage.length === 0 ? (
                                        <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma denúncia encontrada.</td></tr>
                                    ) : (
                                        reportsPage.map((report) => (
                                            <tr key={report.id} className="border-t border-slate-100">
                                                <td className="px-4 py-3 text-sm text-slate-600">{report.timestamp?.toDate ? report.timestamp.toDate().toLocaleString() : 'N/A'}</td>
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
                            {reportsLoading ? (
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
                                            {report.timestamp?.toDate ? report.timestamp.toDate().toLocaleString() : 'N/A'}
                                        </div>

                                        <div className="text-sm text-slate-700 mb-4 bg-slate-50 p-2 rounded border border-slate-100">
                                            {report.description}
                                        </div>

                                        {report.status !== 'resolved' && (
                                            <button
                                                onClick={() => handleResolveReport(report.id)}
                                                className="w-full rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                            >
                                                Marcar como Resolvido
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                            <div>{`Página ${reportsPageIndex + 1}${reportsHasNext ? "" : " (última)"}`}</div>
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
                    </CardShell>
                )}
            </div>
        </div>
    );
}
