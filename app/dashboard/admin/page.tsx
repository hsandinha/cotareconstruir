"use client";

import { useEffect, useState, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase, supabaseAdmin, createUserAdmin, updateUserPasswordAdmin, updateUserRoles } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { NotificationBell } from "../../../components/NotificationBell";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { useToast } from "@/components/ToastProvider";
import ConstructionManagement from "@/components/dashboard/admin/ConstructionManagement";
import ClientesManagement from "@/components/dashboard/admin/ClientesManagement";
import FornecedoresManagement from "@/components/dashboard/admin/FornecedoresManagement";
import { ManufacturersSection } from "@/components/dashboard/admin/ManufacturersSection";

const SkeletonRow = ({ cols }: { cols: number }) => (
    <tr className="animate-pulse border-t border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="px-4 py-4">
                <div className="h-4 w-full rounded bg-slate-200"></div>
            </td>
        ))}
    </tr>
);

const RoleSelector = ({
    currentRoles,
    onUpdate
}: {
    currentRoles: string[],
    onUpdate: (newRoles: string[]) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const availableRoles = ['cliente', 'fornecedor', 'admin'];

    const toggleRole = (role: string) => {
        const newRoles = currentRoles.includes(role)
            ? currentRoles.filter(r => r !== role)
            : [...currentRoles, role];
        onUpdate(newRoles);
    };

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX
            });
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        if (isOpen) {
            const handleScroll = () => setIsOpen(false);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll);
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleScroll);
            };
        }
    }, [isOpen]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className="flex flex-wrap gap-1 items-center min-w-[140px] p-1.5 border border-slate-200 bg-white hover:border-blue-300 rounded-lg transition-all text-left"
            >
                {currentRoles.length > 0 ? (
                    currentRoles.map(role => (
                        <span key={role} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${role === 'admin' ? 'bg-red-100 text-red-800' :
                            role === 'fornecedor' ? 'bg-purple-100 text-purple-800' :
                                'bg-blue-100 text-blue-800'
                            }`}>
                            {role}
                        </span>
                    ))
                ) : (
                    <span className="text-xs text-slate-400 italic px-1">Sem perfil</span>
                )}
                <div className="ml-auto text-slate-400 text-[10px]">▼</div>
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
                    <div
                        className="absolute w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: coords.top, left: coords.left }}
                    >
                        <div className="p-2 space-y-1">
                            {availableRoles.map(role => (
                                <div
                                    key={role}
                                    onClick={(e) => { e.stopPropagation(); toggleRole(role); }}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${currentRoles.includes(role) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${currentRoles.includes(role) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                        {currentRoles.includes(role) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                    </div>
                                    <span className="text-sm font-medium capitalize">{role}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
};

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "clientes" | "fornecedores" | "fabricantes" | "audit" | "reports" | "profile" | "gestao-obra">("gestao-obra");
    const [stats, setStats] = useState({
        users: 0,
        suppliers: 0,
        quotations: 0,
        chatBlockedToday: 0,
    });
    const [recentUsers, setRecentUsers] = useState<any[]>([]);
    const [usersPage, setUsersPage] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersPageIndex, setUsersPageIndex] = useState(0);
    const [userCursors, setUserCursors] = useState<any[]>([]);
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
    const [auditCursors, setAuditCursors] = useState<any[]>([]);
    const [auditHasNext, setAuditHasNext] = useState(false);
    const [auditHasPrev, setAuditHasPrev] = useState(false);
    const [auditSortDir, setAuditSortDir] = useState<"asc" | "desc">("desc");
    const [auditSearchInput, setAuditSearchInput] = useState("");
    const [auditSearchTerm, setAuditSearchTerm] = useState("");
    const [auditActionFilter, setAuditActionFilter] = useState<string>("all");

    const [reportsPage, setReportsPage] = useState<any[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsPageIndex, setReportsPageIndex] = useState(0);
    const [reportsCursors, setReportsCursors] = useState<any[]>([]);
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
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // Create User Modal State
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("123456");
    const [newUserName, setNewUserName] = useState("");
    const [newUserRole, setNewUserRole] = useState("cliente");
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    // Profile Tab State
    const [profileName, setProfileName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newProfilePassword, setNewProfilePassword] = useState("");
    const [confirmProfilePassword, setConfirmProfilePassword] = useState("");
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    const adminTabs: { id: typeof activeTab; label: string }[] = [
        { id: "gestao-obra", label: "Gestão de Obra" },
        { id: "overview", label: "Visão Geral" },
        { id: "users", label: "Gerenciar Usuários" },
        { id: "clientes", label: "Clientes" },
        { id: "fornecedores", label: "Fornecedores" },
        { id: "fabricantes", label: "Fabricantes" },
        { id: "audit", label: "Auditoria" },
        { id: "reports", label: "Denúncias" },
        { id: "profile", label: "Meu Perfil" },
    ];

    const { user, profile, isAdmin: userIsAdmin, initialized } = useAuth();

    const fetchOverview = async () => {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            // Buscar contagens usando Supabase
            const [usersResult, suppliersResult, cotacoesResult, chatBlockedTodayResult] = await Promise.all([
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('fornecedores').select('*', { count: 'exact', head: true }),
                supabase.from('cotacoes').select('*', { count: 'exact', head: true }),
                supabase
                    .from('audit_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('action', 'CHAT_MESSAGE_BLOCKED')
                    .gte('created_at', todayStart.toISOString())
            ]);

            setStats({
                users: usersResult.count || 0,
                suppliers: suppliersResult.count || 0,
                quotations: cotacoesResult.count || 0,
                chatBlockedToday: chatBlockedTodayResult.count || 0,
            });

            // Buscar usuários recentes
            const { data: recentUsersData } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            setRecentUsers(recentUsersData || []);

            // Buscar cotações recentes
            const { data: recentCotacoesData } = await supabase
                .from('cotacoes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            setRecentQuotations(recentCotacoesData || []);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            router.push('/login');
            return;
        }

        if (profile) {
            const name = profile.nome || user.email || "Admin";
            setUserName(name);
            setProfileName(name);
            setUserInitial(name.charAt(0).toUpperCase());
            setUserRoles(profile.roles || [profile.role || 'cliente']);
            setIsAdmin(userIsAdmin || false);
            setAuthLoading(false);
            fetchOverview();
        }
    }, [user, profile, initialized, userIsAdmin, router]);

    const pageSize = 10;

    const fetchUsersPage = async (targetPage = 0) => {
        setUsersLoading(true);
        try {
            let query = supabase
                .from('users')
                .select('*', { count: 'exact' });

            // Aplicar filtros
            if (roleFilter !== "all") {
                query = query.contains('roles', [roleFilter]);
            }
            if (statusFilter !== "all") {
                query = query.eq('status', statusFilter === 'active' ? 'active' : 'suspended');
            }
            if (searchTerm.trim()) {
                query = query.or(`email.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`);
            }

            // Ordenação e paginação
            query = query
                .order('created_at', { ascending: userSortDir === 'asc' })
                .range(targetPage * pageSize, (targetPage + 1) * pageSize - 1);

            const { data, count, error } = await query;

            if (error) throw error;

            setUsersPage(data || []);
            setUsersHasNext((count || 0) > (targetPage + 1) * pageSize);
            setUsersHasPrev(targetPage > 0);
            setUsersPageIndex(targetPage);
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
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' });

            if (auditSearchTerm.trim()) {
                query = query.eq('user_id', auditSearchTerm.trim());
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

    const fetchReportsPage = async (targetPage = 0) => {
        setReportsLoading(true);
        try {
            // Reports não tem tabela ainda, vamos criar uma query vazia
            setReportsPage([]);
            setReportsHasNext(false);
            setReportsHasPrev(false);
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
            setUsersPageIndex(0);
            fetchUsersPage(0);
        }
        if (activeTab === "audit") {
            setAuditPageIndex(0);
            fetchAuditPage(0);
        }
        if (activeTab === "reports") {
            setReportsPageIndex(0);
            fetchReportsPage(0);
        }
    }, [activeTab, isAdmin, roleFilter, statusFilter, userSortDir, searchTerm, auditSortDir, auditSearchTerm, auditActionFilter, reportStatusFilter, reportsSortDir, reportTypeFilter]);

    useEffect(() => {
        if (!isAdmin) return;

        const refreshCurrentTab = () => {
            fetchOverview();

            if (activeTab === "users") {
                fetchUsersPage(usersPageIndex);
            }
            if (activeTab === "audit") {
                fetchAuditPage(auditPageIndex);
            }
            if (activeTab === "reports") {
                fetchReportsPage(reportsPageIndex);
            }
        };

        const handleFocus = () => {
            refreshCurrentTab();
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                refreshCurrentTab();
            }
        };

        const intervalId = window.setInterval(() => {
            refreshCurrentTab();
        }, 30000);

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [
        isAdmin,
        activeTab,
        usersPageIndex,
        auditPageIndex,
        reportsPageIndex,
        roleFilter,
        statusFilter,
        userSortDir,
        searchTerm,
        auditSortDir,
        auditSearchTerm,
        auditActionFilter,
        reportStatusFilter,
        reportsSortDir,
        reportTypeFilter,
    ]);

    const handleResolveReport = async (reportId: string) => {
        if (!confirm("Marcar denúncia como resolvida?")) return;
        try {
            // TODO: Implementar tabela de reports no Supabase se necessário
            showToast("info", "Funcionalidade em desenvolvimento.");
        } catch (error) {
            console.error("Error resolving report:", error);
            showToast("error", "Erro ao resolver denúncia.");
        }
    };

    const handleUpdateRoles = async (userId: string, newRoles: string[]) => {
        try {
            // Buscar dados do usuário
            const { data: userData, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (fetchError || !userData) {
                showToast("error", "Usuário não encontrado.");
                return;
            }

            const previousRoles = userData.roles || (userData.role ? [userData.role] : []);
            const userEmail = userData.email;
            const userName = userData.nome;

            // Ensure at least one role is selected
            const primaryRole = newRoles.length > 0
                ? (newRoles.includes('admin') ? 'admin' : newRoles.includes('fornecedor') ? 'fornecedor' : 'cliente')
                : 'cliente';

            // Atualizar via Supabase
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    roles: newRoles,
                    role: primaryRole
                })
                .eq('id', userId);

            if (updateError) {
                throw updateError;
            }

            showToast("success", "Perfis atualizados com sucesso!");

            // Optimistic update
            setUsersPage(prev => prev.map(u => u.id === userId ? { ...u, roles: newRoles, role: primaryRole } : u));

            // Also update recent users if present
            setRecentUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: newRoles, role: primaryRole } : u));

        } catch (error) {
            console.error("Error updating roles:", error);
            showToast("error", "Erro ao atualizar perfis.");
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const action = newStatus === 'active' ? "ativar" : "inativar";
        if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) return;
        try {
            const { error } = await supabase
                .from('users')
                .update({ status: newStatus })
                .eq('id', userId);

            if (error) throw error;

            showToast("success", `Usuário ${action === "ativar" ? "ativado" : "inativado"}.`);
            fetchUsersPage(usersPageIndex);
        } catch (error) {
            console.error("Error updating status:", error);
            showToast("error", "Erro ao atualizar status.");
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.")) return;
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            showToast("success", "Usuário excluído com sucesso!");
            fetchUsersPage(usersPageIndex);
        } catch (error) {
            console.error("Error deleting user:", error);
            showToast("error", "Erro ao excluir usuário.");
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPassword || !newUserName) {
            showToast("error", "Preencha todos os campos.");
            return;
        }

        setIsCreatingUser(true);
        try {
            // Obter token da sessão
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Sessão não encontrada');
            }

            // Criar usuário via API (usa supabaseAdmin no servidor)
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    email: newUserEmail,
                    password: newUserPassword,
                    nome: newUserName,
                    role: newUserRole,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao criar usuário');
            }

            showToast("success", "Usuário criado com sucesso!");
            setIsCreateUserModalOpen(false);
            setNewUserEmail("");
            setNewUserPassword("");
            setNewUserName("");
            setNewUserRole("cliente");
            fetchUsersPage(0); // Refresh list

        } catch (error: any) {
            console.error("Error creating user:", error);
            let msg = error.message || "Erro ao criar usuário.";
            showToast("error", msg);
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingProfile(true);
        try {
            if (!user) return;

            // Update Name
            if (profileName !== userName) {
                const { error } = await supabase
                    .from('users')
                    .update({ nome: profileName })
                    .eq('id', user.id);

                if (error) throw error;

                setUserName(profileName);
                showToast("success", "Nome atualizado com sucesso!");
            }

            // Update Password
            if (newProfilePassword) {
                if (newProfilePassword !== confirmProfilePassword) {
                    showToast("error", "As senhas não coincidem.");
                    setIsUpdatingProfile(false);
                    return;
                }
                if (newProfilePassword.length < 6) {
                    showToast("error", "A senha deve ter pelo menos 6 caracteres.");
                    setIsUpdatingProfile(false);
                    return;
                }

                // Atualizar senha via Supabase
                const { error: passwordError } = await supabase.auth.updateUser({
                    password: newProfilePassword
                });

                if (passwordError) throw passwordError;

                showToast("success", "Senha atualizada com sucesso!");
                setCurrentPassword("");
                setNewProfilePassword("");
                setConfirmProfilePassword("");
            }
        } catch (error: any) {
            console.error("Error updating profile:", error);
            showToast("error", error.message || "Erro ao atualizar perfil.");
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const { logout } = useAuth();

    const handleLogout = async () => {
        await logout();
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
            <div className="relative z-[60] bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm">
                <div className="section-shell">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center">
                            <div className="mr-2 flex items-center justify-center rounded-lg bg-white">
                                <Image src="/logo.png" alt="Comprar & Construir" width={60} height={60} priority />
                            </div>
                            <span className="text-lg font-semibold text-gray-900">Comprar</span>
                            <span className="ml-1 text-lg font-light text-gray-600">& Construir</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <NotificationBell />
                            <ProfileSwitcher
                                currentRole="admin"
                                availableRoles={userRoles}
                                userName={userName}
                                userInitial={userInitial}
                            />
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
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard title="Total de Usuários" value={stats.users} accent="bg-blue-600" />
                            <StatCard title="Fornecedores" value={stats.suppliers} accent="bg-violet-600" />
                            <StatCard title="Cotações" value={stats.quotations} accent="bg-emerald-600" />
                            <StatCard title="Bloqueios de Chat Hoje" value={stats.chatBlockedToday} accent="bg-rose-600" />
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
                                                <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                                                    {(user.roles || (user.role ? [user.role] : ['cliente'])).map((role: string) => (
                                                        <span key={role} className={`rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${role === 'admin' ? 'bg-red-100 text-red-800' :
                                                            role === 'fornecedor' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-blue-100 text-blue-800'
                                                            }`}>
                                                            {role}
                                                        </span>
                                                    ))}
                                                </div>
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

                            <button
                                onClick={() => setIsCreateUserModalOpen(true)}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 flex items-center gap-1"
                            >
                                <span className="text-lg leading-none">+</span> Adicionar
                            </button>

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
                                                <td className="px-4 py-3 align-top text-sm text-slate-600">
                                                    <div>{user.email}</div>
                                                    <div className="mt-1 text-[11px] text-slate-500">
                                                        Último login: {(() => {
                                                            const raw = user.last_login_at || user.lastLoginAt || user.last_login || null;
                                                            if (!raw) return 'Nunca';
                                                            const dt = typeof raw === 'string' ? new Date(raw) : raw?.toDate ? raw.toDate() : new Date(raw);
                                                            if (Number.isNaN(dt.getTime())) return 'Nunca';
                                                            return dt.toLocaleString('pt-BR');
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <RoleSelector
                                                        currentRoles={user.roles || (user.role ? [user.role] : ['cliente'])}
                                                        onUpdate={(newRoles) => handleUpdateRoles(user.id, newRoles)}
                                                    />
                                                    {(user.must_change_password === true || user.mustChangePassword === true) && (
                                                        <div className="mt-1">
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-100">
                                                                🔒 Senha Provisória
                                                            </span>
                                                        </div>
                                                    )}
                                                    {/* Indicador de cadastro pendente */}
                                                    {(user.pendingClienteProfile || user.pendingFornecedorProfile) && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {user.pendingClienteProfile && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                                                    ⚠ Cadastro Cliente Pendente
                                                                </span>
                                                            )}
                                                            {user.pendingFornecedorProfile && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                                                    ⚠ Cadastro Fornecedor Pendente
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, user.status || 'active')}
                                                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${(user.status || 'active') === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                                                    >
                                                        {(user.status || 'active') === 'active' ? 'Ativo' : 'Inativo'}
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
                                                <div className="mt-1 text-[11px] text-slate-500">
                                                    Último login: {(() => {
                                                        const raw = user.last_login_at || user.lastLoginAt || user.last_login || null;
                                                        if (!raw) return 'Nunca';
                                                        const dt = typeof raw === 'string' ? new Date(raw) : raw?.toDate ? raw.toDate() : new Date(raw);
                                                        if (Number.isNaN(dt.getTime())) return 'Nunca';
                                                        return dt.toLocaleString('pt-BR');
                                                    })()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleToggleStatus(user.id, user.status || 'active')}
                                                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${(user.status || 'active') === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                                            >
                                                {(user.status || 'active') === 'active' ? 'Ativo' : 'Inativo'}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <RoleSelector
                                                currentRoles={user.roles || (user.role ? [user.role] : ['cliente'])}
                                                onUpdate={(newRoles) => handleUpdateRoles(user.id, newRoles)}
                                            />
                                            {(user.must_change_password === true || user.mustChangePassword === true) && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-100">
                                                    🔒 Senha Provisória
                                                </span>
                                            )}
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

                                        {/* Indicador de cadastro pendente - Mobile */}
                                        {(user.pendingClienteProfile || user.pendingFornecedorProfile) && (
                                            <div className="mb-3 flex flex-wrap gap-1">
                                                {user.pendingClienteProfile && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                                        ⚠ Cadastro Cliente Pendente
                                                    </span>
                                                )}
                                                {user.pendingFornecedorProfile && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                                        ⚠ Cadastro Fornecedor Pendente
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 ml-auto"
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
                                    <option value="CHAT_MESSAGE_BLOCKED">CHAT_MESSAGE_BLOCKED</option>
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
                                                <td className="px-4 py-3 text-sm text-slate-600">{log.created_at ? new Date(log.created_at).toLocaleString() : (log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A')}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{log.user_id || log.userId || '-'}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{log.action}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 whitespace-pre-wrap break-words">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})}</td>
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
                                                {log.created_at ? new Date(log.created_at).toLocaleString() : (log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A')}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 mb-1">
                                            <span className="font-medium">User:</span> {log.user_id || log.userId || '-'}
                                        </div>
                                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})}
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

                {activeTab === "gestao-obra" && (
                    <ConstructionManagement />
                )}

                {activeTab === "clientes" && (
                    <ClientesManagement />
                )}

                {activeTab === "fornecedores" && (
                    <FornecedoresManagement />
                )}

                {activeTab === "fabricantes" && (
                    <ManufacturersSection />
                )}

                {activeTab === "profile" && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <CardShell title="Informações do Perfil" subtitle="Seus dados">
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700">Nome / Empresa</label>
                                    <input
                                        type="text"
                                        value={profileName}
                                        onChange={(e) => setProfileName(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700">Email</label>
                                    <input
                                        type="email"
                                        value={user?.email || ""}
                                        disabled
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <h4 className="mb-3 text-sm font-semibold text-slate-900">Alterar Senha</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700">Senha Atual</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                                placeholder="Necessário para alterar a senha"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700">Nova Senha</label>
                                            <input
                                                type="password"
                                                value={newProfilePassword}
                                                onChange={(e) => setNewProfilePassword(e.target.value)}
                                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                                placeholder="Mínimo 6 caracteres"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700">Confirmar Nova Senha</label>
                                            <input
                                                type="password"
                                                value={confirmProfilePassword}
                                                onChange={(e) => setConfirmProfilePassword(e.target.value)}
                                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={isUpdatingProfile}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {isUpdatingProfile ? "Salvando..." : "Salvar Alterações"}
                                    </button>
                                </div>
                            </form>
                        </CardShell>

                        <CardShell title="Segurança da Conta" subtitle="Status">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Autenticação</p>
                                        <p className="text-xs text-slate-500">Login via Email e Senha</p>
                                    </div>
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">Ativo</span>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">ID do Usuário</p>
                                        <p className="text-xs font-mono text-slate-500">{user?.id}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Último Login</p>
                                        <p className="text-xs text-slate-500">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="w-full rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                                    >
                                        Sair da Conta
                                    </button>
                                </div>
                            </div>
                        </CardShell>
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {isCreateUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="mb-4 text-lg font-bold text-slate-900">Adicionar Novo Usuário</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Nome / Empresa</label>
                                <input
                                    type="text"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Nome completo ou Razão Social"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Email</label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="email@exemplo.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Senha Inicial</label>
                                <input
                                    type="password"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    minLength={6}
                                />
                                <p className="mt-1 text-[10px] text-slate-500">O usuário será solicitado a trocar a senha no primeiro login.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Perfil</label>
                                <select
                                    value={newUserRole}
                                    onChange={(e) => setNewUserRole(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="cliente">Cliente</option>
                                    <option value="fornecedor">Fornecedor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateUserModalOpen(false)}
                                    className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                    disabled={isCreatingUser}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={isCreatingUser}
                                >
                                    {isCreatingUser ? "Criando..." : "Criar Usuário"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
