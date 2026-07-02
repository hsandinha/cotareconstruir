/**
 * Cria/submete os templates de mensagem do WhatsApp na Meta para aprovação.
 *
 * Uso:
 *   node scripts/create-whatsapp-templates.mjs            # cria todos
 *   node scripts/create-whatsapp-templates.mjs --list     # lista templates existentes e status
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   WHATSAPP_TOKEN     - Token permanente (System User Token)
 *   WHATSAPP_WABA_ID   - ID da conta WhatsApp Business (WABA)
 *
 * Observações:
 *   - Categoria UTILITY: notificações transacionais (cotação, pedido, proposta).
 *   - Cada template tem um botão de URL fixo para acessar a plataforma.
 *   - Após submeter, o status fica PENDING até a Meta aprovar (normalmente minutos a algumas horas).
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
const WABA_ID = process.env.WHATSAPP_WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

const PLATFORM_URL = 'https://comprareconstruir.com.br/login';

if (!ACCESS_TOKEN || !WABA_ID) {
    console.error('❌ Configure WHATSAPP_TOKEN e WHATSAPP_WABA_ID no .env.local');
    process.exit(1);
}

/**
 * Definição dos templates.
 * As variáveis {{1}}, {{2}} são preenchidas em runtime pelo whatsappService.
 */
const templates = [
    {
        name: 'nova_cotacao_fornecedor',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
            {
                type: 'BODY',
                text: 'Olá! Você recebeu uma nova cotação na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Obra:* {{2}}\n\nAcesse a plataforma para analisar os itens e enviar sua proposta.',
                example: { body_text: [['1024', 'Residencial Jardim das Flores']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    { type: 'URL', text: 'Acessar plataforma', url: PLATFORM_URL },
                ],
            },
        ],
    },
    {
        name: 'pedido_aprovado_fornecedor',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
            {
                type: 'BODY',
                text: 'Boas notícias! Seu pedido foi aprovado na Comprar e Construir.\n\n*Pedido:* #{{1}}\n*Cliente:* {{2}}\n\nAcesse a plataforma para confirmar e preparar o envio.',
                example: { body_text: [['5087', 'Construtora Alfa']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    { type: 'URL', text: 'Acessar plataforma', url: PLATFORM_URL },
                ],
            },
        ],
    },
    {
        name: 'nova_proposta_cliente',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
            {
                type: 'BODY',
                text: 'Você recebeu uma nova proposta na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Fornecedor:* {{2}}\n\nAcesse o mapa comparativo na plataforma para avaliar e decidir.',
                example: { body_text: [['1024', 'Depósito Central Materiais']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    { type: 'URL', text: 'Acessar plataforma', url: PLATFORM_URL },
                ],
            },
        ],
    },
];

async function listTemplates() {
    const url = `${GRAPH_API}/${WABA_ID}/message_templates?limit=100&access_token=${ACCESS_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
        console.error('❌ Erro ao listar templates:', JSON.stringify(data.error || data, null, 2));
        process.exit(1);
    }
    console.log(`\n📋 Templates existentes na WABA (${data.data?.length || 0}):\n`);
    for (const t of data.data || []) {
        console.log(`  • ${t.name} [${t.language}] — ${t.category} — status: ${t.status}`);
    }
    console.log('');
}

async function createTemplate(tpl) {
    const url = `${GRAPH_API}/${WABA_ID}/message_templates`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(tpl),
    });
    const data = await res.json();
    if (!res.ok) {
        console.error(`❌ Falha ao criar "${tpl.name}":`, JSON.stringify(data.error || data, null, 2));
        return false;
    }
    console.log(`✅ Submetido "${tpl.name}" — id: ${data.id} — status: ${data.status || 'PENDING'}`);
    return true;
}

async function main() {
    if (process.argv.includes('--list')) {
        await listTemplates();
        return;
    }

    console.log(`\n🚀 Submetendo ${templates.length} templates para aprovação na WABA ${WABA_ID}...\n`);
    let ok = 0;
    for (const tpl of templates) {
        const success = await createTemplate(tpl);
        if (success) ok++;
    }
    console.log(`\n📊 Concluído: ${ok}/${templates.length} submetidos.`);
    console.log('   Acompanhe a aprovação em: WhatsApp Manager → Modelos de mensagem.\n');
}

main().catch((err) => {
    console.error('❌ Erro inesperado:', err);
    process.exit(1);
});
