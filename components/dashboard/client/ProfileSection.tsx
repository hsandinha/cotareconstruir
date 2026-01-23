"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ToastProvider";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/useAuth";
import { formatCepBr, formatCnpjBr, formatCpfBr, formatPhoneBr, isValidCNPJ, isValidCPF } from "../../../lib/utils";
import { User, Building2, MapPin, Phone, Mail, FileText, Users, Save, Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";

export function ClientProfileSection() {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileType, setProfileType] = useState<"cpf" | "cnpj">("cpf");
    const [profileComplete, setProfileComplete] = useState(0);

    const [person, setPerson] = useState({
        name: "",
        cpf: "",
        email: "",
        phone: "",
        role: "",
    });

    const [address, setAddress] = useState({
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
    });

    const [company, setCompany] = useState({
        razaoSocial: "",
        cnpj: "",
        role: "",
        obras: 0,
    });

    const [loadingCep, setLoadingCep] = useState(false);
    const [loadingCnpj, setLoadingCnpj] = useState(false);

    const [teamMembers, setTeamMembers] = useState<Array<{ name: string; email: string; phone: string; role: string }>>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<{ name: string; email: string; phone: string; role: string }>({ name: "", email: "", phone: "", role: "" });
    const [sortBy, setSortBy] = useState<"name" | "role">("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const { showToast } = useToast();

    // Calcular completude do perfil
    useEffect(() => {
        let total = 0;
        let filled = 0;

        const cpfFields = [person.name, person.email, person.phone, person.cpf, address.cep, address.logradouro, address.numero, address.cidade, address.estado];
        const cnpjFields = [...cpfFields, company.razaoSocial, company.cnpj];

        const fields = profileType === "cpf" ? cpfFields : cnpjFields;
        total = fields.length;
        filled = fields.filter(f => f && f.toString().trim() !== "").length;

        setProfileComplete(Math.round((filled / total) * 100));
    }, [person, address, company, profileType]);

    const handleAddPersonAsMember = () => {
        if (!person.name || !person.email) {
            showToast("error", "Preencha nome e email do contato principal para adicionar.");
            return;
        }
        const exists = teamMembers.some((m) => m.email === person.email);
        if (exists) {
            showToast("error", "Esse email já está na lista de funcionários.");
            return;
        }
        setTeamMembers((prev) => [
            ...prev,
            {
                name: person.name,
                email: person.email,
                phone: person.phone,
                role: person.role,
            },
        ]);
        showToast("success", "Contato principal adicionado à lista de funcionários.");
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (authLoading) return;

            if (user) {
                try {
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    if (userError) throw userError;

                    if (userData.cliente_id) {
                        const { data: clienteData, error: clienteError } = await supabase
                            .from('clientes')
                            .select('*')
                            .eq('id', userData.cliente_id);

                        const cliente = clienteData && clienteData.length > 0 ? clienteData[0] : null;

                        if (!clienteError && cliente) {
                            const cpfCnpjClean = (cliente.cpf_cnpj || "").replace(/\D/g, "");
                            const isCnpj = cpfCnpjClean.length === 14;
                            const detectedProfile = isCnpj ? "cnpj" : "cpf";
                            setProfileType(detectedProfile);

                            setPerson({
                                name: cliente.nome || userData.nome || "",
                                cpf: isCnpj ? "" : formatCpfBr(cliente.cpf_cnpj || ""),
                                email: cliente.email || userData.email || "",
                                phone: formatPhoneBr(cliente.telefone || ""),
                                role: "",
                            });

                            setAddress({
                                cep: formatCepBr(cliente.cep || ""),
                                logradouro: cliente.logradouro || "",
                                numero: cliente.numero || "",
                                complemento: cliente.complemento || "",
                                bairro: cliente.bairro || "",
                                cidade: cliente.cidade || "",
                                estado: cliente.estado || "",
                            });

                            setCompany({
                                razaoSocial: cliente.razao_social || "",
                                cnpj: isCnpj ? formatCnpjBr(cliente.cpf_cnpj || "") : "",
                                role: "",
                                obras: 0,
                            });

                            setLoading(false);
                            return;
                        }
                    }

                    const detectedProfile = userData.profile_type || (userData.cnpj ? "cnpj" : "cpf");
                    setProfileType(detectedProfile);
                    setPerson({
                        name: userData.nome || user.user_metadata?.full_name || "",
                        cpf: formatCpfBr(userData.cpf_cnpj || ""),
                        email: userData.email || user.email || "",
                        phone: formatPhoneBr(userData.telefone || ""),
                        role: userData.person_role || "",
                    });
                    setAddress({
                        cep: formatCepBr(userData.cep || ""),
                        logradouro: userData.endereco || userData.logradouro || "",
                        numero: userData.numero || "",
                        complemento: userData.complemento || "",
                        bairro: userData.bairro || "",
                        cidade: userData.cidade || "",
                        estado: userData.estado || "",
                    });
                    setCompany({
                        razaoSocial: userData.company_name || "",
                        cnpj: formatCnpjBr(userData.cnpj || ""),
                        role: userData.company_role || "",
                        obras: userData.obras || 0,
                    });
                    setTeamMembers((userData.team_members || []).map((m: any) => ({
                        name: m.name || "",
                        email: m.email || "",
                        phone: formatPhoneBr(m.phone || ""),
                        role: m.role || "",
                    })));
                } catch (error) {
                    console.error("Erro ao buscar perfil:", error);
                }
            }
            setLoading(false);
        };

        fetchProfile();
    }, [user, authLoading]);

    const sortedMembers = useMemo(() => {
        const withIndex = teamMembers.map((member, originalIndex) => ({ member, originalIndex }));
        withIndex.sort((a, b) => {
            const aVal = (a.member[sortBy] || "").toLowerCase();
            const bVal = (b.member[sortBy] || "").toLowerCase();
            if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
        return withIndex;
    }, [teamMembers, sortBy, sortDir]);

    const handleSave = async () => {
        if (!user?.id) return;

        if (profileType === "cpf" && person.cpf && !isValidCPF(person.cpf)) {
            showToast("error", "CPF inválido. Por favor, verifique o número digitado.");
            return;
        }

        if (profileType === "cnpj" && person.cpf && !isValidCPF(person.cpf)) {
            showToast("error", "CPF do responsável está inválido.");
            return;
        }

        if (profileType === "cnpj" && company.cnpj && !isValidCNPJ(company.cnpj)) {
            showToast("error", "CNPJ inválido. Por favor, verifique o número digitado.");
            return;
        }

        setSaving(true);
        try {
            const { data: userData } = await supabase
                .from('users')
                .select('cliente_id')
                .eq('id', user.id)
                .single();

            if (userData?.cliente_id) {
                const cpfCnpjValue = profileType === "cpf"
                    ? person.cpf?.replace(/\D/g, '')
                    : company.cnpj?.replace(/\D/g, '');

                const { error: clienteError } = await supabase
                    .from('clientes')
                    .update({
                        nome: person.name,
                        cpf_cnpj: cpfCnpjValue || null,
                        razao_social: profileType === "cnpj" ? company.razaoSocial : null,
                        email: person.email,
                        telefone: person.phone?.replace(/\D/g, ''),
                        cep: address.cep?.replace(/\D/g, ''),
                        logradouro: address.logradouro,
                        numero: address.numero,
                        complemento: address.complemento,
                        bairro: address.bairro,
                        cidade: address.cidade,
                        estado: address.estado,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userData.cliente_id);

                if (clienteError) throw clienteError;
            }

            const { error: userError } = await supabase
                .from('users')
                .update({
                    nome: person.name,
                    telefone: person.phone,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (userError) throw userError;

            showToast("success", "Perfil atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            showToast("error", "Erro ao salvar perfil.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-slate-600">Carregando perfil...</span>
            </div>
        );
    }

    const handleCepLookup = async () => {
        const clean = (address.cep || "").replace(/\D/g, "");
        if (clean.length !== 8) {
            showToast("error", "CEP deve ter 8 dígitos.");
            return;
        }

        setLoadingCep(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();
            setAddress(prev => ({
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

    const handleConsultCNPJ = async () => {
        const clean = (company.cnpj || "").replace(/\D/g, "");
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

            if (data.descricao_situacao_cadastral && data.descricao_situacao_cadastral !== "ATIVA") {
                showToast("error", `CNPJ consta como ${data.descricao_situacao_cadastral}`);
            } else {
                showToast("success", "Dados preenchidos automaticamente!");
            }

            setCompany(prev => ({
                ...prev,
                cnpj: formatCnpjBr(clean),
                razaoSocial: data.razao_social || prev.razaoSocial,
            }));
            setAddress(prev => ({
                ...prev,
                logradouro: data.logradouro || "",
                numero: data.numero || "",
                bairro: data.bairro || "",
                cidade: data.municipio || "",
                estado: data.uf || "",
                complemento: data.complemento || "",
                cep: formatCepBr(data.cep || ""),
            }));
        } catch (error) {
            showToast("error", "Erro ao consultar CNPJ.");
        } finally {
            setLoadingCnpj(false);
        }
    };

    const handleRemoveMember = (index: number) => {
        const member = teamMembers[index];
        if (!member) return;
        if (member.email === person.email) {
            showToast("error", "Não é possível remover o contato principal.");
            return;
        }
        if (!window.confirm("Deseja remover este funcionário?")) return;
        setTeamMembers(prev => prev.filter((_, i) => i !== index));
        showToast("success", "Funcionário removido.");
    };

    const startEdit = (index: number) => {
        setEditingIndex(index);
        setEditDraft(teamMembers[index]);
    };

    const cancelEdit = () => {
        setEditingIndex(null);
        setEditDraft({ name: "", email: "", phone: "", role: "" });
    };

    const saveEdit = (index: number) => {
        if (!editDraft.name || !editDraft.email) {
            showToast("error", "Nome e email são obrigatórios.");
            return;
        }
        setTeamMembers(prev => prev.map((m, i) => i === index ? { ...editDraft, phone: formatPhoneBr(editDraft.phone) } : m));
        setEditingIndex(null);
        showToast("success", "Funcionário atualizado.");
    };

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
                                    className="text-blue-600 transition-all duration-500" />
                            </svg>
                            {profileComplete === 100 && (
                                <CheckCircle2 className="absolute inset-0 m-auto w-6 h-6 text-emerald-500" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Seletor de tipo */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1.5">
                    <button
                        type="button"
                        onClick={() => setProfileType("cpf")}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${profileType === "cpf" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-200"
                            }`}
                    >
                        <User className="w-4 h-4" />
                        Pessoa Física (CPF)
                    </button>
                    <button
                        type="button"
                        onClick={() => setProfileType("cnpj")}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${profileType === "cnpj" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-200"
                            }`}
                    >
                        <Building2 className="w-4 h-4" />
                        Pessoa Jurídica (CNPJ)
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Dados Pessoais */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                {profileType === "cnpj" ? "Responsável Legal" : "Dados Pessoais"}
                            </h2>
                            <p className="text-sm text-slate-500">Informações do responsável pelas cotações</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Nome Completo *</label>
                            <input
                                value={person.name}
                                onChange={(e) => setPerson({ ...person, name: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                placeholder="Seu nome completo"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email *</span>
                                </label>
                                <input value={person.email} disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone *</span>
                                </label>
                                <input
                                    value={person.phone}
                                    onChange={(e) => setPerson({ ...person, phone: formatPhoneBr(e.target.value) })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> CPF *</span>
                                </label>
                                <input
                                    value={person.cpf}
                                    onChange={(e) => setPerson({ ...person, cpf: formatCpfBr(e.target.value) })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="000.000.000-00"
                                />
                                {person.cpf && !isValidCPF(person.cpf) && (
                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> CPF inválido</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Cargo/Setor</label>
                                <input
                                    value={person.role}
                                    onChange={(e) => setPerson({ ...person, role: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Ex: Engenheiro..."
                                />
                            </div>
                        </div>

                        {profileType === "cnpj" && (
                            <div className="pt-4 flex justify-end">
                                <button type="button" onClick={handleAddPersonAsMember} className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                                    <Users className="w-4 h-4" /> Adicionar à equipe
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Endereço */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Endereço</h2>
                            <p className="text-sm text-slate-500">{profileType === "cnpj" ? "Endereço da empresa" : "Endereço de entrega"}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">CEP *</label>
                            <div className="flex gap-2">
                                <input
                                    value={address.cep}
                                    onChange={(e) => setAddress({ ...address, cep: formatCepBr(e.target.value) })}
                                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="00000-000"
                                    maxLength={9}
                                />
                                <button type="button" onClick={handleCepLookup} disabled={loadingCep} className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                                    {loadingCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Buscar
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Logradouro *</label>
                            <input
                                value={address.logradouro}
                                onChange={(e) => setAddress({ ...address, logradouro: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                placeholder="Rua, Avenida..."
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Número *</label>
                                <input
                                    value={address.numero}
                                    onChange={(e) => setAddress({ ...address, numero: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="123"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Complemento</label>
                                <input
                                    value={address.complemento}
                                    onChange={(e) => setAddress({ ...address, complemento: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Apto, Sala..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Bairro *</label>
                            <input
                                value={address.bairro}
                                onChange={(e) => setAddress({ ...address, bairro: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                placeholder="Nome do bairro"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Cidade *</label>
                                <input
                                    value={address.cidade}
                                    onChange={(e) => setAddress({ ...address, cidade: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Cidade"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">UF *</label>
                                <select
                                    value={address.estado}
                                    onChange={(e) => setAddress({ ...address, estado: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                >
                                    <option value="">UF</option>
                                    {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map(uf => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dados Empresa (CNPJ) */}
                {profileType === "cnpj" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 text-violet-600">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-slate-900">Dados da Empresa</h2>
                                <p className="text-sm text-slate-500">Informações jurídicas</p>
                            </div>
                            <div className="rounded-xl bg-slate-900 px-4 py-2 text-right text-white">
                                <p className="text-lg font-bold">{company.obras}</p>
                                <p className="text-xs text-slate-300">obras ativas</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">CNPJ *</label>
                                <div className="flex gap-2">
                                    <input
                                        value={company.cnpj}
                                        onChange={(e) => setCompany({ ...company, cnpj: formatCnpjBr(e.target.value) })}
                                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                        placeholder="00.000.000/0000-00"
                                    />
                                    <button type="button" onClick={handleConsultCNPJ} disabled={loadingCnpj} className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                                        {loadingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Consultar
                                    </button>
                                </div>
                                {company.cnpj && !isValidCNPJ(company.cnpj) && (
                                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> CNPJ inválido</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Razão Social *</label>
                                <input
                                    value={company.razaoSocial}
                                    onChange={(e) => setCompany({ ...company, razaoSocial: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                                    placeholder="Nome da empresa"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Equipe (CNPJ) */}
                {profileType === "cnpj" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Equipe</h2>
                                    <p className="text-sm text-slate-500">Funcionários com acesso</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "role")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                                    <option value="name">Nome</option>
                                    <option value="role">Cargo</option>
                                </select>
                                <button type="button" onClick={() => setSortDir(prev => prev === "asc" ? "desc" : "asc")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                    {sortDir === "asc" ? "A→Z" : "Z→A"}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cargo</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                <p>Nenhum funcionário cadastrado.</p>
                                            </td>
                                        </tr>
                                    )}
                                    {sortedMembers.map(({ member, originalIndex }) => {
                                        const isEditing = editingIndex === originalIndex;
                                        const isPrincipal = member.email === person.email;
                                        return (
                                            <tr key={`${member.email}-${originalIndex}`} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-slate-900">{member.name}</span>
                                                            {isPrincipal && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Principal</span>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">{isEditing ? <input value={editDraft.email} onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" /> : member.email}</td>
                                                <td className="px-4 py-3 text-slate-600">{isEditing ? <input value={editDraft.phone} onChange={(e) => setEditDraft({ ...editDraft, phone: formatPhoneBr(e.target.value) })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" /> : (member.phone || "-")}</td>
                                                <td className="px-4 py-3 text-slate-600">{isEditing ? <input value={editDraft.role} onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" /> : (member.role || "-")}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {isEditing ? (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => saveEdit(originalIndex)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Salvar</button>
                                                            <button onClick={cancelEdit} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">Cancelar</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => startEdit(originalIndex)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200">Editar</button>
                                                            <button onClick={() => handleRemoveMember(originalIndex)} disabled={isPrincipal} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed">Excluir</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
