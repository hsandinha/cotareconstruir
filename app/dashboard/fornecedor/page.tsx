"use client";

import { useState } from "react";
import { SupplierProfileSection } from "../../../components/dashboard/supplier/ProfileSection";
import { SupplierMaterialsSection } from "../../../components/dashboard/supplier/MaterialsSection";
import { SupplierQuotationInboxSection } from "../../../components/dashboard/supplier/QuotationInboxSection";
import { SupplierQuotationResponseSection } from "../../../components/dashboard/supplier/QuotationResponseSection";
import { SupplierTransactionsSection } from "../../../components/dashboard/supplier/TransactionsSection";
import { SupplierCommunicationSection } from "../../../components/dashboard/supplier/CommunicationSection";

export type SupplierTabId =
    | "perfil"
    | "materiais"
    | "consultas"
    | "cotacao"
    | "transacoes"
    | "comunicacao";

const tabs: { id: SupplierTabId; label: string }[] = [
    { id: "perfil", label: "Cadastro & Perfil" },
    { id: "materiais", label: "Materiais & Grupos" },
    { id: "consultas", label: "Consultas Recebidas" },
    { id: "cotacao", label: "Resposta à Cotação" },
    { id: "transacoes", label: "Transações & Negócios" },
    { id: "comunicacao", label: "Comunicação & Suporte" },
];

export default function FornecedorDashboard() {
    const [tab, setTab] = useState<SupplierTabId>("perfil");

    function renderTabContent() {
        switch (tab) {
            case "perfil":
                return <SupplierProfileSection />;
            case "materiais":
                return <SupplierMaterialsSection />;
            case "consultas":
                return <SupplierQuotationInboxSection />;
            case "cotacao":
                return <SupplierQuotationResponseSection />;
            case "transacoes":
                return <SupplierTransactionsSection />;
            case "comunicacao":
                return <SupplierCommunicationSection />;
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
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">F</span>
                            </div>
                            <span className="text-sm text-gray-700">Bem vindo, Fornecedor</span>
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
