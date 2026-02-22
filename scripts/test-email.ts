import dotenv from 'dotenv';

// Load env vars (prefer .env.local for this repo)
dotenv.config({ path: '.env.local' });
dotenv.config();

import { sendEmail, getFornecedorRecadastroEmailTemplate, getWelcomeEmailTemplate } from '../lib/emailService';

type EmailType = 'recadastro' | 'welcome';

function getArg(name: string): string | undefined {
    const idx = process.argv.indexOf(`--${name}`);
    if (idx === -1) return undefined;
    return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
    return process.argv.includes(`--${name}`);
}

function usageAndExit(code: number): never {
    // eslint-disable-next-line no-console
    console.log(`\nUso:\n  npx tsx scripts/test-email.ts --to email@destino.com --type recadastro\n\nOpções:\n  --to        (obrigatório) E-mail de destino\n  --type      recadastro | welcome (padrão: recadastro)\n  --name      Nome (usado em welcome; padrão: Teste)\n  --password  Senha temporária (usado em recadastro; padrão: 123456)\n  --dry-run   Não envia; só imprime subject e tamanhos\n`);
    process.exit(code);
}

async function main() {
    const to = getArg('to');
    if (!to) usageAndExit(1);

    const type = (getArg('type') || 'recadastro') as EmailType;
    const dryRun = hasFlag('dry-run');

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@Comprareconstruir.com.br';
    const fromName = process.env.SENDGRID_FROM_NAME || 'Cota Reconstruir';

    if (!process.env.SENDGRID_API_KEY && !dryRun) {
        throw new Error('SENDGRID_API_KEY não está configurada no ambiente (.env.local)');
    }

    let subject: string;
    let html: string;
    let text: string;

    if (type === 'welcome') {
        const name = getArg('name') || 'Teste';
        const tpl = getWelcomeEmailTemplate(name, to);
        subject = tpl.subject;
        html = tpl.html;
        text = tpl.text;
    } else if (type === 'recadastro') {
        const password = getArg('password') || '123456';
        const tpl = getFornecedorRecadastroEmailTemplate({ recipientEmail: to, temporaryPassword: password });
        subject = tpl.subject;
        html = tpl.html;
        text = tpl.text;
    } else {
        throw new Error(`Tipo inválido: ${type}`);
    }

    // eslint-disable-next-line no-console
    console.log(`\n[Email Test]`);
    // eslint-disable-next-line no-console
    console.log(`- type: ${type}`);
    // eslint-disable-next-line no-console
    console.log(`- from: ${fromName} <${fromEmail}>`);
    // eslint-disable-next-line no-console
    console.log(`- to:   ${to}`);
    // eslint-disable-next-line no-console
    console.log(`- subject: ${subject}`);
    // eslint-disable-next-line no-console
    console.log(`- html bytes: ${Buffer.byteLength(html, 'utf8')}`);
    // eslint-disable-next-line no-console
    console.log(`- text bytes: ${Buffer.byteLength(text, 'utf8')}`);

    if (dryRun) {
        // eslint-disable-next-line no-console
        console.log('\n(dry-run) Nada foi enviado.');
        return;
    }

    const result = await sendEmail({ to, subject, html, text });

    if (!result.success) {
        // eslint-disable-next-line no-console
        console.error(`\nFalha ao enviar: ${result.error}`);
        process.exitCode = 1;
        return;
    }

    // eslint-disable-next-line no-console
    console.log(`\nEnviado com sucesso. messageId: ${result.messageId}`);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});
