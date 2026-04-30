"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ClientProfileSection } from "../../../components/dashboard/client/ProfileSection";
import { ClientWorksSection } from "../../../components/dashboard/client/WorksSection";
import { ClientOrderSection } from "../../../components/dashboard/client/OrderSection";
import { ClientSolicitationSection } from "../../../components/dashboard/client/SolicitationSection";
import { ClientOpportunitiesSection } from "../../../components/dashboard/client/OpportunitiesSection";
import { DashboardHeader } from "../../../components/DashboardHeader";
import PendingProfileModal from "../../../components/PendingProfileModal";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabaseAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatNotificationListener } from "@/components/ChatNotificationListener";
import { SupplierTour, type SupplierTourStep } from "@/components/SupplierTour";

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

function ClienteDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<TabId>("perfil");
    const [userName, setUserName] = useState("Cliente");
    const [userInitial, setUserInitial] = useState("C");
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [userEmail, setUserEmail] = useState("");
    const [userId, setUserId] = useState("");
    const [showPendingProfileModal, setShowPendingProfileModal] = useState(false);
    const [tourOpen, setTourOpen] = useState(false);
    const [stats, setStats] = useState({
        works: 0,
        quotations: 0,
        orders: 0,
        propostas: 0,
    });

    const { user, profile, initialized, logout } = useAuth();

    const fetchDashboardData = useCallback(async () => {
        if (!user) return;

        try {
            setUserId(user.id);
            setUserEmail(user.email || "");

            if (profile) {
                const name = profile.nome || user.email || "Cliente";
                setUserName(name);
                setUserInitial(name.charAt(0).toUpperCase());
                setUserRoles(profile.roles || []);

                if (!profile.cliente_id && profile.roles?.includes('cliente')) {
                    setShowPendingProfileModal(true);
                }
            }

            const [obrasResult, cotacoesResult, pedidosResult, propostasResult] = await Promise.all([
                supabase.from('obras').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('cotacoes').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['rascunho', 'enviada', 'respondida']),
                supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('propostas').select('cotacao_id, cotacoes!inner(user_id)', { count: 'exact', head: true }).eq('cotacoes.user_id', user.id)
            ]);

            setStats({
                works: obrasResult.count || 0,
                quotations: cotacoesResult.count || 0,
                orders: pedidosResult.count || 0,
                propostas: propostasResult.count || 0,
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, [user, profile]);

    useEffect(() => {
        if (!searchParams) return;

        const tabParam = searchParams.get('tab');
        if (!tabParam) return;

        const isValidTab = tabs.some((t) => t.id === tabParam);
        if (isValidTab) {
            setTab(tabParam as TabId);
        }
    }, [searchParams]);

    // Abrir tour automaticamente no primeiro acesso (ou via ?tour=1)
    useEffect(() => {
        if (!initialized || !user) return;
        if (typeof window === 'undefined') return;
        const forceTour = searchParams?.get('tour') === '1';
        try {
            // Limpa flag antiga para garantir que todos os clientes
            // vejam o tour atualizado novamente
            localStorage.removeItem('clientTourSeen');
            const seen = localStorage.getItem('clientTourSeen_v2');
            if (forceTour || !seen) {
                const t = window.setTimeout(() => setTourOpen(true), 600);
                return () => window.clearTimeout(t);
            }
        } catch { }
    }, [initialized, user, searchParams]);

    const tourSteps: SupplierTourStep[] = [
        {
            title: 'Bem-vindo ao seu painel de Cliente',
            description: 'Vamos fazer um tour completo pelo painel: cadastro, obras, cotações, pedidos e oportunidades. Use as setas do teclado ou os botões abaixo para navegar.',
            placement: 'center',
        },
        {
            selector: '[data-tour="cliente-header"]',
            title: 'Cabeçalho do painel',
            description: 'Aqui você vê seu nome, alterna entre perfis (caso tenha cliente e fornecedor na mesma conta) e acessa notificações e configurações.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="cliente-tabs"]',
            title: 'Abas de navegação',
            description: 'As 5 áreas principais: Cadastro & Perfil, Obras & Endereços, Nova Cotação, Meus Pedidos e Oportunidades. Vamos explicar cada uma a seguir.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="cliente-stat-perfis"]',
            title: 'Perfis Ativos',
            description: 'Mostra quantos perfis você tem ativos na plataforma. Você pode ter perfil de Cliente e Fornecedor na mesma conta.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="cliente-stat-obras"]',
            title: 'Obras',
            description: 'Total de obras cadastradas. Cada obra tem endereço e cronograma de etapas próprios e é a base para criar cotações.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="cliente-stat-cotacoes"]',
            title: 'Cotações em andamento',
            description: 'Cotações enviadas que ainda estão aguardando ou recebendo respostas dos fornecedores.',
            placement: 'bottom',
        },
        {
            selector: '[data-tour="cliente-stat-pedidos"]',
            title: 'Ordens Ativas',
            description: 'Pedidos confirmados em produção ou aguardando entrega.',
            placement: 'bottom',
        },

        // Aba Perfil
        {
            requireTab: 'perfil',
            selector: '[data-tour="tab-perfil"]',
            title: 'Aba: Cadastro & Perfil',
            description: 'Aqui você mantém seus dados cadastrais. Um perfil completo gera mais confiança com fornecedores e libera todas as funcionalidades.',
            placement: 'bottom',
        },
        {
            requireTab: 'perfil',
            selector: '[data-tour="cliente-perfil-header"]',
            title: 'Perfil • Indicador de Completude',
            description: 'O percentual mostra o quanto do seu cadastro está preenchido. Mire em 100% para liberar todas as funcionalidades e aumentar sua credibilidade junto aos fornecedores.',
            placement: 'bottom',
        },
        {
            requireTab: 'perfil',
            selector: '[data-tour="cliente-perfil-tipo"]',
            title: 'Perfil • Pessoa Física ou Jurídica',
            description: 'Escolha entre CPF (pessoa física) ou CNPJ (pessoa jurídica). Para CNPJ aparecem campos extras: Dados da Empresa e Equipe. Use o botão "Salvar Alterações" sempre que mudar algo.',
            placement: 'bottom',
        },
        {
            requireTab: 'perfil',
            selector: '[data-tour="cliente-perfil-dados"]',
            title: 'Perfil • Dados Pessoais / Responsável',
            description: 'No CPF: seus dados pessoais (nome, CPF, telefone, e-mail). No CNPJ: dados do responsável legal pela empresa. Esses contatos são usados pelos fornecedores para falar com você.',
            placement: 'right',
        },
        {
            requireTab: 'perfil',
            selector: '[data-tour="cliente-perfil-endereco"]',
            title: 'Perfil • Endereço',
            description: 'Digite o CEP e o endereço (logradouro, bairro, cidade, estado) é preenchido automaticamente. Para PF é o endereço de entrega; para PJ é o endereço da empresa.',
            placement: 'left',
        },
        {
            requireTab: 'perfil',
            selector: '[data-tour="cliente-perfil-empresa"]',
            title: 'Perfil • Dados da Empresa (CNPJ)',
            description: 'Aparece apenas quando você escolhe Pessoa Jurídica. Digite o CNPJ e clique em "Consultar" para preencher Razão Social automaticamente via Receita Federal. Mostra também o número de obras ativas.',
            placement: 'top',
        },
        {
            requireTab: 'perfil',
            selector: '[data-tour="cliente-perfil-equipe"]',
            title: 'Perfil • Equipe (CNPJ)',
            description: 'Adicione funcionários da sua empresa para que também possam acessar e gerenciar pedidos. Cada um pode ter cargo e perfil de acesso próprio. Ordene por Nome ou Cargo no topo da lista.',
            placement: 'top',
        },

        // Aba Obras
        {
            requireTab: 'obras',
            selector: '[data-tour="tab-obras"]',
            title: 'Aba: Obras & Endereços',
            description: 'Gerencie suas obras com endereço e cronograma de etapas. Cada cotação será sempre vinculada a uma obra.',
            placement: 'bottom',
        },
        {
            requireTab: 'obras',
            selector: '[data-tour="cliente-obras-nova"]',
            title: 'Obras • Cadastrar nova obra',
            description: 'Clique em "Nova Obra" para abrir o formulário. Você informa nome, endereço (com auto-preenchimento por CEP) e pode adicionar etapas (fundação, alvenaria, acabamento, etc.).',
            placement: 'left',
        },
        {
            requireTab: 'obras',
            title: 'Obras • Lista e progresso',
            description: 'Cada cartão de obra mostra endereço, etapas e percentual de progresso (etapas concluídas / total). Clique em uma obra para editar dados, marcar etapas como concluídas ou adicionar novas etapas.',
            placement: 'center',
        },
        {
            requireTab: 'obras',
            title: 'Obras • Adicionar Etapa',
            description: 'Dentro de cada obra, você pode usar "Adicionar Etapa" para incluir novas fases do cronograma. Etapas servem para organizar cotações por momento da obra (ex.: cotação só do hidráulico, só do elétrico, etc.).',
            placement: 'center',
        },

        // Aba Cotação
        {
            requireTab: 'cotacao',
            selector: '[data-tour="tab-cotacao"]',
            title: 'Aba: Nova Cotação',
            description: 'Aqui você cria cotações para receber preços de vários fornecedores ao mesmo tempo, em 3 etapas guiadas.',
            placement: 'bottom',
        },
        {
            requireTab: 'cotacao',
            selector: '[data-tour="cliente-cotacao-steps"]',
            title: 'Cotação • Fluxo em 3 passos',
            description: 'Passo 1: Selecionar Obra. Passo 2: Adicionar Itens (por etapa da obra ou busca rápida, ou importando uma planilha). Passo 3: Revisar e Enviar. Você pode voltar e editar em qualquer momento.',
            placement: 'bottom',
        },
        {
            requireTab: 'cotacao',
            selector: '[data-tour="cliente-cotacao-obra"]',
            title: 'Cotação • Passo 1: Selecionar a obra',
            description: 'Escolha para qual obra essa cotação será feita. Os fornecedores da região dessa obra serão automaticamente notificados quando você enviar.',
            placement: 'top',
        },
        {
            requireTab: 'cotacao',
            title: 'Cotação • Passo 2: Adicionar Itens',
            description: 'Você tem 2 modos: "Por Fases da Obra" (escolhe a etapa e vê os materiais sugeridos por categoria) ou "Busca Rápida" (procura qualquer material pelo nome). Também pode importar uma planilha CSV/XLSX com seus itens.',
            placement: 'center',
        },
        {
            requireTab: 'cotacao',
            title: 'Cotação • Passo 3: Revisar e Enviar',
            description: 'Confira a lista final de itens (com quantidade e unidade), adicione observações se quiser e clique em Enviar. Os fornecedores qualificados na região serão notificados imediatamente.',
            placement: 'center',
        },
        {
            requireTab: 'cotacao',
            title: 'Cotação • Sem fornecedor específico',
            description: 'Você não precisa escolher fornecedores manualmente — a plataforma busca automaticamente os fornecedores da região que atendem aos materiais solicitados.',
            placement: 'center',
        },

        // Aba Pedidos
        {
            requireTab: 'pedidos',
            selector: '[data-tour="tab-pedidos"]',
            title: 'Aba: Meus Pedidos',
            description: 'Acompanhe todas as suas cotações enviadas e os pedidos confirmados em um único lugar.',
            placement: 'bottom',
        },
        {
            requireTab: 'pedidos',
            selector: '[data-tour="cliente-pedidos-lista"]',
            title: 'Pedidos • Lista de cotações',
            description: 'Cada item mostra número da cotação, status (Aguardando, Recebendo Propostas, Fechada), obra, data, número de itens e quantidade de propostas recebidas. Quando uma cotação tem propostas, o badge fica verde piscando para chamar sua atenção.',
            placement: 'top',
        },
        {
            requireTab: 'pedidos',
            title: 'Pedidos • Mapa Comparativo',
            description: 'Clique em qualquer cotação para abrir o Mapa Comparativo: tabela lado a lado com todas as propostas dos fornecedores (preço por item, prazo, condições). É onde você escolhe os melhores e fecha o pedido.',
            placement: 'center',
        },
        {
            requireTab: 'pedidos',
            title: 'Pedidos • Chat e negociação',
            description: 'Dentro do Mapa Comparativo você pode iniciar um chat com cada fornecedor para tirar dúvidas, pedir descontos e ajustar prazos. Todo o histórico fica registrado.',
            placement: 'center',
        },
        {
            requireTab: 'pedidos',
            title: 'Pedidos • Fechar pedido',
            description: 'No Mapa Comparativo você pode fechar com um único fornecedor ou dividir o pedido entre vários (item a item). Após fechar, a cotação vira pedido confirmado e os fornecedores escolhidos são notificados.',
            placement: 'center',
        },

        // Aba Oportunidades
        {
            requireTab: 'oportunidades',
            selector: '[data-tour="tab-oportunidades"]',
            title: 'Aba: Oportunidades',
            description: 'Promoções e ofertas especiais publicadas pelos fornecedores específicas para sua obra e região.',
            placement: 'bottom',
        },
        {
            requireTab: 'oportunidades',
            selector: '[data-tour="cliente-oportunidades-header"]',
            title: 'Oportunidades • Como funciona',
            description: 'Passo 1: selecione a obra para a qual quer ver ofertas. Passo 2: o sistema filtra automaticamente as promoções dos fornecedores da região, dos materiais relevantes para as etapas da sua obra.',
            placement: 'bottom',
        },
        {
            requireTab: 'oportunidades',
            title: 'Oportunidades • Aproveitar uma oferta',
            description: 'Cada oferta mostra fornecedor, material, preço promocional e validade. Você pode clicar para criar uma cotação direta com aquele fornecedor ou simplesmente usar a oferta como referência em outras cotações.',
            placement: 'center',
        },

        {
            title: 'Pronto para começar!',
            description: 'Você pode reabrir este tour a qualquer momento clicando no botão "Tour guiado" no topo do painel. Boa obra!',
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
        switch (tab) {
            case "perfil":
                return <ClientProfileSection />;
            case "obras":
                return <ClientWorksSection />;
            case "cotacao":
                return <ClientSolicitationSection />;
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
            <div data-tour="cliente-header">
            <DashboardHeader
                currentRole="cliente"
                availableRoles={userRoles}
                userName={userName}
                userInitial={userInitial}
            />
            </div>

            {/* Tabs Header */}
            <div className="bg-white border-b border-slate-200/80" data-tour="cliente-tabs">
                <div className="section-shell flex items-center justify-between gap-4">
                    <nav className="flex space-x-6 overflow-x-auto scrollbar-hide flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                data-tour={`tab-${item.id}`}
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
                    <button
                        type="button"
                        onClick={() => setTourOpen(true)}
                        className="hidden md:inline-flex shrink-0 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
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
                    <div className="card-elevated p-6" data-tour="cliente-stat-perfis">
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

                    <div className="card-elevated p-6" data-tour="cliente-stat-obras">
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

                    <div className="card-elevated p-6" data-tour="cliente-stat-cotacoes">
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

                    <div className="card-elevated p-6" data-tour="cliente-stat-pedidos">
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
                    <div className="p-6" key={tab} style={{ animation: 'fadeIn 0.2s ease-out' }}>
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
                    // Delay para garantir que o banco foi atualizado
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }}
            />

            <ChatNotificationListener />

            <SupplierTour
                open={tourOpen}
                steps={tourSteps}
                onClose={() => setTourOpen(false)}
                onChangeTab={(t) => setTab(t as TabId)}
                storageKey="clientTourSeen_v2"
            />
        </div>
    );
}

export default function ClienteDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50">
                <div className="bg-white/90 border-b border-slate-200/80 shadow-sm">
                    <div className="section-shell">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center gap-3">
                                <div className="w-[60px] h-[60px] rounded-lg bg-slate-200 animate-pulse" />
                                <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
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
                            {[1,2,3,4,5].map(i => <div key={i} className="h-4 w-24 rounded bg-slate-200 animate-pulse" />)}
                        </div>
                    </div>
                </div>
                <div className="section-shell py-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {[1,2,3,4].map(i => (
                            <div key={i} className="card-elevated p-6">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse" />
                                    <div className="ml-4 space-y-2">
                                        <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
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
                            <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        }>
            <ClienteDashboardContent />
        </Suspense>
    );
}
