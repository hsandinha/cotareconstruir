"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, updatePassword, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";

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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists() && userDoc.data().mustChangePassword) {
                        setMustChangePassword(true);
                    }
                } catch (error) {
                    console.error("Error checking password status:", error);
                }
            }
        });

        return () => unsubscribe();
    }, []);

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
            const user = auth.currentUser;
            if (user) {
                await updatePassword(user, newPassword);
                await updateDoc(doc(db, "users", user.uid), {
                    mustChangePassword: false
                });
                setMustChangePassword(false);
                showToast("success", "Senha alterada com sucesso!");
            }
        } catch (error: any) {
            console.error("Error updating password:", error);
            if (error.code === 'auth/requires-recent-login') {
                showToast("error", "Por favor, faça login novamente para alterar a senha.");
                await signOut(auth);
                router.push('/login');
            } else {
                showToast("error", "Erro ao alterar senha.");
            }
        } finally {
            setLoading(false);
        }
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
                    </div>
                </div>
            )}
        </>
    );
}
