"use client";

import { useEffect, useState, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseAuth";
import { useToast } from "@/components/ToastProvider";
import { useConfirmModal } from "@/components/ConfirmModal";
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

function getUserStatusMeta(statusValue: unknown) {
    const status = String(statusValue || 'active').toLowerCase();
    if (status === 'active') {
        return { value: 'active', label: 'Ativo', className: 'bg-emerald-100 text-emerald-800' };
    }
    if (status === 'pending') {
        return { value: 'pending', label: 'Pendente', className: 'bg-amber-100 text-amber-800' };
    }
    return { value: status || 'suspended', label: 'Inativo', className: 'bg-slate-100 text-slate-700' };
}

export function UsersTable() {
    const { showToast } = useToast();
    const { confirm: confirmModal } = useConfirmModal();
    const pageSize = 10;
    
    // Core state
    const [usersPage, setUsersPage] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersPageIndex, setUsersPageIndex] = useState(0);
    const [usersHasNext, setUsersHasNext] = useState(false);
    const [usersHasPrev, setUsersHasPrev] = useState(false);
    
    // Filters
    const [roleFilter, setRoleFilter] = useState<"all" | "cliente" | "fornecedor" | "admin">("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("desc");

    // Modals state
    const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("123456");
    const [newUserName, setNewUserName] = useState("");
    const [newUserRole, setNewUserRole] = useState("cliente");
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
    const [userPendingDeletion, setUserPendingDeletion] = useState<any | null>(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);

    const [isSupplierLinksModalOpen, setIsSupplierLinksModalOpen] = useState(false);
    const [supplierLinksTargetUser, setSupplierLinksTargetUser] = useState<any | null>(null);
    const [supplierLinksSearchInput, setSupplierLinksSearchInput] = useState("");
    const [supplierLinksLoading, setSupplierLinksLoading] = useState(false);
    const [supplierLinksSaving, setSupplierLinksSaving] = useState(false);
    const [supplierLinksLinked, setSupplierLinksLinked] = useState<any[]>([]);
    const [supplierLinksAvailable, setSupplierLinksAvailable] = useState<any[]>([]);
    const [supplierLinksPrimaryId, setSupplierLinksPrimaryId] = useState<string | null>(null);

    const fetchUsersPage = async (targetPage = 0) => {
        setUsersLoading(true);
        try {
            let query = supabase.from('users').select('*', { count: 'exact' });

            if (roleFilter !== "all") query = query.contains('roles', [roleFilter]);
            if (statusFilter !== "all") {
                if (statusFilter === 'active') query = query.eq('status', 'active');
                else query = query.in('status', ['suspended', 'pending']);
            }
            if (searchTerm.trim()) {
                query = query.or(`email.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`);
            }

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
            showToast("error", "Erro ao carregar usuários.");
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        fetchUsersPage(0);
    }, [roleFilter, statusFilter, searchTerm, userSortDir]);

    usePolling(() => {
        fetchUsersPage(usersPageIndex);
    }, 30000);

    const handleUpdateRoles = async (userId: string, newRoles: string[]) => {
        try {
            const { data: userData, error: fetchError } = await supabase.from('users').select('*').eq('id', userId).single();
            if (fetchError || !userData) {
                showToast("error", "Usuário não encontrado.");
                return;
            }

            const primaryRole = newRoles.length > 0
                ? (newRoles.includes('admin') ? 'admin' : newRoles.includes('fornecedor') ? 'fornecedor' : 'cliente')
                : 'cliente';

            const { error: updateError } = await supabase
                .from('users')
                .update({ roles: newRoles, role: primaryRole })
                .eq('id', userId);

            if (updateError) throw updateError;
            showToast("success", "Perfis atualizados com sucesso!");
            setUsersPage(prev => prev.map(u => u.id === userId ? { ...u, roles: newRoles, role: primaryRole } : u));
        } catch (error) {
            console.error("Error updating roles:", error);
            showToast("error", "Erro ao atualizar perfis.");
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const action = newStatus === 'active' ? "ativar" : "inativar";
        const ok = await confirmModal({
            title: action === "ativar" ? "Ativar Usuário" : "Inativar Usuário",
            message: `Tem certeza que deseja ${action} este usuário?`,
            confirmLabel: action === "ativar" ? "Ativar" : "Inativar",
            variant: action === "ativar" ? "info" : "warning",
        });
        if (!ok) return;

        try {
            const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', userId);
            if (error) throw error;
            showToast("success", `Usuário ${action === "ativar" ? "ativado" : "inativado"}.`);
            fetchUsersPage(usersPageIndex);
        } catch (error) {
            console.error("Error updating status:", error);
            showToast("error", "Erro ao atualizar status.");
        }
    };

    const handleDeleteUser = async () => {
        const userId = userPendingDeletion?.id;
        if (!userId) return;

        setIsDeletingUser(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sessão não encontrada");

            const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${session.access_token}` },
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error?.message || result?.message || result?.error || "Erro ao excluir usuário");
            }

            showToast("success", "Usuário excluído com sucesso!");
            setIsDeleteUserModalOpen(false);
            setUserPendingDeletion(null);
            fetchUsersPage(usersPageIndex);
        } catch (error: any) {
            console.error("Error deleting user:", error);
            showToast("error", error?.message || "Erro ao excluir usuário.");
        } finally {
            setIsDeletingUser(false);
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Sessão não encontrada');

            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ email: newUserEmail, password: newUserPassword, nome: newUserName, role: newUserRole }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao criar usuário');

            showToast("success", "Usuário criado com sucesso!");
            setIsCreateUserModalOpen(false);
            setNewUserEmail("");
            setNewUserPassword("");
            setNewUserName("");
            setNewUserRole("cliente");
            fetchUsersPage(0);
        } catch (error: any) {
            console.error("Error creating user:", error);
            showToast("error", error.message || "Erro ao criar usuário.");
        } finally {
            setIsCreatingUser(false);
        }
    };

    const isFornecedorUser = (user: any) =>
        user?.role === "fornecedor" || (Array.isArray(user?.roles) && user.roles.includes("fornecedor"));

    const fetchSupplierLinksData = async (userId: string, search = "") => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sessão não encontrada");

        const query = new URLSearchParams({ userId });
        if (search.trim()) query.set("search", search.trim());

        const response = await fetch(`/api/admin/user-fornecedor-access?${query.toString()}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Erro ao carregar empresas vinculadas");

        setSupplierLinksLinked(payload.linkedSuppliers || []);
        setSupplierLinksAvailable(payload.availableSuppliers || []);
        setSupplierLinksPrimaryId((payload.linkedSuppliers || []).find((s: any) => s.isPrimary)?.id || null);
        return payload;
    };

    const openSupplierLinksModal = async (targetUser: any) => {
        if (!targetUser?.id) return;
        setSupplierLinksTargetUser(targetUser);
        setSupplierLinksSearchInput("");
        setSupplierLinksLoading(true);
        setIsSupplierLinksModalOpen(true);
        try {
            await fetchSupplierLinksData(targetUser.id, "");
        } catch (error: any) {
            showToast("error", error?.message || "Erro ao carregar vínculos de fornecedores.");
        } finally {
            setSupplierLinksLoading(false);
        }
    };

    const closeSupplierLinksModal = (force = false) => {
        if (supplierLinksSaving && !force) return;
        setIsSupplierLinksModalOpen(false);
        setSupplierLinksTargetUser(null);
        setSupplierLinksSearchInput("");
        setSupplierLinksLinked([]);
        setSupplierLinksAvailable([]);
        setSupplierLinksPrimaryId(null);
        setSupplierLinksLoading(false);
    };

    const handleSaveSupplierLinks = async () => {
        if (!supplierLinksTargetUser?.id) return;
        if (supplierLinksLinked.length > 0 && !supplierLinksPrimaryId) {
            showToast("error", "Selecione um fornecedor principal.");
            return;
        }

        setSupplierLinksSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sessão não encontrada");

            const response = await fetch("/api/admin/user-fornecedor-access", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    userId: supplierLinksTargetUser.id,
                    supplierIds: supplierLinksLinked.map((item) => item.id),
                    primarySupplierId: supplierLinksLinked.length > 0 ? supplierLinksPrimaryId : null,
                }),
            });

            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || "Erro ao salvar vínculos");

            setSupplierLinksLinked(payload.linkedSuppliers || []);
            setSupplierLinksPrimaryId(payload.primarySupplierId || null);
            showToast("success", "Empresas vinculadas atualizadas com sucesso.");
            fetchUsersPage(usersPageIndex);
            closeSupplierLinksModal(true);
        } catch (error: any) {
            showToast("error", error?.message || "Erro ao salvar vínculos.");
        } finally {
            setSupplierLinksSaving(false);
        }
    };

    const handleSupplierLinksSearch = async () => {
        if (!supplierLinksTargetUser?.id) return;
        setSupplierLinksLoading(true);
        try {
            await fetchSupplierLinksData(supplierLinksTargetUser.id, supplierLinksSearchInput);
        } catch (error: any) {
            showToast("error", error?.message || "Erro ao buscar fornecedores.");
        } finally {
            setSupplierLinksLoading(false);
        }
    };

    const handleAddSupplierLinkCandidate = (supplier: any) => {
        if (!supplier?.id || supplier.reserved) return;
        setSupplierLinksLinked((prev) => prev.some(item => item.id === supplier.id) ? prev : [...prev, { ...supplier, isPrimary: false }]);
        setSupplierLinksAvailable((prev) => prev.filter((item) => item.id !== supplier.id));
        setSupplierLinksPrimaryId((prev) => prev || supplier.id);
    };

    const handleRemoveSupplierLinkCandidate = (supplierId: string) => {
        let removedSupplier: any | null = null;
        setSupplierLinksLinked((prev) => {
            const next = prev.filter((item) => {
                const shouldKeep = item.id !== supplierId;
                if (!shouldKeep) removedSupplier = item;
                return shouldKeep;
            });
            setSupplierLinksPrimaryId((current) => current === supplierId ? (next[0]?.id || null) : current);
            return next;
        });

        if (removedSupplier) {
            setSupplierLinksAvailable((prev) => prev.some(item => item.id === removedSupplier.id) ? prev : [{ ...removedSupplier, reserved: false, ownerUserId: null }, ...prev]);
        }
    };

    return (
        <div className="rounded-[20px] border border-slate-100 bg-white/80 shadow-sm relative">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Gerenciamento de Usuários</h3>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Página {usersPageIndex + 1}
                    </p>
                </div>
            </div>
            <div className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3 pb-3">
                    <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(e) => { e.preventDefault(); setUsersPageIndex(0); setSearchTerm(searchInput.trim()); }}
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
                                onClick={() => { setSearchTerm(""); setSearchInput(""); setUsersPageIndex(0); }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >Limpar</button>
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
                        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as any); setUsersPageIndex(0); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1">
                            <option value="all">Todos</option>
                            <option value="cliente">Cliente</option>
                            <option value="fornecedor">Fornecedor</option>
                            <option value="admin">Admin</option>
                        </select>

                        <label className="font-semibold">Status</label>
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setUsersPageIndex(0); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1">
                            <option value="all">Todos</option>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>

                        <label className="font-semibold">Ordenar</label>
                        <button type="button" onClick={() => { setUserSortDir(prev => prev === "desc" ? "asc" : "desc"); setUsersPageIndex(0); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1">
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
                            {usersLoading && usersPage.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                            ) : usersPage.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <EmptyState
                                            title="Nenhum usuário encontrado"
                                            description="Tente ajustar os filtros de busca ou cadastre um novo usuário."
                                            actionLabel="Novo Usuário"
                                            onAction={() => setIsCreateUserModalOpen(true)}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                usersPage.map((user) => (
                                    <tr key={user.id} className="border-t border-slate-100">
                                        <td className="px-4 py-3 align-top">
                                            <div className="text-sm font-semibold text-slate-900">{user.nome || user.email || "Sem Nome"}</div>
                                            <div className="text-[11px] text-slate-500">ID: {user.id.slice(0, 8)}...</div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-600">
                                            <div>{user.email}</div>
                                            <div className="mt-1 text-[11px] text-slate-500">
                                                Último login: {user.last_login_at ? new Date(user.last_login_at).toLocaleString('pt-BR') : 'Nunca'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <RoleSelector currentRoles={user.roles || (user.role ? [user.role] : ['cliente'])} onUpdate={(newRoles) => handleUpdateRoles(user.id, newRoles)} />
                                            {(user.must_change_password) && (
                                                <div className="mt-1"><span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-100">🔒 Senha Provisória</span></div>
                                            )}
                                            {(user.pendingClienteProfile || user.pendingFornecedorProfile) && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {user.pendingClienteProfile && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">⚠ Cadastro Cliente Pendente</span>}
                                                    {user.pendingFornecedorProfile && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">⚠ Cadastro Fornecedor Pendente</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            {(() => {
                                                const statusMeta = getUserStatusMeta(user.status);
                                                return <button onClick={() => handleToggleStatus(user.id, user.status || 'active')} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusMeta.className}`}>{statusMeta.label}</button>;
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-slate-600">
                                            {(() => {
                                                if (!user.updated_at && !user.created_at) return "Nunca";
                                                const d = new Date(user.updated_at || user.created_at);
                                                const diff = Math.ceil(Math.abs(Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
                                                return diff > 1 ? `${diff} dias atrás` : "Hoje";
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 align-top text-right text-sm font-medium space-x-2">
                                            {isFornecedorUser(user) && (
                                                <button onClick={() => openSupplierLinksModal(user)} className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Empresas</button>
                                            )}
                                            <button onClick={() => { setUserPendingDeletion(user); setIsDeleteUserModalOpen(true); }} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">Excluir</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="md:hidden space-y-4">
                    {/* ... Mobile card view implementation skipped for brevity, but structurally identical to desktop mapping ... */}
                    {usersLoading && usersPage.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => (
                             <div key={i} className="animate-pulse flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="h-4 w-1/2 rounded bg-slate-200"></div>
                                <div className="h-3 w-3/4 rounded bg-slate-200"></div>
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
                                        <div className="font-semibold text-slate-900">{user.nome || user.email || "Sem Nome"}</div>
                                        <div className="text-xs text-slate-500">{user.email}</div>
                                    </div>
                                    {(() => {
                                        const statusMeta = getUserStatusMeta(user.status);
                                        return <button onClick={() => handleToggleStatus(user.id, user.status || 'active')} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusMeta.className}`}>{statusMeta.label}</button>;
                                    })()}
                                </div>
                                <RoleSelector currentRoles={user.roles || (user.role ? [user.role] : ['cliente'])} onUpdate={(newRoles) => handleUpdateRoles(user.id, newRoles)} />
                                <div className="flex gap-2 mt-3 pt-3 border-t">
                                    {isFornecedorUser(user) && (
                                        <button onClick={() => openSupplierLinksModal(user)} className="flex-1 rounded border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-xs font-semibold text-indigo-700 text-center">Empresas</button>
                                    )}
                                    <button onClick={() => { setUserPendingDeletion(user); setIsDeleteUserModalOpen(true); }} className="flex-1 rounded border border-red-100 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 text-center">Excluir</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                    <button onClick={() => fetchUsersPage(usersPageIndex - 1)} disabled={!usersHasPrev || usersLoading} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Anterior</button>
                    <span>Página {usersPageIndex + 1}</span>
                    <button onClick={() => fetchUsersPage(usersPageIndex + 1)} disabled={!usersHasNext || usersLoading} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Próxima</button>
                </div>
            </div>

            {/* Create User Modal */}
            {isCreateUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="mb-4 text-lg font-bold text-slate-900">Adicionar Novo Usuário</h3>
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Nome / Empresa</label>
                                <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="Nome completo ou Razão Social" required />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Email</label>
                                <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="email@exemplo.com" required />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Senha Inicial</label>
                                <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" required minLength={6} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Perfil</label>
                                <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                                    <option value="cliente">Cliente</option>
                                    <option value="fornecedor">Fornecedor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsCreateUserModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" disabled={isCreatingUser}>Cancelar</button>
                                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" disabled={isCreatingUser}>{isCreatingUser ? "Criando..." : "Criar Usuário"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete User Modal */}
            {isDeleteUserModalOpen && userPendingDeletion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !isDeletingUser && setIsDeleteUserModalOpen(false)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="border-b border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-900">Excluir usuário</h3>
                            <p className="text-sm text-slate-600">Esta ação não pode ser desfeita.</p>
                        </div>
                        <div className="p-6">
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                                <p className="text-xs font-semibold text-amber-800">O usuário perderá acesso imediato e vínculos serão removidos.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-100 p-6">
                            <button type="button" onClick={() => setIsDeleteUserModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600" disabled={isDeletingUser}>Cancelar</button>
                            <button type="button" onClick={handleDeleteUser} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white" disabled={isDeletingUser}>{isDeletingUser ? "Excluindo..." : "Excluir"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Supplier Links Modal */}
            {isSupplierLinksModalOpen && supplierLinksTargetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => closeSupplierLinksModal()}>
                    <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between border-b border-slate-100 p-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Empresas vinculadas</h3>
                                <p className="text-sm text-slate-600">{supplierLinksTargetUser.email}</p>
                            </div>
                            <button type="button" onClick={() => closeSupplierLinksModal()} className="p-2 text-slate-500 hover:bg-slate-100">✕</button>
                        </div>

                        <div className="grid gap-0 md:grid-cols-2">
                            <div className="border-b border-slate-100 p-6 md:border-b-0 md:border-r">
                                <h4 className="text-sm font-semibold text-slate-900 mb-4">Vinculados ({supplierLinksLinked.length})</h4>
                                <div className="space-y-3 max-h-[360px] overflow-auto">
                                    {supplierLinksLinked.map((supplier) => (
                                        <div key={supplier.id} className="rounded-xl border border-slate-200 p-4">
                                            <div className="flex justify-between gap-3">
                                                <div>
                                                    <p className="font-semibold text-sm">{supplier.nome_fantasia || supplier.razao_social}</p>
                                                    <p className="text-xs text-slate-500">CNPJ: {supplier.cnpj}</p>
                                                </div>
                                                <button onClick={() => handleRemoveSupplierLinkCandidate(supplier.id)} className="text-xs font-semibold text-red-600">Remover</button>
                                            </div>
                                            <label className="mt-3 flex items-center gap-2 cursor-pointer text-xs font-medium">
                                                <input type="radio" checked={supplierLinksPrimaryId === supplier.id} onChange={() => setSupplierLinksPrimaryId(supplier.id)} />
                                                Fornecedor principal
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6">
                                <h4 className="text-sm font-semibold text-slate-900 mb-4">Adicionar fornecedor</h4>
                                <div className="mb-4 flex gap-2">
                                    <input value={supplierLinksSearchInput} onChange={(e) => setSupplierLinksSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSupplierLinksSearch()} placeholder="Buscar..." className="w-full rounded-lg border px-3 py-2 text-sm" />
                                    <button onClick={handleSupplierLinksSearch} className="rounded-lg bg-indigo-600 px-3 text-white">Buscar</button>
                                </div>
                                <div className="space-y-3 max-h-[300px] overflow-auto">
                                    {supplierLinksAvailable.map((supplier) => (
                                        <div key={supplier.id} className="rounded-xl border border-slate-200 p-4 flex justify-between">
                                            <div>
                                                <p className="font-semibold text-sm">{supplier.nome_fantasia || supplier.razao_social}</p>
                                                <p className="text-xs text-slate-500">CNPJ: {supplier.cnpj}</p>
                                                {supplier.reserved && <p className="text-xs text-rose-600">Já vinculado</p>}
                                            </div>
                                            <button onClick={() => handleAddSupplierLinkCandidate(supplier)} disabled={supplier.reserved} className="text-xs font-semibold text-indigo-600 disabled:opacity-50">Adicionar</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t p-6">
                            <button onClick={() => closeSupplierLinksModal()} className="rounded-lg px-4 py-2 font-semibold text-slate-600">Cancelar</button>
                            <button onClick={handleSaveSupplierLinks} disabled={supplierLinksSaving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Salvar vínculos</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
