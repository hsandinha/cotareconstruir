"use client";

import { useState, useEffect } from "react";
import {
    MagnifyingGlassIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import { supabase } from '@/lib/supabaseAuth';

// Helper para obter headers com token (com fallback para localStorage)
async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Tentar Supabase session primeiro
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
            return headers;
        }
    } catch (e) {
        console.warn('Erro ao obter sessão Supabase:', e);
    }

    // Fallback: localStorage (setado pelo login)
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
}

interface Manufacturer {
    id: string;
    name: string;
    category: string;
    contact: string;
    status: string;
}

export function ManufacturersSection() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sourceInfo, setSourceInfo] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        category: "",
        contact: "",
        status: "Ativo"
    });

    const fetchManufacturers = async () => {
        setLoading(true);
        setError(null);
        setSourceInfo(null);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/manufacturers', {
                method: 'GET',
                headers,
                credentials: 'include',
            });

            const payload = await res.json();

            if (!res.ok) {
                throw new Error(payload?.error || 'Erro ao carregar fabricantes');
            }

            const data = payload?.manufacturers || [];

            if (payload?.source && typeof payload.source === 'object') {
                const manufacturersCount = Number(payload.source.manufacturers || 0);
                const fabricantesCount = Number(payload.source.fabricantes || 0);
                setSourceInfo(`Origem: manufacturers=${manufacturersCount}, fabricantes=${fabricantesCount}`);
            } else if (payload?.source && typeof payload.source === 'string') {
                setSourceInfo(`Origem: ${payload.source}`);
            }

            setManufacturers(data.map((item: any) => ({
                id: item.id,
                name: item.name || '',
                category: item.category || '',
                contact: item.contact || '',
                status: item.status || 'Ativo'
            })));
        } catch (err: any) {
            setManufacturers([]);
            setError(err?.message || 'Erro ao carregar fabricantes.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchManufacturers();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddManufacturer = async () => {
        if (!formData.name) {
            alert("Nome do fabricante é obrigatório.");
            return;
        }

        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/manufacturers', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    name: formData.name,
                    category: formData.category,
                    contact: formData.contact,
                    status: formData.status,
                }),
            });

            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error || 'Erro ao adicionar fabricante');

            setFormData({
                name: "",
                category: "",
                contact: "",
                status: "Ativo"
            });
            setShowAddForm(false);
            await fetchManufacturers();
            alert("Fabricante adicionado com sucesso!");
        } catch (error: any) {
            console.error("Error adding manufacturer:", error);
            alert(error?.message || "Erro ao adicionar fabricante.");
        }
    };

    const handleDeleteManufacturer = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este fabricante?")) {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch(`/api/admin/manufacturers?id=${id}`, {
                    method: 'DELETE',
                    headers,
                    credentials: 'include',
                });
                const payload = await res.json();
                if (!res.ok) throw new Error(payload?.error || 'Erro ao excluir fabricante');
                await fetchManufacturers();
            } catch (error: any) {
                console.error("Error deleting manufacturer:", error);
                alert(error?.message || "Erro ao excluir fabricante.");
            }
        }
    };

    const filteredManufacturers = manufacturers.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando fabricantes...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Fabricantes</h2>
                    <p className="text-sm text-gray-500">Gerencie os fabricantes dos seus produtos.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar fabricante..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        {showAddForm ? "Cancelar" : (
                            <>
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Novo Fabricante
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-white shadow rounded-lg p-6 border border-gray-200 animate-fade-in-down">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar Novo Fabricante</h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome do Fabricante *</label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    name="name"
                                    id="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Ex: Votorantim"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Categoria Principal</label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    name="category"
                                    id="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    placeholder="Ex: Cimento"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Email de Contato</label>
                            <div className="mt-1">
                                <input
                                    type="email"
                                    name="contact"
                                    id="contact"
                                    value={formData.contact}
                                    onChange={handleInputChange}
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                    placeholder="contato@empresa.com"
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                            <div className="mt-1">
                                <select
                                    id="status"
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="shadow-sm focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                >
                                    <option value="Ativo">Ativo</option>
                                    <option value="Inativo">Inativo</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setShowAddForm(false)}
                            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mr-3"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleAddManufacturer}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                {error && (
                    <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
                        {error}
                    </div>
                )}
                {sourceInfo && (
                    <div className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                        {sourceInfo}
                    </div>
                )}
                <ul role="list" className="divide-y divide-gray-200">
                    {filteredManufacturers.map((manufacturer) => (
                        <li key={manufacturer.id}>
                            <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition duration-150 ease-in-out">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <p className="text-sm font-medium text-green-600 truncate">{manufacturer.name}</p>
                                        <p className="text-sm text-gray-500">{manufacturer.category}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="hidden sm:flex flex-col items-end">
                                            <p className="text-sm text-gray-900">{manufacturer.contact}</p>
                                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${manufacturer.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {manufacturer.status}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="text-gray-400 hover:text-blue-500">
                                                <PencilSquareIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteManufacturer(manufacturer.id)}
                                                className="text-gray-400 hover:text-red-500"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {filteredManufacturers.length === 0 && (
                        <li className="px-4 py-8 text-center text-gray-500">
                            Nenhum fabricante encontrado.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}
