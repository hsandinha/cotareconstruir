"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Check, BookA } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { getAuthHeaders } from "@/lib/authHeaders";

interface SynonymGroup {
    id: string;
    termos: string[];
    created_at?: string;
    updated_at?: string;
}

/**
 * Cadastro de sinônimos de materiais/especificações.
 * Cada grupo reúne termos equivalentes (ex.: bacia = vaso sanitário) e é
 * usado para expandir a busca de materiais dos clientes.
 */
export function MaterialSynonymsSection() {
    const { showToast } = useToast();
    const [groups, setGroups] = useState<SynonymGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newTerms, setNewTerms] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTerms, setEditingTerms] = useState("");
    const [filter, setFilter] = useState("");

    const loadGroups = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/material-sinonimos', { headers, credentials: 'include' });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Erro ao carregar sinônimos');
            setGroups(json.data || []);
        } catch (error: any) {
            console.error(error);
            showToast("error", error?.message || "Erro ao carregar sinônimos.");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    const parseInputTerms = (value: string) =>
        value.split(/[,;]/).map((t) => t.trim()).filter(Boolean);

    const handleAdd = async () => {
        const termos = parseInputTerms(newTerms);
        if (termos.length < 2) {
            showToast("error", "Informe pelo menos 2 termos separados por vírgula. Ex: bacia, vaso sanitário");
            return;
        }
        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/material-sinonimos', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ termos }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Erro ao salvar');
            setGroups((prev) => [...prev, json.data]);
            setNewTerms("");
            showToast("success", "Grupo de sinônimos cadastrado!");
        } catch (error: any) {
            console.error(error);
            showToast("error", error?.message || "Erro ao salvar sinônimos.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async (id: string) => {
        const termos = parseInputTerms(editingTerms);
        if (termos.length < 2) {
            showToast("error", "Informe pelo menos 2 termos separados por vírgula.");
            return;
        }
        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/material-sinonimos', {
                method: 'PUT',
                headers,
                credentials: 'include',
                body: JSON.stringify({ id, termos }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Erro ao atualizar');
            setGroups((prev) => prev.map((g) => (g.id === id ? json.data : g)));
            setEditingId(null);
            setEditingTerms("");
            showToast("success", "Sinônimos atualizados!");
        } catch (error: any) {
            console.error(error);
            showToast("error", error?.message || "Erro ao atualizar sinônimos.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Excluir este grupo de sinônimos?")) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/admin/material-sinonimos?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers,
                credentials: 'include',
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Erro ao excluir');
            setGroups((prev) => prev.filter((g) => g.id !== id));
            showToast("success", "Grupo excluído.");
        } catch (error: any) {
            console.error(error);
            showToast("error", error?.message || "Erro ao excluir sinônimos.");
        }
    };

    const filteredGroups = filter.trim()
        ? groups.filter((g) => g.termos.some((t) => t.toLowerCase().includes(filter.trim().toLowerCase())))
        : groups;

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando sinônimos...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BookA className="w-6 h-6 text-blue-600" />
                        Sinônimos de Materiais
                    </h2>
                    <p className="text-sm text-gray-500">
                        Termos equivalentes usados na busca de materiais. Ex: quem pesquisa "bacia" também encontra "vaso sanitário".
                    </p>
                </div>
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtrar termos..."
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Novo grupo de sinônimos (termos separados por vírgula)
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTerms}
                        onChange={(e) => setNewTerms(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                        placeholder="Ex: bacia, vaso sanitário"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {filteredGroups.length === 0 ? (
                    <p className="p-8 text-center text-gray-500">Nenhum grupo de sinônimos cadastrado.</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredGroups.map((group) => (
                            <div key={group.id} className="flex items-center gap-3 px-4 py-3">
                                {editingId === group.id ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editingTerms}
                                            onChange={(e) => setEditingTerms(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(group.id); }}
                                            className="flex-1 rounded-lg border border-blue-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleSaveEdit(group.id)}
                                            disabled={saving}
                                            className="p-1.5 rounded-md text-green-600 hover:bg-green-50"
                                            aria-label="Salvar"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setEditingId(null); setEditingTerms(""); }}
                                            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
                                            aria-label="Cancelar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1 flex flex-wrap gap-1.5">
                                            {group.termos.map((termo, idx) => (
                                                <span
                                                    key={`${group.id}-${idx}`}
                                                    className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                                                >
                                                    {termo}
                                                </span>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => { setEditingId(group.id); setEditingTerms(group.termos.join(", ")); }}
                                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                            aria-label="Editar"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(group.id)}
                                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            aria-label="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
