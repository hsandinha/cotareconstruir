"use client";

export function SupplierProfileSection() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900">Cadastro e Gerenciamento do Perfil</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Gerencie os dados da sua empresa e configure seu perfil de fornecedor
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Dados da Empresa */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Dados da Empresa</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome da empresa" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="00.000.000/0000-00" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Estadual</label>
                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="000.000.000.000" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Comercial *</label>
                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(11) 0000-0000" />
                        </div>
                    </div>
                </div>

                {/* Contato Gerencial */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Contato Gerencial</h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                        <p className="text-sm text-blue-800">
                            <strong>Importante:</strong> O contato deve ser preferencialmente com gerente comercial ou diretor comercial.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Responsável *</label>
                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nome completo" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Selecione o cargo</option>
                                <option value="gerente-comercial">Gerente Comercial</option>
                                <option value="diretor-comercial">Diretor Comercial</option>
                                <option value="proprietario">Proprietário</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                            <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@empresa.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(11) 90000-0000" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end space-x-3">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                    Cancelar
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
                    Salvar Alterações
                </button>
            </div>
        </div>
    );
}