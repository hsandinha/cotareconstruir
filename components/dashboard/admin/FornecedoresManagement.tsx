'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Edit2, Trash2, X, Save, Package, CreditCard, Tags, UserPlus, UserCheck, RefreshCw, Mail, Plus } from 'lucide-react';
import { createUserAccount, resetUserPassword } from '@/lib/userAccountService';
import { useToast } from '@/components/ToastProvider';

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
    const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
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

            // Buscar fornecedores, grupos e usuários do Supabase
            const [fornecedoresRes, gruposRes, usersRes, fornecedorGruposRes] = await Promise.all([
                supabase.from('fornecedores').select('*'),
                supabase.from('grupos_insumo').select('*'),
                supabase.from('users').select('id, fornecedor_id'),
                supabase.from('fornecedor_grupo').select('fornecedor_id, grupo_id')
            ]);

            if (fornecedoresRes.error) throw fornecedoresRes.error;
            if (gruposRes.error) throw gruposRes.error;
            if (usersRes.error) throw usersRes.error;
            if (fornecedorGruposRes.error) throw fornecedorGruposRes.error;

            // Mapear dados do Supabase para o formato do componente
            const fornecedoresData: Fornecedor[] = (fornecedoresRes.data || []).map(f => {
                // Buscar grupos associados a este fornecedor
                const grupoIds = (fornecedorGruposRes.data || [])
                    .filter(fg => fg.fornecedor_id === f.id)
                    .map(fg => fg.grupo_id);

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

            const gruposData: GrupoInsumo[] = (gruposRes.data || []).map(g => ({
                id: g.id,
                nome: g.nome || ''
            }));

            // Criar mapa de fornecedorId -> userId para verificar quem tem conta
            const fornecedorUserMap = new Map<string, string>();
            (usersRes.data || []).forEach(user => {
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
                updated_at: new Date().toISOString(),
            };

            if (editingFornecedor) {
                // Editando fornecedor existente
                const { error } = await supabase
                    .from('fornecedores')
                    .update(supabaseData)
                    .eq('id', editingFornecedor.id);

                if (error) throw error;
                showToast('success', 'Fornecedor atualizado com sucesso!');
            } else {
                // Criando novo fornecedor
                const codigo = `F${Date.now().toString().slice(-6)}`;
                const { data: newFornecedor, error } = await supabase
                    .from('fornecedores')
                    .insert({
                        ...supabaseData,
                        codigo,
                        codigo_grupo: '',
                        grupo_insumos: '',
                        created_at: new Date().toISOString(),
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Se marcou para criar acesso junto
                if (createAccessOnSave && formData.email && newFornecedor) {
                    try {
                        await createUserAccount({
                            email: formData.email,
                            entityType: 'fornecedor',
                            entityId: newFornecedor.id,
                            entityName: formData.razaoSocial || '',
                            whatsapp: formData.whatsapp
                        });
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
            // Primeiro remover os grupos associados
            await supabase
                .from('fornecedor_grupo')
                .delete()
                .eq('fornecedor_id', id);

            // Depois remover o fornecedor
            const { error } = await supabase
                .from('fornecedores')
                .delete()
                .eq('id', id);

            if (error) throw error;
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

            // Inserir na tabela de junção fornecedor_grupo
            const { error } = await supabase
                .from('fornecedor_grupo')
                .insert({
                    fornecedor_id: selectedFornecedorGrupos.id,
                    grupo_id: selectedGrupoToAdd
                });

            if (error) throw error;

            // Atualizar timestamp do fornecedor
            await supabase
                .from('fornecedores')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', selectedFornecedorGrupos.id);

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

            // Remover da tabela de junção fornecedor_grupo
            const { error } = await supabase
                .from('fornecedor_grupo')
                .delete()
                .eq('fornecedor_id', selectedFornecedorGrupos.id)
                .eq('grupo_id', grupoId);

            if (error) throw error;

            // Atualizar timestamp do fornecedor
            await supabase
                .from('fornecedores')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', selectedFornecedorGrupos.id);

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
            await createUserAccount({
                email: selectedFornecedorForAccount.email,
                entityType: 'fornecedor',
                entityId: selectedFornecedorForAccount.id,
                entityName: selectedFornecedorForAccount.razaoSocial,
                whatsapp: selectedFornecedorForAccount.whatsapp
            });

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
            await resetUserPassword(fornecedor.userId, 'fornecedor');
            showToast('success', 'Senha resetada! Credenciais enviadas por email.');
        } catch (error: any) {
            showToast('error', error.message || 'Erro ao resetar senha');
        }
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
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-purple-600" />
                                            <div>
                                                <div className="font-medium text-slate-900">{fornecedor.razaoSocial}</div>
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
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openModal(fornecedor)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(fornecedor.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>
    );
}
