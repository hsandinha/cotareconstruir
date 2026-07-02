/**
 * Gerencia o nome de usuário comercial (business username) do WhatsApp.
 *
 * Uso:
 *   node scripts/whatsapp-username.mjs suggestions          # lista nomes reservados/sugeridos
 *   node scripts/whatsapp-username.mjs status               # mostra o username atual e seu status
 *   node scripts/whatsapp-username.mjs claim <username>     # reivindica um nome (vai para aprovação)
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   WHATSAPP_TOKEN             - Token permanente (System User Token)
 *   WHATSAPP_PHONE_NUMBER_ID   - ID do número comercial (business phone number id)
 *
 * Observações:
 *   - O recurso está em rollout gradual da Meta; se a conta não estiver elegível,
 *     a API retorna (#147002) "Account not eligible to request a username".
 *   - Após reivindicar, o status fica pendente até aprovação e disponibilidade no país.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.error('❌ Configure WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID no .env.local');
    process.exit(1);
}

function printResult(label, data) {
    if (data.error) {
        console.error(`❌ ${label} falhou:`);
        console.error(`   ${data.error.error_user_msg || data.error.message}`);
        if (data.error.code) console.error(`   código: ${data.error.code} / subcódigo: ${data.error.error_subcode || '-'}`);
        return false;
    }
    console.log(`✅ ${label}:`);
    console.log(JSON.stringify(data, null, 2));
    return true;
}

async function suggestions() {
    const res = await fetch(`${GRAPH_API}/${PHONE_NUMBER_ID}/username_suggestions`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const data = await res.json();
    printResult('Sugestões de nome de usuário', data);
}

async function status() {
    const res = await fetch(`${GRAPH_API}/${PHONE_NUMBER_ID}?fields=username`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const data = await res.json();
    printResult('Status do nome de usuário', data);
}

async function claim(username) {
    if (!username) {
        console.error('❌ Informe o nome de usuário. Ex: node scripts/whatsapp-username.mjs claim meunome');
        process.exit(1);
    }
    const res = await fetch(`${GRAPH_API}/${PHONE_NUMBER_ID}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
    });
    const data = await res.json();
    printResult(`Reivindicação do nome "${username}"`, data);
}

async function main() {
    const [command, arg] = process.argv.slice(2);
    switch (command) {
        case 'suggestions':
            await suggestions();
            break;
        case 'status':
            await status();
            break;
        case 'claim':
            await claim(arg);
            break;
        default:
            console.log('Uso:');
            console.log('  node scripts/whatsapp-username.mjs suggestions');
            console.log('  node scripts/whatsapp-username.mjs status');
            console.log('  node scripts/whatsapp-username.mjs claim <username>');
            process.exit(1);
    }
}

main().catch((err) => {
    console.error('❌ Erro inesperado:', err);
    process.exit(1);
});
