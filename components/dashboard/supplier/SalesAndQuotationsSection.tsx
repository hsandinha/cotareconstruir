"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { SupplierQuotationInboxSection } from "./QuotationInboxSection";
import { SupplierSalesSection } from "./SalesSection";

export function SupplierSalesAndQuotationsSection() {
    const [showQuotations, setShowQuotations] = useState(true);
    const [showSales, setShowSales] = useState(true);

    return (
        <div className="space-y-6">
            {/* Cotações Recebidas */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowQuotations(!showQuotations)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">Cotações Recebidas</h3>
                            <p className="text-sm text-gray-600">Solicitações de orçamento pendentes</p>
                        </div>
                    </div>
                    {showQuotations ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                </button>

                {showQuotations && (
                    <div className="border-t border-gray-200 p-6">
                        <SupplierQuotationInboxSection />
                    </div>
                )}
            </div>

            {/* Minhas Vendas */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowSales(!showSales)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">Minhas Vendas</h3>
                            <p className="text-sm text-gray-600">Histórico de pedidos e vendas realizadas</p>
                        </div>
                    </div>
                    {showSales ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                </button>

                {showSales && (
                    <div className="border-t border-gray-200 p-6">
                        <SupplierSalesSection />
                    </div>
                )}
            </div>
        </div>
    );
}
