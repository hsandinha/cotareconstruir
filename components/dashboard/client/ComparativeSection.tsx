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
    const [rejectedSuppliers, setRejectedSuppliers] = useState<SupplierKey[]>([]);
    const [negotiationModal, setNegotiationModal] = useState<{
        isOpen: boolean;
        supplier: any;
        step: 'initial' | 'discount' | 'freight' | 'closed';
        discountPercent: number;
    } | null>(null);

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

    function handleSelectBestPerItem() {
        const newSelections: { [itemId: number]: SupplierKey } = {};
        comparativeRows.forEach((row) => {
            const best = bestSupplier(row.id);
            if (best) {
                newSelections[row.id] = best;
            }
        });
        setSelectedSuppliers(newSelections);
    }

    function handleSelectBestWithFreight() {
        // Calcular melhor total considerando apenas os itens no "carrinho"
        // Regra do carrinho: se houver seleções atuais, usa esses itens; senão, considera todos os itens
        const cartItemIds = Object.keys(selectedSuppliers).length > 0
            ? Object.keys(selectedSuppliers).map((id) => Number(id))
            : comparativeRows.map((row) => row.id);

        // Calcular total com frete SOMENTE para fornecedores que cotaram TODOS os itens do carrinho
        const freightCosts: { [key in SupplierKey]: number } = {
            fornecedorA: 80,
            fornecedorB: 0,
            fornecedorC: 100,
            fornecedorD: 0,
        };

        let bestSupplierKey: SupplierKey | null = null;
        let bestTotalWithFreight: number = Infinity;

        supplierKeys.forEach((key) => {
            // Verificar cobertura total dos itens do carrinho
            const coversAllItems = cartItemIds.every((rowId) => {
                const row = comparativeRows.find((r) => r.id === rowId);
                if (!row) return false;
                return !!row.fornecedores[key].total;
            });
            if (!coversAllItems) {
                return; // ignora fornecedores que não cotaram todos os itens
            }

            // Somar apenas os itens do carrinho para este fornecedor
            const merchandiseTotal = cartItemIds
                .map((rowId) => {
                    const row = comparativeRows.find((r) => r.id === rowId)!;
                    return row.fornecedores[key].total || 0;
                })
                .reduce((sum, v) => sum + v, 0);
            const totalWithFreight = merchandiseTotal + freightCosts[key];
            if (totalWithFreight < bestTotalWithFreight) {
                bestTotalWithFreight = totalWithFreight;
                bestSupplierKey = key;
            }
        });

        if (!bestSupplierKey) {
            alert("Para 'Melhor Total com Frete', é necessário um fornecedor que tenha cotado todos os itens do carrinho.");
            return;
        }

        // Selecionar os itens do carrinho para o melhor fornecedor (cobertura total já garantida)
        const newSelections: { [itemId: number]: SupplierKey } = {};
        cartItemIds.forEach((rowId) => {
            newSelections[rowId] = bestSupplierKey!;
        });
        setSelectedSuppliers(newSelections);
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
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleSelectBestWithFreight}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
                    >
                        Melhor Preço com Frete
                    </button>
                    <button
                        onClick={handleSelectBestPerItem}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
                    >
                        Melhor Preço por Item
                    </button>
                </div>
            </div>

            {/* Delta Comparison Card */}
            {(() => {
                // Calcular soma dos melhores preços por item (SEM frete)
                const freightCosts: { [key in SupplierKey]: number } = {
                    fornecedorA: 80,
                    fornecedorB: 0,
                    fornecedorC: 100,
                    fornecedorD: 0,
                };

                let bestPerItemTotal = 0;

                comparativeRows.forEach((row) => {
                    const best = bestSupplier(row.id);
                    if (best && row.fornecedores[best].total) {
                        bestPerItemTotal += row.fornecedores[best].total;
                    }
                });

                // Calcular melhor preço com frete (fornecedor único com todos os itens)
                let bestWithFreightMerchandise = Infinity;
                let bestWithFreightSupplier: SupplierKey | null = null;
                let bestWithFreightCost = 0;

                supplierKeys.forEach((key) => {
                    const coversAllItems = comparativeRows.every((row) => !!row.fornecedores[key].total);
                    if (!coversAllItems) return;

                    const merchandiseTotal = columnTotal(key);
                    const totalWithFreight = merchandiseTotal + freightCosts[key];
                    if (totalWithFreight < bestWithFreightMerchandise + bestWithFreightCost) {
                        bestWithFreightMerchandise = merchandiseTotal;
                        bestWithFreightSupplier = key;
                        bestWithFreightCost = freightCosts[key];
                    }
                });

                if (!bestWithFreightSupplier) return null;

                const bestWithFreightTotal = bestWithFreightMerchandise + bestWithFreightCost;
                const delta = bestPerItemTotal - bestWithFreightMerchandise;
                const percentSavings = bestPerItemTotal > 0 ? (delta / bestPerItemTotal) * 100 : 0;
                const isBetterDeal = bestWithFreightMerchandise < bestPerItemTotal;

                return (
                    <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-4">Análise de Economia</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Melhores Preços por Item</p>
                                <p className="text-2xl font-bold text-gray-900">R$ {bestPerItemTotal.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">Múltiplos fornecedores (sem frete)</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Fornecedor Único</p>
                                <p className="text-2xl font-bold text-blue-600">R$ {bestWithFreightMerchandise.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">{supplierColumns.find(s => s.key === bestWithFreightSupplier)?.label} (sem frete)</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Frete</p>
                                <p className="text-2xl font-bold text-gray-900">R$ {bestWithFreightCost.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">Total com frete: R$ {bestWithFreightTotal.toFixed(2)}</p>
                            </div>
                            <div className={`bg-white rounded-xl p-4 border-2 ${isBetterDeal ? 'border-green-400' : 'border-red-400'}`}>
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Economia na Mercadoria</p>
                                <p className={`text-2xl font-bold ${isBetterDeal ? 'text-green-600' : 'text-red-600'}`}>
                                    {isBetterDeal ? '-' : '+'} R$ {Math.abs(delta).toFixed(2)}
                                </p>
                                <p className={`text-xs font-semibold mt-1 ${isBetterDeal ? 'text-green-600' : 'text-red-600'}`}>
                                    {isBetterDeal ? '↓' : '↑'} {Math.abs(percentSavings).toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        {/* Negotiation Buttons - Prioridade por fornecedor único mais barato */}
                        <div className="mt-4">
                            <p className="text-xs text-gray-600 mb-3">
                                💡 Negocie com fornecedores na ordem de prioridade. O próximo botão aparece apenas se o anterior recusar:
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {(() => {
                                    // Criar lista de fornecedores com todos os itens cotados
                                    const allCoveringSuppliers = supplierKeys
                                        .filter((key) => {
                                            const coversAllItems = comparativeRows.every((row) => !!row.fornecedores[key].total);
                                            return coversAllItems;
                                        })
                                        .map((key) => {
                                            const supplierMerchandise = columnTotal(key);
                                            const supplierFreight = freightCosts[key];
                                            const supplierTotal = supplierMerchandise + supplierFreight;
                                            const deltaMerchandise = supplierMerchandise - bestPerItemTotal;
                                            const deltaTotal = supplierTotal - bestWithFreightTotal;

                                            return {
                                                key,
                                                label: supplierColumns.find(s => s.key === key)?.label || key,
                                                merchandise: supplierMerchandise,
                                                freight: supplierFreight,
                                                total: supplierTotal,
                                                deltaMerchandise,
                                                deltaTotal,
                                            };
                                        })
                                        // Ordenar por total com frete (menor primeiro)
                                        .sort((a, b) => a.total - b.total);

                                    // Calcular o valor de referência ideal (melhor preço por item + melhor frete)
                                    const idealTotal = bestPerItemTotal + Math.min(...Object.values(freightCosts).filter((_, i) => {
                                        const key = supplierKeys[i];
                                        return comparativeRows.every((row) => !!row.fornecedores[key].total);
                                    }));

                                    // Ordenar fornecedores por delta em relação ao ideal (menor delta = mais próximo do ideal)
                                    const suppliersToNegotiate = allCoveringSuppliers
                                        .map(s => ({
                                            ...s,
                                            deltaFromIdeal: s.total - idealTotal
                                        }))
                                        .sort((a, b) => a.deltaFromIdeal - b.deltaFromIdeal);

                                    // Encontrar o índice do primeiro não rejeitado
                                    const firstActiveIndex = suppliersToNegotiate.findIndex(
                                        (s) => !rejectedSuppliers.includes(s.key)
                                    );

                                    return suppliersToNegotiate.map((supplier, index) => {
                                        const isActive = index === firstActiveIndex;
                                        const isRejected = rejectedSuppliers.includes(supplier.key);

                                        // Só mostrar se for ativo ou já foi rejeitado (para histórico)
                                        if (!isActive && !isRejected) return null;

                                        const message = `Olá ${supplier.label}! Você tem uma proposta para nosso pedido.\n\n` +
                                            `📊 Comparação:\n` +
                                            `• Melhores preços por item: R$ ${bestPerItemTotal.toFixed(2)}\n` +
                                            `• Sua proposta: R$ ${supplier.merchandise.toFixed(2)} (${supplier.deltaMerchandise >= 0 ? '+' : ''}R$ ${supplier.deltaMerchandise.toFixed(2)})\n` +
                                            `• Melhor fornecedor único: R$ ${bestWithFreightMerchandise.toFixed(2)} (${supplierColumns.find(s => s.key === bestWithFreightSupplier)?.label})\n\n` +
                                            `💰 Com frete:\n` +
                                            `• Seu total: R$ ${supplier.total.toFixed(2)} (Frete: R$ ${supplier.freight.toFixed(2)})\n` +
                                            `• Melhor total: R$ ${bestWithFreightTotal.toFixed(2)} (Frete: R$ ${bestWithFreightCost.toFixed(2)})\n` +
                                            `• Diferença: R$ ${supplier.deltaTotal.toFixed(2)}\n\n` +
                                            `Consegue igualar ou melhorar o valor de R$ ${bestPerItemTotal.toFixed(2)}?`;

                                        if (isRejected) {
                                            return (
                                                <div
                                                    key={supplier.key}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-500 text-sm font-medium rounded-lg"
                                                >
                                                    <span className="line-through">{supplier.label}</span>
                                                    <span className="text-xs">Recusou</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={supplier.key} className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        alert(`📤 Proposta de negociação enviada para ${supplier.label}!\n\nO fornecedor receberá:\n• Melhor preço: R$ ${bestPerItemTotal.toFixed(2)}\n• Preço atual: R$ ${supplier.merchandise.toFixed(2)}\n• Diferença: +R$ ${supplier.deltaFromIdeal.toFixed(2)}\n\nAguarde a resposta do fornecedor.`);
                                                        // Em um sistema real, aqui enviaria a proposta via API
                                                    }}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors ring-2 ring-amber-300"
                                                >
                                                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                                                    ⭐ {supplier.label} (+R$ {supplier.deltaFromIdeal.toFixed(2)}) - Negociar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setRejectedSuppliers([...rejectedSuppliers, supplier.key]);
                                                        alert(`❌ ${supplier.label} marcado como recusado.\n\nO próximo fornecedor da lista aparecerá agora.`);
                                                    }}
                                                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
                                                    title="Marcar como recusado e passar para o próximo"
                                                >
                                                    Recusou
                                                </button>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-left">Item</th>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-center">Qtde</th>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-center">Unidade</th>
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
                                    </td>
                                    <td className="border-b border-slate-100 px-4 py-3 text-center text-slate-900 font-medium">
                                        {row.quantidade}
                                    </td>
                                    <td className="border-b border-slate-100 px-4 py-3 text-center text-slate-700">
                                        {row.unidade}
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
                        <tr className="bg-white text-sm">
                            <td className="border-t border-slate-100 px-4 py-3 text-black font-semibold">Prazo de Entrega</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            {supplierColumns.map((supplier, index) => (
                                <td
                                    key={`prazo-${supplier.key}`}
                                    className="border-t border-slate-100 px-4 py-3 text-center text-slate-700 font-medium"
                                >
                                    {index === 0 ? "24h" : index === 1 ? "48h" : "3-5 dias"}
                                </td>
                            ))}
                        </tr>
                        <tr className="bg-slate-50 text-sm">
                            <td className="border-t border-slate-100 px-4 py-3 text-black font-semibold">Condições de Pagamento</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            {supplierColumns.map((supplier, index) => (
                                <td
                                    key={`payment-${supplier.key}`}
                                    className="border-t border-slate-100 px-4 py-3 text-center text-slate-700 text-xs"
                                >
                                    <div className="flex flex-col gap-1">
                                        {index === 0 && (
                                            <>
                                                <span className="text-green-600 font-semibold">PIX / Cartão</span>
                                                <span className="text-slate-500">A Faturar 30d</span>
                                            </>
                                        )}
                                        {index === 1 && (
                                            <>
                                                <span className="text-green-600 font-semibold">PIX</span>
                                                <span className="text-slate-500">A Faturar 45d</span>
                                            </>
                                        )}
                                        {index === 2 && (
                                            <>
                                                <span className="text-green-600 font-semibold">PIX / Cartão</span>
                                                <span className="text-slate-500">A Faturar 60d</span>
                                            </>
                                        )}
                                        {index === 3 && (
                                            <>
                                                <span className="text-green-600 font-semibold">PIX</span>
                                                <span className="text-slate-500">A Faturar 45d</span>
                                            </>
                                        )}
                                    </div>
                                </td>
                            ))}
                        </tr>
                        <tr className="bg-slate-900/90 text-white">
                            <td className="px-4 py-3 text-sm font-semibold">Total Mercadoria</td>
                            <td className="px-4 py-3 text-center">-</td>
                            <td className="px-4 py-3 text-center">R$</td>
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
