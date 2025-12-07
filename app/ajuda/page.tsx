import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

export default function FAQPage() {
    return (
        <main className="min-h-screen bg-white">
            <Header />
            <div className="mx-auto max-w-4xl px-6 py-24">
                <h1 className="mb-8 text-3xl font-bold text-slate-900">Perguntas Frequentes (FAQ)</h1>

                <div className="space-y-6">
                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">Como funciona a Cota Reconstruir?</h3>
                        <p className="mt-2 text-slate-600">Nós conectamos quem precisa comprar materiais de construção com fornecedores qualificados. O cliente cria uma lista de materiais, nós enviamos para fornecedores da região, e o cliente recebe as melhores propostas para comparar.</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">É gratuito?</h3>
                        <p className="mt-2 text-slate-600">Para compradores (clientes), o uso da plataforma é totalmente gratuito. Para fornecedores, pode haver planos de assinatura ou taxas sobre vendas.</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">Os fornecedores são verificados?</h3>
                        <p className="mt-2 text-slate-600">Sim, realizamos uma verificação básica do CNPJ na Receita Federal para garantir que a empresa está ativa. No entanto, recomendamos sempre verificar a reputação do fornecedor antes de fechar negócio.</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">Como faço o pagamento dos materiais?</h3>
                        <p className="mt-2 text-slate-600">O pagamento é negociado e realizado diretamente com o fornecedor. A Cota Reconstruir não processa pagamentos de materiais, apenas facilita o encontro entre as partes.</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">Meus dados estão seguros?</h3>
                        <p className="mt-2 text-slate-600">Sim. Seus dados de contato (telefone, e-mail) só são revelados para a outra parte quando um pedido é oficialmente finalizado na plataforma.</p>
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}
