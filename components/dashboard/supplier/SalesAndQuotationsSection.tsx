"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { SupplierQuotationInboxSection } from "./QuotationInboxSection";

export function SupplierSalesAndQuotationsSection() {
    const [showOrders, setShowOrders] = useState(true);

    return (
        <div className="space-y-6">
            {/* Pedidos */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowOrders(!showOrders)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">Pedidos</h3>
                            <p className="text-sm text-gray-600">Recebidos, respondidos, ganhos e perdidos</p>
                        </div>
                    </div>
                    {showOrders ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                </button>

                {showOrders && (
                    <div className="border-t border-gray-200 p-6">
                        <SupplierQuotationInboxSection />
                    </div>
                )}
            </div>
        </div>
    );
}
