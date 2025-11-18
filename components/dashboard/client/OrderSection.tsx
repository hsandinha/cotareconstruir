"use client";

import { ArrowDownOnSquareIcon } from "@heroicons/react/24/outline";
import { comparativeRows } from "../../../lib/clientDashboardMocks";

const SELECTED_SUPPLIER = "Fornecedor C";

export function ClientOrderSection() {
    const totalMercadoria = comparativeRows
        .map((row) => row.fornecedores.fornecedorC.total || 0)
        .reduce((sum, value) => sum + value, 0);
    const frete = 100;

    return (
        <div className="space-y-6 rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Ordem de compra (OC)
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">
                        Documento gerado após a decisão final
                    </h2>
                    <p className="text-sm text-slate-500">
                        A OC consolida itens, fornecedor e condições de pagamento para envio interno.
                    </p>
                </div>
                <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-2 text-sm font-semibold text-slate-700">
                    <ArrowDownOnSquareIcon className="h-5 w-5" />
                    Exportar PDF
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Número</p>
                    <p className="text-lg font-semibold text-slate-900">OC-0231/2025</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Fornecedor selecionado
                    </p>
                    <p className="text-lg font-semibold text-slate-900">{SELECTED_SUPPLIER} (anônimo)</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condições</p>
                    <p className="text-lg font-semibold text-slate-900">Pagamento 28/56dd</p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3 text-left">Item</th>
                            <th className="px-4 py-3 text-center">Qtde</th>
                            <th className="px-4 py-3 text-right">Unitário</th>
                            <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {comparativeRows.map((row) => {
                            const offer = row.fornecedores.fornecedorC;
                            if (!offer.total) return null;
                            return (
                                <tr key={`oc-${row.id}`}>
                                    <td className="px-4 py-3 font-semibold text-slate-900">{row.descricao}</td>
                                    <td className="px-4 py-3 text-center">{row.quantidade}</td>
                                    <td className="px-4 py-3 text-right">R$ {offer.unitario?.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right">R$ {offer.total.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold">
                                Total da mercadoria
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold">R$ {totalMercadoria.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold">
                                Frete
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold">R$ {frete.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-slate-900/90 text-white">
                            <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold">
                                Total global
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold">
                                R$ {(totalMercadoria + frete).toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-slate-500">
                A OC é disponibilizada para download e envio interno. A transação financeira ocorre fora da plataforma.
            </p>
        </div>
    );
}
