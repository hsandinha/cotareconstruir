import Link from "next/link";
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
                        <h3 className="text-lg font-semibold text-slate-900">
                            Como funciona a Comprar e Construir (
                            <Link href="https://www.comprareconstruir.com" className="underline decoration-orange-500 underline-offset-2">
                                comprareconstruir.com
                            </Link>
                            )?
                        </h3>
                        <p className="mt-2 text-slate-600">Nós conectamos quem precisa comprar materiais de construção com fornecedores qualificados. O cliente cria uma lista de materiais, nós enviamos para fornecedores da região, e o cliente recebe as melhores propostas para comparar, tudo organizado em um Mapa Comparativo, com apenas alguns cliques, tudo rápido e seguro, dentro da nossa plataforma.</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">É gratuito?</h3>
                        <p className="mt-2 text-slate-600">Apenas para os fornecedores, possibilitando assim uma maior concorrência entre eles, resultando em melhores condições aos nossos clientes. Para o construtor, o primeiro mês é gratuito e ilimitado; depois, o acesso é de R$ 490,00 por mês, por obra.</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">Os fornecedores são verificados?</h3>
                        <p className="mt-2 text-slate-600">Sim, realizamos uma verificação básica do CNPJ na Receita Federal para garantir que a empresa está ativa. Mesmo com um histórico positivo de fornecimento para os nossos clientes ao longo de décadas, recomendamos sempre verificar a reputação do fornecedor antes de fechar negócio. Para isso, criamos uma ferramenta para os clientes avaliarem os fornecedores em vários quesitos. Ex: pontualidade na entrega, qualidade do material, solução rápida de eventual desacordo.</p>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-900">Como faço o pagamento dos materiais?</h3>
                        <p className="mt-2 text-slate-600">O pagamento é negociado e realizado diretamente com o fornecedor. A Comprar &amp; Construir não processa pagamentos de materiais, apenas facilita o encontro entre as partes.</p>
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
