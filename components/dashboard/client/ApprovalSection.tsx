"use client";

import { useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

export function ClientApprovalSection() {
    const [managerStatus, setManagerStatus] = useState<"pendente" | "aprovado">(
        "pendente"
    );
    const [managerNotes, setManagerNotes] = useState(
        "Avaliar impacto do frete e liberar compra até 18h."
    );

    return (
        <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                            Fluxo de aprovação
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">
                            Analistas consolidam, gestores liberam
                        </h2>
                        <p className="text-sm text-slate-500">
                            Todo movimento fica registrado para auditoria e compliance.
                        </p>
                    </div>
                    <span
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${managerStatus === "aprovado"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-yellow-50 text-yellow-700"}
                    `}
                    >
                        <CheckCircleIcon className="h-4 w-4" />
                        {managerStatus === "aprovado" ? "Aprovado" : "Pendente"}
                    </span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Analista responsável
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">Hebert Sandinha</p>
                        <p className="text-xs text-slate-500">Consolidação concluída em 15/11 • 10h41</p>
                        <div className="mt-4 rounded-xl bg-white px-4 py-3 text-xs text-slate-500">
                            Checados: cadastro fornecedor, itemização, anexos.
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Gerente aprovador
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">Paula Andrade</p>
                        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Observações
                            <textarea
                                value={managerNotes}
                                onChange={(e) => setManagerNotes(e.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                                rows={3}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setManagerStatus("aprovado")}
                            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        >
                            Liberar pedido para o fornecedor
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
