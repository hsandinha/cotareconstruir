import Link from "next/link";

export const metadata = { title: "Sem conexão | Comprar & Construir" };

/** Página servida pelo service worker quando o aparelho está offline. */
export default function OfflinePage() {
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-900 px-6 text-center">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-800/60 p-8">
                <h1 className="text-xl font-bold text-white">Você está sem conexão</h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    Cotações, propostas e pedidos precisam de internet para mostrar valores
                    atualizados — por isso não guardamos essas telas para uso offline.
                </p>
                <Link
                    href="/"
                    className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    Tentar novamente
                </Link>
            </div>
        </main>
    );
}
