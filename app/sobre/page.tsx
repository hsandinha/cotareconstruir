import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

export const metadata = {
    title: "Sobre Nós | Comprar & Construir",
    description: "Décadas de canteiro, agora em uma plataforma.",
};

export default function SobrePage() {
    return (
        <main className="min-h-screen bg-white">
            <Header />
            <div className="mx-auto max-w-4xl px-6 py-24">
                <h1 className="text-3xl font-bold text-slate-900">Sobre Nós</h1>
                <p className="mt-4 text-xl font-semibold text-slate-700">
                    Décadas de canteiro, agora em uma plataforma.
                </p>

                <div className="mt-10 space-y-6 text-lg leading-relaxed text-slate-600">
                    <p>
                        A Comprar &amp; Construir nasceu dentro da obra, não de um escritório. São décadas de projetos,
                        orçamentação e gestão de obras que se transformaram em uma metodologia própria de gestão de
                        suprimentos e compras — construída na prática, validada em centenas de obras, e refinada por
                        quem negociou material, formou preço e segurou margem em cada fase da construção.
                    </p>
                    <p>
                        Durante anos, essa metodologia atendeu centenas de engenheiros, gestores de obras e
                        construtoras, com resultados que se repetiam obra após obra: mais tempo devolvido à equipe,
                        menos desperdício, fornecedores qualificados para cada etapa, e a segurança de decidir com
                        informação na mão.
                    </p>
                    <p className="font-semibold text-slate-900">O que mudou não foi o método. Foi a ferramenta.</p>
                    <p>
                        Hoje, todo esse conhecimento está em uma plataforma moderna — ágil, digital e acessível. Mas ela
                        carrega uma bagagem que nenhum software de prateleira tem: a experiência de quem sabe que compra
                        de obra não se resolve com um catálogo, e sim com parceria. Sabemos o valor de um fornecedor que
                        entrega no prazo, de uma relação construída ao longo de anos e de uma negociação que respeita os
                        dois lados.
                    </p>
                    <p>
                        É por isso que, no momento hostil que o setor enfrenta — custos pressionados, prazos apertados e
                        margens cada vez mais finas —, acreditamos que a saída não é cortar relação, é qualificar
                        decisão. Unimos a rede de fornecedores que selecionamos por três décadas ao conhecimento técnico
                        de quem viveu a obra, para que construtores e fornecedores atravessem esse cenário juntos, com
                        mais transparência, mais concorrência e melhores resultados.
                    </p>
                </div>

                <p className="mt-12 border-t border-slate-200 pt-8 text-xl font-semibold text-slate-900">
                    Mais de 30 anos de suprimentos. Agora, na tela do seu computador.
                </p>
            </div>
            <Footer />
        </main>
    );
}
