"use client";

import { useState } from "react";
import {
    MagnifyingGlassIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    MegaphoneIcon,
    CloudArrowUpIcon,
    ArrowUpIcon,
    ArrowDownIcon
} from "@heroicons/react/24/outline";

export function SupplierMaterialsSection() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItems, setSelectedItems] = useState<number[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const [materials, setMaterials] = useState([
        { id: 1, codigo: "ELE001", nome: "Cabo Flexível 2,5mm", grupo: "Instalações", unidade: "metro", preco: 2.50, status: "Ativo", estoque: 500, dataAtualizacao: new Date().toISOString() },
        { id: 2, codigo: "HID001", nome: "Tubo PVC 100mm", grupo: "Instalações", unidade: "metro", preco: 15.90, status: "Ativo", estoque: 120, dataAtualizacao: new Date().toISOString() },
        { id: 3, codigo: "AGR001", nome: "Cimento CP-II", grupo: "Estrutura", unidade: "saco", preco: 32.00, status: "Ativo", estoque: 80, dataAtualizacao: new Date().toISOString() },
        { id: 4, codigo: "REV001", nome: "Porcelanato 60x60", grupo: "Revestimentos", unidade: "m2", preco: 89.90, status: "Ativo", estoque: 350, dataAtualizacao: new Date().toISOString() },
    ]);

    const [offerModalOpen, setOfferModalOpen] = useState(false);
    const [selectedMaterialForOffer, setSelectedMaterialForOffer] = useState<any | null>(null);
    const [offerType, setOfferType] = useState<'percentage' | 'fixed'>('percentage');
    const [offerValue, setOfferValue] = useState('');

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedItems(filteredMaterials.map(m => m.id));
        } else {
            setSelectedItems([]);
        }
    };

    const handleSelectItem = (id: number) => {
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(item => item !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    const filteredMaterials = materials
        .filter(m =>
            m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.grupo.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (!sortConfig) return 0;

            const { key, direction } = sortConfig;
            let aValue: any = (a as any)[key];
            let bValue: any = (b as any)[key];

            // Handle numeric values for price
            if (key === 'preco') {
                aValue = Number(aValue);
                bValue = Number(bValue);
            } else {
                aValue = String(aValue).toLowerCase();
                bValue = String(bValue).toLowerCase();
            }

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleMakeOffer = (material: any) => {
        setSelectedMaterialForOffer(material);
        setOfferModalOpen(true);
        setOfferValue('');
    };

    const handleSendOffer = () => {
        if (!offerValue) return;

        const message = offerType === 'percentage'
            ? `${offerValue}% de desconto`
            : `R$ ${offerValue}`;

        alert(`Oferta relâmpago para "${selectedMaterialForOffer?.nome}" enviada com sucesso! \nCondição: ${message}`);
        setOfferModalOpen(false);
    };

    const handleUpdateStock = (id: number, value: number) => {
        setMaterials((prev) =>
            prev.map((m) => (m.id === id ? { ...m, estoque: Math.max(0, Number(value) || 0), dataAtualizacao: new Date().toISOString() } : m))
        );
    };

    const handleBulkDelete = () => {
        if (confirm(`Tem certeza que deseja excluir ${selectedItems.length} itens selecionados?`)) {
            setMaterials(materials.filter(m => !selectedItems.includes(m.id)));
            setSelectedItems([]);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Cadastro de Materiais</h3>
                    <p className="text-sm text-gray-600">
                        Gerencie seu catálogo de produtos para receber cotações relevantes.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar material..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
                        />
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                    <button
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        onClick={() => alert("Funcionalidade de importação em massa será implementada em breve.")}
                    >
                        <CloudArrowUpIcon className="h-5 w-5" />
                        Importar em Massa
                    </button>
                    <button
                        onClick={() => setShowAddForm((v) => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        aria-expanded={showAddForm}
                        aria-controls="add-item-form"
                    >
                        <PlusIcon className="h-5 w-5" />
                        {showAddForm ? 'Fechar' : 'Adicionar Item'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 font-medium">Total de Itens</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{materials.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 font-medium">Grupos Ativos</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                        {new Set(materials.map(m => m.grupo)).size}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 font-medium">Última Atualização</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">Hoje</p>
                </div>
            </div>

            {/* Main Content - stacked sections */}
            <div className="grid grid-cols-1 gap-6">
                {/* Form Section (collapsible) */}
                {showAddForm && (
                    <div id="add-item-form">
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Item</h4>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Grupo / Categoria *</label>
                                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">Selecione...</option>
                                        <option value="Preliminares">Preliminares</option>
                                        <option value="Terraplenagem">Terraplenagem</option>
                                        <option value="Fundações">Fundações</option>
                                        <option value="Estrutura">Estrutura</option>
                                        <option value="Instalações">Instalações</option>
                                        <option value="Alvenaria e Vedações">Alvenaria e Vedações</option>
                                        <option value="Cobertura">Cobertura</option>
                                        <option value="Esquadrias">Esquadrias</option>
                                        <option value="Revestimentos">Revestimentos</option>
                                        <option value="Pintura">Pintura</option>
                                        <option value="Acabamentos Finais">Acabamentos Finais</option>
                                        <option value="Urbanização">Urbanização</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Material *</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Ex: Cimento CP-II"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
                                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                            <option value="un">Unidade</option>
                                            <option value="m">Metro</option>
                                            <option value="m2">m²</option>
                                            <option value="m3">m³</option>
                                            <option value="kg">Kg</option>
                                            <option value="sc">Saco</option>
                                            <option value="lt">Litro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Atual</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Ex: 100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Data de Atualização</label>
                                        <input
                                            type="date"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Código Interno (SKU)</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Opcional"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button type="button" className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
                                        Cadastrar Material
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* List Section */}
                <div>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-4">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    onChange={handleSelectAll}
                                                    checked={filteredMaterials.length > 0 && selectedItems.length === filteredMaterials.length}
                                                />
                                                {selectedItems.length > 0 && (
                                                    <button
                                                        onClick={handleBulkDelete}
                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded border border-white shadow-sm hover:bg-red-600 transition-all"
                                                        title="Excluir Selecionados"
                                                    >
                                                        <TrashIcon className="h-3 w-3" />
                                                        <span>{selectedItems.length}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                            onClick={() => handleSort('nome')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Item
                                                {sortConfig?.key === 'nome' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                            onClick={() => handleSort('grupo')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Grupo
                                                {sortConfig?.key === 'grupo' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                            onClick={() => handleSort('preco')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Preço
                                                {sortConfig?.key === 'preco' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >
                                            Estoque
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >
                                            Atualizado
                                        </th>
                                        <th
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                            onClick={() => handleSort('status')}
                                        >
                                            <div className="flex items-center gap-1">
                                                Status
                                                {sortConfig?.key === 'status' && (
                                                    sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredMaterials.map((material) => (
                                        <tr key={material.id} className={`hover:bg-gray-50 transition-colors ${selectedItems.includes(material.id) ? 'bg-blue-50' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedItems.includes(material.id)}
                                                    onChange={() => handleSelectItem(material.id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">{material.nome}</span>
                                                    <span className="text-xs text-gray-500">SKU: {material.codigo} • {material.unidade}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {material.grupo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                R$ {material.preco.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={material.estoque ?? 0}
                                                    onChange={(e) => handleUpdateStock(material.id, Number(e.target.value))}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {(() => {
                                                    const updatedAt = material.dataAtualizacao ? new Date(material.dataAtualizacao) : null;
                                                    if (!updatedAt) return <span className="text-xs text-gray-500">—</span>;
                                                    const diffMs = Date.now() - updatedAt.getTime();
                                                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                    const stale = diffDays >= 30;
                                                    return (
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stale ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                            {diffDays === 0 ? 'Hoje' : `${diffDays}d`}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    {material.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleMakeOffer(material)}
                                                        className="text-amber-600 hover:text-amber-900 p-1"
                                                        title="Disparar Oferta"
                                                    >
                                                        <MegaphoneIcon className="h-4 w-4" />
                                                    </button>
                                                    <button className="text-blue-600 hover:text-blue-900 p-1">
                                                        <PencilSquareIcon className="h-4 w-4" />
                                                    </button>
                                                    <button className="text-red-600 hover:text-red-900 p-1">
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {filteredMaterials.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                Nenhum material encontrado.
                            </div>
                        )}
                    </div>
                </div>

                {/* Out of Stock Section */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 flex items-center justify-between border-b border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-900">Sem Estoque</h4>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {materials.filter((m) => (m.estoque ?? 0) === 0).length} itens
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atualizado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {materials.filter((m) => (m.estoque ?? 0) === 0).map((material) => (
                                    <tr key={`oos-${material.id}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{material.nome}</span>
                                                <span className="text-xs text-gray-500">SKU: {material.codigo}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {material.grupo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{material.unidade}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">R$ {material.preco.toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const updatedAt = material.dataAtualizacao ? new Date(material.dataAtualizacao) : null;
                                                if (!updatedAt) return <span className="text-xs text-gray-500">—</span>;
                                                const diffMs = Date.now() - updatedAt.getTime();
                                                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                const stale = diffDays >= 30;
                                                return (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stale ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                                        {diffDays === 0 ? 'Hoje' : `${diffDays}d`}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                                {materials.filter((m) => (m.estoque ?? 0) === 0).length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum item sem estoque.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Offer Modal */}
            {offerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900">Criar Oferta Relâmpago</h3>
                        <p className="mt-1 text-sm text-gray-600">
                            Defina a condição especial para <strong>{selectedMaterialForOffer?.nome}</strong>.
                        </p>

                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-sm text-blue-800">
                                Preço Base Atual: <span className="font-bold">R$ {selectedMaterialForOffer?.preco.toFixed(2)}</span>
                            </p>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Oferta</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="offerType"
                                            checked={offerType === 'percentage'}
                                            onChange={() => setOfferType('percentage')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-900">Porcentagem (%)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="offerType"
                                            checked={offerType === 'fixed'}
                                            onChange={() => setOfferType('fixed')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-900">Valor Fixo (R$)</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {offerType === 'percentage' ? 'Desconto (%)' : 'Novo Preço (R$)'}
                                </label>
                                <input
                                    type="number"
                                    value={offerValue}
                                    onChange={(e) => setOfferValue(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={offerType === 'percentage' ? "Ex: 10" : "Ex: 19.90"}
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={() => setOfferModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendOffer}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            >
                                Disparar Oferta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}