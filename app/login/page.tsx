"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, googleProvider, db } from "../../lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("cliente");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getFriendlyErrorMessage = (errorCode: string) => {
        switch (errorCode) {
            case "auth/invalid-credential":
                return "Email ou senha incorretos.";
            case "auth/user-not-found":
                return "Usuário não encontrado.";
            case "auth/wrong-password":
                return "Senha incorreta.";
            case "auth/invalid-email":
                return "Email inválido.";
            case "auth/user-disabled":
                return "Esta conta foi desativada.";
            case "auth/too-many-requests":
                return "Muitas tentativas falhas. Tente novamente mais tarde.";
            case "auth/email-already-in-use":
                return "Este email já está em uso.";
            case "auth/popup-closed-by-user":
                return "Login cancelado pelo usuário.";
            case "auth/network-request-failed":
                return "Erro de conexão. Verifique sua internet.";
            default:
                return "Ocorreu um erro ao fazer login. Tente novamente.";
        }
    };

    async function handleUserAuth(user: any, selectedRole: string) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        let userRole = selectedRole;

        if (userSnap.exists()) {
            const userData = userSnap.data();
            userRole = userData.role;
        } else {
            // Create new user document if it doesn't exist
            await setDoc(userRef, {
                email: user.email,
                role: selectedRole,
                name: user.displayName || "",
                photoURL: user.photoURL || "",
                createdAt: new Date().toISOString(),
            });
        }

        const token = await user.getIdToken();

        // Save to localStorage for persistence
        localStorage.setItem("token", token);
        localStorage.setItem("role", userRole);
        localStorage.setItem("uid", user.uid);

        // Set cookies for Middleware
        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
        document.cookie = `role=${userRole}; path=/; max-age=86400; SameSite=Strict`;

        // Redirect based on role
        if (userRole === "fornecedor") router.push("/dashboard/fornecedor");
        else if (userRole === "admin" || userRole === "administrador") router.push("/dashboard/admin");
        else router.push("/dashboard/cliente");
    }

    async function handleGoogleLogin() {
        setLoading(true);
        setError(null);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            await handleUserAuth(result.user, role);
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyErrorMessage(err.code));
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            await handleUserAuth(result.user, role);
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyErrorMessage(err.code));
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 py-20">
            <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-800/60 p-8 shadow-lg">
                <h1 className="mb-6 text-center text-2xl font-bold text-white">Entrar</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-200">Eu sou</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-white"
                        >
                            <option value="cliente">Cliente</option>
                            <option value="fornecedor">Fornecedor</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>

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
                        <label className="mb-2 block text-sm font-medium text-slate-200">Senha</label>
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