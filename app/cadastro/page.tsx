"use client";

/**
 * Cadastro público de cliente (construtor/comprador).
 * Fornecedores continuam entrando pelo cadastro interno da administração.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseAuth";
import { validatePassword } from "@/lib/validation";

type Form = {
    nome: string;
    razaoSocial: string;
    email: string;
    telefone: string;
    cpfCnpj: string;
    password: string;
    confirmPassword: string;
};

const EMPTY: Form = {
    nome: "",
    razaoSocial: "",
    email: "",
    telefone: "",
    cpfCnpj: "",
    password: "",
    confirmPassword: "",
};

/** (31) 99999-9999 */
function maskTelefone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** 000.000.000-00 ou 00.000.000/0000-00 */
function maskCpfCnpj(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
        return digits
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d)/, "$1.$2")
            .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return digits
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

function CadastroPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [form, setForm] = useState<Form>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmationSent, setConfirmationSent] = useState(false);
    // Turma de lançamento: vagas restantes e resultado quando elas acabam
    const [turma, setTurma] = useState<{ vagasTotal: number; vagasRestantes: number; diasTeste: number; obrasPorConta: number } | null>(null);
    const [naFilaDeEspera, setNaFilaDeEspera] = useState<string | null>(null);
    const [convite, setConvite] = useState<{ nome: string; email: string } | null>(null);
    const [conviteInvalido, setConviteInvalido] = useState(false);

    const set = (field: keyof Form, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    // Vagas restantes da turma de lançamento
    useEffect(() => {
        fetch("/api/lancamento")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data) setTurma(data); })
            .catch(() => { /* contador é informativo: falhar não bloqueia o cadastro */ });
    }, []);

    // E-mail que o usuário tentou logar sem ter conta chega por ?email=
    useEffect(() => {
        const prefill = searchParams?.get("email") || "";
        if (prefill) setForm((prev) => (prev.email ? prev : { ...prev, email: prefill }));
    }, [searchParams]);

    // Convite da fila de espera: ?convite=<token> preenche nome e e-mail
    const conviteToken = searchParams?.get("convite") || "";
    useEffect(() => {
        if (!conviteToken) return;
        fetch(`/api/lancamento/convite?token=${encodeURIComponent(conviteToken)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (!data?.valido) {
                    setConviteInvalido(true);
                    return;
                }
                setConvite({ nome: data.nome, email: data.email });
                setForm((prev) => ({
                    ...prev,
                    nome: prev.nome || data.nome || "",
                    email: prev.email || data.email || "",
                }));
            })
            .catch(() => setConviteInvalido(true));
    }, [conviteToken]);

    const passwordCheck = useMemo(() => validatePassword(form.password), [form.password]);
    const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!passwordCheck.valid) {
            setError(passwordCheck.errors.join(". "));
            return;
        }
        if (!passwordsMatch) {
            setError("As senhas não conferem.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nome: form.nome.trim(),
                    razaoSocial: form.razaoSocial.trim(),
                    email: form.email.trim().toLowerCase(),
                    telefone: form.telefone.trim(),
                    cpfCnpj: form.cpfCnpj.trim(),
                    password: form.password,
                    convite: conviteToken || undefined,
                }),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json?.error || "Não foi possível criar a conta.");
                setLoading(false);
                return;
            }

            if (json.waitlisted) {
                setNaFilaDeEspera(json.message || "Você entrou na fila de espera.");
                setLoading(false);
                return;
            }

            if (json.needsEmailConfirmation) {
                setConfirmationSent(true);
                setLoading(false);
                return;
            }

            // Projeto sem confirmação de e-mail: já entra direto
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: form.email.trim().toLowerCase(),
                password: form.password,
            });

            if (signInError) {
                router.push("/login?email=" + encodeURIComponent(form.email.trim().toLowerCase()));
                return;
            }

            router.push("/dashboard/cliente");
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setError("Erro de conexão. Tente novamente.");
            setLoading(false);
        }
    }

    if (naFilaDeEspera) {
        return (
            <div className="min-h-screen bg-slate-900 px-4 py-20">
                <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-800/60 p-8 text-center shadow-lg">
                    <h1 className="text-2xl font-bold text-white">Você está na fila de espera</h1>
                    <p className="mt-4 text-sm leading-relaxed text-slate-300">{naFilaDeEspera}</p>
                    <p className="mt-3 text-xs text-slate-400">
                        Guardamos seus dados. Assim que abrir uma vaga, avisamos por e-mail em{" "}
                        <span className="font-semibold text-slate-200">{form.email.trim().toLowerCase()}</span>.
                    </p>
                    <Link
                        href="/"
                        className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Voltar ao início
                    </Link>
                </div>
            </div>
        );
    }

    if (confirmationSent) {
        return (
            <div className="min-h-screen bg-slate-900 px-4 py-20">
                <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-800/60 p-8 text-center shadow-lg">
                    <h1 className="text-2xl font-bold text-white">Confirme seu e-mail</h1>
                    <p className="mt-4 text-sm leading-relaxed text-slate-300">
                        Enviamos um link de confirmação para{" "}
                        <span className="font-semibold text-white">{form.email.trim().toLowerCase()}</span>.
                        Clique nele para ativar sua conta e depois faça login.
                    </p>
                    <p className="mt-3 text-xs text-slate-400">
                        Não recebeu? Confira a caixa de spam ou fale com o suporte.
                    </p>
                    <Link
                        href="/login"
                        className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Ir para o login
                    </Link>
                </div>
            </div>
        );
    }

    const inputClass =
        "w-full rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none";
    const labelClass = "mb-2 block text-sm font-medium text-slate-200";

    return (
        <div className="min-h-screen bg-slate-900 px-4 py-16">
            <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-slate-800/60 p-8 shadow-lg">
                <h1 className="text-center text-2xl font-bold text-white">Criar conta de cliente</h1>
                <p className="mt-2 text-center text-sm text-slate-400">
                    Cadastre sua obra e receba propostas comparadas no mapa.
                </p>

                {convite && (
                    <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center">
                        <p className="text-sm font-semibold text-emerald-300">
                            Vaga reservada para {convite.nome || convite.email}
                        </p>
                        <p className="mt-1 text-xs text-emerald-200/80">
                            Você foi convidado da fila de espera. Complete o cadastro para começar o teste.
                        </p>
                    </div>
                )}

                {conviteInvalido && (
                    <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center">
                        <p className="text-sm text-amber-200">
                            Este convite expirou ou já foi usado. Você ainda pode se cadastrar se houver vaga aberta.
                        </p>
                    </div>
                )}

                {turma && !convite && (
                    <div className="mt-4 rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 text-center">
                        {turma.vagasRestantes > 0 ? (
                            <>
                                <p className="text-sm font-semibold text-white">
                                    Teste gratuito de {turma.diasTeste} dias
                                    <span className="mx-2 text-slate-500">·</span>
                                    {turma.obrasPorConta === 1 ? "1 obra" : `${turma.obrasPorConta} obras`}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Restam <span className="font-bold text-blue-400">{turma.vagasRestantes}</span> de{" "}
                                    {turma.vagasTotal} vagas da turma de lançamento.
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-amber-300">
                                As {turma.vagasTotal} vagas da turma de lançamento foram preenchidas. Ao enviar o
                                formulário você entra na fila de espera.
                            </p>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    <div>
                        <label className={labelClass} htmlFor="nome">Nome completo *</label>
                        <input
                            id="nome"
                            required
                            value={form.nome}
                            onChange={(e) => set("nome", e.target.value)}
                            className={inputClass}
                            placeholder="Seu nome"
                        />
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="razaoSocial">Empresa / construtora</label>
                        <input
                            id="razaoSocial"
                            value={form.razaoSocial}
                            onChange={(e) => set("razaoSocial", e.target.value)}
                            className={inputClass}
                            placeholder="Opcional"
                        />
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="email">E-mail *</label>
                        <input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            className={inputClass}
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass} htmlFor="telefone">Telefone / WhatsApp</label>
                            <input
                                id="telefone"
                                inputMode="numeric"
                                value={form.telefone}
                                onChange={(e) => set("telefone", maskTelefone(e.target.value))}
                                className={inputClass}
                                placeholder="(31) 99999-9999"
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="cpfCnpj">CPF ou CNPJ</label>
                            <input
                                id="cpfCnpj"
                                inputMode="numeric"
                                value={form.cpfCnpj}
                                onChange={(e) => set("cpfCnpj", maskCpfCnpj(e.target.value))}
                                className={inputClass}
                                placeholder="Opcional"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="password">Senha *</label>
                        <input
                            id="password"
                            type="password"
                            required
                            autoComplete="new-password"
                            value={form.password}
                            onChange={(e) => set("password", e.target.value)}
                            className={inputClass}
                            placeholder="••••••••"
                        />
                        {form.password.length > 0 && !passwordCheck.valid && (
                            <ul className="mt-2 space-y-0.5 text-xs text-amber-300">
                                {passwordCheck.errors.map((err) => (
                                    <li key={err}>• {err}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <label className={labelClass} htmlFor="confirmPassword">Confirmar senha *</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            required
                            autoComplete="new-password"
                            value={form.confirmPassword}
                            onChange={(e) => set("confirmPassword", e.target.value)}
                            className={inputClass}
                            placeholder="••••••••"
                        />
                        {form.confirmPassword.length > 0 && !passwordsMatch && (
                            <p className="mt-2 text-xs text-amber-300">As senhas não conferem.</p>
                        )}
                    </div>

                    {error && (
                        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                    >
                        {loading ? "Criando conta..." : "Criar conta"}
                    </button>

                    <p className="text-center text-xs text-slate-400">
                        Ao criar a conta você concorda com os{" "}
                        <Link href="/termos" className="text-blue-400 hover:text-blue-300">Termos de Uso</Link> e a{" "}
                        <Link href="/privacidade" className="text-blue-400 hover:text-blue-300">Política de Privacidade</Link>.
                    </p>

                    <div className="border-t border-white/10 pt-4 text-center text-sm text-slate-300">
                        Já tem conta?{" "}
                        <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">Entrar</Link>
                    </div>

                    <p className="text-center text-xs text-slate-500">
                        É fornecedor? O cadastro de fornecedores é feito pela nossa equipe —{" "}
                        <Link href="/ajuda" className="text-slate-300 hover:text-white">fale com o suporte</Link>.
                    </p>
                </form>
            </div>
        </div>
    );
}

export default function CadastroPage() {
    return (
        <Suspense fallback={null}>
            <CadastroPageContent />
        </Suspense>
    );
}
