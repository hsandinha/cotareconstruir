"use client";

import { useEffect, useRef, useState } from "react";
import { SupplierProfileSection } from "../../../components/dashboard/supplier/ProfileSection";
import { SupplierMaterialsSection } from "../../../components/dashboard/supplier/MaterialsSection";
import { SupplierSalesSection } from "../../../components/dashboard/supplier/SalesSection";
import { SupplierOffersSection } from "../../../components/dashboard/supplier/OffersSection";
import { NotificationBell, type Notification } from "../../../components/NotificationBell";

export type SupplierTabId =
    | "perfil"
    | "materiais"
    | "vendas"
    | "ofertas";

const tabs: { id: SupplierTabId; label: string }[] = [
    { id: "perfil", label: "Cadastro & Perfil" },
    { id: "materiais", label: "Cadastro de Materiais" },
    { id: "vendas", label: "Minhas Vendas" },
    { id: "ofertas", label: "Minhas Ofertas" },
];

const supplierNotifications: Notification[] = [
    {
        id: "1",
        title: "Nova Cotação Disponível",
        message: "Cliente 'Cond. Ed. A. Nogueira' solicitou cotação para 'Fundações'.",
        time: "10 min atrás",
        read: false,
        type: "success"
    },
    {
        id: "2",
        title: "Proposta Aceita",
        message: "Sua proposta para o pedido #REQ-2025-001 foi aceita!",
        time: "3 horas atrás",
        read: false,
        type: "success"
    },
    {
        id: "3",
        title: "Documentação Pendente",
        message: "Atualize sua certidão negativa para continuar participando.",
        time: "2 dias atrás",
        read: true,
        type: "warning"
    }
];

export default function FornecedorDashboard() {
    const [tab, setTab] = useState<SupplierTabId>("perfil");
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleMenuSelection = (action: "perfil" | "cadastros" | "vendas" | "ofertas" | "sair") => {
        switch (action) {
            case "perfil":
                setTab("perfil");
                break;
            case "cadastros":
                setTab("materiais");
                break;
            case "vendas":
                setTab("vendas");
                break;
            case "ofertas":
                setTab("ofertas");
                break;
            case "sair":
                alert("Você saiu da conta.");
                break;
        }
        setIsUserMenuOpen(false);
    };

    function renderTabContent() {
        switch (tab) {
            case "perfil":
                return <SupplierProfileSection />;
            case "materiais":
                return <SupplierMaterialsSection />;
            case "vendas":
                return <SupplierSalesSection />;
            case "ofertas":
                return <SupplierOffersSection />;
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
                            <span className="text-lg font-semibold text-gray-900">Cotar</span>
                            <span className="text-lg font-light text-gray-600 ml-1">& Construir</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <NotificationBell initialNotifications={supplierNotifications} />
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                                    className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 hover:border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                        F
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-xs text-gray-500">Bem vindo</p>
                                        <p className="text-sm font-semibold text-gray-900 flex items-center">
                                            Fornecedor
                                            <svg className="ml-1 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </p>
                                    </div>
                                </button>
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-20">
                                        <button
                                            onClick={() => handleMenuSelection("perfil")}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            Perfil
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("cadastros")}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            Cadastros
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("vendas")}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            Minhas Vendas
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("ofertas")}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            Minhas Ofertas
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("sair")}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                                        >
                                            Sair
                                        </button>
                                    </div>
                                )}
                            </div>
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
                                    ? 'border-green-500 text-green-600'
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
                    <p className="text-xs font-semibold uppercase text-green-600 mb-2">
                        Ambiente estratégico do fornecedor
                    </p>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Receba consultas, envie propostas e finalize negócios com segurança
                    </h1>
                    <p className="text-sm text-gray-600">
                        Ambiente ético e competitivo de vendas com anonimato garantido até a aprovação da proposta.
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Consultas Ativas</p>
                                <p className="text-2xl font-semibold text-gray-900">3</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Propostas Enviadas</p>
                                <p className="text-2xl font-semibold text-gray-900">8</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Materiais Cadastrados</p>
                                <p className="text-2xl font-semibold text-gray-900">45</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Aprovações</p>
                                <p className="text-2xl font-semibold text-gray-900">2</p>
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
