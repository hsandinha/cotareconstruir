'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseAuth';
import { Search, Edit2, Trash2, X, Save, Package, CreditCard, Tags, UserPlus, UserCheck, RefreshCw, Mail, Plus, Eye, MapPin, Phone, Building2, FileText, Calendar, Globe, Hash } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

// Helper para obter headers com token (com fallback para localStorage)
async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Tentar Supabase session primeiro
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
            return headers;
        }
    } catch (e) {
        console.warn('Erro ao obter sessão Supabase:', e);
    }

    // Fallback: localStorage (setado pelo login)
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
}

interface GrupoInsumo {
    id: string;
    nome: string;
}

interface Fornecedor {
    id: string;
    userId?: string;
    hasUserAccount?: boolean;
    codigo: string;
    razaoSocial: string;
    codigoGrupo: string;
    grupoInsumos: string;
    grupoInsumoIds?: string[];
    contato: string;
    fone: string;
    whatsapp: string;
    email: string;
    cnpj: string;
    inscricaoEstadual: string;
    endereco: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    cartaoCredito: boolean;
    ativo: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export default function FornecedoresManagement() {
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [filteredFornecedores, setFilteredFornecedores] = useState<Fornecedor[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGruposModalOpen, setIsGruposModalOpen] = useState(false);
    const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
    const [selectedFornecedorDetail, setSelectedFornecedorDetail] = useState<Fornecedor | null>(null);
    const [selectedFornecedorGrupos, setSelectedFornecedorGrupos] = useState<Fornecedor | null>(null);
    const [selectedFornecedorForAccount, setSelectedFornecedorForAccount] = useState<Fornecedor | null>(null);
    const [creatingAccount, setCreatingAccount] = useState(false);
    const { showToast } = useToast();
    const [formData, setFormData] = useState<Partial<Fornecedor>>({});
    const [selectedGrupoToAdd, setSelectedGrupoToAdd] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [createAccessOnSave, setCreateAccessOnSave] = useState(true);
    const [loadingCnpj, setLoadingCnpj] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    // Função para consultar CNPJ
    const handleCnpjLookup = async (cnpj: string) => {
        const clean = cnpj.replace(/\D/g, '');
        if (clean.length !== 14) return;

        setLoadingCnpj(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
            if (!response.ok) throw new Error('CNPJ não encontrado');
            const data = await response.json();

            setFormData(prev => ({
                ...prev,
                razaoSocial: data.razao_social || prev.razaoSocial,
                endereco: data.logradouro || '',
                numero: data.numero || '',
                bairro: data.bairro || '',
                cidade: data.municipio || '',
                estado: data.uf || '',
                cep: data.cep || '',
                fone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.fone,
                email: data.email || prev.email
            }));
            showToast('success', 'Dados preenchidos pelo CNPJ');
        } catch (error) {
            showToast('error', 'CNPJ não encontrado');
        } finally {
            setLoadingCnpj(false);
        }
    };

    // Função para buscar CEP
    const handleCepLookup = async (cep: string) => {
        const clean = cep.replace(/\D/g, '');
        if (clean.length !== 8) return;

        setLoadingCep(true);
        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error('CEP não encontrado');
            const data = await response.json();

            setFormData(prev => ({
                ...prev,
                endereco: data.street || '',
                bairro: data.neighborhood || '',
                cidade: data.city || '',
                estado: data.state || ''
            }));
            showToast('success', 'Endereço preenchido pelo CEP');
        } catch (error) {
            showToast('error', 'CEP não encontrado');
        } finally {
            setLoadingCep(false);
        }
    };

    useEffect(() => {
        loadFornecedores();
    }, []);

    useEffect(() => {
        if (searchQuery) {
            const filtered = fornecedores.filter(f =>
                f.razaoSocial.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.cidade.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.grupoInsumos.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (f.cnpj && f.cnpj.includes(searchQuery))
            );
            setFilteredFornecedores(filtered);
        } else {
            setFilteredFornecedores(fornecedores);
        }
    }, [searchQuery, fornecedores]);

    const loadFornecedores = async () => {
        try {
            setLoading(true);

            const headers = await getAuthHeaders();
            // Se não tem token, não faz a requisição (ex: logout em andamento)
            if (!headers['Authorization']) {
                return;
            }
            const res = await fetch('/api/admin/fornecedores', { headers });
            if (!res.ok) {
                // Se 401, pode ser logout em andamento — não logar erro ruidoso
                if (res.status === 401) {
                    return;
                }
                const err = await res.json();
                throw new Error(err.error || 'Erro ao carregar');
            }
            const { fornecedores: fornecedoresRaw, grupos: gruposRaw, users: usersRaw, fornecedorGrupos: fornecedorGruposRaw } = await res.json();

            // Mapear dados do Supabase para o formato do componente
            const fornecedoresData: Fornecedor[] = (fornecedoresRaw || []).map((f: any) => {
                // Buscar grupos associados a este fornecedor
                const grupoIds = (fornecedorGruposRaw || [])
                    .filter((fg: any) => fg.fornecedor_id === f.id)
                    .map((fg: any) => fg.grupo_id);

                return {
                    id: f.id,
                    codigo: f.codigo || '',
                    razaoSocial: f.razao_social || '',
                    codigoGrupo: f.codigo_grupo || '',
                    grupoInsumos: f.grupo_insumos || '',
                    grupoInsumoIds: grupoIds,
                    contato: f.contato || '',
                    fone: f.telefone || '',
                    whatsapp: f.whatsapp || '',
                    email: f.email || '',
                    cnpj: f.cnpj || '',
                    inscricaoEstadual: f.inscricao_estadual || '',
                    endereco: f.logradouro || '',
                    numero: f.numero || '',
                    bairro: f.bairro || '',
                    cidade: f.cidade || '',
                    estado: f.estado || '',
                    cep: f.cep || '',
                    cartaoCredito: f.cartao_credito || false,
                    ativo: f.ativo ?? true,
                    createdAt: f.created_at,
                    updatedAt: f.updated_at
                };
            });

            const gruposData: GrupoInsumo[] = (gruposRaw || []).map((g: any) => ({
                id: g.id,
                nome: g.nome || ''
            }));

            // Criar mapa de fornecedorId -> userId para verificar quem tem conta
            const fornecedorUserMap = new Map<string, string>();
            (usersRaw || []).forEach((user: any) => {
                if (user.fornecedor_id) {
                    fornecedorUserMap.set(user.fornecedor_id, user.id);
                }
            });

            // Adicionar flag hasUserAccount e userId
            const fornecedoresComFlag = fornecedoresData.map(f => ({
                ...f,
                hasUserAccount: fornecedorUserMap.has(f.id),
                userId: fornecedorUserMap.get(f.id)
            }));

            setFornecedores(fornecedoresComFlag);
            setFilteredFornecedores(fornecedoresComFlag);
            setGrupos(gruposData);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.razaoSocial) {
            showToast('error', 'Razão Social é obrigatória');
            return;
        }
        if (!formData.email) {
            showToast('error', 'Email é obrigatório');
            return;
        }

        try {
            setSaving(true);
            const headers = await getAuthHeaders();

            // Preparar dados para o Supabase (snake_case)
            const supabaseData = {
                razao_social: formData.razaoSocial,
                cnpj: formData.cnpj || '',
                email: formData.email,
                telefone: formData.fone || '',
                whatsapp: formData.whatsapp || '',
                contato: formData.contato || '',
                cep: formData.cep || '',
                logradouro: formData.endereco || '',
                numero: formData.numero || '',
                bairro: formData.bairro || '',
                cidade: formData.cidade || '',
                estado: formData.estado || '',
                inscricao_estadual: formData.inscricaoEstadual || '',
                cartao_credito: formData.cartaoCredito || false,
                ativo: formData.ativo ?? true,
            };

            if (editingFornecedor) {
                // Editando fornecedor existente via API
                const res = await fetch('/api/admin/fornecedores', {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ id: editingFornecedor.id, ...supabaseData })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Erro ao atualizar');
                }
                showToast('success', 'Fornecedor atualizado com sucesso!');
            } else {
                // Criando novo fornecedor via API
                const res = await fetch('/api/admin/fornecedores', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ action: 'create', data: supabaseData })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Erro ao criar');
                }
                const { fornecedor: newFornecedor } = await res.json();

                // Se marcou para criar acesso junto
                if (createAccessOnSave && formData.email && newFornecedor) {
                    try {
                        const accHeaders = await getAuthHeaders();
                        const accRes = await fetch('/api/admin/accounts', {
                            method: 'POST',
                            headers: accHeaders,
                            body: JSON.stringify({
                                email: formData.email,
                                entityType: 'fornecedor',
                                entityId: newFornecedor.id,
                                entityName: formData.razaoSocial || '',
                                whatsapp: formData.whatsapp
                            })
                        });
                        if (!accRes.ok) {
                            const accErr = await accRes.json();
                            throw new Error(accErr.error || 'Erro ao criar acesso');
                        }
                        showToast('success', 'Fornecedor criado com acesso! Credenciais enviadas por email.');
                    } catch (accessError: any) {
                        if (accessError.message?.includes('já possui uma conta')) {
                            showToast('success', 'Fornecedor criado! Email já possui conta no sistema.');
                        } else {
                            showToast('success', 'Fornecedor criado! Erro ao criar acesso: ' + accessError.message);
                        }
                    }
                } else {
                    showToast('success', 'Fornecedor criado com sucesso!');
                }
            }

            loadFornecedores();
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar fornecedor:', error);
            showToast('error', 'Erro ao salvar fornecedor');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este fornecedor?')) return;

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/admin/fornecedores?id=${id}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao excluir');
            }
            loadFornecedores();
        } catch (error) {
            console.error('Erro ao excluir fornecedor:', error);
            showToast('error', 'Erro ao excluir fornecedor');
        }
    };

    const openModal = (fornecedor?: Fornecedor) => {
        if (fornecedor) {
            setEditingFornecedor(fornecedor);
            setFormData(fornecedor);
        } else {
            setEditingFornecedor(null);
            setFormData({
                razaoSocial: '',
                cnpj: '',
                contato: '',
                email: '',
                fone: '',
                whatsapp: '',
                endereco: '',
                bairro: '',
                cidade: '',
                estado: '',
                cep: '',
                ativo: true,
                cartaoCredito: false,
            });
            setCreateAccessOnSave(true);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingFornecedor(null);
        setFormData({});
    };

    const openGruposModal = (fornecedor: Fornecedor) => {
        setSelectedFornecedorGrupos(fornecedor);
        setIsGruposModalOpen(true);
        setSelectedGrupoToAdd('');
    };

    const closeGruposModal = () => {
        setIsGruposModalOpen(false);
        setSelectedFornecedorGrupos(null);
        setSelectedGrupoToAdd('');
    };

    const handleAddGrupoToFornecedor = async () => {
        if (!selectedFornecedorGrupos || !selectedGrupoToAdd) return;

        try {
            setSaving(true);
            const headers = await getAuthHeaders();

            const res = await fetch('/api/admin/fornecedores', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'addGrupo',
                    fornecedor_id: selectedFornecedorGrupos.id,
                    grupo_id: selectedGrupoToAdd
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao adicionar grupo');
            }

            await loadFornecedores();

            // Atualizar o fornecedor selecionado após recarregar
            setTimeout(() => {
                const updated = fornecedores.find(f => f.id === selectedFornecedorGrupos.id);
                if (updated) {
                    setSelectedFornecedorGrupos(updated);
                }
            }, 100);
            setSelectedGrupoToAdd('');
        } catch (error) {
            console.error('Erro ao adicionar grupo:', error);
            showToast('error', 'Erro ao adicionar grupo');
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveGrupoFromFornecedor = async (grupoId: string) => {
        if (!selectedFornecedorGrupos) return;

        try {
            setSaving(true);
            const headers = await getAuthHeaders();

            const res = await fetch('/api/admin/fornecedores', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'removeGrupo',
                    fornecedor_id: selectedFornecedorGrupos.id,
                    grupo_id: grupoId
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao remover grupo');
            }

            await loadFornecedores();

            // Atualizar o fornecedor selecionado após recarregar
            setTimeout(() => {
                const updated = fornecedores.find(f => f.id === selectedFornecedorGrupos.id);
                if (updated) {
                    setSelectedFornecedorGrupos(updated);
                }
            }, 100);
        } catch (error) {
            console.error('Erro ao remover grupo:', error);
            showToast('error', 'Erro ao remover grupo');
        } finally {
            setSaving(false);
        }
    };

    const openCreateAccountModal = (fornecedor: Fornecedor) => {
        setSelectedFornecedorForAccount(fornecedor);
        setIsCreateAccountModalOpen(true);
    };

    const closeCreateAccountModal = () => {
        setIsCreateAccountModalOpen(false);
        setSelectedFornecedorForAccount(null);
    };

    const handleCreateAccount = async () => {
        if (!selectedFornecedorForAccount) return;

        try {
            setCreatingAccount(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/accounts', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email: selectedFornecedorForAccount.email,
                    entityType: 'fornecedor',
                    entityId: selectedFornecedorForAccount.id,
                    entityName: selectedFornecedorForAccount.razaoSocial,
                    whatsapp: selectedFornecedorForAccount.whatsapp
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao criar conta');
            }

            showToast('success', 'Conta criada com sucesso! Credenciais enviadas por email.');
            closeCreateAccountModal();
            loadFornecedores();
        } catch (error: any) {
            showToast('error', error.message || 'Erro ao criar conta');
        } finally {
            setCreatingAccount(false);
        }
    };

    const handleResetPassword = async (fornecedor: Fornecedor) => {
        if (!fornecedor.userId) return;
        if (!confirm(`Resetar senha de ${fornecedor.razaoSocial} para 123456?`)) return;

        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/accounts', {
                method: 'PUT',
                headers,
                body: JSON.stringify({ userId: fornecedor.userId })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao resetar senha');
            }

            showToast('success', 'Senha resetada! Credenciais enviadas por email.');
        } catch (error: any) {
            showToast('error', error.message || 'Erro ao resetar senha');
        }
    };

    const openDetailModal = (fornecedor: Fornecedor) => {
        setSelectedFornecedorDetail(fornecedor);
        setIsDetailModalOpen(true);
    };

    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedFornecedorDetail(null);
    };

    const formatDate = (dateStr: any) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return '—'; }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-12">Carregando fornecedores...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestão de Fornecedores</h2>
                    <p className="text-sm text-slate-600">Gerencie todos os fornecedores cadastrados</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Novo Fornecedor
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por razão social, email, cidade, grupo ou CNPJ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Total de Fornecedores</div>
                    <div className="text-2xl font-bold text-slate-900">{fornecedores.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Fornecedores Ativos</div>
                    <div className="text-2xl font-bold text-green-600">{fornecedores.filter(f => f.ativo).length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Com Cartão de Crédito</div>
                    <div className="text-2xl font-bold text-blue-600">{fornecedores.filter(f => f.cartaoCredito).length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Grupos Únicos</div>
                    <div className="text-2xl font-bold text-purple-600">
                        {new Set(fornecedores.flatMap(f => f.grupoInsumoIds || [])).size}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Razão Social</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Grupo(s)</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Contato</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cidade</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Acesso</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cartão</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredFornecedores.map((fornecedor) => (
                                <tr key={fornecedor.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => openDetailModal(fornecedor)}>
                                            <Package className="w-4 h-4 text-purple-600" />
                                            <div>
                                                <div className="font-medium text-slate-900 group-hover:text-purple-700 transition-colors">{fornecedor.razaoSocial}</div>
                                                <div className="text-xs text-slate-500">{fornecedor.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => openGruposModal(fornecedor)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                                        >
                                            <Tags className="w-4 h-4" />
                                            <span className="font-semibold">{fornecedor.grupoInsumoIds?.length || 0}</span>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-slate-900">{fornecedor.contato}</div>
                                        <div className="text-xs text-slate-500">{fornecedor.whatsapp}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{fornecedor.cidade} - {fornecedor.estado}</td>
                                    <td className="px-4 py-3">
                                        {fornecedor.hasUserAccount ? (
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="w-4 h-4 text-green-600" />
                                                <button
                                                    onClick={() => handleResetPassword(fornecedor)}
                                                    className="text-xs text-blue-600 hover:underline"
                                                    title="Resetar senha"
                                                >
                                                    <RefreshCw className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => openCreateAccountModal(fornecedor)}
                                                className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600"
                                            >
                                                <UserPlus className="w-4 h-4" />
                                                <span>Criar conta</span>
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {fornecedor.cartaoCredito && <CreditCard className="w-4 h-4 text-green-600" />}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${fornecedor.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => openDetailModal(fornecedor)}
                                                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
                                                title="Ver detalhes"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => openModal(fornecedor)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(fornecedor.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-900">
                                {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                            </h3>
                            <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social *</label>
                                    <input
                                        type="text"
                                        value={formData.razaoSocial || ''}
                                        onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.cnpj || ''}
                                            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                                            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="00.000.000/0000-00"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => formData.cnpj && handleCnpjLookup(formData.cnpj)}
                                            disabled={loadingCnpj || !formData.cnpj}
                                            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 disabled:opacity-50 transition-colors"
                                        >
                                            {loadingCnpj ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Inscrição Estadual</label>
                                    <input
                                        type="text"
                                        value={formData.inscricaoEstadual || ''}
                                        onChange={(e) => setFormData({ ...formData, inscricaoEstadual: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contato</label>
                                    <input
                                        type="text"
                                        value={formData.contato || ''}
                                        onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                    <input
                                        type="text"
                                        value={formData.fone || ''}
                                        onChange={(e) => setFormData({ ...formData, fone: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                                    <input
                                        type="text"
                                        value={formData.whatsapp || ''}
                                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.cep || ''}
                                            onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                                            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="00000-000"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => formData.cep && handleCepLookup(formData.cep)}
                                            disabled={loadingCep || !formData.cep}
                                            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 disabled:opacity-50 transition-colors"
                                        >
                                            {loadingCep ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
                                    <input
                                        type="text"
                                        value={formData.endereco || ''}
                                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                                    <input
                                        type="text"
                                        value={formData.numero || ''}
                                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                                    <input
                                        type="text"
                                        value={formData.bairro || ''}
                                        onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                                    <input
                                        type="text"
                                        value={formData.cidade || ''}
                                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                                    <input
                                        type="text"
                                        value={formData.estado || ''}
                                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        maxLength={2}
                                    />
                                </div>
                                <div className="col-span-2 flex flex-wrap items-center gap-6">
                                    {!editingFornecedor && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={createAccessOnSave}
                                                onChange={(e) => setCreateAccessOnSave(e.target.checked)}
                                                className="rounded text-purple-600"
                                            />
                                            <label className="text-sm font-medium text-purple-700">
                                                Criar acesso ao sistema automaticamente
                                            </label>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.cartaoCredito ?? false}
                                            onChange={(e) => setFormData({ ...formData, cartaoCredito: e.target.checked })}
                                            className="rounded text-blue-600"
                                        />
                                        <label className="text-sm font-medium text-slate-700">Aceita Cartão</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.ativo ?? true}
                                            onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                            className="rounded text-blue-600"
                                        />
                                        <label className="text-sm font-medium text-slate-700">Fornecedor Ativo</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {editingFornecedor ? 'Salvar' : 'Criar Fornecedor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Grupos */}
            {isGruposModalOpen && selectedFornecedorGrupos && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Grupos de Insumos</h3>
                                <p className="text-sm text-slate-600">{selectedFornecedorGrupos.razaoSocial}</p>
                            </div>
                            <button onClick={closeGruposModal} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Lista de grupos associados */}
                            <div>
                                <h4 className="font-semibold text-slate-800 mb-3">Grupos Associados ({selectedFornecedorGrupos.grupoInsumoIds?.length || 0})</h4>
                                {selectedFornecedorGrupos.grupoInsumoIds && selectedFornecedorGrupos.grupoInsumoIds.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {selectedFornecedorGrupos.grupoInsumoIds.map((grupoId) => {
                                            const grupo = grupos.find(g => g.id === grupoId);
                                            return grupo ? (
                                                <div key={grupoId} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <Tags className="w-4 h-4 text-purple-600" />
                                                        <span className="text-sm font-medium text-slate-900">{grupo.nome}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveGrupoFromFornecedor(grupoId)}
                                                        disabled={saving}
                                                        className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-sm mb-4">Nenhum grupo associado</p>
                                )}
                            </div>

                            {/* Adicionar novo grupo */}
                            <div className="border-t border-slate-200 pt-4">
                                <h4 className="font-semibold text-slate-800 mb-3">Adicionar Grupo</h4>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedGrupoToAdd}
                                        onChange={(e) => setSelectedGrupoToAdd(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="">Selecione um grupo</option>
                                        {grupos
                                            .filter(g => !selectedFornecedorGrupos.grupoInsumoIds?.includes(g.id))
                                            .sort((a, b) => a.nome.localeCompare(b.nome))
                                            .map(grupo => (
                                                <option key={grupo.id} value={grupo.id}>
                                                    {grupo.nome}
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        onClick={handleAddGrupoToFornecedor}
                                        disabled={!selectedGrupoToAdd || saving}
                                        className="px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                            <button
                                onClick={closeGruposModal}
                                className="px-6 py-2 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Criar Conta */}
            {isCreateAccountModalOpen && selectedFornecedorForAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Criar Conta de Acesso</h3>
                                <p className="text-sm text-slate-600">{selectedFornecedorForAccount.razaoSocial}</p>
                            </div>
                            <button onClick={closeCreateAccountModal} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium text-blue-900 mb-1">Credenciais serão enviadas para:</p>
                                        <p className="text-blue-700">📧 {selectedFornecedorForAccount.email}</p>
                                        <p className="text-blue-700">📱 {selectedFornecedorForAccount.whatsapp}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800">
                                    <strong>Senha padrão:</strong> 123456
                                    <br />
                                    O fornecedor será solicitado a trocar a senha no primeiro acesso.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                            <button
                                onClick={closeCreateAccountModal}
                                disabled={creatingAccount}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateAccount}
                                disabled={creatingAccount}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                <UserPlus className="w-4 h-4" />
                                {creatingAccount ? 'Criando...' : 'Criar e Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalhes do Fornecedor */}
            {isDetailModalOpen && selectedFornecedorDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-start justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-slate-50">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{selectedFornecedorDetail.razaoSocial}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${selectedFornecedorDetail.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                            {selectedFornecedorDetail.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                        {selectedFornecedorDetail.hasUserAccount ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                                <UserCheck className="w-3 h-3" /> Com acesso
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                                <UserPlus className="w-3 h-3" /> Sem acesso
                                            </span>
                                        )}
                                        {selectedFornecedorDetail.cartaoCredito && (
                                            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                                <CreditCard className="w-3 h-3" /> Cartão
                                            </span>
                                        )}
                                        {selectedFornecedorDetail.codigo && (
                                            <span className="text-xs text-slate-500">Cód: {selectedFornecedorDetail.codigo}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={closeDetailModal} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Documentos */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5" /> Documentos
                                </h4>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                    <DetailField label="CNPJ" value={selectedFornecedorDetail.cnpj} />
                                    <DetailField label="Inscrição Estadual" value={selectedFornecedorDetail.inscricaoEstadual} />
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Contato */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Phone className="w-3.5 h-3.5" /> Contato
                                </h4>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                    <DetailField label="Nome do Contato" value={selectedFornecedorDetail.contato} />
                                    <DetailField label="Email" value={selectedFornecedorDetail.email} copyable />
                                    <DetailField label="Telefone" value={selectedFornecedorDetail.fone} />
                                    <DetailField label="WhatsApp" value={selectedFornecedorDetail.whatsapp} />
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Endereço */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5" /> Endereço
                                </h4>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                    <DetailField label="CEP" value={selectedFornecedorDetail.cep} />
                                    <DetailField label="Logradouro" value={selectedFornecedorDetail.endereco ? `${selectedFornecedorDetail.endereco}${selectedFornecedorDetail.numero ? `, ${selectedFornecedorDetail.numero}` : ''}` : ''} />
                                    <DetailField label="Bairro" value={selectedFornecedorDetail.bairro} />
                                    <DetailField label="Cidade / UF" value={selectedFornecedorDetail.cidade ? `${selectedFornecedorDetail.cidade} - ${selectedFornecedorDetail.estado}` : ''} />
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Grupos de Insumo */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Tags className="w-3.5 h-3.5" /> Grupos de Insumo ({selectedFornecedorDetail.grupoInsumoIds?.length || 0})
                                </h4>
                                {selectedFornecedorDetail.grupoInsumoIds && selectedFornecedorDetail.grupoInsumoIds.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedFornecedorDetail.grupoInsumoIds.map((grupoId) => {
                                            const grupo = grupos.find(g => g.id === grupoId);
                                            return grupo ? (
                                                <span key={grupoId} className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 text-xs font-medium">
                                                    <Tags className="w-3 h-3" />
                                                    {grupo.nome}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">Nenhum grupo associado</p>
                                )}
                            </div>

                            <hr className="border-slate-100" />

                            {/* Sistema */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5" /> Informações do Sistema
                                </h4>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                    <DetailField label="ID" value={selectedFornecedorDetail.id} mono />
                                    <DetailField label="Código" value={selectedFornecedorDetail.codigo} />
                                    <DetailField label="Cadastrado em" value={formatDate(selectedFornecedorDetail.createdAt)} />
                                    <DetailField label="Última atualização" value={formatDate(selectedFornecedorDetail.updatedAt)} />
                                    <DetailField label="User ID" value={selectedFornecedorDetail.userId || '—'} mono />
                                    <DetailField label="Aceita Cartão" value={selectedFornecedorDetail.cartaoCredito ? 'Sim' : 'Não'} />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                            <div className="text-xs text-slate-400">
                                ID: {selectedFornecedorDetail.id.slice(0, 8)}...
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        closeDetailModal();
                                        openModal(selectedFornecedorDetail);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" /> Editar
                                </button>
                                <button
                                    onClick={closeDetailModal}
                                    className="px-5 py-2 text-sm bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* Sub-componente para exibir campo de detalhe */
function DetailField({ label, value, copyable, mono }: { label: string; value?: string; copyable?: boolean; mono?: boolean }) {
    const displayValue = value || '—';
    const isEmpty = !value || value === '—';

    const handleCopy = () => {
        if (value && !isEmpty) {
            navigator.clipboard.writeText(value);
        }
    };

    return (
        <div className="py-1">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className={`text-sm mt-0.5 flex items-center gap-1.5 ${isEmpty ? 'text-slate-300 italic' : 'text-slate-900'
                } ${mono && !isEmpty ? 'font-mono text-xs bg-slate-50 px-2 py-0.5 rounded' : ''}`}>
                {displayValue}
                {copyable && !isEmpty && (
                    <button
                        onClick={handleCopy}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copiar"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                        </svg>
                    </button>
                )}
            </dd>
        </div>
    );
}
