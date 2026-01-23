'use client';

import { useState, useEffect } from 'react';
import { X, Building2, User, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import {
    completeClienteProfile,
    completeFornecedorProfile,
    checkProfileLinkStatus,
    ClienteMinimalData,
    FornecedorMinimalData
} from '@/lib/profileLinkService';
import { formatCnpjBr, formatCpfBr, formatPhoneBr, formatCepBr, isValidCNPJ, isValidCPF } from '@/lib/utils';

interface PendingProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profileType: 'cliente' | 'fornecedor';
    userId: string;
    userEmail: string;
    userName?: string;
    onComplete: () => void;
}

export default function PendingProfileModal({
    isOpen,
    onClose,
    profileType,
    userId,
    userEmail,
    userName = '',
    onComplete
}: PendingProfileModalProps) {
    const [loading, setLoading] = useState(false);
    const [clienteType, setClienteType] = useState<'cpf' | 'cnpj'>('cpf');

    // Cliente form data
    const [clienteData, setClienteData] = useState<ClienteMinimalData>({
        nome: userName,
        email: userEmail,
        telefone: '',
        cpf: '',
        cnpj: '',
        razaoSocial: '',
        cidade: '',
        estado: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cep: ''
    });

    // Fornecedor form data
    const [fornecedorData, setFornecedorData] = useState<FornecedorMinimalData>({
        razaoSocial: userName,
        email: userEmail,
        cnpj: '',
        telefone: '',
        whatsapp: '',
        cidade: '',
        estado: '',
        endereco: '',
        bairro: '',
        cep: ''
    });

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setClienteData(prev => ({ ...prev, nome: userName, email: userEmail }));
        setFornecedorData(prev => ({ ...prev, razaoSocial: userName, email: userEmail }));
    }, [userName, userEmail]);

    const handleClienteChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let formatted = value;

        if (name === 'cpf') formatted = formatCpfBr(value);
        if (name === 'cnpj') formatted = formatCnpjBr(value);
        if (name === 'telefone') formatted = formatPhoneBr(value);
        if (name === 'cep') formatted = formatCepBr(value);

        setClienteData(prev => ({ ...prev, [name]: formatted }));
    };

    const handleFornecedorChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let formatted = value;

        if (name === 'cnpj') formatted = formatCnpjBr(value);
        if (name === 'telefone' || name === 'whatsapp') formatted = formatPhoneBr(value);
        if (name === 'cep') formatted = formatCepBr(value);

        setFornecedorData(prev => ({ ...prev, [name]: formatted }));
    };

    const handleCepLookup = async (type: 'cliente' | 'fornecedor') => {
        const cep = type === 'cliente' ? clienteData.cep : fornecedorData.cep;
        const clean = (cep || '').replace(/\D/g, '');
        if (clean.length !== 8) return;

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
            if (!response.ok) throw new Error('CEP não encontrado');
            const data = await response.json();

            if (type === 'cliente') {
                setClienteData(prev => ({
                    ...prev,
                    cep: formatCepBr(clean),
                    endereco: data.street || '',
                    bairro: data.neighborhood || '',
                    cidade: data.city || '',
                    estado: data.state || ''
                }));
            } else {
                setFornecedorData(prev => ({
                    ...prev,
                    cep: formatCepBr(clean),
                    endereco: data.street || '',
                    bairro: data.neighborhood || '',
                    cidade: data.city || '',
                    estado: data.state || ''
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        }
    };

    const handleCnpjLookup = async () => {
        const cnpj = fornecedorData.cnpj;
        const clean = (cnpj || '').replace(/\D/g, '');
        if (clean.length !== 14) return;

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
            if (!response.ok) throw new Error('CNPJ não encontrado');
            const data = await response.json();

            setFornecedorData(prev => ({
                ...prev,
                razaoSocial: data.razao_social || prev.razaoSocial,
                cnpj: formatCnpjBr(clean),
                endereco: `${data.logradouro || ''}, ${data.numero || ''}`,
                bairro: data.bairro || '',
                cidade: data.municipio || '',
                estado: data.uf || '',
                cep: formatCepBr(data.cep || ''),
                telefone: formatPhoneBr(data.ddd_telefone_1 || '')
            }));
        } catch (error) {
            console.error('Erro ao buscar CNPJ:', error);
        }
    };

    const validateClienteForm = (): boolean => {
        if (!clienteData.nome) {
            setError('Nome é obrigatório');
            return false;
        }
        if (!clienteData.email) {
            setError('Email é obrigatório');
            return false;
        }
        if (clienteType === 'cpf' && clienteData.cpf && !isValidCPF(clienteData.cpf)) {
            setError('CPF inválido');
            return false;
        }
        if (clienteType === 'cnpj' && clienteData.cnpj && !isValidCNPJ(clienteData.cnpj)) {
            setError('CNPJ inválido');
            return false;
        }
        return true;
    };

    const validateFornecedorForm = (): boolean => {
        if (!fornecedorData.razaoSocial) {
            setError('Razão Social é obrigatória');
            return false;
        }
        if (!fornecedorData.email) {
            setError('Email é obrigatório');
            return false;
        }
        if (fornecedorData.cnpj && !isValidCNPJ(fornecedorData.cnpj)) {
            setError('CNPJ inválido');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (profileType === 'cliente') {
                if (!validateClienteForm()) {
                    setLoading(false);
                    return;
                }

                const result = await completeClienteProfile(userId, {
                    ...clienteData,
                    cpf: clienteType === 'cpf' ? clienteData.cpf : undefined,
                    cnpj: clienteType === 'cnpj' ? clienteData.cnpj : undefined
                });

                if (!result.success) {
                    setError(result.error || 'Erro ao completar cadastro');
                    setLoading(false);
                    return;
                }
            } else {
                if (!validateFornecedorForm()) {
                    setLoading(false);
                    return;
                }

                const result = await completeFornecedorProfile(userId, fornecedorData);

                if (!result.success) {
                    setError(result.error || 'Erro ao completar cadastro');
                    setLoading(false);
                    return;
                }
            }

            onComplete();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar cadastro');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

                {/* Modal */}
                <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            {profileType === 'cliente' ? (
                                <User className="w-6 h-6 text-blue-600" />
                            ) : (
                                <Building2 className="w-6 h-6 text-purple-600" />
                            )}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Complete seu Cadastro de {profileType === 'cliente' ? 'Cliente' : 'Fornecedor'}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Para acessar todas as funcionalidades, complete suas informações
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <form onSubmit={handleSubmit} className="p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <span className="text-sm text-red-700">{error}</span>
                            </div>
                        )}

                        {profileType === 'cliente' ? (
                            <div className="space-y-4">
                                {/* Tipo de cadastro */}
                                <div className="flex gap-4 mb-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="clienteType"
                                            checked={clienteType === 'cpf'}
                                            onChange={() => setClienteType('cpf')}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm text-gray-700">Pessoa Física (CPF)</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="clienteType"
                                            checked={clienteType === 'cnpj'}
                                            onChange={() => setClienteType('cnpj')}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm text-gray-700">Pessoa Jurídica (CNPJ)</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {clienteType === 'cpf' ? 'Nome Completo *' : 'Nome do Responsável *'}
                                        </label>
                                        <input
                                            type="text"
                                            name="nome"
                                            value={clienteData.nome}
                                            onChange={handleClienteChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={clienteData.email}
                                            onChange={handleClienteChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                                            readOnly
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                        <input
                                            type="text"
                                            name="telefone"
                                            value={clienteData.telefone}
                                            onChange={handleClienteChange}
                                            placeholder="(00) 00000-0000"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {clienteType === 'cpf' ? (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                                            <input
                                                type="text"
                                                name="cpf"
                                                value={clienteData.cpf}
                                                onChange={handleClienteChange}
                                                placeholder="000.000.000-00"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
                                                <input
                                                    type="text"
                                                    name="razaoSocial"
                                                    value={clienteData.razaoSocial}
                                                    onChange={handleClienteChange}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                                                <input
                                                    type="text"
                                                    name="cnpj"
                                                    value={clienteData.cnpj}
                                                    onChange={handleClienteChange}
                                                    placeholder="00.000.000/0000-00"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                                        <input
                                            type="text"
                                            name="cep"
                                            value={clienteData.cep}
                                            onChange={handleClienteChange}
                                            onBlur={() => handleCepLookup('cliente')}
                                            placeholder="00000-000"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (Logradouro)</label>
                                        <input
                                            type="text"
                                            name="endereco"
                                            value={clienteData.endereco}
                                            onChange={handleClienteChange}
                                            placeholder="Rua, Avenida, etc."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                                        <input
                                            type="text"
                                            name="numero"
                                            value={clienteData.numero}
                                            onChange={handleClienteChange}
                                            placeholder="123"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                                        <input
                                            type="text"
                                            name="complemento"
                                            value={clienteData.complemento}
                                            onChange={handleClienteChange}
                                            placeholder="Apto, Sala, etc."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                                        <input
                                            type="text"
                                            name="bairro"
                                            value={clienteData.bairro}
                                            onChange={handleClienteChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                                        <input
                                            type="text"
                                            name="cidade"
                                            value={clienteData.cidade}
                                            onChange={handleClienteChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                        <select
                                            name="estado"
                                            value={clienteData.estado}
                                            onChange={handleClienteChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                </div>
                            </div>
                        ) : (
                            /* Fornecedor Form */
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
                                        <input
                                            type="text"
                                            name="razaoSocial"
                                            value={fornecedorData.razaoSocial}
                                            onChange={handleFornecedorChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                                        <input
                                            type="text"
                                            name="cnpj"
                                            value={fornecedorData.cnpj}
                                            onChange={handleFornecedorChange}
                                            onBlur={handleCnpjLookup}
                                            placeholder="00.000.000/0000-00"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Preenche automaticamente ao sair do campo</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={fornecedorData.email}
                                            onChange={handleFornecedorChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-50"
                                            readOnly
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                        <input
                                            type="text"
                                            name="telefone"
                                            value={fornecedorData.telefone}
                                            onChange={handleFornecedorChange}
                                            placeholder="(00) 0000-0000"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                                        <input
                                            type="text"
                                            name="whatsapp"
                                            value={fornecedorData.whatsapp}
                                            onChange={handleFornecedorChange}
                                            placeholder="(00) 00000-0000"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                                        <input
                                            type="text"
                                            name="cep"
                                            value={fornecedorData.cep}
                                            onChange={handleFornecedorChange}
                                            onBlur={() => handleCepLookup('fornecedor')}
                                            placeholder="00000-000"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                                        <input
                                            type="text"
                                            name="endereco"
                                            value={fornecedorData.endereco}
                                            onChange={handleFornecedorChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                                        <input
                                            type="text"
                                            name="bairro"
                                            value={fornecedorData.bairro}
                                            onChange={handleFornecedorChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                                        <input
                                            type="text"
                                            name="cidade"
                                            value={fornecedorData.cidade}
                                            onChange={handleFornecedorChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                        <select
                                            name="estado"
                                            value={fornecedorData.estado}
                                            onChange={handleFornecedorChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Preencher Depois
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${profileType === 'cliente'
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : 'bg-purple-600 hover:bg-purple-700'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {loading ? 'Salvando...' : 'Salvar Cadastro'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
