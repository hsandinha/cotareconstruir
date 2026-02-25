'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseAuth';
import { Search, Edit2, Trash2, X, Save, Package, CreditCard, Tags, UserPlus, UserCheck, RefreshCw, Mail, Plus, Eye, MapPin, Phone, Building2, FileText, Globe } from 'lucide-react';
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

function onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
}

function formatTelefoneFixo(value: string): string {
    const digits = onlyDigits(value).slice(0, 10);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

function formatWhatsApp(value: string): string {
    const digits = onlyDigits(value).slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatRegioesAtendimento(value: unknown): string {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined) return '';
    return String(value);
}

function normalizeEmail(value?: string | null): string {
    return (value || '').trim().toLowerCase();
}

interface GrupoInsumo {
    id: string;
    nome: string;
}

interface Fornecedor {
    id: string;
    userId?: string;
    fornecedorUserId?: string | null;
    hasUserAccount?: boolean;
    mustChangePassword?: boolean;
    lastLoginAt?: string | null;
    emailLoginExists?: boolean;
    emailLoginIsFornecedor?: boolean;
    emailLoginUserId?: string | null;
    emailLoginLastLoginAt?: string | null;
    codigo: string;
    razaoSocial: string;
    nomeFantasia: string;
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
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    regioesAtendimento: string;
    prazoEntregaPadrao: number;
    isVerified: boolean;
    status: string;
    rating: number;
    reviewCount: number;
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
    const [grupoSearchQuery, setGrupoSearchQuery] = useState('');
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
                nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
                endereco: data.logradouro || '',
                numero: data.numero || '',
                complemento: data.complemento || prev.complemento || '',
                bairro: data.bairro || '',
                cidade: data.municipio || '',
                estado: data.uf || '',
                cep: data.cep || '',
                fone: data.ddd_telefone_1 ? formatTelefoneFixo(data.ddd_telefone_1) : prev.fone,
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
                f.nomeFantasia.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.contato.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.cidade.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.grupoInsumos.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
            const {
                fornecedores: fornecedoresRaw,
                grupos: gruposRaw,
                users: usersRaw,
                fornecedorGrupos: fornecedorGruposRaw,
                userFornecedorAccess: userFornecedorAccessRaw
            } = await res.json();

            // Mapear dados do Supabase para o formato do componente
            const fornecedoresData: Fornecedor[] = (fornecedoresRaw || []).map((f: any) => {
                // Buscar grupos associados a este fornecedor
                const grupoIds = (fornecedorGruposRaw || [])
                    .filter((fg: any) => fg.fornecedor_id === f.id)
                    .map((fg: any) => fg.grupo_id);

                return {
                    id: f.id,
                    fornecedorUserId: f.user_id || null,
                    codigo: f.codigo || '',
                    razaoSocial: f.razao_social || '',
                    nomeFantasia: f.nome_fantasia || '',
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
                    complemento: f.complemento || '',
                    bairro: f.bairro || '',
                    cidade: f.cidade || '',
                    estado: f.estado || '',
                    cep: f.cep || '',
                    regioesAtendimento: formatRegioesAtendimento(f.regioes_atendimento),
                    prazoEntregaPadrao: Number.isFinite(Number(f.prazo_entrega_padrao)) ? Number(f.prazo_entrega_padrao) : 7,
                    isVerified: Boolean(f.is_verified),
                    status: f.status || 'pending',
                    rating: Number.isFinite(Number(f.rating)) ? Number(f.rating) : 0,
                    reviewCount: Number.isFinite(Number(f.review_count)) ? Number(f.review_count) : 0,
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

            // Criar mapa de usuário por id para enriquecer vínculos N:N
            const userById = new Map<string, { userId: string; mustChangePassword: boolean; lastLoginAt: string | null }>();
            const userByEmail = new Map<string, { userId: string; isFornecedor: boolean; lastLoginAt: string | null }>();
            (usersRaw || []).forEach((user: any) => {
                if (user?.id) {
                    userById.set(user.id, {
                        userId: user.id,
                        mustChangePassword: Boolean(user.must_change_password),
                        lastLoginAt: user.last_login_at || null,
                    });
                }
                const emailKey = normalizeEmail(user?.email);
                if (emailKey && !userByEmail.has(emailKey)) {
                    const isFornecedor = user?.role === 'fornecedor' || user?.roles?.includes?.('fornecedor');
                    userByEmail.set(emailKey, {
                        userId: user.id,
                        isFornecedor: Boolean(isFornecedor),
                        lastLoginAt: user.last_login_at || null,
                    });
                }
            });

            // Criar mapa de fornecedorId -> dados de acesso (legado + N:N)
            const fornecedorUserMap = new Map<string, { userId: string; mustChangePassword: boolean; lastLoginAt: string | null }>();
            (usersRaw || []).forEach((user: any) => {
                if (user.fornecedor_id) {
                    fornecedorUserMap.set(user.fornecedor_id, {
                        userId: user.id,
                        mustChangePassword: Boolean(user.must_change_password),
                        lastLoginAt: user.last_login_at || null,
                    });
                }
            });
            (userFornecedorAccessRaw || []).forEach((link: any) => {
                const fornecedorId = link?.fornecedor_id;
                const userId = link?.user_id;
                if (!fornecedorId || !userId) return;
                if (fornecedorUserMap.has(fornecedorId)) return;
                const userInfo = userById.get(userId);
                if (userInfo) {
                    fornecedorUserMap.set(fornecedorId, userInfo);
                } else {
                    fornecedorUserMap.set(fornecedorId, {
                        userId,
                        mustChangePassword: false,
                        lastLoginAt: null,
                    });
                }
            });

            // Adicionar flag hasUserAccount, userId e metadados de acesso
            const fornecedoresComFlag = fornecedoresData.map(f => ({
                ...f,
                hasUserAccount: fornecedorUserMap.has(f.id),
                userId: fornecedorUserMap.get(f.id)?.userId,
                mustChangePassword: fornecedorUserMap.get(f.id)?.mustChangePassword,
                lastLoginAt: fornecedorUserMap.get(f.id)?.lastLoginAt || null,
                emailLoginExists: Boolean(userByEmail.get(normalizeEmail(f.email))),
                emailLoginIsFornecedor: Boolean(userByEmail.get(normalizeEmail(f.email))?.isFornecedor),
                emailLoginUserId: userByEmail.get(normalizeEmail(f.email))?.userId || null,
                emailLoginLastLoginAt: userByEmail.get(normalizeEmail(f.email))?.lastLoginAt || null,
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

    const validateFornecedorForm = (): boolean => {
        if (!formData.razaoSocial) {
            showToast('error', 'Razão Social é obrigatória');
            return false;
        }
        if (!formData.email) {
            showToast('error', 'Email é obrigatório');
            return false;
        }

        return true;
    };

    const submitFornecedor = async () => {
        if (!validateFornecedorForm()) return;

        try {
            setSaving(true);
            const headers = await getAuthHeaders();
            const prazoEntregaPadrao = Number(formData.prazoEntregaPadrao ?? 7);

            // Preparar dados para o Supabase (snake_case)
            const supabaseData = {
                razao_social: formData.razaoSocial,
                nome_fantasia: formData.nomeFantasia || '',
                cnpj: formData.cnpj || '',
                email: formData.email,
                telefone: formData.fone || '',
                whatsapp: formData.whatsapp || '',
                contato: formData.contato || '',
                cep: formData.cep || '',
                logradouro: formData.endereco || '',
                numero: formData.numero || '',
                complemento: formData.complemento || '',
                bairro: formData.bairro || '',
                cidade: formData.cidade || '',
                estado: formData.estado || '',
                regioes_atendimento: formData.regioesAtendimento || '',
                prazo_entrega_padrao: Number.isFinite(prazoEntregaPadrao) ? prazoEntregaPadrao : 7,
                inscricao_estadual: formData.inscricaoEstadual || '',
                cartao_credito: formData.cartaoCredito || false,
                ativo: formData.ativo ?? true,
            };

            if (editingFornecedor) {
                // Editando fornecedor existente via API
                const res = await fetch('/api/admin/fornecedores', {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        id: editingFornecedor.id,
                        ...supabaseData
                    })
                });
                const payload = await res.json();
                if (!res.ok) {
                    throw new Error(payload.error || 'Erro ao atualizar');
                }

                if (payload.accessCredentialsResent) {
                    showToast('success', 'Fornecedor atualizado. Novas credenciais enviadas para o novo email.');
                } else if (payload.emailLoginSynced) {
                    showToast('success', 'Fornecedor atualizado e email de login sincronizado.');
                } else {
                    showToast('success', 'Fornecedor atualizado com sucesso!');
                }

                if (payload.warning) {
                    showToast('warning', payload.warning);
                }
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
                        const accPayload = await accRes.json();
                        if (accPayload.linkedExistingAccount) {
                            showToast('success', 'Fornecedor criado e vinculado a uma conta de acesso já existente.');
                        } else {
                            showToast('success', 'Fornecedor criado com acesso! Credenciais enviadas por email.');
                        }
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
            showToast('error', error instanceof Error ? error.message : 'Erro ao salvar fornecedor');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!validateFornecedorForm()) return;
        await submitFornecedor();
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
                nomeFantasia: '',
                cnpj: '',
                contato: '',
                inscricaoEstadual: '',
                email: '',
                fone: '',
                whatsapp: '',
                endereco: '',
                numero: '',
                complemento: '',
                bairro: '',
                cidade: '',
                estado: '',
                cep: '',
                regioesAtendimento: '',
                prazoEntregaPadrao: 7,
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
        setGrupoSearchQuery('');
    };

    const closeGruposModal = () => {
        setIsGruposModalOpen(false);
        setSelectedFornecedorGrupos(null);
        setGrupoSearchQuery('');
    };

    const syncFornecedorGrupoIdsLocal = (fornecedorId: string, nextGrupoIds: string[]) => {
        setSelectedFornecedorGrupos(prev =>
            prev && prev.id === fornecedorId
                ? { ...prev, grupoInsumoIds: nextGrupoIds }
                : prev
        );

        const applyUpdate = (list: Fornecedor[]) => list.map(f =>
            f.id === fornecedorId
                ? { ...f, grupoInsumoIds: nextGrupoIds }
                : f
        );

        setFornecedores(prev => applyUpdate(prev));
        setFilteredFornecedores(prev => applyUpdate(prev));
    };

    const handleAddGrupoToFornecedor = async (grupoId: string) => {
        if (!selectedFornecedorGrupos || !grupoId) return;
        if (selectedFornecedorGrupos.grupoInsumoIds?.includes(grupoId)) return;

        try {
            setSaving(true);
            const headers = await getAuthHeaders();

            const res = await fetch('/api/admin/fornecedores', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'addGrupo',
                    fornecedor_id: selectedFornecedorGrupos.id,
                    grupo_id: grupoId
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao adicionar grupo');
            }

            const nextGrupoIds = [...(selectedFornecedorGrupos.grupoInsumoIds || []), grupoId];
            syncFornecedorGrupoIdsLocal(selectedFornecedorGrupos.id, Array.from(new Set(nextGrupoIds)));
        } catch (error) {
            console.error('Erro ao adicionar grupo:', error);
            showToast('error', error instanceof Error ? error.message : 'Erro ao adicionar grupo');
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

            const nextGrupoIds = (selectedFornecedorGrupos.grupoInsumoIds || []).filter(id => id !== grupoId);
            syncFornecedorGrupoIdsLocal(selectedFornecedorGrupos.id, nextGrupoIds);
        } catch (error) {
            console.error('Erro ao remover grupo:', error);
            showToast('error', error instanceof Error ? error.message : 'Erro ao remover grupo');
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

            const payload = await res.json();
            if (payload.linkedExistingAccount) {
                showToast('success', 'Fornecedor vinculado a uma conta existente com sucesso.');
            } else {
                showToast('success', 'Conta criada com sucesso! Credenciais enviadas por email.');
            }
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

    const selectedGrupoIds = new Set(selectedFornecedorGrupos?.grupoInsumoIds || []);
    const normalizedGrupoSearch = grupoSearchQuery.trim().toLowerCase();
    const allAvailableGrupos = grupos
        .filter(g => !selectedGrupoIds.has(g.id))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    const allSelectedGrupos = grupos
        .filter(g => selectedGrupoIds.has(g.id))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    const filteredAvailableGrupos = allAvailableGrupos.filter(g =>
        !normalizedGrupoSearch || g.nome.toLowerCase().includes(normalizedGrupoSearch)
    );
    const filteredSelectedGrupos = allSelectedGrupos.filter(g =>
        !normalizedGrupoSearch || g.nome.toLowerCase().includes(normalizedGrupoSearch)
    );

    const createAccountWillLinkExistingFornecedorLogin = Boolean(
        selectedFornecedorForAccount
        && !selectedFornecedorForAccount.hasUserAccount
        && selectedFornecedorForAccount.emailLoginExists
        && selectedFornecedorForAccount.emailLoginIsFornecedor
    );

    const createAccountEmailBelongsToNonSupplierUser = Boolean(
        selectedFornecedorForAccount
        && !selectedFornecedorForAccount.hasUserAccount
        && selectedFornecedorForAccount.emailLoginExists
        && !selectedFornecedorForAccount.emailLoginIsFornecedor
    );

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
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Conta</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Último login</th>
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
                                            <div>
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
                                        {!fornecedor.hasUserAccount ? (
                                            <span className="text-[11px] text-slate-400">—</span>
                                        ) : (
                                            <span className="text-[11px] text-slate-600">
                                                {fornecedor.lastLoginAt ? formatDate(fornecedor.lastLoginAt) : 'Nunca'}
                                            </span>
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

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Building2 className="w-4 h-4 text-purple-600" />
                                    Cadastro e identificação
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social *</label>
                                        <input
                                            type="text"
                                            value={formData.razaoSocial || ''}
                                            onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Fantasia</label>
                                        <input
                                            type="text"
                                            value={formData.nomeFantasia || ''}
                                            onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
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
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Phone className="w-4 h-4 text-purple-600" />
                                    Contato e operação
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Telefone Fixo</label>
                                        <input
                                            type="text"
                                            value={formData.fone || ''}
                                            onChange={(e) => setFormData({ ...formData, fone: formatTelefoneFixo(e.target.value) })}
                                            inputMode="numeric"
                                            placeholder="(00) 0000-0000"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                                        <input
                                            type="text"
                                            value={formData.whatsapp || ''}
                                            onChange={(e) => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                                            inputMode="numeric"
                                            placeholder="(00) 00000-0000"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Prazo Entrega Padrão (dias)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.prazoEntregaPadrao ?? 7}
                                            onChange={(e) => setFormData({ ...formData, prazoEntregaPadrao: Number(e.target.value || 0) })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Regiões de Atendimento</label>
                                        <textarea
                                            value={formData.regioesAtendimento || ''}
                                            onChange={(e) => setFormData({ ...formData, regioesAtendimento: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                                            placeholder="Ex.: São Paulo, Campinas, ABC Paulista"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <MapPin className="w-4 h-4 text-purple-600" />
                                    Endereço
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Logradouro</label>
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
                                            onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            maxLength={2}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Globe className="w-4 h-4 text-purple-600" />
                                    Opções
                                </div>
                                <div className="flex flex-wrap items-center gap-6">
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
                                        <label className="text-sm font-medium text-slate-700">Fornecedor Ativo (`ativo`)</label>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-slate-50">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xl font-bold text-slate-900">Grupos de Insumos</h3>
                                    <p className="text-sm text-slate-600 truncate">{selectedFornecedorGrupos.razaoSocial}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-semibold">
                                            <Tags className="w-3 h-3" />
                                            {allSelectedGrupos.length} selecionado(s)
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium">
                                            {allAvailableGrupos.length} disponível(is)
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={closeGruposModal} className="p-2 hover:bg-white/80 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                                <p className="text-sm text-violet-900">
                                    <strong>Dica:</strong> Use a busca e clique em <strong>+</strong> para adicionar ou em <strong>Remover</strong> para retirar grupos. As alterações são salvas imediatamente.
                                </p>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={grupoSearchQuery}
                                    onChange={(e) => setGrupoSearchQuery(e.target.value)}
                                    placeholder="Buscar grupo por nome..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                        <h4 className="text-sm font-semibold text-slate-700">Grupos Disponíveis</h4>
                                        <span className="text-xs text-slate-500">
                                            {filteredAvailableGrupos.length}
                                            {normalizedGrupoSearch ? ` de ${allAvailableGrupos.length}` : ''}
                                        </span>
                                    </div>

                                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                        {filteredAvailableGrupos.map((grupo) => (
                                            <div key={grupo.id} className="border border-slate-200 rounded-xl bg-white p-3 flex items-center justify-between gap-3 hover:bg-violet-50 transition-colors">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                                                        <Tags className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 truncate">{grupo.nome}</p>
                                                        <p className="text-[11px] text-slate-500">Clique para adicionar</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleAddGrupoToFornecedor(grupo.id)}
                                                    disabled={saving}
                                                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors shrink-0"
                                                    title="Adicionar grupo"
                                                >
                                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        ))}

                                        {filteredAvailableGrupos.length === 0 && (
                                            <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                                                <Package className="w-9 h-9 mx-auto text-slate-300 mb-2" />
                                                <p className="text-sm font-medium text-slate-700">
                                                    {allAvailableGrupos.length === 0 ? 'Todos os grupos já foram associados' : 'Nenhum grupo encontrado'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {allAvailableGrupos.length === 0 ? 'Remova um grupo à direita para voltar a disponibilizá-lo.' : 'Tente outro termo na busca.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-500">
                                        <h4 className="text-sm font-semibold text-slate-900">Grupos Associados</h4>
                                        <span className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 rounded-full">
                                            {allSelectedGrupos.length}
                                        </span>
                                    </div>

                                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                        {filteredSelectedGrupos.map((grupo) => (
                                            <div key={grupo.id} className="border-2 border-emerald-500 bg-emerald-50 rounded-xl p-3 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">{grupo.nome}</p>
                                                        <p className="text-[11px] text-emerald-700">Associado a este fornecedor</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveGrupoFromFornecedor(grupo.id)}
                                                    disabled={saving}
                                                    className="px-3 py-1.5 text-sm font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors shrink-0"
                                                >
                                                    {saving ? '...' : 'Remover'}
                                                </button>
                                            </div>
                                        ))}

                                        {filteredSelectedGrupos.length === 0 && (
                                            <div className="text-center py-10 border border-dashed border-emerald-200 rounded-xl bg-emerald-50/40">
                                                <Tags className="w-9 h-9 mx-auto text-emerald-300 mb-2" />
                                                <p className="text-sm font-medium text-slate-700">
                                                    {allSelectedGrupos.length === 0 ? 'Nenhum grupo associado' : 'Nenhum associado corresponde à busca'}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {allSelectedGrupos.length === 0 ? 'Use a coluna de grupos disponíveis para adicionar.' : 'Limpe a busca para ver todos os associados.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
                            <div className="text-xs text-slate-500">
                                Total associado: <span className="font-semibold text-slate-700">{allSelectedGrupos.length}</span>
                            </div>
                            <button
                                onClick={closeGruposModal}
                                className="px-6 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors"
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
                                        <p className="font-medium text-blue-900 mb-1">
                                            {createAccountWillLinkExistingFornecedorLogin
                                                ? 'Conta existente identificada para este email:'
                                                : 'Credenciais serão enviadas para:'}
                                        </p>
                                        <p className="text-blue-700">📧 {selectedFornecedorForAccount.email}</p>
                                        <p className="text-blue-700">📱 {selectedFornecedorForAccount.whatsapp}</p>
                                        {createAccountWillLinkExistingFornecedorLogin && (
                                            <p className="mt-2 text-blue-800">
                                                Ao continuar, este fornecedor será apenas associado ao login já existente.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {createAccountWillLinkExistingFornecedorLogin ? (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                    <p className="text-sm text-emerald-800">
                                        A senha atual será mantida. Nenhum reset de senha será feito neste fluxo.
                                    </p>
                                </div>
                            ) : createAccountEmailBelongsToNonSupplierUser ? (
                                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                                    <p className="text-sm text-rose-800">
                                        Este email já pertence a uma conta que não é de fornecedor. Use outro email ou ajuste o usuário em <strong>Gerenciar Usuários</strong>.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm text-amber-800">
                                        <strong>Senha padrão:</strong> 123456
                                        <br />
                                        O fornecedor será solicitado a trocar a senha no primeiro acesso.
                                    </p>
                                </div>
                            )}
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
                                disabled={creatingAccount || createAccountEmailBelongsToNonSupplierUser}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {createAccountWillLinkExistingFornecedorLogin ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                {creatingAccount
                                    ? (createAccountWillLinkExistingFornecedorLogin ? 'Associando...' : 'Criando...')
                                    : (createAccountWillLinkExistingFornecedorLogin ? 'Associar Conta' : 'Criar e Enviar')}
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
                                    {selectedFornecedorDetail.nomeFantasia && (
                                        <p className="text-sm text-slate-500 mt-0.5">{selectedFornecedorDetail.nomeFantasia}</p>
                                    )}
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
                                    <DetailField label="Nome Fantasia" value={selectedFornecedorDetail.nomeFantasia} />
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
                                    <DetailField label="Complemento" value={selectedFornecedorDetail.complemento} />
                                    <DetailField label="Bairro" value={selectedFornecedorDetail.bairro} />
                                    <DetailField label="Cidade / UF" value={selectedFornecedorDetail.cidade ? `${selectedFornecedorDetail.cidade} - ${selectedFornecedorDetail.estado}` : ''} />
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Operação */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Globe className="w-3.5 h-3.5" /> Operação e Atendimento
                                </h4>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                    <DetailField label="Regiões de Atendimento" value={selectedFornecedorDetail.regioesAtendimento} />
                                    <DetailField label="Prazo Entrega Padrão" value={`${selectedFornecedorDetail.prazoEntregaPadrao || 0} dia(s)`} />
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
