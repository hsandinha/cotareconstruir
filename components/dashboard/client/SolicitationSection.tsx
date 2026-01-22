"use client";

import { useMemo, useState, type FormEvent, useEffect } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { CartItem } from "../../../lib/clientDashboardMocks";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { sendEmail } from "../../../app/actions/email";

export function ClientSolicitationSection() {
    const { user, initialized } = useAuth();
    const [items, setItems] = useState<CartItem[]>([]);
    const [works, setWorks] = useState<{ id: string; obra: string; city?: string }[]>([]);
    const [selectedWorkId, setSelectedWorkId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);

    const [form, setForm] = useState({
        descricao: "",
        categoria: "",
        quantidade: 1,
        unidade: "unid",
        observacao: "",
    });

    useEffect(() => {
        // Carregar grupos de insumo disponíveis
        const loadGroups = async () => {
            try {
                const { data, error } = await supabase
                    .from('grupos_insumo')
                    .select('nome')
                    .order('nome', { ascending: true });

                if (error) throw error;

                const groups = (data || []).map(doc => doc.nome).sort();
                setAvailableGroups(groups);
                if (groups.length > 0 && !form.categoria) {
                    setForm(prev => ({ ...prev, categoria: groups[0] }));
                }
            } catch (error) {
                console.error("Erro ao carregar grupos:", error);
            }
        };
        loadGroups();
    }, []);

    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            setWorks([]);
            return;
        }

        // Buscar obras inicialmente
        const fetchWorks = async () => {
            const { data, error } = await supabase
                .from('works')
                .select('id, obra, cidade')
                .eq('user_id', user.id);

            if (error) {
                console.error("Erro ao carregar obras:", error);
                setWorks([]);
            } else {
                const worksData = (data || []).map((doc) => ({
                    id: doc.id,
                    obra: doc.obra,
                    city: doc.cidade
                }));
                setWorks(worksData);
            }
        };

        fetchWorks();

        // Configurar subscription realtime para obras
        const channel = supabase
            .channel('works_solicitation_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'works',
                    filter: `user_id=eq.${user.id}`
                },
                async () => {
                    const { data } = await supabase
                        .from('works')
                        .select('id, obra, cidade')
                        .eq('user_id', user.id);

                    const worksData = (data || []).map((doc) => ({
                        id: doc.id,
                        obra: doc.obra,
                        city: doc.cidade
                    }));
                    setWorks(worksData);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, initialized]);

    function handleAddItem(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!form.descricao || !form.quantidade) return;
        setItems((prev) => [...prev, { id: Date.now(), ...form } as CartItem]);
        setForm({
            descricao: "",
            categoria: availableGroups[0] || "",
            quantidade: 1,
            unidade: "unid",
            observacao: "",
        });
    }

    function handleRemove(id: number) {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }

    async function handleSaveQuotation() {
        if (!user || !selectedWorkId || items.length === 0) return;
        setLoading(true);
        try {
            const work = works.find(w => w.id === selectedWorkId);

            const { error } = await supabase
                .from('quotations')
                .insert({
                    user_id: user.id,
                    work_id: selectedWorkId,
                    items: items,
                    status: "pending", // pending approval/release
                    created_at: new Date().toISOString(),
                    total_items: items.length,
                    location: {
                        city: work?.city || "",
                        state: "SP" // Default or fetch if available
                    }
                });

            if (error) throw error;

            // Notify suppliers in the region
            if (work?.city) {
                // Note: In a real app, use a server-side query or Cloud Function to avoid fetching all users
                const { data: usersData } = await supabase
                    .from('users')
                    .select('*');

                const suppliers = (usersData || [])
                    .filter(u => u.operating_regions && u.operating_regions.includes(work.city!));

                // Send emails in parallel
                await Promise.all(suppliers.map(async (supplier) => {
                    if (supplier.email) {
                        await sendEmail({
                            to: supplier.email,
                            subject: `Nova cotação em ${work.city} - Cota Reconstruir`,
                            html: `
                                <h1>Nova oportunidade de venda!</h1>
                                <p>Uma nova cotação foi aberta na região de <strong>${work.city}</strong>.</p>
                                <p>Itens solicitados: ${items.length}</p>
                                <p>Acesse a plataforma para enviar sua proposta.</p>
                            `
                        });
                    }
                }));
            }

            setItems([]);
            setSuccessMessage("Cotação criada com sucesso!");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (error) {
            console.error("Erro ao salvar cotação:", error);
            alert("Erro ao salvar cotação. Verifique se você tem permissão.");
        } finally {
            setLoading(false);
        }
    }

    const grouped = useMemo(() => {
        return availableGroups.map((category) => ({
            category,
            items: items.filter((item) => item.categoria === category),
        }));
    }, [items, availableGroups]);

    return (
        <div className="space-y-6">
            {successMessage && (
                <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg" role="alert">
                    {successMessage}
                </div>
            )}

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Nova Cotação</h3>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Selecione a Obra</label>
                    <select
                        value={selectedWorkId}
                        onChange={(e) => setSelectedWorkId(e.target.value)}
                        className="w-full rounded-lg border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                        disabled={works.length === 0}
                    >
                        <option value="">Selecione uma obra...</option>
                        {works.map((work) => (
                            <option key={work.id} value={work.id}>
                                {work.obra}
                            </option>
                        ))}
                    </select>
                    {works.length === 0 && (
                        <p className="text-xs text-red-500 mt-1">Cadastre uma obra na aba "Obras" para iniciar uma cotação.</p>
                    )}
                </div>

                {/* Só mostra o formulário se uma obra foi selecionada */}
                {selectedWorkId && (
                    <>
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
                                        onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                                        className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none"
                                    >
                                        {availableGroups.map((cat) => (
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

                        {items.length > 0 && (
                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleSaveQuotation}
                                    disabled={loading}
                                    className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Enviando..." : "Finalizar Cotação"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
