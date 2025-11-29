"use client";

import { useState } from "react";
import {
    supplierColumns,
    comparativeRows,
    SupplierKey,
} from "../../../lib/clientDashboardMocks";
import { ArrowDownOnSquareIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { ChatInterface } from "../../ChatInterface";

const supplierKeys = supplierColumns.map((supplier) => supplier.key);

export function ClientComparativeSection() {
    const [selectedSuppliers, setSelectedSuppliers] = useState<{ [itemId: number]: SupplierKey }>({});
    const [view, setView] = useState<"map" | "oc">("map");
    const [chatRecipient, setChatRecipient] = useState<string | null>(null);

    function bestSupplier(rowId: number): SupplierKey | null {
        const row = comparativeRows.find((item) => item.id === rowId);
        if (!row) return null;

        let bestKey: SupplierKey | null = null;
        let bestTotal: number | null = null;

        supplierKeys.forEach((key) => {
            const data = row.fornecedores[key];
            if (!data.total) return;
            if (bestTotal === null || data.total < bestTotal) {
                bestKey = key;
                bestTotal = data.total;
            }
        });

        return bestKey;
    }

    function columnTotal(key: SupplierKey) {
        return comparativeRows
            .map((row) => row.fornecedores[key].total || 0)
            .reduce((sum, value) => sum + value, 0);
    }

    function handleSelectSupplier(itemId: number, supplierKey: SupplierKey) {
        setSelectedSuppliers((prev) => ({
            ...prev,
            [itemId]: supplierKey,
        }));
    }

    function handleGenerateOC() {
        if (Object.keys(selectedSuppliers).length === 0) {
            alert("Selecione pelo menos um fornecedor para os itens.");
            return;
        }
        setView("oc");
    }

    if (view === "oc") {
        // Agrupar itens por fornecedor selecionado
        const itemsBySupplier: { [key in SupplierKey]?: any[] } = {};
        let totalGlobal = 0;

        comparativeRows.forEach((row) => {
            const selectedKey = selectedSuppliers[row.id];
            if (selectedKey) {
                if (!itemsBySupplier[selectedKey]) {
                    itemsBySupplier[selectedKey] = [];
                }
                const offer = row.fornecedores[selectedKey];
                itemsBySupplier[selectedKey]!.push({
                    ...row,
                    offer,
                });
                totalGlobal += offer.total || 0;
            }
        });

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Ordem de Compra Gerada</h2>
                    <button
                        onClick={() => setView("map")}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        Voltar ao Mapa
                    </button>
                </div>

                {Object.entries(itemsBySupplier).map(([supplierKey, items]) => {
                    const supplierLabel = supplierColumns.find((s) => s.key === supplierKey)?.label;
                    const supplierTotal = items.reduce((sum: number, item: any) => sum + (item.offer.total || 0), 0);
                    const freight = supplierKey === "fornecedorA" ? 80 : supplierKey === "fornecedorC" ? 100 : 0;

                    return (
                        <div key={supplierKey} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{supplierLabel}</h3>
                                    <p className="text-sm text-slate-500">Fornecedor Selecionado</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Total Pedido</p>
                                    <p className="text-lg font-bold text-slate-900">R$ {(supplierTotal + freight).toFixed(2)}</p>
                                </div>
                            </div>

                            <table className="min-w-full text-sm mb-4">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Item</th>
                                        <th className="px-4 py-2 text-center">Qtde</th>
                                        <th className="px-4 py-2 text-right">Unitário</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-2 font-medium text-slate-900">{item.descricao}</td>
                                            <td className="px-4 py-2 text-center">{item.quantidade}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.offer.unitario?.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.offer.total?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-700">Frete</td>
                                        <td className="px-4 py-2 text-right font-semibold text-slate-700">R$ {freight.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="flex justify-end">
                                <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                    <ArrowDownOnSquareIcon className="h-4 w-4" />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Mapa comparativo
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">
                        Selecione os melhores fornecedores
                    </h2>
                    <p className="text-sm text-slate-500">
                        Compare preços, fretes e selecione o fornecedor para cada item ou grupo.
                    </p>
                </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-left">Item</th>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-center">Qtde</th>
                            {supplierColumns.map((supplier) => (
                                <th key={supplier.key} className="border-b border-slate-100 px-4 py-3 text-black text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <span>{supplier.label}</span>
                                        <button
                                            onClick={() => setChatRecipient(supplier.label)}
                                            className="text-xs font-normal text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full"
                                        >
                                            <ChatBubbleLeftRightIcon className="h-3 w-3" />
                                            Chat
                                        </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {comparativeRows.map((row) => {
                            const highlight = bestSupplier(row.id);
                            return (
                                <tr key={row.id} className="odd:bg-white even:bg-slate-50/60">
                                    <td className="border-b border-slate-100 px-4 py-3">
                                        <p className="font-semibold text-slate-900">{row.descricao}</p>
                                        <p className="text-xs text-slate-500">{row.unidade}</p>
                                    </td>
                                    <td className="border-b border-slate-100 px-4 py-3 text-center">
                                        {row.quantidade}
                                    </td>
                                    {supplierColumns.map((supplier) => {
                                        const data = row.fornecedores[supplier.key];
                                        const isBest = highlight === supplier.key && data.total;
                                        const isSelected = selectedSuppliers[row.id] === supplier.key;

                                        return (
                                            <td
                                                key={`${row.id}-${supplier.key}`}
                                                onClick={() => data.total && handleSelectSupplier(row.id, supplier.key)}
                                                className={`border-b border-slate-100 px-4 py-3 text-center cursor-pointer transition-colors
                                                    ${isSelected ? "bg-blue-100 ring-2 ring-inset ring-blue-500" : isBest ? "bg-emerald-50/80 hover:bg-emerald-100" : "hover:bg-slate-100"}
                                                `}
                                            >
                                                {data.total ? (
                                                    <>
                                                        <div className={`text-sm font-semibold ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                                                            R$ {data.unitario?.toFixed(2)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Total R$ {data.total.toFixed(2)}
                                                        </div>
                                                        {isSelected && (
                                                            <div className="mt-1 text-[10px] font-bold text-blue-600 uppercase">
                                                                Selecionado
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Sem oferta</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-50 text-sm">
                            <td className="border-t border-slate-100 px-4 py-3 text-black font-semibold">Frete (Estimado)</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            {supplierColumns.map((supplier, index) => (
                                <td
                                    key={`frete-${supplier.key}`}
                                    className="border-t border-slate-100 px-4 py-3 text-center text-slate-700 font-medium"
                                >
                                    R$ {index === 0 ? "80,00" : index === 2 ? "100,00" : "0,00"}
                                </td>
                            ))}
                        </tr>
                        <tr className="bg-slate-900/90 text-white">
                            <td className="px-4 py-3 text-sm font-semibold">Total Mercadoria</td>
                            <td className="px-4 py-3 text-center">-</td>
                            {supplierColumns.map((supplier) => (
                                <td key={`total-${supplier.key}`} className="px-4 py-3 text-center text-sm font-semibold">
                                    R$ {columnTotal(supplier.key).toFixed(2)}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleGenerateOC}
                    className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
                >
                    Gerar Ordem de Compra
                </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
                Clique nas células para selecionar o fornecedor de cada item. O frete será calculado na Ordem de Compra final.
            </p>

            {chatRecipient && (
                <ChatInterface
                    recipientName={chatRecipient}
                    isOpen={!!chatRecipient}
                    onClose={() => setChatRecipient(null)}
                />
            )}
        </div>
    );
}
