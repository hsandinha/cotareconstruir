"use client";

import { useState } from "react";

export function ClientProfileSection() {
    const [person, setPerson] = useState({
        name: "Hebert Sandinha",
        cpf: "123.456.789-00",
        email: "hebert@cotareconstruir.com.br",
        phone: "+55 (31) 99999-0000",
    });

    const [company, setCompany] = useState({
        companyName: "Construtora Horizonte",
        cnpj: "12.345.678/0001-90",
        role: "Analista de suprimentos",
        obras: 3,
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                Dados pessoais
                            </p>
                            <h2 className="text-xl font-semibold text-slate-900">
                                Responsável pelas cotações
                            </h2>
                            <p className="text-sm text-slate-500">
                                Campos espelhados nos contratos com fornecedores.
                            </p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            CPF + Conta pessoal
                        </span>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4">
                        {(["name", "email", "phone", "cpf"] as const).map((field) => (
                            <label key={field} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {field === "name"
                                    ? "Nome completo"
                                    : field === "email"
                                        ? "Email corporativo"
                                        : field === "phone"
                                            ? "Telefone/WhatsApp"
                                            : "CPF"}
                                <input
                                    value={person[field]}
                                    onChange={(e) => setPerson({ ...person, [field]: e.target.value })}
                                    className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                />
                            </label>
                        ))}
                    </div>
                </div>

                <div className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                                Dados da empresa
                            </p>
                            <h2 className="text-xl font-semibold text-slate-900">
                                Garantia de confidencialidade
                            </h2>
                            <p className="text-sm text-slate-500">
                                CNPJ vinculado ao contrato mestre com a Cotar & Construir.
                            </p>
                        </div>
                        <div className="rounded-2xl bg-slate-900/90 px-4 py-2 text-right text-xs text-white">
                            <p className="font-semibold">{company.obras} obras</p>
                            <p>ativos vinculados</p>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Razão Social
                            <input
                                value={company.companyName}
                                onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                                className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                            />
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            CNPJ
                            <input
                                value={company.cnpj}
                                onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                                className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                            />
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Função no processo
                            <input
                                value={company.role}
                                onChange={(e) => setCompany({ ...company, role: e.target.value })}
                                className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                            />
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Obras vinculadas
                            <input
                                value={company.obras}
                                onChange={(e) =>
                                    setCompany({ ...company, obras: Number(e.target.value) })
                                }
                                type="number"
                                className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                            />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
