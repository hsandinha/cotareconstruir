"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { initialWorks, Work } from "../../../lib/clientDashboardMocks";

export function ClientWorksSection() {
    const [works, setWorks] = useState<Work[]>(initialWorks);
    const [form, setForm] = useState({
        obra: "",
        bairro: "",
        cidade: "",
        etapa: "",
    });

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!form.obra || !form.bairro) return;
        setWorks((prev) => [...prev, { id: Date.now(), ...form } as Work]);
        setForm({ obra: "", bairro: "", cidade: "", etapa: "" });
    }

    return (
        <div className="space-y-6">
            <form
                onSubmit={handleSubmit}
                className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm"
            >
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                            Cadastrar nova obra
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">
                            Contextualize onde cada demanda será entregue
                        </h2>
                        <p className="text-sm text-slate-500">
                            O bairro direciona fornecedores próximos e reduz o custo de frete.
                        </p>
                    </div>
                    <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Salvar obra
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(["obra", "bairro", "cidade", "etapa"] as const).map((field) => (
                        <label
                            key={field}
                            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                            {field === "obra"
                                ? "Nome da obra / Projeto"
                                : field === "bairro"
                                    ? "Bairro (obrigatório para fornecedores)"
                                    : field === "cidade"
                                        ? "Cidade / UF"
                                        : "Etapa atual"}
                            <input
                                value={form[field]}
                                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                                className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                            />
                        </label>
                    ))}
                </div>
            </form>

            <div className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                            Obras cadastradas
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">
                            Compartilhamos apenas o necessário com o fornecedor
                        </h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
                        {works.length} obras monitoradas
                    </span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {works.map((work) => (
                        <div
                            key={work.id}
                            className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                        >
                            <p className="text-sm font-semibold text-slate-900">{work.obra}</p>
                            <p className="text-xs text-slate-500">
                                Bairro {work.bairro} • {work.cidade}
                            </p>
                            <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-600">
                                    {work.etapa || "Etapa não informada"}
                                </span>
                                <span className="text-slate-400">ID #{work.id}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
