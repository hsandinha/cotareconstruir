"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ToastProvider";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { formatCepBr, formatCnpjBr, formatCpfBr, formatPhoneBr, isValidCNPJ, isValidCPF } from "../../../lib/utils";

export function ClientProfileSection() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profileType, setProfileType] = useState<"cpf" | "cnpj">("cpf");
    const [userUid, setUserUid] = useState<string | null>(null);

    const [person, setPerson] = useState({
        name: "",
        cpf: "",
        email: "",
        phone: "",
        role: "",
    });

    const [company, setCompany] = useState({
        companyName: "",
        cnpj: "",
        role: "",
        obras: 0,
        address: "",
        addressNumber: "",
        addressComplement: "",
        cep: "",
    });

    const [teamMembers, setTeamMembers] = useState<Array<{ name: string; email: string; phone: string; role: string }>>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<{ name: string; email: string; phone: string; role: string }>({ name: "", email: "", phone: "", role: "" });
    const [sortBy, setSortBy] = useState<"name" | "role">("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const { showToast } = useToast();

    const handleAddPersonAsMember = () => {
        if (!person.name || !person.email) {
            showToast("error", "Preencha nome e email do contato principal para adicionar.");
            return;
        }

        const exists = teamMembers.some((m) => m.email === person.email);
        if (exists) {
            showToast("error", "Este email já está na lista de funcionários.");
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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserUid(user.uid);
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const detectedProfile = data.profileType || (data.cnpj ? "cnpj" : "cpf");
                        setProfileType(detectedProfile);
                        setPerson({
                            name: data.name || user.displayName || "",
                            cpf: formatCpfBr(data.cpf || ""),
                            email: data.email || user.email || "",
                            phone: formatPhoneBr(data.phone || ""),
                            role: data.personRole || "",
                        });
                        setCompany({
                            companyName: data.companyName || "",
                            cnpj: formatCnpjBr(data.cnpj || ""),
                            role: data.companyRole || "",
                            obras: data.obras || 0,
                            address: data.address || "",
                            addressNumber: data.addressNumber || "",
                            addressComplement: data.addressComplement || "",
                            cep: formatCepBr(data.cep || ""),
                        });
                        setTeamMembers((data.teamMembers || []).map((m: any) => ({
                            name: m.name || "",
                            email: m.email || "",
                            phone: formatPhoneBr(m.phone || ""),
                            role: m.role || "",
                        })));
                    }
                } catch (error) {
                    console.error("Erro ao buscar perfil:", error);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
        if (!userUid) return;

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

        if (profileType === "cnpj") {
            const invalidMember = teamMembers.find((m) => !m.name || !m.email);
            if (invalidMember) {
                showToast("error", "Preencha nome e email de todos os responsáveis vinculados.");
                return;
            }
        }

        setSaving(true);
        try {
            const docRef = doc(db, "users", userUid);
            await updateDoc(docRef, {
                profileType,
                name: person.name,
                cpf: person.cpf,
                phone: person.phone,
                personRole: person.role,
                companyName: profileType === "cnpj" ? company.companyName : "",
                cnpj: profileType === "cnpj" ? company.cnpj : "",
                companyRole: profileType === "cnpj" ? company.role : "",
                obras: profileType === "cnpj" ? company.obras : 0,
                address: profileType === "cnpj" ? company.address : "",
                addressNumber: profileType === "cnpj" ? company.addressNumber : "",
                addressComplement: profileType === "cnpj" ? company.addressComplement : "",
                cep: profileType === "cnpj" ? company.cep : "",
                teamMembers: profileType === "cnpj" ? teamMembers : [],
            });
            showToast("success", "Perfil atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            showToast("error", "Erro ao salvar perfil.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-center">Carregando perfil...</div>;

    const handleCepLookup = async () => {
        const clean = (company.cep || "").replace(/\D/g, "");
        if (clean.length !== 8) return;

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error("CEP não encontrado");
            const data = await response.json();
            setCompany(prev => ({
                ...prev,
                cep: formatCepBr(clean),
                address: `${data.street}, ${data.neighborhood}, ${data.city} - ${data.state}`,
            }));
            showToast("success", "Endereço preenchido pelo CEP.");
        } catch (error) {
            showToast("error", "Não foi possível buscar o CEP. Verifique o número ou tente novamente.");
        }
    };

    const handleConsultCNPJ = async () => {
        const clean = (company.cnpj || "").replace(/\D/g, "");
        if (clean.length !== 14) return;

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
            if (!response.ok) {
                showToast("error", "CNPJ não encontrado ou erro na consulta. Verifique o número ou tente mais tarde.");
                return;
            }

            const data = await response.json();

            if (data.descricao_situacao_cadastral && data.descricao_situacao_cadastral !== "ATIVA") {
                showToast("error", `Atenção: O CNPJ consta como ${data.descricao_situacao_cadastral} na Receita Federal.`);
            } else {
                showToast("success", "Dados preenchidos automaticamente pela Receita.");
            }

            setCompany(prev => ({
                ...prev,
                cnpj: formatCnpjBr(clean),
                companyName: data.razao_social || prev.companyName,
                address: `${data.logradouro}, ${data.bairro}, ${data.municipio} - ${data.uf}`,
                addressNumber: data.numero || prev.addressNumber,
                addressComplement: data.complemento || prev.addressComplement,
                cep: formatCepBr(data.cep || clean.slice(0, 8)),
            }));
        } catch (error) {
            console.error("Erro ao consultar CNPJ:", error);
            showToast("error", "Erro ao consultar CNPJ. Verifique se o número está correto ou tente novamente mais tarde.");
        }
    };

    const handleRemoveMember = (index: number) => {
        const member = teamMembers[index];
        if (!member) return;
        if (member.email === person.email) {
            showToast("error", "Não é possível remover o contato principal.");
            return;
        }
        const confirmed = window.confirm("Deseja remover este funcionário?");
        if (!confirmed) return;
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
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    <button
                        type="button"
                        onClick={() => setProfileType("cpf")}
                        className={`rounded-xl px-3 py-2 transition ${profileType === "cpf" ? "bg-blue-600 text-white shadow-sm" : "text-slate-700"}`}
                    >
                        Sou pessoa física (CPF)
                    </button>
                    <button
                        type="button"
                        onClick={() => setProfileType("cnpj")}
                        className={`rounded-xl px-3 py-2 transition ${profileType === "cnpj" ? "bg-blue-600 text-white shadow-sm" : "text-slate-700"}`}
                    >
                        Sou pessoa jurídica (CNPJ)
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                                {profileType === "cnpj" ? "Associar funcionário" : "Dados pessoais"}
                            </p>
                            <h2 className="text-xl font-semibold text-slate-900">
                                {profileType === "cnpj" ? "Contato principal da empresa" : "Responsável pelas cotações"}
                            </h2>
                            <p className="text-sm text-slate-500">
                                {profileType === "cnpj"
                                    ? "Contato principal (será listado junto com os demais responsáveis)."
                                    : "Campos espelhados nos contratos com fornecedores."}
                            </p>
                        </div>
                        {profileType === "cpf" && (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                CPF + Conta pessoal
                            </span>
                        )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4">
                        {(["name", "email", "phone", "cpf", "role"] as const).map((field) => (
                            <label key={field} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {field === "name"
                                    ? "Nome completo"
                                    : field === "email"
                                        ? "Email corporativo"
                                        : field === "phone"
                                            ? "Telefone/WhatsApp"
                                            : field === "cpf"
                                                ? "CPF"
                                                : "Cargo/Setor"}
                                <input
                                    value={person[field]}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setPerson({
                                            ...person,
                                            [field]: field === "phone"
                                                ? formatPhoneBr(value)
                                                : field === "cpf"
                                                    ? formatCpfBr(value)
                                                    : value,
                                        });
                                    }}
                                    disabled={field === "email"}
                                    className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none disabled:opacity-60"
                                />
                            </label>
                        ))}
                    </div>

                    {profileType === "cnpj" && (
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={handleAddPersonAsMember}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Adicionar funcionário
                            </button>
                        </div>
                    )}
                </div>

                {profileType === "cnpj" && (
                    <>
                        <div className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                                        Dados da empresa
                                    </p>
                                    <h2 className="text-xl font-semibold text-slate-900">
                                        Garantia de confidencialidade
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        CNPJ vinculado ao contrato mestre com a Cotar & Construir.
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-slate-900/90 px-4 py-2 text-right text-xs text-white">
                                    <p className="font-semibold">{company.obras} obras</p>
                                    <p>ativos vinculados</p>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Razão Social
                                    <input
                                        value={company.companyName}
                                        onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                                        className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                    />
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    CNPJ
                                    <input
                                        value={company.cnpj}
                                        onChange={(e) => setCompany({ ...company, cnpj: formatCnpjBr(e.target.value) })}
                                        onBlur={handleConsultCNPJ}
                                        className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                        placeholder="00.000.000/0000-00"
                                    />
                                    <p className="mt-1 text-[11px] text-slate-500">Busca automática na Receita ao sair do campo.</p>
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    CEP
                                    <input
                                        value={company.cep}
                                        onChange={(e) => setCompany({ ...company, cep: formatCepBr(e.target.value) })}
                                        onBlur={handleCepLookup}
                                        className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                        placeholder="00000-000"
                                    />
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Endereço da Sede
                                    <input
                                        value={company.address}
                                        onChange={(e) => setCompany({ ...company, address: e.target.value })}
                                        className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                        placeholder="Rua, Número, Bairro, Cidade - UF"
                                    />
                                </label>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Número
                                        <input
                                            value={company.addressNumber}
                                            onChange={(e) => setCompany({ ...company, addressNumber: e.target.value })}
                                            className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                            placeholder="Ex: 123"
                                        />
                                    </label>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Complemento
                                        <input
                                            value={company.addressComplement}
                                            onChange={(e) => setCompany({ ...company, addressComplement: e.target.value })}
                                            className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                            placeholder="Apto, sala, bloco..."
                                        />
                                    </label>
                                </div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Função no processo
                                    <input
                                        value={company.role}
                                        onChange={(e) => setCompany({ ...company, role: e.target.value })}
                                        className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                    />
                                </label>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Obras vinculadas
                                    <input
                                        value={company.obras}
                                        onChange={(e) =>
                                            setCompany({ ...company, obras: Number(e.target.value) })
                                        }
                                        type="number"
                                        className="mt-2 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
                                    />
                                </label>

                            </div>
                        </div>

                        <div className="rounded-[28px] border border-slate-100 bg-white/80 p-6 shadow-sm lg:col-span-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Funcionários</p>
                                    <h3 className="text-lg font-semibold text-slate-900">Equipe cadastrada</h3>
                                    <p className="text-sm text-slate-500">Lista dos funcionários com acesso às cotações.</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <label className="font-semibold">Ordenar por</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as "name" | "role")}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                                    >
                                        <option value="name">Nome</option>
                                        <option value="role">Cargo</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setSortDir((prev) => prev === "asc" ? "desc" : "asc")}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                                    >
                                        {sortDir === "asc" ? "A→Z" : "Z→A"}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 overflow-x-auto">
                                <table className="min-w-full border-collapse text-sm text-slate-800">
                                    <thead>
                                        <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <th className="px-3 py-2">Nome</th>
                                            <th className="px-3 py-2">Email</th>
                                            <th className="px-3 py-2">Telefone</th>
                                            <th className="px-3 py-2">Cargo/Setor</th>
                                            <th className="px-3 py-2 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedMembers.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-3 text-sm text-slate-500" colSpan={5}>
                                                    Nenhum funcionário adicionado ainda.
                                                </td>
                                            </tr>
                                        )}
                                        {sortedMembers.map(({ member, originalIndex }) => {
                                            const isEditing = editingIndex === originalIndex;
                                            const principal = member.email === person.email;
                                            return (
                                                <tr key={`${member.email}-${originalIndex}`} className="border-t border-slate-100">
                                                    <td className="px-3 py-3 font-semibold text-slate-900">
                                                        {isEditing ? (
                                                            <input
                                                                value={editDraft.name}
                                                                onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                                                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span>{member.name}</span>
                                                                {principal && (
                                                                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Contato principal</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-700">
                                                        {isEditing ? (
                                                            <input
                                                                value={editDraft.email}
                                                                onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                                                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                                                            />
                                                        ) : member.email}
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-600">
                                                        {isEditing ? (
                                                            <input
                                                                value={editDraft.phone}
                                                                onChange={(e) => setEditDraft({ ...editDraft, phone: formatPhoneBr(e.target.value) })}
                                                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                                                            />
                                                        ) : (member.phone || "Telefone não informado")}
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-600">
                                                        {isEditing ? (
                                                            <input
                                                                value={editDraft.role}
                                                                onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                                                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                                                            />
                                                        ) : (member.role || "-")}
                                                    </td>
                                                    <td className="px-3 py-3 text-right space-x-2">
                                                        {isEditing ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => saveEdit(originalIndex)}
                                                                    className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                                                >
                                                                    Salvar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEdit}
                                                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEdit(originalIndex)}
                                                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                >
                                                                    Editar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveMember(originalIndex)}
                                                                    className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                                                                    disabled={principal}
                                                                >
                                                                    Excluir
                                                                </button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
