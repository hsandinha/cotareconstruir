import Link from "next/link";

export const metadata = { title: "Sem conexão | Comprar & Construir" };

/** Página servida pelo service worker quando o aparelho está offline. */
export default function OfflinePage() {
    return (
        <main className="tela-grafite flex min-h-dvh flex-col items-center justify-center bg-[#292524] px-6 text-center">
            <div className="w-full max-w-sm rounded-md border border-white/10 bg-[#1C1917] p-8">
                <h1 className="text-xl font-bold text-white">Você está sem conexão</h1>
                <p className="mt-3 text-sm leading-relaxed text-[#D6D3D1]">
                    Cotações, propostas e pedidos precisam de internet para mostrar valores
                    atualizados — por isso não guardamos essas telas para uso offline.
                </p>
                <Link
                    href="/"
                    className="mt-6 inline-block rounded-lg bg-[#F97316] px-6 py-3 text-sm font-bold text-[#1C1917] shadow-[4px_4px_0_rgba(0,0,0,0.4)] hover:bg-[#FB923C]"
                >
                    Tentar novamente
                </Link>
            </div>
        </main>
    );
}
