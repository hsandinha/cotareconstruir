"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { formatCepBr, formatCnpjBr, formatPhoneBr, isValidCNPJ } from "../../../lib/utils";
import { useToast } from "@/components/ToastProvider";
import { SupplierVerificationSection } from "./VerificationSection";
import {
    Building2, User, MapPin, Phone, Mail, FileText, Briefcase, Save, Loader2,
    Search, CheckCircle2, AlertCircle, Package, Plus, X, Shield, ChevronDown, ChevronUp
} from "lucide-react";

export function SupplierProfileSection() {
    const { user, profile, initialized } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);
    const [profileComplete, setProfileComplete] = useState(0);

    const [userUid, setUserUid] = useState<string | null>(null);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);

    // Estados de UI
    const [showGroups, setShowGroups] = useState(true);
    const [showVerification, setShowVerification] = useState(false);

    // Grupos de insumo
    const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; nome: string }>>([]);
    const [supplierGroups, setSupplierGroups] = useState<string[]>([]);
    const [savingGroups, setSavingGroups] = useState(false);

    // Dados da empresa
    const [company, setCompany] = useState({
        razaoSocial: "",
        cnpj: "",
        inscricaoEstadual: "",
        telefone: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
    });

    // Dados do responsável
    const [manager, setManager] = useState({
        nome: "",
        cargo: "",
        email: "",
        whatsapp: "",
    });

    // Preferências
    const [preferences, setPreferences] = useState({
        regioesAtendimento: "",
        categoriasMateriais: "",
    });

    // Calcular completude do perfil
    useEffect(() => {
        const fields = [
            company.razaoSocial, company.cnpj, company.telefone, company.cep,
            company.logradouro, company.cidade, company.estado,
            manager.nome, manager.email, manager.whatsapp
        ];
        const filled = fields.filter(f => f && f.toString().trim() !== "").length;
        setProfileComplete(Math.round((filled / fields.length) * 100));
    }, [company, manager]);

    // Carregar perfil
    useEffect(() => {
        if (!initialized) return;

        const loadProfile = async () => {
            if (user) {
                setUserUid(user.id);
                try {
                    if (profile) {
                        setCompany({
                            razaoSocial: profile.company_name || profile.razao_social || "",
                            cnpj: formatCnpjBr(profile.cnpj || ""),
                            inscricaoEstadual: profile.state_registration || profile.inscricao_estadual || "",
                            telefone: formatPhoneBr(profile.phone || profile.telefone || ""),
                            cep: formatCepBr(profile.cep || ""),
                            logradouro: profile.endereco || profile.logradouro || profile.address || "",
                            numero: profile.numero || "",
                            complemento: profile.complemento || "",
                            bairro: profile.bairro || "",
                            cidade: profile.cidade || "",
                            estado: profile.estado || "",
                        });

                        setManager({
                            nome: profile.manager_name || profile.nome || "",
                            cargo: profile.manager_role || "",
                            email: profile.email || user.email || "",
                            whatsapp: formatPhoneBr(profile.whatsapp || ""),
                        });

                        setPreferences({
                            regioesAtendimento: profile.operating_regions || profile.regioes_atendimento || "",
                            categoriasMateriais: profile.operating_categories || "",
                        });

                        // Buscar dados do fornecedor se existir fornecedor_id
                        if (profile.fornecedor_id) {
                            setFornecedorId(profile.fornecedor_id);
                            const { data: gruposData } = await supabase
                                .from('fornecedor_grupo')
                                .select('grupo_id')
                                .eq('fornecedor_id', profile.fornecedor_id);

                            if (gruposData) {
                                setSupplierGroups(gruposData.map(g => g.grupo_id));
                            }
                        }
                    }
                } catch (error) {
                    console.error("Erro ao carregar perfil:", error);
                }
            }
            setLoading(false);
        };

        loadProfile();
    }, [user, profile, initialized]);

    // Carregar grupos de insumo disponíveis
    useEffect(() => {
        const loadGroups = async () => {
            const { data: groups } = await supabase
                .from('grupos_insumo')
                .select('id, nome')
                .order('nome');

            if (groups) {
                setAvailableGroups(groups);
            }
        };
        loadGroups();
    }, []);

    const handleConsultCNPJ = async () => {
        const clean = company.cnpj.replace(/\D/g, '');
        if (clean.length !== 14) {
            showToast("error", "CNPJ deve ter 14 dígitos.");
            return;
        }

        setLoadingCnpj(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
            if (!response.ok) {
                showToast("error", "CNPJ não encontrado.");
                return;
            }

            const data = await response.json();

            if (data.descricao_situacao_cadastral !== "ATIVA") {
                showToast("error", `CNPJ consta como ${data.descricao_situacao_cadastral}`);
            } else {
                showToast("success", "Dados preenchidos automaticamente!");
            }

            setCompany(prev => ({
                ...prev,
                razaoSocial: data.razao_social || prev.razaoSocial,
                cnpj: formatCnpjBr(clean),
                logradouro: data.logradouro || "",
                numero: data.numero || "",
                complemento: data.complemento || "",
                bairro: data.bairro || "",
                cidade: data.municipio || "",
                estado: data.uf || "",
                cep: formatCepBr(data.cep || ""),
                telefone: formatPhoneBr(data.ddd_telefone_1 || prev.telefone),
            }));
        } catch (error) {
            showToast("error", "Erro ao consultar CNPJ.");
        } finally {
            setLoadingCnpj(false);
        }
    };

    const handleCepLookup = async () => {
        const clean = company.cep.replace(/\D/g, "");
        if (clean.length !== 8) {
            showToast("error", "CEP deve ter 8 dígitos.");
            return;
        }

        setLoadingCep(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();
            setCompany(prev => ({
                ...prev,
                cep: formatCepBr(clean),
                logradouro: data.street || "",
                bairro: data.neighborhood || "",
                cidade: data.city || "",
                estado: data.state || "",
            }));
            showToast("success", "Endereço preenchido automaticamente!");
        } catch (error) {
            showToast("error", "Não foi possível buscar o CEP.");
        } finally {
            setLoadingCep(false);
        }
    };

    const handleSave = async () => {
        if (!userUid) return;

        if (company.cnpj && !isValidCNPJ(company.cnpj)) {
            showToast("error", "CNPJ inválido.");
            return;
        }

        setSaving(true);
        try {
            await supabase
                .from('users')
                .update({
                    company_name: company.razaoSocial,
                    cnpj: company.cnpj.replace(/\D/g, ''),
                    state_registration: company.inscricaoEstadual,
                    phone: company.telefone.replace(/\D/g, ''),
                    manager_name: manager.nome,
                    manager_role: manager.cargo,
                    email: manager.email,
                    whatsapp: manager.whatsapp.replace(/\D/g, ''),
                    cep: company.cep.replace(/\D/g, ''),
                    endereco: company.logradouro,
                    numero: company.numero,
                    bairro: company.bairro,
                    cidade: company.cidade,
                    estado: company.estado,
                    complemento: company.complemento,
                    operating_regions: preferences.regioesAtendimento,
                    operating_categories: preferences.categoriasMateriais,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userUid);

            showToast("success", "Perfil atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            showToast("error", "Erro ao atualizar perfil.");
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
            showToast("error", "Fornecedor não identificado.");
            return;
        }

        setSavingGroups(true);
        try {
            await supabase.from('fornecedor_grupo').delete().eq('fornecedor_id', fornecedorId);

            if (supplierGroups.length > 0) {
                const insertData = supplierGroups.map(grupoId => ({
                    fornecedor_id: fornecedorId,
                    grupo_id: grupoId
                }));
                await supabase.from('fornecedor_grupo').insert(insertData);
            }

            showToast("success", "Grupos atualizados com sucesso!");
        } catch (error) {
            showToast("error", "Erro ao atualizar grupos.");
        } finally {
            setSavingGroups(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="ml-3 text-slate-600">Carregando perfil...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header com barra de progresso */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Meu Perfil</h1>
                        <p className="mt-1 text-slate-500">Complete seu cadastro para ter acesso a todas as funcionalidades</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Perfil completo</p>
                            <p className="text-2xl font-bold text-slate-900">{profileComplete}%</p>
                        </div>
                        <div className="h-16 w-16 relative">
                            <svg className="w-16 h-16 transform -rotate-90">
                                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-slate-200" />
                                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none"
                                    strokeDasharray={`${profileComplete * 1.76} 176`}
                                    className="text-emerald-600 transition-all duration-500" />
                            </svg>
                            {profileComplete === 100 && (
                                <CheckCircle2 className="absolute inset-0 m-auto w-6 h-6 text-emerald-500" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Botão Salvar */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Dados da Empresa */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Dados da Empresa</h2>
                            <p className="text-sm text-slate-500">Informações cadastrais da empresa</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Razão Social *</label>
                            <input
                                value={company.razaoSocial}
                                onChange={(e) => setCompany({ ...company, razaoSocial: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="Nome da empresa"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> CNPJ *</span>
                            </label>
                            <div className="relative">
                                <input
                                    value={company.cnpj}
                                    onChange={(e) => setCompany({ ...company, cnpj: formatCnpjBr(e.target.value) })}
                                    onBlur={handleConsultCNPJ}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                    placeholder="00.000.000/0000-00"
                                />
                                {loadingCnpj && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Preenche automaticamente ao sair do campo</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Inscrição Estadual</label>
                            <input
                                value={company.inscricaoEstadual}
                                onChange={(e) => setCompany({ ...company, inscricaoEstadual: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="000.000.000.000"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone Comercial *</span>
                            </label>
                            <input
                                value={company.telefone}
                                onChange={(e) => setCompany({ ...company, telefone: formatPhoneBr(e.target.value) })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="(00) 0000-0000"
                            />
                        </div>
                    </div>
                </div>

                {/* Contato Gerencial */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Contato Gerencial</h2>
                            <p className="text-sm text-slate-500">Responsável pelo atendimento comercial</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                        <p className="text-sm text-blue-800">
                            <strong>Importante:</strong> O contato deve ser preferencialmente com gerente ou diretor comercial.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Nome do Responsável *</label>
                            <input
                                value={manager.nome}
                                onChange={(e) => setManager({ ...manager, nome: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="Nome completo"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Cargo *</label>
                            <select
                                value={manager.cargo}
                                onChange={(e) => setManager({ ...manager, cargo: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                            >
                                <option value="">Selecione o cargo</option>
                                <option value="gerente-comercial">Gerente Comercial</option>
                                <option value="diretor-comercial">Diretor Comercial</option>
                                <option value="proprietario">Proprietário</option>
                                <option value="vendedor">Vendedor</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email *</span>
                            </label>
                            <input
                                type="email"
                                value={manager.email}
                                onChange={(e) => setManager({ ...manager, email: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="email@empresa.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp *</span>
                            </label>
                            <input
                                value={manager.whatsapp}
                                onChange={(e) => setManager({ ...manager, whatsapp: formatPhoneBr(e.target.value) })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>
                </div>

                {/* Endereço */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 text-orange-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Endereço</h2>
                            <p className="text-sm text-slate-500">Localização da empresa</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">CEP *</label>
                            <div className="relative">
                                <input
                                    value={company.cep}
                                    onChange={(e) => setCompany({ ...company, cep: formatCepBr(e.target.value) })}
                                    onBlur={handleCepLookup}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                    placeholder="00000-000"
                                />
                                {loadingCep && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Logradouro</label>
                            <input
                                value={company.logradouro}
                                readOnly
                                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 cursor-not-allowed"
                                placeholder="Rua, Avenida..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Número</label>
                            <input
                                value={company.numero}
                                onChange={(e) => setCompany({ ...company, numero: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="123"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Complemento</label>
                            <input
                                value={company.complemento}
                                onChange={(e) => setCompany({ ...company, complemento: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                                placeholder="Sala, Bloco..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Bairro</label>
                            <input
                                value={company.bairro}
                                readOnly
                                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 cursor-not-allowed"
                                placeholder="Bairro"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Cidade</label>
                            <input
                                value={company.cidade}
                                readOnly
                                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 cursor-not-allowed"
                                placeholder="Cidade"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Estado</label>
                            <input
                                value={company.estado}
                                readOnly
                                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 cursor-not-allowed"
                                placeholder="UF"
                            />
                        </div>
                    </div>
                </div>

                {/* Preferências de Atendimento */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 text-purple-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Regiões de Atendimento</h2>
                            <p className="text-sm text-slate-500">Configure as regiões que você atende</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Regiões de Atuação</label>
                        <p className="text-xs text-slate-400 mb-2">Separe por vírgula. Ex: Centro, Zona Sul, Belo Horizonte</p>
                        <input
                            value={preferences.regioesAtendimento}
                            onChange={(e) => setPreferences({ ...preferences, regioesAtendimento: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                            placeholder="Ex: Centro, Copacabana, Rio de Janeiro"
                        />
                    </div>
                </div>
            </div>

            {/* Grupos de Insumo */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                    onClick={() => setShowGroups(!showGroups)}
                    className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 text-violet-600">
                            <Package className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-semibold text-slate-900">Grupos de Insumo</h2>
                            <p className="text-sm text-slate-500">
                                Selecione os grupos de materiais que você fornece ({supplierGroups.length} selecionados)
                            </p>
                        </div>
                    </div>
                    {showGroups ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {showGroups && (
                    <div className="border-t border-slate-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex-1 mr-4">
                                <p className="text-sm text-violet-800">
                                    <strong>Dica:</strong> Marque os grupos de materiais que você fornece para receber oportunidades relevantes.
                                </p>
                            </div>
                            <button
                                onClick={handleSaveGroups}
                                disabled={savingGroups}
                                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
                            >
                                {savingGroups ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {savingGroups ? "Salvando..." : "Salvar Grupos"}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Grupos Disponíveis */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                    <h5 className="text-sm font-semibold text-slate-700">Grupos Disponíveis</h5>
                                    <span className="text-xs text-slate-500">
                                        {availableGroups.filter(g => !supplierGroups.includes(g.id)).length} grupos
                                    </span>
                                </div>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                    {availableGroups
                                        .filter(group => !supplierGroups.includes(group.id))
                                        .map(group => (
                                            <button
                                                key={group.id}
                                                onClick={() => toggleGroup(group.id)}
                                                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                                            >
                                                <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700">
                                                    {group.nome}
                                                </span>
                                                <Plus className="h-4 w-4 text-slate-400 group-hover:text-emerald-600" />
                                            </button>
                                        ))}
                                    {availableGroups.filter(g => !supplierGroups.includes(g.id)).length === 0 && (
                                        <div className="text-center py-8 text-slate-400">
                                            <p className="text-sm">Todos os grupos foram selecionados</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Meus Grupos */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-500">
                                    <h5 className="text-sm font-semibold text-slate-900">Meus Grupos</h5>
                                    <span className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 rounded-full">
                                        {supplierGroups.length}
                                    </span>
                                </div>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                    {availableGroups
                                        .filter(group => supplierGroups.includes(group.id))
                                        .map(group => (
                                            <div
                                                key={group.id}
                                                className="flex items-center justify-between p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                                                    <span className="text-sm font-semibold text-slate-900">{group.nome}</span>
                                                </div>
                                                <button
                                                    onClick={() => toggleGroup(group.id)}
                                                    className="p-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 hover:border-red-400 transition-all"
                                                >
                                                    <X className="w-4 h-4 text-red-600" />
                                                </button>
                                            </div>
                                        ))}
                                    {supplierGroups.length === 0 && (
                                        <div className="text-center py-12">
                                            <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                            <p className="text-sm font-medium text-slate-700">Nenhum grupo selecionado</p>
                                            <p className="text-xs text-slate-500">Clique nos grupos à esquerda para adicionar</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Verificação e Documentos */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                    onClick={() => setShowVerification(!showVerification)}
                    className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-semibold text-slate-900">Verificação e Documentos</h2>
                            <p className="text-sm text-slate-500">Envie documentos para validação do seu cadastro</p>
                        </div>
                    </div>
                    {showVerification ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {showVerification && (
                    <div className="border-t border-slate-200 p-6">
                        <SupplierVerificationSection />
                    </div>
                )}
            </div>
        </div>
    );
}
