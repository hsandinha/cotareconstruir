"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SupplierProfileSection } from "../../../components/dashboard/supplier/ProfileSection";
import { SupplierMaterialsSection } from "../../../components/dashboard/supplier/MaterialsSection";
import { SupplierMyProductsSection } from "../../../components/dashboard/supplier/MyProductsSection";
import { SupplierSalesAndQuotationsSection } from "../../../components/dashboard/supplier/SalesAndQuotationsSection";
import { SupplierAccessProvider, useSupplierAccessContext } from "@/components/dashboard/supplier/SupplierAccessContext";
import { DashboardHeader } from "../../../components/DashboardHeader";
import PendingProfileModal from "../../../components/PendingProfileModal";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabaseAuth";
import { getAuthHeaders } from "@/lib/authHeaders";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatNotificationListener } from "@/components/ChatNotificationListener";
import { SupplierTour, type SupplierTourStep } from "@/components/SupplierTour";

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
    const [tourOpen, setTourOpen] = useState(false);
    const [stats, setStats] = useState({
        activeConsultations: 0,
        sentProposals: 0,
        registeredMaterials: 0,
        approvals: 0,
    });

    const { user, profile, session, initialized, logout } = useAuth();
    const {
        suppliers,
        activeSupplierId,
        activeSupplier,
        setActiveSupplierId,
        hasMultipleSuppliers,
        requiresSelection,
        loading: supplierAccessLoading,
    } = useSupplierAccessContext();

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;
        if (supplierAccessLoading) return;

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
            const fornecedorQuery = activeSupplierId
                ? `?fornecedor_id=${encodeURIComponent(activeSupplierId)}`
                : '';

            if (requiresSelection) {
                setStats({
                    activeConsultations: 0,
                    sentProposals: 0,
                    registeredMaterials: 0,
                    approvals: 0,
                });
                return;
            }

            const [cotacoesRes, pedidosRes, materiaisRes] = await Promise.all([
                fetch(`/api/cotacoes${fornecedorQuery}`, { headers: authHeaders }).then(async (r) => r.ok ? r.json() : { data: [] }),
                fetch(`/api/pedidos${fornecedorQuery}`, { headers: authHeaders }).then(async (r) => r.ok ? r.json() : { data: [] }),
                fetch('/api/fornecedor-materiais' + fornecedorQuery, { headers: authHeaders }).then(async (r) => r.ok ? r.json() : { data: [] }),
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
    }, [user, profile, session, activeSupplierId, requiresSelection, supplierAccessLoading]);

    useEffect(() => {
        if (!searchParams) return;

        const tabParam = searchParams.get('tab');
        if (!tabParam) return;

        const isValidTab = tabs.some((t) => t.id === tabParam);
        if (isValidTab) {
            setTab(tabParam as SupplierTabId);
        }
    }, [searchParams]);

    // Abrir tour automaticamente no primeiro acesso (ou via ?tour=1)
    useEffect(() => {
        if (!initialized || !user) return;
        if (typeof window === 'undefined') return;
        const forceTour = searchParams?.get('tour') === '1';
        try {
            const seen = localStorage.getItem('supplierTourSeen');
            if (forceTour || !seen) {
                const t = window.setTimeout(() => setTourOpen(true), 600);
                return () => window.clearTimeout(t);
            }
        } catch { }
    }, [initialized, user, searchParams]);

    const tourSteps: SupplierTourStep[] = [
        {
            title: 'Bem-vindo ao seu painel de Fornecedor',
            description: 'Vamos fazer um tour rápido para mostrar onde ficam suas cotações, propostas, materiais e pedidos. Use as setas do teclado ou os botões abaixo para navegar.',
            placement: 'center',
        },
        {
            selector: '[data-tour="supplier-header"]',
            title: 'Cabeçalho do painel',
            description: 'Aqui você vê seu nome, alterna entre perfis (caso tenha mais de um) e acessa notificações e configurações da conta.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="supplier-company-switcher"]',
            title: 'Seletor de empresa (multi-CNPJ)',
            description: 'Se seu login estiver vinculado a mais de uma empresa, troque aqui o CNPJ ativo. Todos os dados do painel passam a refletir a empresa selecionada.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="supplier-tabs"]',
            title: 'Abas de navegação',
            description: 'Use estas abas para navegar entre as áreas principais: Cadastro & Perfil, Cadastro de Materiais, Minhas Ofertas e Pedidos.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="stat-active"]',
            title: 'Consultas Ativas',
            description: 'Mostra quantas cotações abertas estão disponíveis para você responder. Quanto mais rápido responder, maior a chance de ganhar o pedido.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="stat-proposals"]',
            title: 'Propostas Enviadas',
            description: 'Total de propostas que você já enviou em resposta às cotações. Acompanhe o status de cada uma na aba Pedidos.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="stat-materials"]',
            title: 'Materiais Cadastrados',
            description: 'Quantos materiais você possui cadastrados em seu catálogo. Apenas cotações compatíveis com esses materiais aparecerão para você.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="stat-approvals"]',
            title: 'Aprovações',
            description: 'Pedidos confirmados ou já entregues. É o seu indicador de fechamentos e vendas concluídas.',
            placement: 'bottom',
        },
        {
            requireTab: 'perfil',
            selector: '[data-tour="tab-perfil"]',
            title: 'Cadastro & Perfil',
            description: 'Mantenha seus dados de cadastro, contatos, endereço, dados bancários e informações da empresa sempre atualizados. Um perfil completo aumenta sua credibilidade junto aos clientes.',
            placement: 'bottom',
        },
        {
            requireTab: 'materiais',
            selector: '[data-tour="tab-materiais"]',
            title: 'Cadastro de Materiais',
            description: 'Cadastre os materiais e serviços que você fornece. Esse catálogo é usado para casar suas ofertas com as cotações dos clientes automaticamente.',
            placement: 'bottom',
        },
        {
            requireTab: 'ofertas',
            selector: '[data-tour="tab-ofertas"]',
            title: 'Minhas Ofertas',
            description: 'Visualize suas ofertas ativas, preços vigentes e condições comerciais. É aqui que você gerencia o que está disponível para os clientes solicitarem.',
            placement: 'bottom',
        },
        {
            requireTab: 'vendas-cotacoes',
            selector: '[data-tour="tab-pedidos"]',
            title: 'Pedidos & Cotações',
            description: 'Aqui chegam as cotações dos clientes. Você pode responder com propostas, negociar via chat e acompanhar pedidos confirmados até a entrega.',
            placement: 'bottom',
        },
        {
            title: 'Pronto para começar!',
            description: 'Você pode reabrir este tour a qualquer momento clicando no botão "Tour guiado" no topo do painel. Bons negócios!',
            placement: 'center',
        },
    ];

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
        if (hasMultipleSuppliers && !activeSupplierId) {
            return (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                    <p className="text-lg font-semibold text-amber-900">Selecione uma empresa para continuar</p>
                    <p className="mt-2 text-sm text-amber-800">
                        Este login possui acesso a mais de um CNPJ. Escolha a empresa no modal ou no seletor do topo.
                    </p>
                </div>
            );
        }

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
            <div data-tour="supplier-header">
            <DashboardHeader
                currentRole="fornecedor"
                availableRoles={userRoles}
                userName={userName}
                userInitial={userInitial}
            >
                {(suppliers.length > 0) && (
                    <div className="hidden md:flex items-center" data-tour="supplier-company-switcher">
                        <div className="rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
                            <label className="sr-only" htmlFor="supplier-company-switcher">Empresa ativa</label>
                            <select
                                id="supplier-company-switcher"
                                value={activeSupplierId || ""}
                                onChange={(e) => setActiveSupplierId(e.target.value || null)}
                                className="max-w-[280px] bg-transparent px-2 py-1 text-sm font-medium text-slate-700 focus:outline-none"
                            >
                                <option value="" disabled={suppliers.length > 1}>Selecionar empresa</option>
                                {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {(supplier.nome_fantasia || supplier.razao_social || "Fornecedor")}
                                        {supplier.isPrimary ? " (principal)" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </DashboardHeader>
            </div>

            {/* Tabs Header */}
            <div className="bg-white border-b border-slate-200/80" data-tour="supplier-tabs">
                <div className="section-shell flex items-center justify-between gap-4">
                    <nav className="flex space-x-6 overflow-x-auto scrollbar-hide flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                data-tour={`tab-${item.id === 'vendas-cotacoes' ? 'pedidos' : item.id}`}
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
                    <button
                        type="button"
                        onClick={() => setTourOpen(true)}
                        className="hidden md:inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                        aria-label="Iniciar tour guiado"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
                        </svg>
                        Tour guiado
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="section-shell py-10">

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="card-elevated p-6" data-tour="stat-active">
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

                    <div className="card-elevated p-6" data-tour="stat-proposals">
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

                    <div className="card-elevated p-6" data-tour="stat-materials">
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

                    <div className="card-elevated p-6" data-tour="stat-approvals">
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
                    <div className="p-6" key={tab} style={{ animation: 'fadeIn 0.2s ease-out' }}>
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

            {/* Seleção obrigatória de empresa (multi-CNPJ) */}
            {hasMultipleSuppliers && requiresSelection && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-slate-100 p-6">
                            <h3 className="text-xl font-bold text-slate-900">Escolha a empresa para acessar</h3>
                            <p className="mt-1 text-sm text-slate-600">
                                Este login possui acesso a múltiplos CNPJs. Selecione a empresa que deseja operar agora.
                            </p>
                        </div>

                        <div className="grid gap-4 p-6 md:grid-cols-2">
                            {suppliers.map((supplier) => (
                                <button
                                    key={supplier.id}
                                    type="button"
                                    onClick={() => setActiveSupplierId(supplier.id)}
                                    className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                {supplier.nome_fantasia || supplier.razao_social || "Fornecedor"}
                                            </p>
                                            {supplier.nome_fantasia && supplier.razao_social && (
                                                <p className="mt-1 text-xs text-slate-500">{supplier.razao_social}</p>
                                            )}
                                        </div>
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${supplier.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                            {supplier.ativo ? "Ativo" : "Inativo"}
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                                        <p>CNPJ: {supplier.cnpj || "Não informado"}</p>
                                        {supplier.isPrimary && (
                                            <p className="font-semibold text-emerald-700">Conta principal</p>
                                        )}
                                    </div>
                                    <div className="mt-4 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white group-hover:bg-emerald-700">
                                        Entrar com esta empresa
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-slate-100 px-6 py-4 text-right">
                            <button
                                type="button"
                                onClick={async () => { await logout(); }}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                            >
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ChatNotificationListener />

            <SupplierTour
                open={tourOpen}
                steps={tourSteps}
                onClose={() => setTourOpen(false)}
                onChangeTab={(t) => setTab(t as SupplierTabId)}
                storageKey="supplierTourSeen"
            />
        </div>
    );
}

export default function FornecedorDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50">
                <div className="bg-white/90 border-b border-slate-200/80 shadow-sm">
                    <div className="section-shell">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center gap-3">
                                <div className="w-[60px] h-[60px] rounded-lg bg-slate-200 animate-pulse" />
                                <div className="h-5 w-36 rounded bg-slate-200 animate-pulse" />
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
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-4 w-28 rounded bg-slate-200 animate-pulse" />)}
                        </div>
                    </div>
                </div>
                <div className="section-shell py-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="card-elevated p-6">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse" />
                                    <div className="ml-4 space-y-2">
                                        <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                                        <div className="h-6 w-10 rounded bg-slate-200 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="card-elevated p-6">
                        <div className="space-y-4">
                            <div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
                            <div className="h-4 w-full rounded bg-slate-100 animate-pulse" />
                            <div className="h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        }>
            <SupplierAccessProvider>
                <FornecedorDashboardContent />
            </SupplierAccessProvider>
        </Suspense>
    );
}
