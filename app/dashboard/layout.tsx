"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updatePassword } from "@/lib/supabaseAuth";
import { supabase } from "@/lib/supabaseAuth";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { startSessionMonitoring, stopSessionMonitoring } from "../../lib/sessionManager";
import { validatePassword } from "@/lib/validation";
import { PasswordStrengthIndicator } from "@/components/PasswordStrength";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();
    const router = useRouter();
    const { user, profile, logout, initialized } = useAuth();

    useEffect(() => {
        if (initialized && !user) {
            // Se não está autenticado, redirecionar para login
            router.push('/login');
            return;
        }

        if (user) {
            // Iniciar monitoramento de sessão
            startSessionMonitoring();
        }

        return () => {
            stopSessionMonitoring();
        };
    }, [user, initialized, router]);

    useEffect(() => {
        const isFornecedor = Boolean(profile?.role === 'fornecedor' || profile?.roles?.includes('fornecedor'));
        const needsChange = Boolean((profile as any)?.must_change_password);
        setMustChangePassword(isFornecedor && needsChange);
    }, [profile]);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        // Segurança: exigir senha atual (provisória)
        if (!currentPassword) {
            showToast("error", "Informe a senha temporária.");
            return;
        }

        // Server-side verification happens via signInWithPassword below
        // No client-side password check needed

        if (newPassword !== confirmPassword) {
            showToast("error", "As senhas não coincidem.");
            return;
        }

        if (newPassword === currentPassword) {
            showToast("error", "A nova senha não pode ser igual à senha atual.");
            return;
        }

        const strength = validatePassword(newPassword);
        if (!strength.valid) {
            showToast("error", `Senha fraca: ${strength.errors.join(' | ')}`);
            return;
        }

        setLoading(true);
        try {
            if (!user?.email) {
                throw new Error('Usuário não autenticado');
            }

            // Reautenticar com senha temporária antes de trocar
            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });
            if (reauthError) {
                throw new Error('Senha temporária incorreta');
            }

            const result = await updatePassword(newPassword);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Atualizar flag no perfil
            if (user) {
                await supabase
                    .from('users')
                    .update({
                        must_change_password: false,
                        status: 'active',
                        password_changed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as any)
                    .eq('id', user.id);
            }

            // Atualizar cookie para liberar navegação
            const isProduction = window.location.protocol === 'https:';
            const secureFlag = isProduction ? '; Secure' : '';
            document.cookie = `mustChangePassword=false; path=/; max-age=86400; SameSite=Strict${secureFlag}`;

            setMustChangePassword(false);
            setCurrentPassword("");
            showToast("success", "Senha alterada com sucesso!");
        } catch (error: any) {
            console.error("Error updating password:", error);
            showToast("error", error.message || "Erro ao alterar senha.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    return (
        <>
            {children}

            {mustChangePassword && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="mb-6 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                                <svg className="h-7 w-7 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">Alteração de Senha Obrigatória</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Para sua segurança, você deve alterar sua senha no primeiro acesso.
                            </p>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Senha Atual</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    placeholder="Digite sua senha atual"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Nova Senha</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    placeholder="Digite sua nova senha"
                                    required
                                    minLength={8}
                                />
                                <PasswordStrengthIndicator password={newPassword} className="mt-2" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`mt-1 w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${
                                        confirmPassword && newPassword !== confirmPassword
                                            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                                            : confirmPassword && newPassword === confirmPassword
                                                ? "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                                                : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                                    }`}
                                    placeholder="Confirme sua nova senha"
                                    required
                                    minLength={8}
                                />
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                        As senhas não coincidem
                                    </p>
                                )}
                                {confirmPassword && newPassword === confirmPassword && (
                                    <p className="mt-1 text-[11px] text-emerald-500 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        Senhas coincidem
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-4 w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {loading ? "Atualizando..." : "Alterar Senha e Continuar"}
                            </button>
                        </form>

                        <div className="mt-4 text-center">
                            <button
                                onClick={handleLogout}
                                className="text-xs text-slate-500 hover:text-slate-700 hover:underline transition-colors"
                            >
                                Sair e tentar mais tarde
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
