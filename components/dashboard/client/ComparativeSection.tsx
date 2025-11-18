"use client";

import {
    supplierColumns,
    comparativeRows,
    SupplierKey,
} from "../../../lib/clientDashboardMocks";

const supplierKeys = supplierColumns.map((supplier) => supplier.key);

export function ClientComparativeSection() {
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

    return (
        <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Mapa comparativo
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">
                        Garantia de anonimato entre fornecedores
                    </h2>
                    <p className="text-sm text-slate-500">
                        Itens nas linhas, fornecedores nas colunas. O sistema destaca o melhor custo automaticamente.
                    </p>
                </div>
                <div className="rounded-2xl bg-slate-900/90 px-5 py-3 text-xs text-white">
                    <p className="font-semibold">R$ {columnTotal("fornecedorC").toFixed(2)}</p>
                    <p>menor total estimado</p>
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
                                    {supplier.label}
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
                                        return (
                                            <td
                                                key={`${row.id}-${supplier.key}`}
                                                className={`border-b border-slate-100 px-4 py-3 text-black text-center ${isBest ? "bg-emerald-50/80" : ""}`}
                                            >
                                                {data.total ? (
                                                    <>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            R$ {data.unitario?.toFixed(2)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Total R$ {data.total.toFixed(2)}
                                                        </div>
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
                        <tr className="bg-slate-900/90 text-white">
                            <td className="px-4 py-3 text-sm font-semibold">Total da mercadoria</td>
                            <td className="px-4 py-3 text-center">-</td>
                            {supplierColumns.map((supplier) => (
                                <td key={`total-${supplier.key}`} className="px-4 py-3 text-center text-sm font-semibold">
                                    R$ {columnTotal(supplier.key).toFixed(2)}
                                </td>
                            ))}
                        </tr>
                        <tr className="bg-slate-50 text-sm">
                            <td className="border-t border-slate-100 px-4 py-3 text-black">Frete estimado</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            {supplierColumns.map((supplier, index) => (
                                <td
                                    key={`frete-${supplier.key}`}
                                    className="border-t border-slate-100 px-4 py-3 text-center text-slate-700"
                                >
                                    R$ {index === 0 ? "80,00" : index === 2 ? "100,00" : "0,00"}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-xs text-slate-500">
                Condições comerciais completas aparecem somente após a aprovação. Até lá, mantemos anonimato
                para proteger a base de fornecedores do cliente.
            </p>
        </div>
    );
}
