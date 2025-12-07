import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-white">
            <Header />
            <div className="mx-auto max-w-4xl px-6 py-24">
                <h1 className="mb-8 text-3xl font-bold text-slate-900">Política de Privacidade</h1>
                <div className="prose prose-slate max-w-none">
                    <p>Última atualização: 07 de dezembro de 2025</p>

                    <h2>1. Coleta de Dados</h2>
                    <p>Coletamos informações que você nos fornece diretamente, como nome, e-mail, telefone, endereço e dados da empresa (CNPJ). Também coletamos dados de uso da plataforma automaticamente.</p>

                    <h2>2. Uso das Informações</h2>
                    <p>Usamos seus dados para:</p>
                    <ul>
                        <li>Conectar compradores e fornecedores (seus dados de contato são compartilhados apenas quando um pedido é finalizado).</li>
                        <li>Enviar notificações sobre o status das cotações e pedidos.</li>
                        <li>Melhorar nossos serviços e prevenir fraudes.</li>
                    </ul>

                    <h2>3. Compartilhamento de Dados</h2>
                    <p>Não vendemos seus dados pessoais. Compartilhamos suas informações apenas com:</p>
                    <ul>
                        <li>Fornecedores/Compradores envolvidos na sua transação.</li>
                        <li>Prestadores de serviço que nos ajudam a operar a plataforma (ex: envio de e-mails).</li>
                        <li>Autoridades legais, quando exigido por lei.</li>
                    </ul>

                    <h2>4. Segurança</h2>
                    <p>Adotamos medidas de segurança técnicas e administrativas para proteger seus dados, incluindo criptografia e controle de acesso rigoroso.</p>

                    <h2>5. Seus Direitos (LGPD)</h2>
                    <p>Você tem direito a acessar, corrigir ou solicitar a exclusão de seus dados pessoais. Para exercer esses direitos, entre em contato conosco através do suporte.</p>
                </div>
            </div>
            <Footer />
        </main>
    );
}
