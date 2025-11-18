"use client";

export default function AdminDashboard() {
    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Dashboard de Administração</h1>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-5 shadow">
                    <div className="text-sm text-slate-500">Usuários</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">1.240</div>
                </div>
                <div className="rounded-lg bg-white p-5 shadow">
                    <div className="text-sm text-slate-500">Fornecedores</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">320</div>
                </div>
                <div className="rounded-lg bg-white p-5 shadow">
                    <div className="text-sm text-slate-500">Cotações</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">3.412</div>
                </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="text-lg font-semibold">Visão Geral</h2>
                <p className="mt-2 text-sm text-slate-600">Ferramentas administrativas (mock). Gerenciamento de usuários, cotações e fornecedores.</p>
            </div>
        </div>
    );
}
