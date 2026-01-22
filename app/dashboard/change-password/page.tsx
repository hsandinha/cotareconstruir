'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/useAuth';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export default function ChangePasswordPage() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [userName, setUserName] = useState('');
    const [role, setRole] = useState('');

    useEffect(() => {
        if (profile) {
            setUserName(profile.name || profile.company_name || 'Usuário');
            setRole(profile.role || '');
        }
    }, [profile]);

    const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Mínimo de 8 caracteres');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Pelo menos uma letra maiúscula');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Pelo menos uma letra minúscula');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Pelo menos um número');
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Pelo menos um caractere especial');
        }

        return { valid: errors.length === 0, errors };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validações
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Preencha todos os campos');
            return;
        }

        if (currentPassword !== '123456') {
            setError('Senha atual incorreta');
            return;
        }

        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            setError(`Senha fraca:\n${validation.errors.join('\n')}`);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (newPassword === '123456') {
            setError('A nova senha não pode ser igual à senha padrão');
            return;
        }

        try {
            setLoading(true);

            if (!user || !user.email) {
                throw new Error('Usuário não autenticado');
            }

            // Reautenticar com senha atual
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });

            if (signInError) {
                throw new Error('auth/wrong-password');
            }

            // Atualizar senha
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                throw updateError;
            }

            // Atualizar flag no Supabase
            await supabase.from('users').update({
                must_change_password: false,
                password_changed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', user.id);

            // Atualizar cookie
            document.cookie = 'mustChangePassword=false; path=/';

            // Redirecionar para dashboard apropriado
            const redirectMap: Record<string, string> = {
                'cliente': '/dashboard/cliente',
                'fornecedor': '/dashboard/fornecedor',
                'admin': '/dashboard/admin',
                'administrador': '/dashboard/admin'
            };

            setTimeout(() => {
                router.push(redirectMap[role] || '/dashboard/cliente');
            }, 1500);

        } catch (err: any) {
            console.error('Erro ao alterar senha:', err);
            if (err.message === 'auth/wrong-password' || err.message?.includes('Invalid login credentials')) {
                setError('Senha atual incorreta');
            } else if (err.message?.includes('weak') || err.message?.includes('Password')) {
                setError('Senha muito fraca');
            } else {
                setError('Erro ao alterar senha. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    const passwordStrength = validatePassword(newPassword);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                            <Lock className="w-8 h-8 text-amber-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Alteração de Senha Obrigatória</h1>
                        <p className="text-sm text-slate-600">
                            Olá, <strong>{userName}</strong>! Por segurança, você precisa alterar sua senha temporária.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Senha Atual */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Senha Atual (123456)
                            </label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-12"
                                    placeholder="Digite a senha temporária"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Nova Senha */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Nova Senha
                            </label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-12"
                                    placeholder="Digite sua nova senha"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {/* Requisitos de senha */}
                            {newPassword && (
                                <div className="mt-2 space-y-1">
                                    {passwordStrength.errors.map((err, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>{err}</span>
                                        </div>
                                    ))}
                                    {passwordStrength.valid && (
                                        <div className="flex items-center gap-2 text-xs text-green-600">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>Senha forte!</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Confirmar Senha */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Confirmar Nova Senha
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-12"
                                    placeholder="Confirme sua nova senha"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {confirmPassword && newPassword !== confirmPassword && (
                                <div className="flex items-center gap-2 text-xs text-red-600 mt-2">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>As senhas não coincidem</span>
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-800 whitespace-pre-line">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading || !passwordStrength.valid || newPassword !== confirmPassword}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Alterando senha...' : 'Alterar Senha e Continuar'}
                        </button>
                    </form>

                    {/* Info */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-800">
                            <strong>Dica de segurança:</strong> Escolha uma senha única que você não use em outros sites.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
