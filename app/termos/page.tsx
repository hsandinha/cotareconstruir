import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-white">
            <Header />
            <div className="mx-auto max-w-4xl px-6 py-24">
                <h1 className="mb-8 text-3xl font-bold text-slate-900">Termos de Uso</h1>
                <div className="prose prose-slate max-w-none">
                    <p>Última atualização: 07 de dezembro de 2025</p>

                    <h2>1. Aceitação dos Termos</h2>
                    <p>Ao acessar e usar a plataforma Cota Reconstruir, você concorda com estes termos. Se você não concordar com qualquer parte destes termos, você não deve usar nossos serviços.</p>

                    <h2>2. Descrição do Serviço</h2>
                    <p>A Cota Reconstruir é uma plataforma que conecta compradores (clientes) a fornecedores de materiais de construção. Nós facilitamos o processo de cotação e negociação.</p>

                    <h2>3. Responsabilidades</h2>
                    <p>A Cota Reconstruir atua apenas como intermediária na troca de informações. Não nos responsabilizamos pela qualidade dos produtos entregues, prazos de entrega ou pagamentos. Toda a transação comercial é de responsabilidade exclusiva entre Comprador e Fornecedor.</p>

                    <h2>4. Cadastro</h2>
                    <p>Para usar o serviço, você deve fornecer informações verdadeiras e atualizadas. O uso de dados falsos (como CNPJ inválido) pode resultar no bloqueio da conta.</p>

                    <h2>5. Taxas e Pagamentos</h2>
                    <p>O uso da plataforma para cotação é gratuito para compradores. Fornecedores podem estar sujeitos a taxas de assinatura ou comissão, conforme plano contratado.</p>

                    <h2>6. Alterações</h2>
                    <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entram em vigor assim que publicadas na plataforma.</p>
                </div>
            </div>
            <Footer />
        </main>
    );
}
