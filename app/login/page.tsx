"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseAuth";
import { decodeLoginRef, quotationDeepLinkPath } from "@/lib/quotationLink";
import { useModoApp } from "@/lib/modoApp";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const modoApp = useModoApp();
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSignupHint, setShowSignupHint] = useState(false);
    const autoRedirectRef = useRef(false);

    // Token enviado nos links de notificação (WhatsApp/email): ?wa=<token>
    const loginRef = useMemo(() => {
        const token = searchParams?.get("wa");
        return token ? decodeLoginRef(token) : null;
    }, [searchParams]);

    // Destino pós-login: cotação do token, ou ?redirect= definido pelo proxy
    const nextPath = useMemo(() => {
        if (loginRef?.cotacaoId) return quotationDeepLinkPath(loginRef.cotacaoId, loginRef.role);
        const redirect = searchParams?.get("redirect");
        if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;
        return null;
    }, [loginRef, searchParams]);

    // Pré-preenche o email vindo do token ou de ?email=
    useEffect(() => {
        const prefill = loginRef?.email || searchParams?.get("email") || "";
        if (prefill) setEmail((prev) => prev || prefill);
    }, [loginRef, searchParams]);

    // Se já existe sessão ativa e o link tem destino, entra direto na cotação
    useEffect(() => {
        if (!nextPath || autoRedirectRef.current) return;
        autoRedirectRef.current = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                handleUserAuth(session.user, session).catch(() => { });
            }
        });
    }, [nextPath]);

    /**
     * O Supabase responde "Invalid login credentials" para conta inexistente,
     * senha errada e conta só com login social. Aqui perguntamos ao servidor
     * qual é o caso real para orientar o usuário em vez de repetir o erro genérico.
     */
    const explainFailedLogin = async (normalizedEmail: string): Promise<string> => {
        try {
            const res = await fetch("/api/auth/account-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: normalizedEmail }),
            });
            const json = await res.json();

            switch (json?.status) {
                case "not_found":
                    setShowSignupHint(true);
                    return "Não encontramos uma conta com este e-mail. Crie sua conta gratuitamente.";
                case "oauth_only":
                    return "Esta conta foi criada com login do Google. Use o botão \"Entrar com Google\" abaixo.";
                case "email_unconfirmed":
                    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada e o spam.";
                case "suspended":
                    return "Esta conta está desativada. Fale com o suporte.";
                default:
                    return "Senha incorreta. Use \"Esqueci minha senha\" se precisar redefinir.";
            }
        } catch {
            return "Email ou senha incorretos.";
        }
    };

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
        const roleHome = primaryRole === "admin"
            ? "/dashboard/admin"
            : primaryRole === "fornecedor"
                ? "/dashboard/fornecedor"
                : "/dashboard/cliente";

        // Se o link trouxe um destino dentro da área do usuário (ex.: cotação
        // recebida via WhatsApp), abre direto nele
        if (nextPath && nextPath.startsWith(roleHome)) {
            router.push(nextPath);
        } else {
            router.push(roleHome);
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
        setShowSignupHint(false);

        // O Supabase não normaliza o e-mail no sign-in: espaço colado do
        // preenchimento automático ou letra maiúscula derrubavam o login.
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail !== email) setEmail(normalizedEmail);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
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
            const message = String(err?.message || "");

            if (message.includes("Invalid login credentials")) {
                setError(await explainFailedLogin(normalizedEmail));
            } else {
                setError(getFriendlyErrorMessage(message));
            }
            setLoading(false);
        }
    }

    return (
        // Paleta da landing: papel #FAF8F5, tinta #1C1917, laranja #F97316.
        // `tela-papel` leva o tom para o body — no iPhone instalado é ele
        // que pinta a área segura do rodapé.
        <div className="tela-papel lp-paper-grain relative flex min-h-dvh flex-col bg-[#FAF8F5]">
            <div className="fixed inset-0 -z-10 bg-[#FAF8F5]" aria-hidden />

            <div
                className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5"
                style={{
                    paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
                    paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
                }}
            >
                {/* Marca no topo: dá continuidade à abertura do app */}
                <div className="mb-8 flex flex-col items-center text-center">
                    <Image
                        src="/logo.png"
                        alt="Comprar &amp; Construir"
                        width={256}
                        height={144}
                        priority
                        className="h-20 w-auto object-contain"
                    />
                    <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#9A3412]">
                        {modoApp ? "Bem-vindo de volta" : "Área do cliente"}
                    </p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1C1917]">
                        {modoApp ? "Entrar no app" : "Entrar"}
                    </h1>
                </div>

                <div className={modoApp ? "" : "rounded-md border border-[#D6D3D1] bg-white p-6 shadow-[0_18px_40px_-28px_rgba(28,25,23,0.45)] sm:p-7"}>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-widest text-[#57534E]">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                inputMode="email"
                                autoCapitalize="none"
                                autoCorrect="off"
                                enterKeyHint="next"
                                className="w-full rounded-md border-2 border-[#D6D3D1] bg-white px-4 py-3.5 text-base text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#1C1917] focus:outline-none"
                                placeholder="seu@email.com"
                            />
                        </div>

                        <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                                <label htmlFor="senha" className="block font-mono text-[11px] font-bold uppercase tracking-widest text-[#57534E]">
                                    Senha
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#9A3412] underline decoration-[#F97316] decoration-2 underline-offset-4 hover:text-[#1C1917]"
                                >
                                    Esqueci
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    id="senha"
                                    type={mostrarSenha ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    enterKeyHint="go"
                                    className="w-full rounded-md border-2 border-[#D6D3D1] bg-white px-4 py-3.5 pr-12 text-base text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#1C1917] focus:outline-none"
                                    placeholder="••••••••"
                                />
                                {/* Ver a senha é padrão em app — sem isso erra-se muito no toque */}
                                <button
                                    type="button"
                                    onClick={() => setMostrarSenha((v) => !v)}
                                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2.5 text-[#78716C] hover:text-[#1C1917]"
                                >
                                    {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md border-l-4 border-[#B91C1C] bg-[#FEF2F2] px-4 py-3">
                                <p className="text-sm text-[#7F1D1D]">{error}</p>
                                {showSignupHint && (
                                    <Link
                                        href={`/cadastro?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                                        className="mt-2 inline-block text-sm font-bold text-[#9A3412] underline decoration-[#F97316] decoration-2 underline-offset-4"
                                    >
                                        Criar minha conta →
                                    </Link>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-3.5 text-base font-bold text-[#1C1917] shadow-[4px_4px_0_#1C1917] transition-transform hover:-translate-y-0.5 hover:bg-[#FB923C] active:translate-y-0 disabled:opacity-60 disabled:shadow-none"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? "Entrando..." : "Entrar"}
                        </button>

                        <div className="relative flex items-center justify-center py-1">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#D6D3D1]" /></div>
                            <span className="relative bg-[#FAF8F5] px-3 font-mono text-[10px] uppercase tracking-widest text-[#A8A29E]">ou</span>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2.5 rounded-lg border-2 border-[#1C1917] bg-white px-4 py-3.5 text-base font-bold text-[#1C1917] transition-transform hover:-translate-y-0.5 hover:bg-[#F1EDE7] active:translate-y-0 disabled:opacity-60"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5 7.7.5 3.99 2.97 2.18 6.56l3.66 2.84C6.71 6.79 9.14 4.75 12 4.75z" fill="#EA4335" />
                            </svg>
                            Entrar com Google
                        </button>
                    </form>
                </div>

                <p className="mt-8 text-center text-sm text-[#57534E]">
                    Ainda não tem conta?{" "}
                    <Link href="/cadastro" className="font-bold text-[#1C1917] underline decoration-[#F97316] decoration-2 underline-offset-4">
                        Criar conta grátis
                    </Link>
                </p>

                {/* No app não existe "site" para voltar — o app É a tela */}
                {!modoApp && (
                    <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="mt-4 text-center font-mono text-[11px] uppercase tracking-widest text-[#A8A29E] hover:text-[#57534E]"
                    >
                        ← Voltar para o site
                    </button>
                )}
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginPageContent />
        </Suspense>
    );
}