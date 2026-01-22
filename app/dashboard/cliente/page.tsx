"use client";

import { useEffect, useRef, useState } from "react";
import { ClientProfileSection } from "../../../components/dashboard/client/ProfileSection";
import { ClientWorksSection } from "../../../components/dashboard/client/WorksSection";
import { ClientOrderSection } from "../../../components/dashboard/client/OrderSection";
import { ClientExploreSection } from "../../../components/dashboard/client/ExploreSection";
import { ClientOpportunitiesSection } from "../../../components/dashboard/client/OpportunitiesSection";
import { NotificationBell } from "../../../components/NotificationBell";
import { ProfileSwitcher } from "../../../components/ProfileSwitcher";
import PendingProfileModal from "../../../components/PendingProfileModal";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabaseAuth";
import { useRouter } from "next/navigation";

export type TabId =
    | "perfil"
    | "obras"
    | "cotacao"
    | "pedidos"
    | "oportunidades";

const tabs: { id: TabId; label: string }[] = [
    { id: "perfil", label: "Cadastro & Perfil" },
    { id: "obras", label: "Obras & Endereços" },
    { id: "cotacao", label: "Nova Cotação" },
    { id: "pedidos", label: "Meus Pedidos" },
    { id: "oportunidades", label: "Oportunidades" },
];

export default function ClienteDashboard() {
    const router = useRouter();
    const [tab, setTab] = useState<TabId>("perfil");
    const [userName, setUserName] = useState("Cliente");
    const [userInitial, setUserInitial] = useState("C");
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [userEmail, setUserEmail] = useState("");
    const [userId, setUserId] = useState("");
    const [showPendingProfileModal, setShowPendingProfileModal] = useState(false);
    const [stats, setStats] = useState({
        works: 0,
        quotations: 0,
        orders: 0,
    });

    const { user, profile, initialized, logout } = useAuth();

    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            router.push('/login');
            return;
        }

        const loadData = async () => {
            try {
                setUserId(user.id);
                setUserEmail(user.email || "");

                if (profile) {
                    const name = profile.nome || user.email || "Cliente";
                    setUserName(name);
                    setUserInitial(name.charAt(0).toUpperCase());
                    setUserRoles(profile.roles || []);

                    // Verificar se tem cliente_id vinculado
                    if (!profile.cliente_id && profile.roles?.includes('cliente')) {
                        setShowPendingProfileModal(true);
                    }
                }

                // Buscar estatísticas via Supabase
                const [obrasResult, cotacoesResult, pedidosResult] = await Promise.all([
                    supabase.from('obras').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                    supabase.from('cotacoes').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['rascunho', 'enviada', 'respondida']),
                    supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
                ]);

                setStats({
                    works: obrasResult.count || 0,
                    quotations: cotacoesResult.count || 0,
                    orders: pedidosResult.count || 0,
                });
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };

        loadData();
    }, [user, profile, initialized, router]);

    function renderTabContent() {
        switch (tab) {
            case "perfil":
                return <ClientProfileSection />;
            case "obras":
                return <ClientWorksSection />;
            case "cotacao":
                return <ClientExploreSection />;
            case "pedidos":
                return <ClientOrderSection />;
            case "oportunidades":
                return <ClientOpportunitiesSection />;
            default:
                return null;
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Main Header */}
            <div className="bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm">
                <div className="section-shell">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <span className="text-lg font-semibold text-gray-900">Cotar</span>
                            <span className="text-lg font-light text-gray-600 ml-1">& Construir</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <NotificationBell />
                            <ProfileSwitcher
                                currentRole="cliente"
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
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setTab(item.id)}
                                className={`tab-button ${tab === item.id
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

            {/* Main Content */}
            <div className="section-shell py-10">

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Perfis Ativos</p>
                                <p className="text-2xl font-semibold text-gray-900">1</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0H3" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Obras</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.works}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Cotações</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.quotations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Ordens Ativas</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.orders}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="card-elevated">
                    <div className="p-6">
                        {renderTabContent()}
                    </div>
                </div>
            </div>

            {/* Modal de Cadastro Pendente */}
            <PendingProfileModal
                isOpen={showPendingProfileModal}
                onClose={() => setShowPendingProfileModal(false)}
                profileType="cliente"
                userId={userId}
                userEmail={userEmail}
                userName={userName}
                onComplete={async () => {
                    setShowPendingProfileModal(false);
                    // Forçar atualização da sessão antes de recarregar
                    await supabase.auth.refreshSession();
                    // Pequeno delay para garantir que o banco foi atualizado
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }}
            />
        </div>
    );
}
