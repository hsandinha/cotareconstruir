"use client";

import { useState } from "react";

export function SupplierMaterialsSection() {
    const [materials, setMaterials] = useState([
        { id: 1, codigo: "ELE001", nome: "Cabo Flexível 2,5mm", grupo: "Elétrico", unidade: "metro" },
        { id: 2, codigo: "HID001", nome: "Tubo PVC 100mm", grupo: "Hidráulico", unidade: "metro" },
        { id: 3, codigo: "AGR001", nome: "Cimento CP-II", grupo: "Aglomerante", unidade: "saco" },
    ]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Cadastro de Materiais e Grupos</h3>
                    <p className="mt-1 text-sm text-gray-600">
                        Cadastre os materiais que sua empresa fornece e associe aos grupos específicos
                    </p>
                </div>
                <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
                    + Novo Material
                </button>
            </div>

            {/* Informação sobre grupos */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-amber-800">
                            <strong>Códigos Padronizados:</strong> O sistema utiliza códigos específicos para cada grupo de material (Elétrico, Hidráulico, Aglomerante, Agregado, etc.) para filtrar automaticamente as necessidades dos clientes.
                        </p>
                    </div>
                </div>
            </div>

            {/* Formulário de novo material */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 mb-4">Adicionar Novo Material</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Grupo do Material *</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Selecione o grupo</option>
                            <option value="eletrico">Elétrico</option>
                            <option value="hidraulico">Hidráulico</option>
                            <option value="aglomerante">Aglomerante</option>
                            <option value="agregado">Agregado</option>
                            <option value="acabamento">Acabamento</option>
                            <option value="estrutural">Estrutural</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Material *</label>
                        <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Cabo Flexível 2,5mm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Selecione</option>
                            <option value="metro">Metro</option>
                            <option value="saco">Saco</option>
                            <option value="unidade">Unidade</option>
                            <option value="litro">Litro</option>
                            <option value="kg">Quilograma</option>
                            <option value="m2">Metro²</option>
                            <option value="m3">Metro³</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700">
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>

            {/* Lista de materiais */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h4 className="text-base font-medium text-gray-900">Materiais Cadastrados</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {materials.map((material) => (
                                <tr key={material.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{material.codigo}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{material.nome}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{material.grupo}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{material.unidade}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            <button className="text-blue-600 hover:text-blue-900">Editar</button>
                                            <button className="text-red-600 hover:text-red-900">Excluir</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}