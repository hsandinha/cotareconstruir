'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Plus, Edit2, Trash2, X, Save, Building2, UserPlus, UserCheck, RefreshCw, Mail, Briefcase, Layers, ChevronDown, ChevronRight, MapPin, Calendar } from 'lucide-react';
import { createUserAccount, resetUserPassword } from '@/lib/userAccountService';
import { useToast } from '@/components/ToastProvider';

interface Obra {
    id: string;
    obra: string;
    endereco: string;
    bairro: string;
    cidade: string;
    etapa: string;
    dataInicio: string;
    previsaoTermino: string;
    stages?: Array<{
        stageId: string;
        stageName: string;
        predictedDate: string;
        endDate?: string;
        status: string;
    }>;
}

interface Cliente {
    id: string;
    userId?: string;
    hasUserAccount?: boolean;
    nome: string;
    cpf?: string;
    cnpj?: string;
    email: string;
    telefone: string;
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    ativo: boolean;
    obras?: number;
    createdAt?: any;
    updatedAt?: any;
}

export default function ClientesManagement() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
    const [isObrasModalOpen, setIsObrasModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
    const [selectedClienteForAccount, setSelectedClienteForAccount] = useState<Cliente | null>(null);
    const [selectedClienteForObras, setSelectedClienteForObras] = useState<Cliente | null>(null);
    const [clienteObras, setClienteObras] = useState<Obra[]>([]);
    const [loadingObras, setLoadingObras] = useState(false);
    const [expandedObras, setExpandedObras] = useState<Record<string, boolean>>({});
    const [obrasByClienteId, setObrasByClienteId] = useState<Record<string, Obra[]>>({});
    const [creatingAccount, setCreatingAccount] = useState(false);
    const { showToast } = useToast();
    const [formData, setFormData] = useState<Partial<Cliente>>({
        nome: '',
        email: '',
        telefone: '',
        endereco: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: '',
        ativo: true,
    });
    const [createAccessOnSave, setCreateAccessOnSave] = useState(true); // Criar acesso junto com o cliente
    const [loadingCep, setLoadingCep] = useState(false);
    const [loadingCnpj, setLoadingCnpj] = useState(false);

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
                nome: data.razao_social || prev.nome,
                endereco: `${data.logradouro || ''}, ${data.numero || ''}`,
                bairro: data.bairro || '',
                cidade: data.municipio || '',
                estado: data.uf || '',
                cep: data.cep || '',
                telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : prev.telefone
            }));
            showToast('success', 'Dados preenchidos pelo CNPJ');
        } catch (error) {
            showToast('error', 'CNPJ não encontrado');
        } finally {
            setLoadingCnpj(false);
        }
    };

    useEffect(() => {
        loadClientes();
    }, []);

    useEffect(() => {
        if (searchQuery) {
            const filtered = clientes.filter(c =>
                c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.cidade.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.cpf && c.cpf.includes(searchQuery)) ||
                (c.cnpj && c.cnpj.includes(searchQuery))
            );
            setFilteredClientes(filtered);
        } else {
            setFilteredClientes(clientes);
        }
    }, [searchQuery, clientes]);

    const loadClientes = async () => {
        try {
            setLoading(true);

            // Carregar clientes
            const clientesSnapshot = await getDocs(collection(db, 'clientes'));
            const clientesData = clientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Cliente[];

            // Carregar todas as obras
            const obrasSnapshot = await getDocs(collection(db, 'works'));
            const obrasData = obrasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Obra & { userId?: string })[];

            // Criar mapa de obras por userId
            const obrasByUserId: Record<string, Obra[]> = {};
            obrasData.forEach(obra => {
                if (obra.userId) {
                    if (!obrasByUserId[obra.userId]) {
                        obrasByUserId[obra.userId] = [];
                    }
                    obrasByUserId[obra.userId].push(obra);
                }
            });

            // Mapear obras por clienteId (através do userId do cliente)
            const obrasByCliente: Record<string, Obra[]> = {};
            clientesData.forEach(cliente => {
                if (cliente.userId && obrasByUserId[cliente.userId]) {
                    obrasByCliente[cliente.id] = obrasByUserId[cliente.userId];
                }
            });

            setObrasByClienteId(obrasByCliente);
            setClientes(clientesData);
            setFilteredClientes(clientesData);
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.nome || !formData.email) {
            showToast('error', 'Nome e email são obrigatórios');
            return;
        }

        try {
            if (editingCliente) {
                // Editando cliente existente
                await updateDoc(doc(db, 'clientes', editingCliente.id), {
                    ...formData,
                    updatedAt: new Date(),
                });
                showToast('success', 'Cliente atualizado com sucesso!');
            } else {
                // Criando novo cliente
                const clienteRef = await addDoc(collection(db, 'clientes'), {
                    ...formData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                // Se marcou para criar acesso junto
                if (createAccessOnSave && formData.email) {
                    try {
                        await createUserAccount({
                            email: formData.email,
                            entityType: 'cliente',
                            entityId: clienteRef.id,
                            entityName: formData.nome || '',
                            whatsapp: formData.telefone
                        });
                        showToast('success', 'Cliente criado com acesso! Credenciais enviadas por email.');
                    } catch (accessError: any) {
                        if (accessError.message?.includes('já possui uma conta')) {
                            showToast('success', 'Cliente criado! Email já possui conta no sistema.');
                        } else {
                            showToast('success', 'Cliente criado! Erro ao criar acesso: ' + accessError.message);
                        }
                    }
                } else {
                    showToast('success', 'Cliente criado com sucesso!');
                }
            }
            loadClientes();
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            showToast('error', 'Erro ao salvar cliente');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este cliente?')) return;

        try {
            await deleteDoc(doc(db, 'clientes', id));
            loadClientes();
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
        }
    };

    const openModal = (cliente?: Cliente) => {
        if (cliente) {
            setEditingCliente(cliente);
            setFormData(cliente);
            setCreateAccessOnSave(false); // Ao editar, não criar acesso
        } else {
            setEditingCliente(null);
            setFormData({
                nome: '',
                email: '',
                telefone: '',
                endereco: '',
                numero: '',
                bairro: '',
                cidade: '',
                estado: '',
                cep: '',
                ativo: true,
            });
            setCreateAccessOnSave(true); // Ao criar, criar acesso por padrão
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCliente(null);
        setFormData({});
    };

    const openObrasModal = (cliente: Cliente) => {
        setSelectedClienteForObras(cliente);
        setClienteObras(obrasByClienteId[cliente.id] || []);
        setExpandedObras({});
        setIsObrasModalOpen(true);
    };

    const closeObrasModal = () => {
        setIsObrasModalOpen(false);
        setSelectedClienteForObras(null);
        setClienteObras([]);
    };

    const toggleObraExpanded = (obraId: string) => {
        setExpandedObras(prev => ({
            ...prev,
            [obraId]: !prev[obraId]
        }));
    };
    const openCreateAccountModal = (cliente: Cliente) => {
        setSelectedClienteForAccount(cliente);
        setIsCreateAccountModalOpen(true);
    };

    const closeCreateAccountModal = () => {
        setIsCreateAccountModalOpen(false);
        setSelectedClienteForAccount(null);
    };

    const handleCreateAccount = async () => {
        if (!selectedClienteForAccount) return;

        try {
            setCreatingAccount(true);
            await createUserAccount({
                email: selectedClienteForAccount.email,
                entityType: 'cliente',
                entityId: selectedClienteForAccount.id,
                entityName: selectedClienteForAccount.nome,
                whatsapp: selectedClienteForAccount.telefone
            });

            showToast('success', 'Conta criada com sucesso! Credenciais enviadas por email.');
            closeCreateAccountModal();
            loadClientes();
        } catch (error: any) {
            showToast('error', error.message || 'Erro ao criar conta');
        } finally {
            setCreatingAccount(false);
        }
    };

    const handleResetPassword = async (cliente: Cliente) => {
        if (!cliente.userId) return;
        if (!confirm(`Resetar senha de ${cliente.nome} para 123456?`)) return;

        try {
            await resetUserPassword(cliente.userId, 'cliente');
            showToast('success', 'Senha resetada! Credenciais enviadas por email.');
        } catch (error: any) {
            showToast('error', error.message || 'Erro ao resetar senha');
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-12">Carregando clientes...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestão de Clientes</h2>
                    <p className="text-sm text-slate-600">Gerencie todos os clientes cadastrados</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Novo Cliente
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome, email, cidade, CPF ou CNPJ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Total de Clientes</div>
                    <div className="text-2xl font-bold text-slate-900">{clientes.length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Clientes Ativos</div>
                    <div className="text-2xl font-bold text-green-600">{clientes.filter(c => c.ativo).length}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-600">Clientes Inativos</div>
                    <div className="text-2xl font-bold text-slate-400">{clientes.filter(c => !c.ativo).length}</div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Nome</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Telefone</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cidade</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Obras</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Acesso</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClientes.map((cliente) => {
                                const obrasCount = obrasByClienteId[cliente.id]?.length || 0;
                                return (
                                    <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-blue-600" />
                                                <span className="font-medium text-slate-900">{cliente.nome}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{cliente.email}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{cliente.telefone}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{cliente.cidade} - {cliente.estado}</td>
                                        <td className="px-4 py-3">
                                            {obrasCount > 0 ? (
                                                <button
                                                    onClick={() => openObrasModal(cliente)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                                                >
                                                    <Briefcase className="w-4 h-4" />
                                                    <span className="font-semibold">{obrasCount}</span>
                                                </button>
                                            ) : (
                                                <span className="text-sm text-slate-400">0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {cliente.hasUserAccount ? (
                                                <div className="flex items-center gap-2">
                                                    <UserCheck className="w-4 h-4 text-green-600" />
                                                    <button
                                                        onClick={() => handleResetPassword(cliente)}
                                                        className="text-xs text-blue-600 hover:underline"
                                                        title="Resetar senha"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => openCreateAccountModal(cliente)}
                                                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600"
                                                >
                                                    <UserPlus className="w-4 h-4" />
                                                    <span>Criar conta</span>
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${cliente.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {cliente.ativo ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openModal(cliente)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cliente.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <h3 className="text-xl font-bold text-slate-900">
                                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
                            </h3>
                            <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                                    <input
                                        type="text"
                                        value={formData.nome || ''}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                    <input
                                        type="text"
                                        value={formData.telefone || ''}
                                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                                    <input
                                        type="text"
                                        value={formData.cpf || ''}
                                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                                        placeholder="000.000.000-00"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.cnpj || ''}
                                            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                                            onBlur={(e) => handleCnpjLookup(e.target.value)}
                                            placeholder="00.000.000/0000-00"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        {loadingCnpj && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Preenche automaticamente ao sair do campo</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.cep || ''}
                                            onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                                            onBlur={(e) => handleCepLookup(e.target.value)}
                                            placeholder="00000-000"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        {loadingCep && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Preenche endereço automaticamente</p>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                                    <input
                                        type="text"
                                        value={formData.complemento || ''}
                                        onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
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
                                    <select
                                        value={formData.estado || ''}
                                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Selecione</option>
                                        <option value="AC">AC</option>
                                        <option value="AL">AL</option>
                                        <option value="AP">AP</option>
                                        <option value="AM">AM</option>
                                        <option value="BA">BA</option>
                                        <option value="CE">CE</option>
                                        <option value="DF">DF</option>
                                        <option value="ES">ES</option>
                                        <option value="GO">GO</option>
                                        <option value="MA">MA</option>
                                        <option value="MT">MT</option>
                                        <option value="MS">MS</option>
                                        <option value="MG">MG</option>
                                        <option value="PA">PA</option>
                                        <option value="PB">PB</option>
                                        <option value="PR">PR</option>
                                        <option value="PE">PE</option>
                                        <option value="PI">PI</option>
                                        <option value="RJ">RJ</option>
                                        <option value="RN">RN</option>
                                        <option value="RS">RS</option>
                                        <option value="RO">RO</option>
                                        <option value="RR">RR</option>
                                        <option value="SC">SC</option>
                                        <option value="SP">SP</option>
                                        <option value="SE">SE</option>
                                        <option value="TO">TO</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.ativo ?? true}
                                        onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                        className="rounded text-blue-600"
                                    />
                                    <label className="text-sm font-medium text-slate-700">Cliente Ativo</label>
                                </div>

                                {/* Opção de criar acesso - apenas para novos clientes */}
                                {!editingCliente && (
                                    <div className="col-span-2 mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                id="createAccess"
                                                checked={createAccessOnSave}
                                                onChange={(e) => setCreateAccessOnSave(e.target.checked)}
                                                className="mt-1 rounded text-blue-600"
                                            />
                                            <div>
                                                <label htmlFor="createAccess" className="text-sm font-medium text-blue-900 cursor-pointer">
                                                    Criar acesso ao sistema
                                                </label>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Cria automaticamente um login para o cliente acessar o sistema.
                                                    <br />
                                                    Senha padrão: <strong>123456</strong> (será solicitado trocar no primeiro acesso)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Criar Conta */}
            {isCreateAccountModalOpen && selectedClienteForAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Criar Conta de Acesso</h3>
                                <p className="text-sm text-slate-600">{selectedClienteForAccount.nome}</p>
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
                                        <p className="text-blue-700">📧 {selectedClienteForAccount.email}</p>
                                        <p className="text-blue-700">📱 {selectedClienteForAccount.telefone}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-800">
                                    <strong>Senha padrão:</strong> 123456
                                    <br />
                                    O cliente será solicitado a trocar a senha no primeiro acesso.
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

            {/* Modal Obras do Cliente */}
            {isObrasModalOpen && selectedClienteForObras && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Obras do Cliente</h3>
                                <p className="text-sm text-slate-600">{selectedClienteForObras.nome}</p>
                            </div>
                            <button onClick={closeObrasModal} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {clienteObras.length === 0 ? (
                                <div className="text-center py-12">
                                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500">Nenhuma obra cadastrada para este cliente</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {clienteObras.map((obra) => (
                                        <div key={obra.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                            {/* Header da Obra */}
                                            <button
                                                onClick={() => toggleObraExpanded(obra.id)}
                                                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Briefcase className="w-5 h-5 text-amber-600" />
                                                    <div className="text-left">
                                                        <h4 className="font-semibold text-slate-900">{obra.obra}</h4>
                                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-3 h-3" />
                                                                {obra.bairro}, {obra.cidade}
                                                            </span>
                                                            {obra.etapa && (
                                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                                    {obra.etapa}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                                                        {obra.stages?.length || 0} fases
                                                    </span>
                                                    {expandedObras[obra.id] ? (
                                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                                    ) : (
                                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                                    )}
                                                </div>
                                            </button>

                                            {/* Detalhes da Obra (expandido) */}
                                            {expandedObras[obra.id] && (
                                                <div className="p-4 border-t border-slate-200 bg-white">
                                                    {/* Info da obra */}
                                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                                        <div className="text-sm">
                                                            <span className="text-slate-500">Endereço:</span>
                                                            <p className="text-slate-700">{obra.endereco}, {obra.bairro}</p>
                                                        </div>
                                                        {obra.dataInicio && (
                                                            <div className="text-sm">
                                                                <span className="text-slate-500">Início:</span>
                                                                <p className="text-slate-700">{new Date(obra.dataInicio).toLocaleDateString('pt-BR')}</p>
                                                            </div>
                                                        )}
                                                        {obra.previsaoTermino && (
                                                            <div className="text-sm">
                                                                <span className="text-slate-500">Previsão término:</span>
                                                                <p className="text-slate-700">{new Date(obra.previsaoTermino).toLocaleDateString('pt-BR')}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Fases */}
                                                    <div className="mt-4">
                                                        <h5 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                                                            <Layers className="w-4 h-4 text-indigo-600" />
                                                            Fases da Obra
                                                        </h5>
                                                        {obra.stages && obra.stages.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {obra.stages.map((stage, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={`flex items-center justify-between p-3 rounded-lg border ${stage.status === 'completed'
                                                                                ? 'bg-green-50 border-green-200'
                                                                                : stage.status === 'in_progress'
                                                                                    ? 'bg-blue-50 border-blue-200'
                                                                                    : 'bg-slate-50 border-slate-200'
                                                                            }`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-2 h-2 rounded-full ${stage.status === 'completed'
                                                                                    ? 'bg-green-500'
                                                                                    : stage.status === 'in_progress'
                                                                                        ? 'bg-blue-500'
                                                                                        : 'bg-slate-400'
                                                                                }`} />
                                                                            <span className="font-medium text-sm text-slate-800">
                                                                                {stage.stageName}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                                                            <span className="flex items-center gap-1">
                                                                                <Calendar className="w-3 h-3" />
                                                                                {stage.predictedDate ? new Date(stage.predictedDate).toLocaleDateString('pt-BR') : '-'}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 rounded ${stage.status === 'completed'
                                                                                    ? 'bg-green-100 text-green-700'
                                                                                    : stage.status === 'in_progress'
                                                                                        ? 'bg-blue-100 text-blue-700'
                                                                                        : 'bg-slate-100 text-slate-600'
                                                                                }`}>
                                                                                {stage.status === 'completed' ? 'Concluída' : stage.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-slate-400 italic">Nenhuma fase cadastrada</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end p-4 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={closeObrasModal}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
