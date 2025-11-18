"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("cliente");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Erro no login");

            // salvar token mock e role no localStorage
            if (data?.token) {
                localStorage.setItem("token", data.token);
            }
            if (data?.user?.role) {
                localStorage.setItem("role", data.user.role);
            }

            // redirecionar para dashboard conforme role
            const userRole = data?.user?.role || role;
            if (userRole === "fornecedor") router.push("/dashboard/fornecedor");
            else if (userRole === "admin" || userRole === "administrador") router.push("/dashboard/admin");
            else router.push("/dashboard/cliente");
        } catch (err: any) {
            setError(err.message || "Erro desconhecido");
        } finally {
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

                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {loading ? "Entrando..." : "Entrar"}
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push("/")}
                            className="text-sm text-slate-300 hover:text-white"
                        >
                            Voltar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
