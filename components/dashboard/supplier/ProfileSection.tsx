"use client";

import { useState, useEffect } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { formatCepBr, formatCnpjBr, formatPhoneBr, isValidCNPJ } from "../../../lib/utils";
import { SupplierVerificationSection } from "./VerificationSection";

export function SupplierProfileSection() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [consultingCNPJ, setConsultingCNPJ] = useState(false);
    const [userUid, setUserUid] = useState<string | null>(null);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);
    const [showVerification, setShowVerification] = useState(false);
    const [showProfile, setShowProfile] = useState(true);
    const [showGroups, setShowGroups] = useState(true);
    const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; nome: string }>>([]);
    const [supplierGroups, setSupplierGroups] = useState<string[]>([]);
    const [savingGroups, setSavingGroups] = useState(false);

    const [formData, setFormData] = useState({
        companyName: "",
        cnpj: "",
        stateRegistration: "",
        phone: "",
        managerName: "",
        managerRole: "",
        email: "",
        whatsapp: "",
        cep: "",
        endereco: "",
        numero: "",
        bairro: "",
        cidade: "",
        estado: "",
        complemento: "",
        operatingRegions: "",
        operatingCategories: ""
    });
    const [loadingCep, setLoadingCep] = useState(false);

    const { user, profile, initialized } = useAuth();

    useEffect(() => {
        if (!initialized) return;

        const loadProfile = async () => {
            if (user) {
                setUserUid(user.id);
                try {
                    if (profile) {
                        setFormData({
                            companyName: profile.company_name || "",
                            cnpj: formatCnpjBr(profile.cnpj || ""),
                            stateRegistration: profile.state_registration || "",
                            phone: formatPhoneBr(profile.phone || ""),
                            managerName: profile.manager_name || profile.nome || "",
                            managerRole: profile.manager_role || "",
                            email: profile.email || user.email || "",
                            whatsapp: formatPhoneBr(profile.whatsapp || ""),
                            cep: formatCepBr(profile.cep || ""),
                            endereco: profile.endereco || profile.address || "",
                            numero: profile.numero || "",
                            bairro: profile.bairro || "",
                            cidade: profile.cidade || "",
                            estado: profile.estado || "",
                            complemento: profile.complemento || "",
                            operatingRegions: profile.operating_regions || "",
                            operatingCategories: profile.operating_categories || ""
                        });

                        // Buscar dados do fornecedor se existir fornecedor_id
                        if (profile.fornecedor_id) {
                            setFornecedorId(profile.fornecedor_id);
                            const { data: fornecedorData } = await supabase
                                .from('fornecedores')
                                .select('*')
                                .eq('id', profile.fornecedor_id)
                                .single();

                            if (fornecedorData) {
                                // Buscar grupos vinculados ao fornecedor
                                const { data: gruposData } = await supabase
                                    .from('fornecedor_grupo')
                                    .select('grupo_id')
                                    .eq('fornecedor_id', profile.fornecedor_id);

                                if (gruposData) {
                                    setSupplierGroups(gruposData.map(g => g.grupo_id));
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error fetching profile:", error);
                }
            }
            setLoading(false);
        };

        loadProfile();
    }, [user, profile, initialized]);

    // Carregar grupos de insumo disponíveis
    useEffect(() => {
        const loadGroups = async () => {
            try {
                const { data: groups } = await supabase
                    .from('grupos_insumo')
                    .select('id, nome')
                    .order('nome');

                if (groups) {
                    setAvailableGroups(groups);
                }
            } catch (error) {
                console.error("Erro ao carregar grupos:", error);
            }
        };
        loadGroups();
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
                endereco: data.logradouro || "",
                numero: data.numero || "",
                bairro: data.bairro || "",
                cidade: data.municipio || "",
                estado: data.uf || "",
                complemento: data.complemento || "",
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

        setLoadingCep(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();
            setFormData(prev => ({
                ...prev,
                cep: formatCepBr(clean),
                endereco: data.street || "",
                bairro: data.neighborhood || "",
                cidade: data.city || "",
                estado: data.state || "",
            }));
        } catch (error) {
            console.error("Erro ao consultar CEP:", error);
            alert("Não foi possível buscar o CEP. Verifique o número ou tente novamente.");
        } finally {
            setLoadingCep(false);
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
            await supabase
                .from('users')
                .update({
                    company_name: formData.companyName,
                    cnpj: formData.cnpj.replace(/\D/g, ''),
                    state_registration: formData.stateRegistration,
                    phone: formData.phone.replace(/\D/g, ''),
                    manager_name: formData.managerName,
                    manager_role: formData.managerRole,
                    email: formData.email,
                    whatsapp: formData.whatsapp.replace(/\D/g, ''),
                    cep: formData.cep.replace(/\D/g, ''),
                    endereco: formData.endereco,
                    numero: formData.numero,
                    bairro: formData.bairro,
                    cidade: formData.cidade,
                    estado: formData.estado,
                    complemento: formData.complemento,
                    operating_regions: formData.operatingRegions,
                    operating_categories: formData.operatingCategories,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userUid);
            alert("Perfil atualizado com sucesso!");
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Erro ao atualizar perfil.");
        } finally {
            setSaving(false);
        }
    };

    const toggleGroup = (groupId: string) => {
        setSupplierGroups(prev => {
            if (prev.includes(groupId)) {
                return prev.filter(id => id !== groupId);
            } else {
                return [...prev, groupId];
            }
        });
    };

    const handleSaveGroups = async () => {
        if (!fornecedorId) {
            alert("Fornecedor não identificado. Verifique se sua conta está vinculada a um fornecedor.");
            return;
        }

        setSavingGroups(true);
        try {
            // Deletar grupos antigos
            await supabase
                .from('fornecedor_grupo')
                .delete()
                .eq('fornecedor_id', fornecedorId);

            // Inserir novos grupos
            if (supplierGroups.length > 0) {
                const insertData = supplierGroups.map(grupoId => ({
                    fornecedor_id: fornecedorId,
                    grupo_id: grupoId
                }));
                await supabase.from('fornecedor_grupo').insert(insertData);
            }

            alert("Grupos de insumo atualizados com sucesso!");
        } catch (error) {
            console.error("Erro ao atualizar grupos:", error);
            alert("Erro ao atualizar grupos de insumo.");
        } finally {
            setSavingGroups(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando perfil...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Seção de Cadastro e Gerenciamento do Perfil */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowProfile(!showProfile)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">Cadastro e Gerenciamento do Perfil</h3>
                            <p className="text-sm text-gray-600">Gerencie os dados da sua empresa e configure seu perfil de fornecedor</p>
                        </div>
                    </div>
                    {showProfile ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                </button>

                {showProfile && (
                    <div className="border-t border-gray-200 p-6">
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
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                                            <input
                                                type="text"
                                                name="cep"
                                                value={formData.cep || ""}
                                                onChange={handleChange}
                                                onBlur={handleConsultCEP}
                                                disabled={loadingCep}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                                                placeholder="00000-000"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">{loadingCep ? "Buscando..." : "Busca automática ao sair do campo"}</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (Logradouro)</label>
                                            <input
                                                type="text"
                                                name="endereco"
                                                value={formData.endereco || ""}
                                                onChange={handleChange}
                                                readOnly
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                                                placeholder="Rua, Avenida, etc"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                                                <input
                                                    type="text"
                                                    name="numero"
                                                    value={formData.numero || ""}
                                                    onChange={handleChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    placeholder="123"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                                                <input
                                                    type="text"
                                                    name="complemento"
                                                    value={formData.complemento || ""}
                                                    onChange={handleChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    placeholder="Apto, Sala, Bloco..."
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                                            <input
                                                type="text"
                                                name="bairro"
                                                value={formData.bairro || ""}
                                                onChange={handleChange}
                                                readOnly
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                                                placeholder="Bairro"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                                                <input
                                                    type="text"
                                                    name="cidade"
                                                    value={formData.cidade || ""}
                                                    onChange={handleChange}
                                                    readOnly
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                                                    placeholder="Cidade"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                                <input
                                                    type="text"
                                                    name="estado"
                                                    value={formData.estado || ""}
                                                    onChange={handleChange}
                                                    readOnly
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
                                                    placeholder="UF"
                                                    maxLength={2}
                                                />
                                            </div>
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
                )}
            </div>

            {/* Seção de Grupos de Insumo */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowGroups(!showGroups)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">Grupos de Insumo</h3>
                            <p className="text-sm text-gray-600">Selecione os grupos de materiais que sua empresa fornece ({supplierGroups.length} selecionados)</p>
                        </div>
                    </div>
                    {showGroups ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                </button>

                {showGroups && (
                    <div className="border-t border-gray-200 p-6">
                        <div className="flex items-center justify-end mb-4">
                            <button
                                onClick={handleSaveGroups}
                                disabled={savingGroups}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                                {savingGroups ? "Salvando..." : "Salvar Grupos"}
                            </button>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                            <p className="text-sm text-blue-800">
                                <strong>Dica:</strong> Marque os grupos de materiais que você fornece. Isso ajudará a receber oportunidades relevantes.
                            </p>
                        </div>

                        {availableGroups.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>Carregando grupos de insumo...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Coluna Esquerda: Grupos Disponíveis */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                        <h5 className="text-sm font-semibold text-gray-700">Grupos Disponíveis</h5>
                                        <span className="text-xs text-gray-500">
                                            {availableGroups.filter(g => !supplierGroups.includes(g.id)).length} grupos
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                        {availableGroups
                                            .filter(group => !supplierGroups.includes(group.id))
                                            .map(group => (
                                                <button
                                                    key={group.id}
                                                    onClick={() => toggleGroup(group.id)}
                                                    className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:border-green-400 hover:bg-green-50 transition-all group"
                                                >
                                                    <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                                                        {group.nome}
                                                    </span>
                                                    <PlusIcon className="h-4 w-4 text-gray-400 group-hover:text-green-600" />
                                                </button>
                                            ))}
                                        {availableGroups.filter(g => !supplierGroups.includes(g.id)).length === 0 && (
                                            <div className="text-center py-8 text-gray-400">
                                                <p className="text-sm">Todos os grupos foram selecionados</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Coluna Direita: Grupos Selecionados */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-green-500">
                                        <h5 className="text-sm font-semibold text-gray-900">Meus Grupos</h5>
                                        <span className="px-2.5 py-1 text-xs font-bold text-white bg-green-600 rounded-full">
                                            {supplierGroups.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-2">
                                        {availableGroups
                                            .filter(group => supplierGroups.includes(group.id))
                                            .map(group => (
                                                <div
                                                    key={group.id}
                                                    className="group flex items-center justify-between p-3.5 rounded-lg border-2 border-green-500 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 transition-all shadow-sm"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-2 h-2 rounded-full bg-green-600"></div>
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            {group.nome}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleGroup(group.id)}
                                                        className="p-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 hover:border-red-400 transition-all shadow-sm"
                                                        title="Remover grupo"
                                                    >
                                                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        {supplierGroups.length === 0 && (
                                            <div className="text-center py-16 px-4">
                                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 mb-4">
                                                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                </div>
                                                <p className="text-base font-semibold text-gray-700 mb-1">Nenhum grupo selecionado</p>
                                                <p className="text-sm text-gray-500">Clique nos grupos à esquerda para adicionar aos seus materiais</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {supplierGroups.length > 0 && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                                <p className="text-sm font-medium text-green-700">
                                    Total de grupos selecionados: <span className="font-bold">{supplierGroups.length}</span>
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Seção de Verificação e Documentos */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowVerification(!showVerification)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-gray-900">Verificação e Documentos</h3>
                            <p className="text-sm text-gray-600">Envie documentos e comprovantes para verificação</p>
                        </div>
                    </div>
                    {showVerification ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                    ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                    )}
                </button>

                {showVerification && (
                    <div className="border-t border-gray-200 p-6">
                        <SupplierVerificationSection />
                    </div>
                )}
            </div>
        </div>
    );
}