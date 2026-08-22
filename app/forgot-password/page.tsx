'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Erro ao solicitar recuperação');
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="tela-papel lp-paper-grain min-h-dvh bg-[#FAF8F5] flex items-center justify-center px-4">
                <div className="max-w-md w-full">
                    <div className="bg-white/5 backdrop-blur-xl border border-[#D6D3D1] rounded-md shadow-2xl p-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-[#1C1917] mb-2">Email Enviado!</h2>
                            <p className="text-[#78716C] mb-6">
                                Se o email existe em nossa base, você receberá um link para redefinir sua senha.
                            </p>
                            <p className="text-sm text-slate-500 mb-6">
                                Verifique sua caixa de entrada e pasta de spam.
                            </p>
                            <Link
                                href="/login"
                                className="inline-block w-full bg-[#F97316] text-[#1C1917] py-3 rounded-xl font-semibold hover:bg-blue-500 transition-colors text-center"
                            >
                                Voltar ao Login
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="tela-papel lp-paper-grain min-h-dvh bg-[#FAF8F5] flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="bg-white/5 backdrop-blur-xl border border-[#D6D3D1] rounded-md shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-[#9A3412]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-[#1C1917] mb-2">
                            Esqueceu a Senha?
                        </h1>
                        <p className="text-[#78716C]">
                            Digite seu email e enviaremos um link para redefinir sua senha.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-red-400 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-sm text-red-300">{error}</p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-[#57534E] mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="seu@email.com"
                                className="w-full px-4 py-3 bg-white/5 border border-[#D6D3D1] rounded-xl text-[#1C1917] placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#F97316] text-[#1C1917] py-3 rounded-xl font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Enviando...
                                </span>
                            ) : (
                                'Enviar Link de Recuperação'
                            )}
                        </button>

                        <div className="text-center">
                            <Link
                                href="/login"
                                className="text-[#9A3412] hover:text-[#1C1917] font-medium text-sm transition-colors"
                            >
                                ← Voltar ao Login
                            </Link>
                        </div>
                    </form>

                    <div className="mt-8 pt-6 border-t border-[#D6D3D1]">
                        <p className="text-xs text-slate-500 text-center">
                            O link de recuperação expira em 15 minutos por segurança.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
