"use client";

import { useState, useMemo } from "react";

export function ClientExploreSection() {
    const [currentView, setCurrentView] = useState<"search" | "analysis" | "comparative" | "formalization">("search");
    const [searchTerm, setSearchTerm] = useState("");
    const [cart, setCart] = useState<Array<{ id: string, name: string, quantity: number, unit: string, group: string }>>([]);
    const [selectedWork, setSelectedWork] = useState("");

    // Simulação de dados
    const works = [
        { id: "1", name: "Obra Residencial - Vila Madalena", address: "Vila Madalena, São Paulo" },
        { id: "2", name: "Reforma Comercial - Pinheiros", address: "Pinheiros, São Paulo" },
    ];

    const materialSuggestions = [
        { name: "Cimento", group: "Aglomerante", unit: "saco" },
        { name: "Areia", group: "Agregado", unit: "m³" },
        { name: "Brita", group: "Agregado", unit: "m³" },
        { name: "Cabo elétrico", group: "Elétrico", unit: "metro" },
        { name: "Tubo PVC", group: "Hidráulico", unit: "metro" },
        { name: "Tijolo", group: "Estrutural", unit: "milheiro" },
    ];

    const comparativeData = [
        {
            id: 1,
            material: "Cimento CP-II 50kg",
            quantity: 20,
            unit: "saco",
            fornecedorA: { price: 32.50, conditions: "À vista", availability: "Imediato" },
            fornecedorB: { price: 34.00, conditions: "30 dias", availability: "24h" },
            fornecedorC: { price: 31.80, conditions: "15 dias", availability: "48h" },
            fornecedorD: { price: 33.20, conditions: "À vista", availability: "Imediato" }
        },
        {
            id: 2,
            material: "Areia média lavada",
            quantity: 5,
            unit: "m³",
            fornecedorA: { price: 45.00, conditions: "À vista", availability: "48h" },
            fornecedorB: { price: 42.50, conditions: "30 dias", availability: "24h" },
            fornecedorC: { price: 46.00, conditions: "15 dias", availability: "Imediato" },
            fornecedorD: { price: 44.20, conditions: "À vista", availability: "24h" }
        }
    ];

    const addToCart = (material: string) => {
        const suggestion = materialSuggestions.find(m => m.name.toLowerCase().includes(material.toLowerCase()));
        if (suggestion && !cart.find(item => item.name === suggestion.name)) {
            setCart([...cart, {
                id: Date.now().toString(),
                name: suggestion.name,
                quantity: 1,
                unit: suggestion.unit,
                group: suggestion.group
            }]);
        }
        setSearchTerm("");
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateQuantity = (id: string, quantity: number) => {
        setCart(cart.map(item => item.id === id ? { ...item, quantity } : item));
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

    // Renderização baseada na view atual
    if (currentView === "search") {
        return (
            <div className="space-y-6">
                {/* Header Principal */}
                <div className="text-center bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Carrinho de Compras Inteligente</h2>
                    <p className="text-gray-900 max-w-2xl mx-auto">
                        Seu analista de compras pessoal. Digite suas necessidades de forma simples e
                        transformaremos em um plano de aquisição otimizado e pronto para uso.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Área de Pesquisa */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">O que você precisa para sua obra?</h3>

                            {/* Campo de busca livre */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Digite qualquer material: cimento, areia, cabo elétrico..."
                                />
                                <div className="absolute right-3 top-3">
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Sugestões */}
                            {filteredSuggestions.length > 0 && (
                                <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                                    {filteredSuggestions.map((material) => (
                                        <button
                                            key={material.name}
                                            onClick={() => addToCart(material.name)}
                                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex justify-between items-center"
                                        >
                                            <span>{material.name}</span>
                                            <span className="text-sm text-gray-700">{material.group}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Vínculo com obra */}
                            <div className="mt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Vincular à obra (opcional)
                                </label>
                                <select
                                    value={selectedWork}
                                    onChange={(e) => setSelectedWork(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Selecione uma obra</option>
                                    {works.map((work) => (
                                        <option key={work.id} value={work.id}>
                                            {work.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Materiais populares */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h4 className="text-base font-medium text-gray-900 mb-3">Materiais mais buscados</h4>
                            <div className="flex flex-wrap gap-2">
                                {materialSuggestions.slice(0, 6).map((material) => (
                                    <button
                                        key={material.name}
                                        onClick={() => addToCart(material.name)}
                                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-blue-100 hover:text-blue-700"
                                    >
                                        + {material.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Carrinho de Compras */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">Sua Lista de Materiais</h3>
                                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                                </span>
                            </div>

                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-gray-700">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <p>Adicione materiais à sua lista</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Materiais agrupados */}
                                    {Object.entries(groupedCart).map(([group, items]) => (
                                        <div key={group} className="border border-gray-100 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-gray-800 mb-2 bg-gray-50 px-2 py-1 rounded">
                                                {group}
                                            </h4>
                                            {items.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between py-2">
                                                    <div className="flex-1">
                                                        <span className="text-sm text-gray-900">{item.name}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                                                        />
                                                        <span className="text-xs text-gray-700">{item.unit}</span>
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}

                                    {/* Ações */}
                                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => setCart([])}
                                            className="text-sm text-gray-800 hover:text-gray-900"
                                        >
                                            Limpar lista
                                        </button>
                                        <button
                                            onClick={() => setCurrentView("analysis")}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                        >
                                            Analisar Lista →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Informação sobre automação */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <div>
                                    <h4 className="text-sm font-medium text-green-800">Classificação Automática</h4>
                                    <p className="text-sm text-green-700">
                                        Nossa IA organiza automaticamente seus materiais por grupos especializados,
                                        garantindo que cada fornecedor receba apenas os itens de sua especialidade.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (currentView === "analysis") {
        return (
            <div className="space-y-6">
                {/* Navigation */}
                <div className="flex items-center space-x-2 text-sm text-gray-800">
                    <button onClick={() => setCurrentView("search")} className="hover:text-blue-600">Lista de Materiais</button>
                    <span>→</span>
                    <span className="text-blue-600 font-medium">Análise Técnica</span>
                    <span>→</span>
                    <span className="text-gray-600">Mapa Comparativo</span>
                    <span>→</span>
                    <span className="text-gray-600">Formalização</span>
                </div>

                {/* Header */}
                <div className="text-center bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Análise Técnica e Sugestões</h2>
                    <p className="text-gray-900 max-w-2xl mx-auto">
                        Eliminamos a incerteza apresentando opções técnicas claras e embasadas.
                        Veja onde estão as oportunidades de redução de custos.
                    </p>
                </div>

                {/* Resumo da lista */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-700">Total de Itens</p>
                                <p className="text-2xl font-semibold text-gray-900">{cart.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-700">Grupos Técnicos</p>
                                <p className="text-2xl font-semibold text-gray-900">{Object.keys(groupedCart).length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-700">Economia Estimada</p>
                                <p className="text-2xl font-semibold text-green-600">15-25%</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Análise por grupos */}
                <div className="space-y-4">
                    {Object.entries(groupedCart).map(([group, items]) => (
                        <div key={group} className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-medium text-gray-900">{group}</h3>
                                <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                                    {items.length} {items.length === 1 ? 'item' : 'itens'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Lista de itens */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-3">Materiais Solicitados</h4>
                                    <div className="space-y-2">
                                        {items.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                                <span className="text-sm text-gray-900">{item.name}</span>
                                                <span className="text-sm text-gray-800">{item.quantity} {item.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Oportunidades identificadas */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-3">Oportunidades Identificadas</h4>
                                    <div className="space-y-2">
                                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span className="text-sm font-medium text-green-800">Compra em Volume</span>
                                            </div>
                                            <p className="text-xs text-green-700 mt-1">Economia de 8-12% possível</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
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
                                    <h4 className="text-sm font-medium text-gray-700 mb-3">Padrões Técnicos</h4>
                                    <div className="space-y-2">
                                        <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-sm font-medium text-purple-800">Qualidade Garantida</span>
                                            </div>
                                            <p className="text-xs text-purple-700 mt-1">Materiais certificados ABNT</p>
                                        </div>
                                        <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                                            <div className="flex items-center space-x-2">
                                                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                <span className="text-sm font-medium text-orange-800">Custo-Benefício</span>
                                            </div>
                                            <p className="text-xs text-orange-700 mt-1">Melhor relação preço x qualidade</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Importância da antecipação */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-start space-x-3">
                        <svg className="w-6 h-6 text-yellow-600 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                            <h4 className="text-base font-medium text-yellow-800 mb-2">Importância da Antecipação (Suprimentos)</h4>
                            <p className="text-sm text-yellow-700 mb-3">
                                O planejamento de suprimentos precede a compra e é fundamental para o sucesso da obra.
                                Antecipar as compras garante:
                            </p>
                            <ul className="text-sm text-yellow-700 space-y-1 ml-4">
                                <li>• <strong>Evita atrasos:</strong> Materiais disponíveis na hora certa</li>
                                <li>• <strong>Reduz desperdícios:</strong> Compra planejada evita sobras</li>
                                <li>• <strong>Melhores preços:</strong> Negociação sem pressa</li>
                                <li>• <strong>Qualidade garantida:</strong> Tempo para verificar especificações</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Ações */}
                <div className="flex justify-between">
                    <button
                        onClick={() => setCurrentView("search")}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        ← Voltar à Lista
                    </button>
                    <button
                        onClick={() => setCurrentView("comparative")}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        Ver Comparativo de Preços →
                    </button>
                </div>
            </div>
        );
    }

    if (currentView === "comparative") {
        return (
            <div className="space-y-6">
                {/* Navigation */}
                <div className="flex items-center space-x-2 text-sm text-gray-800">
                    <button onClick={() => setCurrentView("search")} className="hover:text-blue-600">Lista de Materiais</button>
                    <span>→</span>
                    <button onClick={() => setCurrentView("analysis")} className="hover:text-blue-600">Análise Técnica</button>
                    <span>→</span>
                    <span className="text-blue-600 font-medium">Mapa Comparativo</span>
                    <span>→</span>
                    <span className="text-gray-600">Formalização</span>
                </div>

                {/* Header */}
                <div className="text-center bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Mapa Comparativo de Fornecedores</h2>
                    <p className="text-gray-900 max-w-2xl mx-auto">
                        Transparência total sem expor fornecedores. Compare preços e condições para tomar
                        a melhor decisão técnica e econômica.
                    </p>
                </div>

                {/* Informações de anonimato */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <div>
                            <h4 className="text-sm font-medium text-blue-800">Anonimato Garantido</h4>
                            <p className="text-sm text-blue-700">
                                Os fornecedores são identificados apenas como A, B, C e D para garantir a exclusividade
                                e imparcialidade do processo. A identidade será revelada apenas após sua escolha.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabela comparativa */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">Comparativo de Preços e Condições</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Material</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Qtd</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        <div className="text-center">
                                            <div className="font-semibold text-blue-600">Fornecedor A</div>
                                            <div className="text-xs text-gray-600">Preço | Condição | Prazo</div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        <div className="text-center">
                                            <div className="font-semibold text-green-600">Fornecedor B</div>
                                            <div className="text-xs text-gray-600">Preço | Condição | Prazo</div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        <div className="text-center">
                                            <div className="font-semibold text-purple-600">Fornecedor C</div>
                                            <div className="text-xs text-gray-600">Preço | Condição | Prazo</div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        <div className="text-center">
                                            <div className="font-semibold text-orange-600">Fornecedor D</div>
                                            <div className="text-xs text-gray-600">Preço | Condição | Prazo</div>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {comparativeData.map((item, index) => (
                                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{item.material}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-900">
                                            {item.quantity} {item.unit}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm font-medium text-gray-900">R$ {item.fornecedorA.price.toFixed(2)}</div>
                                            <div className="text-xs text-gray-700">{item.fornecedorA.conditions}</div>
                                            <div className="text-xs text-blue-600">{item.fornecedorA.availability}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm font-medium text-gray-900">R$ {item.fornecedorB.price.toFixed(2)}</div>
                                            <div className="text-xs text-gray-700">{item.fornecedorB.conditions}</div>
                                            <div className="text-xs text-green-600">{item.fornecedorB.availability}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm font-medium text-gray-900">R$ {item.fornecedorC.price.toFixed(2)}</div>
                                            <div className="text-xs text-gray-700">{item.fornecedorC.conditions}</div>
                                            <div className="text-xs text-purple-600">{item.fornecedorC.availability}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm font-medium text-gray-900">R$ {item.fornecedorD.price.toFixed(2)}</div>
                                            <div className="text-xs text-gray-700">{item.fornecedorD.conditions}</div>
                                            <div className="text-xs text-orange-600">{item.fornecedorD.availability}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100">
                                <tr>
                                    <td className="px-6 py-3 text-sm font-medium text-gray-900" colSpan={2}>Total Geral:</td>
                                    <td className="px-6 py-3 text-center text-sm font-bold text-blue-600">
                                        R$ {comparativeData.reduce((sum, item) => sum + (item.fornecedorA.price * item.quantity), 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-3 text-center text-sm font-bold text-green-600">
                                        R$ {comparativeData.reduce((sum, item) => sum + (item.fornecedorB.price * item.quantity), 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-3 text-center text-sm font-bold text-purple-600">
                                        R$ {comparativeData.reduce((sum, item) => sum + (item.fornecedorC.price * item.quantity), 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-3 text-center text-sm font-bold text-orange-600">
                                        R$ {comparativeData.reduce((sum, item) => sum + (item.fornecedorD.price * item.quantity), 0).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Análise de economia */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-green-800 mb-1">Melhor Preço Global</h4>
                        <p className="text-lg font-bold text-green-600">Fornecedor C</p>
                        <p className="text-xs text-green-700">Economia de R$ 147,50 vs mais caro</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-800 mb-1">Melhor Prazo</h4>
                        <p className="text-lg font-bold text-blue-600">Fornecedor A</p>
                        <p className="text-xs text-blue-700">Entrega imediata disponível</p>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-purple-800 mb-1">Melhor Condição</h4>
                        <p className="text-lg font-bold text-purple-600">Fornecedor B</p>
                        <p className="text-xs text-purple-700">Pagamento em 30 dias</p>
                    </div>
                </div>

                {/* Seleção de fornecedores */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Suas Escolhas</h3>
                    <div className="space-y-3">
                        {comparativeData.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="text-sm font-medium text-gray-900">{item.material}</div>
                                <select className="px-3 py-1 border border-gray-300 rounded text-sm">
                                    <option value="">Escolher fornecedor</option>
                                    <option value="A">Fornecedor A - R$ {item.fornecedorA.price.toFixed(2)}</option>
                                    <option value="B">Fornecedor B - R$ {item.fornecedorB.price.toFixed(2)}</option>
                                    <option value="C">Fornecedor C - R$ {item.fornecedorC.price.toFixed(2)}</option>
                                    <option value="D">Fornecedor D - R$ {item.fornecedorD.price.toFixed(2)}</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ações */}
                <div className="flex justify-between">
                    <button
                        onClick={() => setCurrentView("analysis")}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        ← Voltar à Análise
                    </button>
                    <button
                        onClick={() => setCurrentView("formalization")}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                        Formalizar Compras →
                    </button>
                </div>
            </div>
        );
    }

    if (currentView === "formalization") {
        const totalEconomy = 547.30; // Simulado
        const monthlyService = 1200; // Simulado

        return (
            <div className="space-y-6">
                {/* Navigation */}
                <div className="flex items-center space-x-2 text-sm text-gray-800">
                    <button onClick={() => setCurrentView("search")} className="hover:text-blue-600">Lista de Materiais</button>
                    <span>→</span>
                    <button onClick={() => setCurrentView("analysis")} className="hover:text-blue-600">Análise Técnica</button>
                    <span>→</span>
                    <button onClick={() => setCurrentView("comparative")} className="hover:text-blue-600">Mapa Comparativo</button>
                    <span>→</span>
                    <span className="text-green-600 font-medium">Formalização</span>
                </div>

                {/* Header */}
                <div className="text-center bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Formalização e Controle</h2>
                    <p className="text-gray-900 max-w-2xl mx-auto">
                        Finalize suas compras com documentação completa e acompanhe os resultados obtidos.
                    </p>
                </div>

                {/* Resumo da economia */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-700">Economia Total</p>
                                <p className="text-2xl font-semibold text-green-600">R$ {totalEconomy.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-700">ROI do Serviço</p>
                                <p className="text-2xl font-semibold text-blue-600">45.6%</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-700">Tempo Economizado</p>
                                <p className="text-2xl font-semibold text-purple-600">12h</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ordens de compra */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Ordens de Compra Geradas</h3>
                    <div className="space-y-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h4 className="font-medium text-gray-900">OC #2024-001 - Fornecedor C</h4>
                                    <p className="text-sm text-gray-800">Cimento CP-II 50kg</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-gray-900">R$ 636,00</p>
                                    <p className="text-sm text-gray-800">20 sacos</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Condições: 15 dias | Prazo: 48h</span>
                                <button className="text-blue-600 hover:text-blue-800">Baixar OC</button>
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h4 className="font-medium text-gray-900">OC #2024-002 - Fornecedor B</h4>
                                    <p className="text-sm text-gray-800">Areia média lavada</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-gray-900">R$ 212,50</p>
                                    <p className="text-sm text-gray-800">5 m³</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Condições: 30 dias | Prazo: 24h</span>
                                <button className="text-blue-600 hover:text-blue-800">Baixar OC</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instruções importantes */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-start space-x-3">
                        <svg className="w-6 h-6 text-yellow-600 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h4 className="text-base font-medium text-yellow-800 mb-2">Instruções para Finalização</h4>
                            <div className="text-sm text-yellow-700 space-y-2">
                                <p><strong>1. Contato Direto:</strong> Agora você pode entrar em contato diretamente com os fornecedores usando os dados fornecidos nas OCs.</p>
                                <p><strong>2. Transação Externa:</strong> A compra e pagamento são realizados diretamente entre você e o fornecedor, fora da plataforma.</p>
                                <p><strong>3. Documentação:</strong> Use as Ordens de Compra como base para suas negociações e contratos.</p>
                                <p><strong>4. Prazo de Validade:</strong> As propostas são válidas conforme especificado em cada OC.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Visão de desempenho para clientes mensais */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Desempenho do Investimento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Este Mês</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-800">Investimento no serviço:</span>
                                    <span className="text-sm font-medium text-red-600">-R$ {monthlyService.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-800">Economia obtida:</span>
                                    <span className="text-sm font-medium text-green-600">+R$ {totalEconomy.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm font-medium text-gray-900">Resultado líquido:</span>
                                        <span className="text-sm font-bold text-green-600">+R$ {(totalEconomy - monthlyService).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Eficiência Operacional</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-800">Tempo de pesquisa:</span>
                                    <span className="text-sm text-green-600">-89%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-800">Precisão de compra:</span>
                                    <span className="text-sm text-green-600">+94%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-800">Fornecedores avaliados:</span>
                                    <span className="text-sm text-blue-600">4x mais</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ações finais */}
                <div className="flex justify-between">
                    <button
                        onClick={() => setCurrentView("comparative")}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        ← Voltar ao Comparativo
                    </button>
                    <div className="space-x-3">
                        <button
                            onClick={() => {
                                setCart([]);
                                setCurrentView("search");
                            }}
                            className="px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50"
                        >
                            Nova Consulta
                        </button>
                        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                            Baixar Todas as OCs
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
