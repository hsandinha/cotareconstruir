"use client";

import { useState } from "react";
import { ClientProfileSection } from "../../../components/dashboard/client/ProfileSection";
import { ClientWorksSection } from "../../../components/dashboard/client/WorksSection";
import { ClientSolicitationSection } from "../../../components/dashboard/client/SolicitationSection";
import { ClientComparativeSection } from "../../../components/dashboard/client/ComparativeSection";
import { ClientApprovalSection } from "../../../components/dashboard/client/ApprovalSection";
import { ClientOrderSection } from "../../../components/dashboard/client/OrderSection";
import { ClientExploreSection } from "../../../components/dashboard/client/ExploreSection";

export type TabId =
    | "perfil"
    | "obras"
    | "solicitacao"
    | "comparativo"
    | "aprovacao"
    | "oc"
    | "explorar";

const tabs: { id: TabId; label: string }[] = [
    { id: "perfil", label: "Cadastro & Perfil" },
    { id: "obras", label: "Obras & Endereços" },
    { id: "solicitacao", label: "Solicitação de Cotação" },
    { id: "comparativo", label: "Mapa Comparativo" },
    { id: "aprovacao", label: "Decisão e Aprovação" },
    { id: "oc", label: "Ordem de Compra" },
    { id: "explorar", label: "Pesquisa & Uso" },
];

export default function ClienteDashboard() {
    const [tab, setTab] = useState<TabId>("perfil");

    function renderTabContent() {
        switch (tab) {
            case "perfil":
                return <ClientProfileSection />;
            case "obras":
                return <ClientWorksSection />;
            case "solicitacao":
                return <ClientSolicitationSection />;
            case "comparativo":
                return <ClientComparativeSection />;
            case "aprovacao":
                return <ClientApprovalSection />;
            case "oc":
                return <ClientOrderSection />;
            case "explorar":
                return <ClientExploreSection />;
            default:
                return null;
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Main Header */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <span className="text-lg font-semibold text-gray-900">Cota</span>
                            <span className="text-lg font-light text-gray-600 ml-1">Reconstruir</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">H</span>
                            </div>
                            <span className="text-sm text-gray-700">Bem vindo, Cliente</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8 overflow-x-auto">
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setTab(item.id)}
                                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${tab === item.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <p className="text-xs font-semibold uppercase text-blue-600 mb-2">
                        Hub estratégico do cliente
                    </p>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Centralize cadastros, cotações e decisões em um só lugar
                    </h1>
                    <p className="text-sm text-gray-600">
                        Transparência total sem expor seus fornecedores e mantendo controle sobre aprovações internas.
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0H3" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Obras</p>
                                <p className="text-2xl font-semibold text-gray-900">5</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Cotações</p>
                                <p className="text-2xl font-semibold text-gray-900">8</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Ordens Ativas</p>
                                <p className="text-2xl font-semibold text-gray-900">3</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}
