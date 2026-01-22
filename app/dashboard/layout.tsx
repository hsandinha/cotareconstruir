"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updatePassword } from "@/lib/supabaseAuth";
import { supabase } from "@/lib/supabaseAuth";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { startSessionMonitoring, stopSessionMonitoring } from "../../lib/sessionManager";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mustChangePassword, setMustChangePassword] = useState(false);
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

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showToast("error", "As senhas não coincidem.");
            return;
        }
        if (newPassword.length < 6) {
            showToast("error", "A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setLoading(true);
        try {
            const result = await updatePassword(newPassword);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Atualizar flag no perfil
            if (user) {
                await supabase
                    .from('users')
                    .update({ mustChangePassword: false })
                    .eq('id', user.id);
            }

            setMustChangePassword(false);
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
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl font-bold text-slate-900">Alteração de Senha Obrigatória</h2>
                            <p className="mt-2 text-sm text-slate-600">
                                Para sua segurança, você deve alterar sua senha no primeiro acesso.
                            </p>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Nova Senha</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Digite sua nova senha"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
                                    placeholder="Confirme sua nova senha"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-4 w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? "Atualizando..." : "Alterar Senha e Continuar"}
                            </button>
                        </form>

                        <div className="mt-4 text-center">
                            <button
                                onClick={handleLogout}
                                className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
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
