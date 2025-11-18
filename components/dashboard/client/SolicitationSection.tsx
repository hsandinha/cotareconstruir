"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
    initialCartItems,
    cartCategories,
    CartItem,
} from "../../../lib/clientDashboardMocks";

const categoryOptions = cartCategories as readonly string[];

export function ClientSolicitationSection() {
    type Category = (typeof categoryOptions)[number];

    const [items, setItems] = useState<CartItem[]>(initialCartItems);
    const [form, setForm] = useState({
        descricao: "",
        categoria: categoryOptions[0] as Category,
        quantidade: 1,
        unidade: "unid",
        observacao: "",
    });

    function handleAddItem(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!form.descricao || !form.quantidade) return;
        setItems((prev) => [...prev, { id: Date.now(), ...form } as CartItem]);
        setForm({
            descricao: "",
            categoria: categoryOptions[0] as Category,
            quantidade: 1,
            unidade: "unid",
            observacao: "",
        });
    }

    function handleRemove(id: number) {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }

    const grouped = useMemo(() => {
        return categoryOptions.map((category) => ({
            category,
            items: items.filter((item) => item.categoria === category),
        }));
    }, [items]);

    return (
        <div className="space-y-6">
            <form
                onSubmit={handleAddItem}
                className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm"
            >
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                            Solicitação de materiais
                        </p>
                        <h2 className="text-xl font-semibold text-slate-900">
                            Monte seu carrinho inteligente
                        </h2>
                        <p className="text-sm text-slate-500">
                            Os itens são agrupados automaticamente para acelerar a análise dos fornecedores.
                        </p>
                    </div>
                    <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/20"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Adicionar ao carrinho
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Item / Material
                        <input
                            value={form.descricao}
                            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                            className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                            placeholder="Ex.: cimento CPII 50kg"
                        />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Categoria
                        <select
                            value={form.categoria}
                            onChange={(e) => setForm({ ...form, categoria: e.target.value as Category })}
                            className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                        >
                            {categoryOptions.map((cat) => (
                                <option key={cat}>{cat}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quantidade
                        <input
                            type="number"
                            min={1}
                            value={form.quantidade}
                            onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
                            className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                        />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Unidade
                        <input
                            value={form.unidade}
                            onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                            className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                            placeholder="m³, unid, kg..."
                        />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
                        Observações técnicas
                        <textarea
                            value={form.observacao}
                            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                            className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                            rows={2}
                        />
                    </label>
                </div>
            </form>

            {grouped.map(
                (group) =>
                    group.items.length > 0 && (
                        <div
                            key={group.category}
                            className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                                        {group.category}
                                    </p>
                                    <h3 className="text-lg font-semibold text-slate-900">
                                        {group.items.length} item(s) prontos para cotação
                                    </h3>
                                </div>
                                <span className="text-sm text-slate-500">
                                    Enviaremos para fornecedores especialistas
                                </span>
                            </div>
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                {group.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {item.descricao}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {item.quantidade} {item.unidade} • {item.observacao || "Sem observações"}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(item.id)}
                                                className="text-slate-400 transition hover:text-red-500"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
            )}
        </div>
    );
}
