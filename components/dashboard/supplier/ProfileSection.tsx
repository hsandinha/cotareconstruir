"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { formatCepBr, formatCnpjBr, formatPhoneBr, isValidCNPJ } from "../../../lib/utils";

export function SupplierProfileSection() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [consultingCNPJ, setConsultingCNPJ] = useState(false);
    const [userUid, setUserUid] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        companyName: "",
        cnpj: "",
        stateRegistration: "",
        phone: "",
        managerName: "",
        managerRole: "",
        email: "",
        whatsapp: "",
        address: "",
        cep: "",
        operatingRegions: "",
        operatingCategories: ""
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserUid(user.uid);
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setFormData({
                            companyName: data.companyName || "",
                            cnpj: formatCnpjBr(data.cnpj || ""),
                            stateRegistration: data.stateRegistration || "",
                            phone: formatPhoneBr(data.phone || ""),
                            managerName: data.managerName || data.name || "",
                            managerRole: data.managerRole || "",
                            email: data.email || user.email || "",
                            whatsapp: formatPhoneBr(data.whatsapp || ""),
                            address: data.address || "",
                            cep: formatCepBr(data.cep || ""),
                            operatingRegions: data.operatingRegions || "",
                            operatingCategories: data.operatingCategories || ""
                        });
                    }
                } catch (error) {
                    console.error("Error fetching profile:", error);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const masked = name === "phone" || name === "whatsapp"
            ? formatPhoneBr(value)
            : name === "cnpj"
                ? formatCnpjBr(value)
                : name === "cep"
                    ? formatCepBr(value)
                    : value;
        setFormData(prev => ({ ...prev, [name]: masked }));
    };

    const handleConsultCNPJ = async () => {
        const cleanCNPJ = formData.cnpj.replace(/\D/g, '');
        if (cleanCNPJ.length !== 14) return;

        setConsultingCNPJ(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
            if (!response.ok) {
                alert("CNPJ não encontrado ou erro na consulta. Verifique o número ou tente mais tarde.");
                return;
            }
            const data = await response.json();

            if (data.descricao_situacao_cadastral !== "ATIVA") {
                alert(`Atenção: O CNPJ consta como ${data.descricao_situacao_cadastral} na Receita Federal.`);
            }

            setFormData(prev => ({
                ...prev,
                companyName: data.razao_social || prev.companyName,
                address: `${data.logradouro}, ${data.numero} ${data.complemento || ''} - ${data.bairro}, ${data.municipio} - ${data.uf}`,
                phone: formatPhoneBr(data.ddd_telefone_1 || prev.phone),
                cnpj: formatCnpjBr(cleanCNPJ),
                cep: formatCepBr(data.cep || cleanCNPJ.slice(0, 8)),
                email: data.email || prev.email // Optional: auto-fill email if available
            }));

        } catch (error) {
            console.error("Erro ao consultar CNPJ:", error);
            alert("Erro ao consultar CNPJ. Verifique se o número está correto ou tente novamente mais tarde.");
        } finally {
            setConsultingCNPJ(false);
        }
    };

    const handleConsultCEP = async () => {
        const clean = (formData.cep || "").replace(/\D/g, "");
        if (clean.length !== 8) return;

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();
            setFormData(prev => ({
                ...prev,
                cep: formatCepBr(clean),
                address: `${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}`,
            }));
        } catch (error) {
            console.error("Erro ao consultar CEP:", error);
            alert("Não foi possível buscar o CEP. Verifique o número ou tente novamente.");
        }
    };

    const handleSave = async () => {
        if (!userUid) return;

        if (formData.cnpj && !isValidCNPJ(formData.cnpj)) {
            alert("CNPJ inválido. Por favor, verifique o número digitado.");
            return;
        }

        setSaving(true);
        try {
            const docRef = doc(db, "users", userUid);
            await updateDoc(docRef, {
                ...formData,
                updatedAt: new Date().toISOString()
            });
            alert("Perfil atualizado com sucesso!");
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Erro ao atualizar perfil.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando perfil...</div>;
    }

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
                            <input
                                type="text"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Nome da empresa"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
                            <input
                                type="text"
                                name="cnpj"
                                value={formData.cnpj}
                                onChange={handleChange}
                                onBlur={handleConsultCNPJ}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="00.000.000/0000-00"
                            />
                            <p className="mt-1 text-xs text-gray-500">Preenche automaticamente ao sair do campo (dados da Receita).</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Estadual</label>
                            <input
                                type="text"
                                name="stateRegistration"
                                value={formData.stateRegistration}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="000.000.000.000"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço da Sede</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Rua, Número, Bairro, Cidade - UF"
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                                <input
                                    type="text"
                                    name="cep"
                                    value={formData.cep}
                                    onChange={handleChange}
                                    onBlur={handleConsultCEP}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    placeholder="00000-000"
                                />
                                <p className="text-xs text-gray-500 mt-1">Busca automática ao sair do campo. Finalize número e complemento.</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Comercial *</label>
                            <input
                                type="text"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="(11) 0000-0000"
                            />
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
                            <input
                                type="text"
                                name="managerName"
                                value={formData.managerName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Nome completo"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                            <select
                                name="managerRole"
                                value={formData.managerRole}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">Selecione o cargo</option>
                                <option value="gerente-comercial">Gerente Comercial</option>
                                <option value="diretor-comercial">Diretor Comercial</option>
                                <option value="proprietario">Proprietário</option>
                                <option value="vendedor">Vendedor</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="email@empresa.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
                            <input
                                type="text"
                                name="whatsapp"
                                value={formData.whatsapp}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="(11) 90000-0000"
                            />
                        </div>
                    </div>
                </div>

                {/* Preferências de Atendimento */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 md:col-span-2">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Preferências de Atendimento</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Regiões de Atuação (Bairros/Cidades)</label>
                            <p className="text-xs text-gray-500 mb-2">Separe por vírgula. Ex: Centro, Zona Sul, São Paulo</p>
                            <input
                                type="text"
                                name="operatingRegions"
                                value={formData.operatingRegions}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Ex: Centro, Copacabana, Rio de Janeiro"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Categorias de Materiais</label>
                            <p className="text-xs text-gray-500 mb-2">Separe por vírgula. Ex: Cimento, Elétrica, Hidráulica</p>
                            <input
                                type="text"
                                name="operatingCategories"
                                value={formData.operatingCategories}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Ex: Cimento, Aço, Tintas"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end space-x-3">
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                    {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
            </div>
        </div>
    );
}