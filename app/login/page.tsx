"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseAuth";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getFriendlyErrorMessage = (errorMessage: string) => {
        if (errorMessage.includes("Invalid login credentials")) {
            return "Email ou senha incorretos.";
        }
        if (errorMessage.includes("Email not confirmed")) {
            return "Por favor, confirme seu email antes de fazer login.";
        }
        if (errorMessage.includes("User not found")) {
            return "Usuário não encontrado.";
        }
        if (errorMessage.includes("Invalid email")) {
            return "Email inválido.";
        }
        if (errorMessage.includes("disabled")) {
            return "Esta conta foi desativada.";
        }
        if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
            return "Muitas tentativas falhas. Tente novamente mais tarde.";
        }
        return "Ocorreu um erro ao fazer login. Tente novamente.";
    };

    async function handleUserAuth(user: any, directSession?: any) {
        // Buscar perfil do usuário
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        // Best effort: registrar último login
        try {
            await supabase
                .from('users')
                .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', user.id);
        } catch {
            // ignore
        }

        let userRoles: string[] = ["cliente"];
        let primaryRole = "cliente";

        if (profile) {
            // Support both legacy 'role' and new 'roles' array
            if (profile.roles && Array.isArray(profile.roles) && profile.roles.length > 0) {
                userRoles = profile.roles;
            } else if (profile.role) {
                userRoles = [profile.role];
            }
        } else {
            // Create new user profile if it doesn't exist
            await supabase.from('users').insert({
                id: user.id,
                email: user.email,
                roles: ["cliente"],
                nome: user.user_metadata?.full_name || user.user_metadata?.name || "",
                avatar_url: user.user_metadata?.avatar_url || "",
                created_at: new Date().toISOString(),
            });
        }

        // Determine redirect priority: Admin > Fornecedor > Cliente
        if (userRoles.includes("admin") || userRoles.includes("administrador")) {
            primaryRole = "admin";
        } else if (userRoles.includes("fornecedor")) {
            primaryRole = "fornecedor";
        } else {
            primaryRole = "cliente";
        }

        // Get session token - prefer the session from signIn response
        let token = directSession?.access_token || "";
        if (!token) {
            const { data: { session } } = await supabase.auth.getSession();
            token = session?.access_token || "";
        }

        // Save to localStorage for persistence
        localStorage.setItem("token", token);
        localStorage.setItem("role", primaryRole);
        localStorage.setItem("uid", user.id);

        // Set cookies for Middleware with security flags
        const isProduction = window.location.protocol === 'https:';
        const secureFlag = isProduction ? '; Secure' : '';

        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict${secureFlag}`;
        document.cookie = `role=${primaryRole}; path=/; max-age=86400; SameSite=Strict${secureFlag}`;

        const mustChangePasswordFlag = Boolean((profile as any)?.must_change_password);
        document.cookie = `mustChangePassword=${mustChangePasswordFlag ? 'true' : 'false'}; path=/; max-age=86400; SameSite=Strict${secureFlag}`;

        // Redirect based on priority role
        if (primaryRole === "admin") {
            router.push("/dashboard/admin");
        } else if (primaryRole === "fornecedor") {
            router.push("/dashboard/fornecedor");
        } else {
            router.push("/dashboard/cliente");
        }

        // Force a hard refresh to ensure state updates
        router.refresh();
    }

    async function handleGoogleLogin() {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            });
            if (error) throw error;
            // OAuth redirects, so this code won't run immediately
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyErrorMessage(err.message));
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data.user && data.session) {
                await handleUserAuth(data.user, data.session);
            } else if (data.user) {
                await handleUserAuth(data.user);
            }
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyErrorMessage(err.message));
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 py-20">
            <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-800/60 p-8 shadow-lg">
                <h1 className="mb-6 text-center text-2xl font-bold text-white">Entrar</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-white placeholder:text-slate-400"
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-slate-200">Senha</label>
                            <a
                                href="/forgot-password"
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Esqueci minha senha
                            </a>
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-white placeholder:text-slate-400"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && <p className="text-sm text-red-400">{error}</p>}

                    <div className="flex flex-col gap-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-blue-700 transition-colors"
                        >
                            {loading ? "Entrando..." : "Entrar com Email"}
                        </button>

                        <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative bg-slate-800/60 px-2 text-sm text-slate-400">ou</div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Entrar com Google
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="text-sm text-slate-300 hover:text-white text-center mt-2"
                        >
                            Voltar para Home
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}