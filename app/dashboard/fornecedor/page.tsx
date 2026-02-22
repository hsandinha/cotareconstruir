"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SupplierProfileSection } from "../../../components/dashboard/supplier/ProfileSection";
import { SupplierMaterialsSection } from "../../../components/dashboard/supplier/MaterialsSection";
import { SupplierMyProductsSection } from "../../../components/dashboard/supplier/MyProductsSection";
import { SupplierSalesAndQuotationsSection } from "../../../components/dashboard/supplier/SalesAndQuotationsSection";
import { NotificationBell } from "../../../components/NotificationBell";
import { ProfileSwitcher } from "../../../components/ProfileSwitcher";
import PendingProfileModal from "../../../components/PendingProfileModal";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabaseAuth";
import { getAuthHeaders } from "@/lib/authHeaders";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatNotificationListener } from "@/components/ChatNotificationListener";

export type SupplierTabId =
    | "perfil"
    | "materiais"
    | "ofertas"
    | "vendas-cotacoes";

const tabs: { id: SupplierTabId; label: string }[] = [
    { id: "perfil", label: "Cadastro & Perfil" },
    { id: "materiais", label: "Cadastro de Materiais" },
    { id: "ofertas", label: "Minhas Ofertas" },
    { id: "vendas-cotacoes", label: "Pedidos" },
];


function FornecedorDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<SupplierTabId>("perfil");
    const [userName, setUserName] = useState("Fornecedor");
    const [userInitial, setUserInitial] = useState("F");
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [userEmail, setUserEmail] = useState("");
    const [userId, setUserId] = useState("");
    const [showPendingProfileModal, setShowPendingProfileModal] = useState(false);
    const [stats, setStats] = useState({
        activeConsultations: 0,
        sentProposals: 0,
        registeredMaterials: 0,
        approvals: 0,
    });

    const { user, profile, session, initialized, logout } = useAuth();

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;

        try {
            setUserId(user.id);
            setUserEmail(user.email || "");

            if (profile) {
                const name = profile.nome || user.email || "Fornecedor";
                setUserName(name);
                setUserInitial(name.charAt(0).toUpperCase());
                setUserRoles(profile.roles || []);

                if (!profile.fornecedor_id && profile.roles?.includes('fornecedor')) {
                    setShowPendingProfileModal(true);
                }
            }

            const authHeaders = await getAuthHeaders(session?.access_token);

            const [cotacoesRes, pedidosRes, materiaisRes] = await Promise.all([
                fetch('/api/cotacoes', { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }),
                fetch('/api/pedidos', { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }),
                fetch('/api/fornecedor-materiais' + (profile?.fornecedor_id ? `?fornecedor_id=${profile.fornecedor_id}` : ''), { headers: authHeaders }).then(r => r.ok ? r.json() : { data: [] }),
            ]);

            const cotacoesData = cotacoesRes.data || [];
            const pedidosData = pedidosRes.data || [];
            const materiaisData = materiaisRes.data || [];
            const cotacoesAbertas = cotacoesData.filter((c: any) => c.status !== 'fechada');

            setStats({
                activeConsultations: cotacoesAbertas.length,
                sentProposals: cotacoesData.filter((c: any) => c._proposta_status).length,
                registeredMaterials: materiaisData.length,
                approvals: pedidosData.filter((p: any) => p.status === 'confirmado' || p.status === 'entregue').length,
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, [user, profile, session]);

    useEffect(() => {
        if (!searchParams) return;

        const tabParam = searchParams.get('tab');
        if (!tabParam) return;

        const isValidTab = tabs.some((t) => t.id === tabParam);
        if (isValidTab) {
            setTab(tabParam as SupplierTabId);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            router.push('/login');
            return;
        }

        fetchDashboardData();

        const handleFocus = () => {
            fetchDashboardData();
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchDashboardData();
            }
        };

        const intervalId = window.setInterval(() => {
            fetchDashboardData();
        }, 30000);

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, initialized, router, fetchDashboardData]);

    function renderTabContent() {
        switch (tab) {
            case "perfil":
                return <SupplierProfileSection />;
            case "materiais":
                return <SupplierMaterialsSection />;
            case "ofertas":
                return <SupplierMyProductsSection />;
            case "vendas-cotacoes":
                return <SupplierSalesAndQuotationsSection />;
            default:
                return <SupplierProfileSection />;
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Main Header */}
            <div className="relative z-[60] bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm">
                <div className="section-shell">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <div className="mr-2 flex items-center justify-center rounded-lg bg-white">
                                <Image src="/logo.png" alt="Comprar & Construir" width={60} height={60} priority />
                            </div>
                            <span className="text-lg font-semibold text-gray-900">Comprar</span>
                            <span className="text-lg font-light text-gray-600 ml-1">& Construir</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <NotificationBell />
                            <ProfileSwitcher
                                currentRole="fornecedor"
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
                                    ? 'border-green-600 text-green-700'
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
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Consultas Ativas</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.activeConsultations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Propostas Enviadas</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.sentProposals}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Materiais Cadastrados</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.registeredMaterials}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Aprovações</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.approvals}</p>
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
                profileType="fornecedor"
                userId={userId}
                userEmail={userEmail}
                userName={userName}
                onComplete={async () => {
                    setShowPendingProfileModal(false);
                    // Forçar atualização da sessão antes de recarregar
                    await supabase.auth.refreshSession();
                    // Delay para garantir que o banco foi atualizado
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }}
            />

            <ChatNotificationListener />
        </div>
    );
}

export default function FornecedorDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <FornecedorDashboardContent />
        </Suspense>
    );
}
