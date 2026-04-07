"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useToast } from "@/components/ToastProvider";
import ConstructionManagement from "@/components/dashboard/admin/ConstructionManagement";
import ClientesManagement from "@/components/dashboard/admin/ClientesManagement";
import FornecedoresManagement from "@/components/dashboard/admin/FornecedoresManagement";
import SuppliersByGroupManagement from "@/components/dashboard/admin/SuppliersByGroupManagement";
import { ManufacturersSection } from "@/components/dashboard/admin/ManufacturersSection";
import { validatePassword } from "@/lib/validation";
import { PasswordStrengthIndicator } from "@/components/PasswordStrength";
import { UsersTable } from "@/components/dashboard/admin/UsersTable";
import { AuditTable } from "@/components/dashboard/admin/AuditTable";
import { ReportsTable } from "@/components/dashboard/admin/ReportsTable";
import { usePolling } from "@/lib/hooks";

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

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "clientes" | "fornecedores" | "fabricantes" | "audit" | "reports" | "profile" | "gestao-obra">("gestao-obra");
    const [fornecedoresSubTab, setFornecedoresSubTab] = useState<"gestao" | "grupo">("gestao");
    const [stats, setStats] = useState({
        users: 0,
        suppliers: 0,
        quotations: 0,
        chatBlockedToday: 0,
    });
    const [recentUsers, setRecentUsers] = useState<any[]>([]);
    const [recentQuotations, setRecentQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("Admin");
    const [userInitial, setUserInitial] = useState("A");
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    const { showToast } = useToast();

    // Profile Tab State
    const [profileName, setProfileName] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newProfilePassword, setNewProfilePassword] = useState("");
    const [confirmProfilePassword, setConfirmProfilePassword] = useState("");
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    const adminTabs: { id: typeof activeTab; label: string; badge?: number }[] = [
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

    // Polling only for overview when active
    usePolling(() => {
        if (activeTab === "overview") fetchOverview();
    }, 30000);

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
                const strength = validatePassword(newProfilePassword);
                if (!strength.valid) {
                    showToast("error", `Senha fraca: ${strength.errors.join(' | ')}`);
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
    const handleLogout = async () => await logout();

    if (authLoading) return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white/90 border-b border-slate-200/80 shadow-sm">
                <div className="section-shell">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-[60px] h-[60px] rounded-lg bg-slate-200 animate-pulse" />
                            <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
                            <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-white border-b border-slate-200/80">
                <div className="section-shell">
                    <div className="flex gap-6 py-3">
                        {[1,2,3,4,5,6].map(i => <div key={i} className="h-4 w-24 rounded bg-slate-200 animate-pulse" />)}
                    </div>
                </div>
            </div>
            <div className="section-shell py-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="rounded-[20px] border border-slate-100 bg-white/80 p-5 shadow-sm">
                            <div className="h-3 w-20 rounded bg-slate-200 animate-pulse mb-3" />
                            <div className="h-8 w-16 rounded bg-slate-200 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
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

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <DashboardHeader
                currentRole="admin"
                availableRoles={userRoles}
                userName={userName}
                userInitial={userInitial}
            />

            {/* Tabs Header */}
            <div className="bg-white border-b border-slate-200/80">
                <div className="section-shell">
                    <nav className="flex space-x-6 overflow-x-auto scrollbar-hide relative" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                                {item.badge ? (
                                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="section-shell space-y-6 py-8" key={activeTab} style={{ animation: 'fadeIn 0.2s ease-out' }}>
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
                                                    <p className="text-sm font-semibold text-slate-900">{user.nome || user.email || "Sem Nome"}</p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{user.email}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span>{user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'Data N/A'}</span>
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
                                                        {quotation.created_at ? new Date(quotation.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Data N/A'}
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

                {activeTab === "users" && <UsersTable />}
                {activeTab === "audit" && <AuditTable />}
                {activeTab === "reports" && <ReportsTable />}

                {activeTab === "gestao-obra" && <ConstructionManagement />}
                {activeTab === "clientes" && <ClientesManagement />}

                {activeTab === "fornecedores" && (
                    <div>
                        {/* Sub-tabs */}
                        <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
                            <button
                                onClick={() => setFornecedoresSubTab("gestao")}
                                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                    fornecedoresSubTab === "gestao"
                                        ? "bg-white text-blue-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                Gestão de Fornecedores
                            </button>
                            <button
                                onClick={() => setFornecedoresSubTab("grupo")}
                                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                    fornecedoresSubTab === "grupo"
                                        ? "bg-white text-blue-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                Fornecedores por Grupo
                            </button>
                        </div>

                        {/* Sub-tab content */}
                        {fornecedoresSubTab === "gestao" && <FornecedoresManagement />}
                        {fornecedoresSubTab === "grupo" && <SuppliersByGroupManagement />}
                    </div>
                )}

                {activeTab === "fabricantes" && <ManufacturersSection />}

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
                                                placeholder="Mínimo 8 caracteres"
                                            />
                                            <PasswordStrengthIndicator password={newProfilePassword} className="mt-2" />
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
        </div>
    );
}
