'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Plus, Edit2, Trash2, X, Save, Building2, UserPlus, UserCheck, RefreshCw, Mail } from 'lucide-react';
import { createUserAccount, resetUserPassword } from '@/lib/userAccountService';
import { useToast } from '@/components/ToastProvider';

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
    const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
    const [selectedClienteForAccount, setSelectedClienteForAccount] = useState<Cliente | null>(null);
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
            const snapshot = await getDocs(collection(db, 'clientes'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Cliente[];
            setClientes(data);
            setFilteredClientes(data);
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.nome || !formData.email) {
            alert('Nome e email são obrigatórios');
            return;
        }

        try {
            if (editingCliente) {
                await updateDoc(doc(db, 'clientes', editingCliente.id), {
                    ...formData,
                    updatedAt: new Date(),
                });
            } else {
                await addDoc(collection(db, 'clientes'), {
                    ...formData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
            loadClientes();
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
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
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCliente(null);
        setFormData({});
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
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Acesso</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClientes.map((cliente) => (
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
                            ))}
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
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                    <input
                                        type="text"
                                        value={formData.cnpj || ''}
                                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
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
                                    <input
                                        type="text"
                                        value={formData.estado || ''}
                                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        maxLength={2}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                                    <input
                                        type="text"
                                        value={formData.cep || ''}
                                        onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
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
        </div>
    );
}
