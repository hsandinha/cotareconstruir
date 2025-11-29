"use client";

import { useState, useMemo } from "react";
import { PlusIcon, MagnifyingGlassIcon, ShoppingCartIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { initialWorks, cartCategories } from "../../../lib/clientDashboardMocks";

export function ClientExploreSection() {
    const [currentView, setCurrentView] = useState<"search" | "analysis" | "success">("search");
    const [searchTerm, setSearchTerm] = useState("");
    const [cart, setCart] = useState<Array<{ id: string, name: string, quantity: number, unit: string, group: string, observation?: string }>>([]);
    const [selectedWork, setSelectedWork] = useState("");
    const [showManualEntry, setShowManualEntry] = useState(false);

    // Estado para entrada manual
    const [manualItem, setManualItem] = useState({
        name: "",
        group: cartCategories[0] as string,
        quantity: 1,
        unit: "unid",
        observation: ""
    });

    const materialSuggestions = [
        { name: "Cimento CP-II", group: "Aglomerante", unit: "saco" },
        { name: "Areia Média", group: "Agregado", unit: "m³" },
        { name: "Brita 1", group: "Agregado", unit: "m³" },
        { name: "Cabo Flexível 2.5mm", group: "Elétrico", unit: "rolo" },
        { name: "Tubo PVC 100mm", group: "Hidráulico", unit: "barra" },
        { name: "Tijolo Baiano", group: "Alvenaria e Vedações", unit: "milheiro" },
        { name: "Argamassa AC-III", group: "Aglomerante", unit: "saco" },
        { name: "Tinta Acrílica Branco Neve", group: "Pintura", unit: "lata 18L" },
    ];

    const addToCart = (material: string) => {
        const suggestion = materialSuggestions.find(m => m.name.toLowerCase() === material.toLowerCase());
        if (suggestion) {
            // Verifica se já existe para somar ou avisar (aqui vamos permitir duplicar se quiser, ou apenas somar)
            // Simplificação: Adiciona novo item
            setCart([...cart, {
                id: Date.now().toString(),
                name: suggestion.name,
                quantity: 1,
                unit: suggestion.unit,
                group: suggestion.group,
                observation: ""
            }]);
        }
        setSearchTerm("");
    };

    const addManualItem = () => {
        if (!manualItem.name) return;
        setCart([...cart, {
            id: Date.now().toString(),
            name: manualItem.name,
            quantity: manualItem.quantity,
            unit: manualItem.unit,
            group: manualItem.group,
            observation: manualItem.observation
        }]);
        setManualItem({ name: "", group: cartCategories[0], quantity: 1, unit: "unid", observation: "" });
        setShowManualEntry(false);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: string, value: any) => {
        setCart(cart.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const filteredSuggestions = useMemo(() => {
        if (!searchTerm) return [];
        return materialSuggestions.filter(m =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    const groupedCart = useMemo(() => {
        const groups: { [key: string]: typeof cart } = {};
        cart.forEach(item => {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push(item);
        });
        return groups;
    }, [cart]);

    const handleSendQuotation = () => {
        if (!selectedWork) {
            alert("Por favor, selecione uma obra para vincular à cotação.");
            return;
        }
        if (cart.length === 0) {
            alert("Adicione itens ao carrinho antes de enviar.");
            return;
        }
        setCurrentView("success");
    };

    // Renderização baseada na view atual
    if (currentView === "search") {
        return (
            <div className="space-y-6">
                {/* Header Principal */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Nova Cotação Inteligente</h2>
                        <p className="text-slate-500 text-sm">
                            Busque materiais ou adicione manualmente. Nossa IA agrupa tudo para você.
                        </p>
                    </div>
                    <div className="w-full md:w-64">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                            Vincular à Obra *
                        </label>
                        <select
                            value={selectedWork}
                            onChange={(e) => setSelectedWork(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {initialWorks.map((work) => (
                                <option key={work.id} value={work.id}>
                                    {work.obra}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Área de Pesquisa e Adição */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Busca Inteligente */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <MagnifyingGlassIcon className="h-5 w-5 text-blue-600" />
                                    O que você precisa comprar?
                                </h3>
                                <button
                                    onClick={() => setShowManualEntry(!showManualEntry)}
                                    className="text-sm text-blue-600 font-medium hover:underline"
                                >
                                    {showManualEntry ? "Voltar para busca" : "Não encontrou? Adicionar manual"}
                                </button>
                            </div>

                            {!showManualEntry ? (
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full px-4 py-4 pl-12 border border-slate-200 rounded-xl text-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                        placeholder="Digite o nome do material (ex: Cimento, Areia)..."
                                    />
                                    <MagnifyingGlassIcon className="h-6 w-6 text-slate-400 absolute left-4 top-4" />

                                    {/* Sugestões Dropdown */}
                                    {filteredSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                            {filteredSuggestions.map((material) => (
                                                <button
                                                    key={material.name}
                                                    onClick={() => addToCart(material.name)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center border-b border-slate-50 last:border-0"
                                                >
                                                    <span className="font-medium text-slate-700">{material.name}</span>
                                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{material.group}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Sugestões Rápidas */}
                                    <div className="mt-4">
                                        <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Sugestões frequentes</p>
                                        <div className="flex flex-wrap gap-2">
                                            {materialSuggestions.slice(0, 5).map((material) => (
                                                <button
                                                    key={material.name}
                                                    onClick={() => addToCart(material.name)}
                                                    className="px-3 py-1.5 text-sm bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-colors"
                                                >
                                                    + {material.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Material</label>
                                            <input
                                                value={manualItem.name}
                                                onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Ex: Porcelanato 60x60"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Categoria</label>
                                            <select
                                                value={manualItem.group}
                                                onChange={(e) => setManualItem({ ...manualItem, group: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {cartCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Quantidade</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={manualItem.quantity}
                                                    onChange={(e) => setManualItem({ ...manualItem, quantity: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Unidade</label>
                                                <input
                                                    value={manualItem.unit}
                                                    onChange={(e) => setManualItem({ ...manualItem, unit: e.target.value })}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="unid, m², kg"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Observação</label>
                                            <input
                                                value={manualItem.observation}
                                                onChange={(e) => setManualItem({ ...manualItem, observation: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Detalhes técnicos..."
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={addManualItem}
                                        className="w-full py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800"
                                    >
                                        Adicionar Item
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Lista do Carrinho */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <ShoppingCartIcon className="h-5 w-5 text-blue-600" />
                                Itens no Carrinho ({cart.length})
                            </h3>

                            {cart.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                    <p className="text-slate-500">Seu carrinho está vazio.</p>
                                    <p className="text-sm text-slate-400">Comece buscando materiais acima.</p>
                                </div>
                            ) : (
                                Object.entries(groupedCart).map(([group, items]) => (
                                    <div key={group} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                            <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{group}</span>
                                            <span className="text-xs text-slate-500">{items.length} itens</span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {items.map((item) => (
                                                <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <p className="font-medium text-slate-900">{item.name}</p>
                                                            <input
                                                                type="text"
                                                                placeholder="Adicionar observação..."
                                                                value={item.observation}
                                                                onChange={(e) => updateItem(item.id, 'observation', e.target.value)}
                                                                className="mt-1 w-full text-sm text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none placeholder-slate-400"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                                                                    className="w-16 px-2 py-1 text-center text-sm text-slate-900 focus:outline-none bg-transparent"
                                                                />
                                                                <span className="px-2 text-xs text-slate-500 border-l border-slate-200 bg-slate-50 h-full flex items-center rounded-r-lg">
                                                                    {item.unit}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => removeFromCart(item.id)}
                                                                className="text-slate-400 hover:text-red-500 p-1"
                                                            >
                                                                <span className="sr-only">Remover</span>
                                                                ×
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Sidebar de Resumo e Ação */}
                    <div className="space-y-6">
                        <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                            <h3 className="text-lg font-bold mb-2">Resumo da Cotação</h3>
                            <div className="space-y-2 mb-6 text-blue-100 text-sm">
                                <div className="flex justify-between">
                                    <span>Itens totais</span>
                                    <span className="font-semibold">{cart.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Grupos</span>
                                    <span className="font-semibold">{Object.keys(groupedCart).length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Obra</span>
                                    <span className="font-semibold truncate max-w-[150px]">
                                        {selectedWork ? initialWorks.find(w => w.id === Number(selectedWork))?.obra : "Não selecionada"}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setCurrentView("analysis")}
                                disabled={cart.length === 0}
                                className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                Analisar Lista →
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6">
                            <div className="flex items-start gap-3">
                                <WrenchScrewdriverIcon className="h-6 w-6 text-orange-500 mt-1" />
                                <div>
                                    <h4 className="font-semibold text-slate-900 text-sm">Dica do Especialista</h4>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Agrupar materiais da mesma fase (ex: elétrica e hidráulica) pode aumentar seu poder de negociação com fornecedores Especializados.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }



    if (currentView === "success") {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-6 bg-white rounded-lg border border-gray-200">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Solicitação Enviada!</h2>
                    <p className="text-gray-600 mt-2 max-w-md">
                        Sua solicitação de cotação foi enviada para os fornecedores parceiros.
                        Você será notificado assim que as propostas chegarem.
                    </p>
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={() => {
                            setCart([]);
                            setSearchTerm("");
                            setCurrentView("search");
                        }}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                    >
                        Nova Cotação
                    </button>
                    <button
                        onClick={() => {
                            // Idealmente redirecionaria para a aba de pedidos
                            // Como estamos no mesmo componente, apenas resetamos por enquanto
                            setCart([]);
                            setSearchTerm("");
                            setCurrentView("search");
                        }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        Ir para Meus Pedidos
                    </button>
                </div>
            </div>
        );
    }



    if (currentView === "analysis") {
        return (
            <div className="space-y-6">
                {/* Navigation */}
                <div className="flex items-center space-x-2 text-sm text-slate-800">
                    <button onClick={() => setCurrentView("search")} className="hover:text-blue-600">Lista de Materiais</button>
                    <span>→</span>
                    <span className="text-blue-600 font-medium">Análise Técnica</span>
                    <span>→</span>
                    <span className="text-slate-600">Solicitação</span>
                </div>

                {/* Header */}
                <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Análise Técnica e Sugestões</h2>
                    <p className="text-slate-900 max-w-2xl mx-auto">
                        Eliminamos a incerteza apresentando opções técnicas claras e embasadas.
                        Veja onde estão as oportunidades de redução de custos.
                    </p>
                </div>

                {/* Resumo da lista */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <ShoppingCartIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-700">Total de Itens</p>
                                <p className="text-2xl font-semibold text-slate-900">{cart.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <WrenchScrewdriverIcon className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-700">Grupos Técnicos</p>
                                <p className="text-2xl font-semibold text-slate-900">{Object.keys(groupedCart).length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-700">Economia Estimada</p>
                                <p className="text-2xl font-semibold text-green-600">15-25%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Análise por grupos */}
                <div className="space-y-4">
                    {Object.entries(groupedCart).map(([group, items]) => (
                        <div key={group} className="bg-white rounded-xl border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-slate-900">{group}</h3>
                                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Lista de itens */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3">Materiais Solicitados</h4>
                                    <div className="space-y-2">
                                        {items.map((item) => (
                                            <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                                                    <span className="text-xs text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                                                        {item.quantity} {item.unit}
                                                    </span>
                                                </div>
                                                {item.observation && (
                                                    <p className="text-xs text-slate-500 mt-1 italic">Obs: {item.observation}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Oportunidades identificadas */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3">Oportunidades Identificadas</h4>
                                    <div className="space-y-2">
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span className="text-sm font-medium text-green-800">Compra em Volume</span>
                                            </div>
                                            <p className="text-xs text-green-700 mt-1">Economia de 8-12% possível</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-sm font-medium text-blue-800">Antecipação Recomendada</span>
                                            </div>
                                            <p className="text-xs text-blue-700 mt-1">Comprar 5-7 dias antes do uso</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Padrões técnicos */}
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-3">Padrões Técnicos</h4>
                                    <div className="space-y-2">
                                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-sm font-medium text-purple-800">Qualidade Garantida</span>
                                            </div>
                                            <p className="text-xs text-purple-700 mt-1">Materiais certificados ABNT</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Ações */}
                <div className="flex justify-between pt-6">
                    <button
                        onClick={() => setCurrentView("search")}
                        className="px-6 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
                    >
                        ← Voltar à Lista
                    </button>
                    <button
                        onClick={handleSendQuotation}
                        className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold shadow-lg shadow-green-200 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Enviar Solicitação de Cotação
                    </button>
                </div>
            </div>
        );
    }



    return null;
}
