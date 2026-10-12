/**
 * Cria/submete os templates de mensagem do WhatsApp na Meta para aprovação.
 *
 * Uso:
 *   node scripts/create-whatsapp-templates.mjs                    # cria os que faltam
 *   node scripts/create-whatsapp-templates.mjs --list             # lista os existentes e o status
 *   node scripts/create-whatsapp-templates.mjs --only <nome>      # submete só esse
 *   node scripts/create-whatsapp-templates.mjs --amostra <arq>    # grava o PDF de exemplo e sai
 *   node scripts/create-whatsapp-templates.mjs --categoria <nome> UTILITY
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   WHATSAPP_TOKEN     - Token permanente (System User Token)
 *   WHATSAPP_WABA_ID   - ID da conta WhatsApp Business (WABA)
 *
 * Observações:
 *   - Categoria UTILITY: notificações transacionais (cotação, pedido, proposta).
 *   - Cada template tem um botão de URL fixo para acessar a plataforma.
 *   - Após submeter, o status fica PENDING até a Meta aprovar (normalmente minutos a algumas horas).
 *
 * nova_cotacao_fornecedor_v3 tem cabeçalho de DOCUMENTO (a planilha de
 * resposta). A Meta exige um arquivo de exemplo para aprovar esse cabeçalho, e
 * o exemplo não é enviado como bytes: passa pela Resumable Upload API, que
 * devolve um handle. Por isso esse template — e só ele — precisa também de:
 *   WHATSAPP_APP_ID   - ID do app na Meta (Configurações do app → Básico)
 */

import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const APP_ID = process.env.WHATSAPP_APP_ID || process.env.META_APP_ID;

const PLATFORM_URL = 'https://comprareconstruir.com/login';

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
        // v2: botão com URL dinâmica (?wa=<token>) — o token pré-preenche o
        // email no login e redireciona direto para a cotação após autenticar.
        name: 'nova_cotacao_fornecedor_v2',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
            {
                type: 'BODY',
                text: 'Olá! Você recebeu uma nova cotação na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Obra:* {{2}}\n\nToque no botão abaixo para acessar a cotação e enviar sua proposta.',
                example: { body_text: [['1024', 'Residencial Jardim das Flores']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    {
                        type: 'URL',
                        text: 'Ver cotação',
                        url: `${PLATFORM_URL}?wa={{1}}`,
                        example: [`${PLATFORM_URL}?wa=JTdCJTIyZSUyMiUzQSUyMmZvcm5lY2Vkb3IlNDBlbWFpbC5jb20lMjIlMkMlMjJjJTIyJTNBJTIyMTAyNCUyMiU3RA`],
                    },
                ],
            },
        ],
    },
    {
        // v3: o v2 mais a planilha de resposta no cabeçalho. O fornecedor
        // preenche a coluna de preço, devolve o arquivo na conversa e o
        // webhook monta a proposta — sem abrir a plataforma.
        // `needsDocumentSample` faz o script subir um .xlsx de exemplo e
        // trocar pelo handle que a Meta exige; não vai no corpo da requisição.
        name: 'nova_cotacao_fornecedor_v3',
        language: 'pt_BR',
        category: 'UTILITY',
        needsDocumentSample: true,
        components: [
            {
                type: 'HEADER',
                format: 'DOCUMENT',
                example: { header_handle: ['__HEADER_HANDLE__'] },
            },
            {
                type: 'BODY',
                text: 'Olá! Você recebeu uma nova cotação na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Obra:* {{2}}\n\nA planilha em anexo já vem com todos os itens: preencha a coluna *preco_unitario*, salve e devolva o arquivo aqui mesmo. Nós montamos a proposta e enviamos ao cliente.\n\nPrefere responder pela plataforma? Toque no botão abaixo.',
                example: { body_text: [['1024', 'Residencial Jardim das Flores']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    {
                        type: 'URL',
                        text: 'Ver cotação',
                        url: `${PLATFORM_URL}?wa={{1}}`,
                        example: [`${PLATFORM_URL}?wa=JTdCJTIyZSUyMiUzQSUyMmZvcm5lY2Vkb3IlNDBlbWFpbC5jb20lMjIlMkMlMjJjJTIyJTNBJTIyMTAyNCUyMiU3RA`],
                    },
                ],
            },
        ],
    },
    {
        // Só na PRIMEIRA mensagem de cada conversa — a partir daí o
        // fornecedor está na janela de 24h e recebe pela plataforma.
        name: 'nova_mensagem_chat_fornecedor',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
            {
                type: 'BODY',
                text: 'Olá! Um cliente iniciou uma conversa com você na Comprar e Construir.\n\n*Cliente:* {{1}}\n*Sobre:* {{2}}\n\nToque no botão abaixo para responder.',
                example: { body_text: [['Construtora Palhares', 'Cotação #1024']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    {
                        type: 'URL',
                        text: 'Responder',
                        url: `${PLATFORM_URL}?wa={{1}}`,
                        example: [`${PLATFORM_URL}?wa=JTdCJTIyZSUyMiUzQSUyMmZvcm5lY2Vkb3IlNDBlbWFpbC5jb20lMjIlN0Q`],
                    },
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
        // v2: botão com URL dinâmica (?wa=<token>) — abre direto a cotação/pedido
        // no painel do fornecedor após autenticar, com email pré-preenchido.
        name: 'pedido_aprovado_fornecedor_v2',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
            {
                type: 'BODY',
                text: 'Boas notícias! Seu pedido foi aprovado na Comprar e Construir.\n\n*Pedido:* #{{1}}\n*Cliente:* {{2}}\n\nToque no botão abaixo para acessar o pedido e preparar o envio.',
                example: { body_text: [['5087', 'Construtora Alfa']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    {
                        type: 'URL',
                        text: 'Ver pedido',
                        url: `${PLATFORM_URL}?wa={{1}}`,
                        example: [`${PLATFORM_URL}?wa=JTdCJTIyZSUyMiUzQSUyMmZvcm5lY2Vkb3IlNDBlbWFpbC5jb20lMjIlMkMlMjJjJTIyJTNBJTIyMTAyNCUyMiU3RA`],
                    },
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
    {
        // v2: botão com URL dinâmica (?wa=<token>) — abre direto a cotação no
        // painel do cliente após autenticar, com email pré-preenchido.
        name: 'nova_proposta_cliente_v2',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
            {
                type: 'BODY',
                text: 'Você recebeu uma nova proposta na Comprar e Construir.\n\n*Cotação:* #{{1}}\n*Fornecedor:* {{2}}\n\nToque no botão abaixo para ver a proposta no mapa comparativo.',
                example: { body_text: [['1024', 'Depósito Central Materiais']] },
            },
            {
                type: 'BUTTONS',
                buttons: [
                    {
                        type: 'URL',
                        text: 'Ver proposta',
                        url: `${PLATFORM_URL}?wa={{1}}`,
                        example: [`${PLATFORM_URL}?wa=JTdCJTIyZSUyMiUzQSUyMmNsaWVudGUlNDBlbWFpbC5jb20lMjIlMkMlMjJjJTIyJTNBJTIyMTAyNCUyMiU3RA`],
                    },
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
        console.log(`  • ${t.name} [${t.language}] — ${t.category} — status: ${t.status} — id: ${t.id}`);
    }
    console.log('');
}

/**
 * Troca a categoria de um template.
 *
 * A Meta classifica sozinha na criação e às vezes erra o alvo: notificação
 * transacional carimbada como MARKETING custa mais e pode ser barrada por
 * quem optou por não receber promoção.
 *
 * Só funciona enquanto o template NÃO está aprovado — depois a Meta recusa
 * com o subcode 3835031. Para um aprovado o caminho é criar a versão nova
 * (um `_v2` já na categoria certa) e deixar a antiga morrer como fallback,
 * que é o que o código faz: só cai no v1 se o v2 falhar.
 */
async function recategorizar(nome, categoria) {
    const listaUrl = `${GRAPH_API}/${WABA_ID}/message_templates?limit=100&access_token=${ACCESS_TOKEN}`;
    const listaRes = await fetch(listaUrl);
    const lista = await listaRes.json();
    const alvo = (lista.data || []).find((t) => t.name === nome);

    if (!alvo) {
        console.error(`❌ Template "${nome}" não existe na WABA`);
        process.exit(1);
    }
    if (alvo.category === categoria) {
        console.log(`✓ "${nome}" já está como ${categoria} — nada a fazer`);
        return;
    }

    const res = await fetch(`${GRAPH_API}/${alvo.id}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: categoria }),
    });
    const data = await res.json();

    if (!res.ok) {
        console.error(`❌ Falha ao recategorizar "${nome}":`, JSON.stringify(data.error || data, null, 2));
        if (data.error?.error_subcode === 3835031) {
            console.error('\n   Template aprovado não muda de categoria. Crie uma versão nova já na'
                + '\n   categoria certa e deixe esta como fallback (ou apague depois que a nova'
                + '\n   estiver APPROVED).');
        }
        process.exit(1);
    }
    console.log(`✅ "${nome}": ${alvo.category} → ${categoria} (volta para revisão da Meta)`);
}

const MIME_PDF = 'application/pdf';

/**
 * PDF de exemplo para a revisão do cabeçalho DOCUMENT.
 *
 * Por que PDF e não a planilha: na Resumable Upload API a Meta até aceita o
 * .xlsx, mas recusa o template com "Tipo de arquivo não aceito" (subcode
 * 2388084) — a AMOSTRA de cabeçalho de documento só pode ser PDF. O anexo
 * real continua sendo o .xlsx gerado por lib/cotacaoPlanilha.ts; a amostra
 * serve apenas para o revisor ver que tipo de arquivo acompanha a mensagem.
 *
 * Montado à mão para não trazer dependência de PDF só por causa disto. São
 * cinco objetos (catálogo, páginas, página, fonte, conteúdo) e uma xref com
 * os deslocamentos em bytes de cada um.
 */
function samplePdf() {
    const linhas = [
        'Comprar e Construir',
        '',
        'Planilha de resposta da cotacao',
        '',
        'Este arquivo acompanha a notificacao de nova cotacao.',
        'O fornecedor preenche a coluna preco_unitario e devolve',
        'a planilha na propria conversa do WhatsApp.',
    ];

    const texto = linhas
        .map((linha, i) => `BT /F1 ${i === 0 ? 18 : 12} Tf 60 ${780 - i * 26} Td (${linha.replace(/([()\\])/g, '\\$1')}) Tj ET`)
        .join('\n');

    const objetos = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]'
            + ' /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    objetos.forEach((corpo, i) => {
        offsets.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
    });

    const inicioXref = pdf.length;
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
        pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${inicioXref}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
}

/**
 * Sobe o arquivo de exemplo pela Resumable Upload API e devolve o handle.
 *
 * São duas chamadas: a primeira abre a sessão, a segunda manda os bytes com
 * `file_offset: 0`. A segunda usa `Authorization: OAuth <token>` — e não
 * `Bearer` — que é como essa API em particular espera o token.
 */
async function uploadSampleDocument(fileName) {
    if (!APP_ID) {
        console.error('❌ Configure WHATSAPP_APP_ID no .env.local para submeter o template com anexo');
        return null;
    }

    const buffer = samplePdf();

    const sessionUrl = `${GRAPH_API}/${APP_ID}/uploads`
        + `?file_name=${encodeURIComponent(fileName)}`
        + `&file_length=${buffer.length}`
        + `&file_type=${encodeURIComponent(MIME_PDF)}`
        + `&access_token=${ACCESS_TOKEN}`;

    const sessionRes = await fetch(sessionUrl, { method: 'POST' });
    const session = await sessionRes.json();
    if (!sessionRes.ok || !session.id) {
        console.error('❌ Falha ao abrir sessão de upload:', JSON.stringify(session.error || session, null, 2));
        return null;
    }

    const uploadRes = await fetch(`${GRAPH_API}/${session.id}`, {
        method: 'POST',
        headers: {
            'Authorization': `OAuth ${ACCESS_TOKEN}`,
            'file_offset': '0',
            'Content-Type': 'application/octet-stream',
        },
        body: buffer,
    });
    const upload = await uploadRes.json();
    if (!uploadRes.ok || !upload.h) {
        console.error('❌ Falha ao subir arquivo de exemplo:', JSON.stringify(upload.error || upload, null, 2));
        return null;
    }

    console.log(`📎 Arquivo de exemplo enviado — handle: ${String(upload.h).slice(0, 24)}...`);
    return upload.h;
}

/**
 * Troca o placeholder do cabeçalho pelo handle real.
 * Devolve `null` quando o upload falhou — aí o template é pulado em vez de
 * ser submetido com exemplo inválido (a Meta rejeitaria).
 */
async function prepararTemplate(tpl) {
    const { needsDocumentSample, ...payload } = tpl;
    if (!needsDocumentSample) return payload;

    const handle = await uploadSampleDocument('cotacao-exemplo.pdf');
    if (!handle) return null;

    payload.components = payload.components.map((c) => (
        c.type === 'HEADER' && c.format === 'DOCUMENT'
            ? { ...c, example: { header_handle: [handle] } }
            : c
    ));
    return payload;
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

async function getExistingTemplateNames() {
    try {
        const url = `${GRAPH_API}/${WABA_ID}/message_templates?limit=100&access_token=${ACCESS_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) return new Set();
        return new Set((data.data || []).map((t) => t.name));
    } catch {
        return new Set();
    }
}

async function main() {
    if (process.argv.includes('--list')) {
        await listTemplates();
        return;
    }

    const catIndex = process.argv.indexOf('--categoria');
    if (catIndex >= 0) {
        const [nome, categoria] = process.argv.slice(catIndex + 1);
        if (!nome || !categoria) {
            console.error('❌ Uso: --categoria <nome do template> <UTILITY|MARKETING|AUTHENTICATION>');
            process.exit(1);
        }
        await recategorizar(nome, categoria.toUpperCase());
        return;
    }

    // Conferir a amostra antes de queimar uma submissão na conta.
    const amostraIndex = process.argv.indexOf('--amostra');
    if (amostraIndex >= 0) {
        const destino = process.argv[amostraIndex + 1] || 'cotacao-exemplo.pdf';
        writeFileSync(destino, samplePdf());
        console.log(`📄 PDF de exemplo gravado em ${destino}`);
        return;
    }

    // Submeter template é ação irreversível na conta: `--only` existe para
    // mandar um sem arrastar junto todos os outros que ainda faltam.
    const onlyIndex = process.argv.indexOf('--only');
    const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
    const alvos = only ? templates.filter((t) => t.name === only) : templates;

    if (only && alvos.length === 0) {
        console.error(`❌ Template "${only}" não existe neste arquivo. Disponíveis:`);
        for (const t of templates) console.error(`   • ${t.name}`);
        process.exit(1);
    }

    const existing = await getExistingTemplateNames();

    console.log(`\n🚀 Submetendo ${alvos.length} template(s) para aprovação na WABA ${WABA_ID}...\n`);
    let ok = 0;
    for (const tpl of alvos) {
        if (existing.has(tpl.name)) {
            console.log(`⏭️  "${tpl.name}" já existe na WABA — pulando`);
            continue;
        }
        const payload = await prepararTemplate(tpl);
        if (!payload) {
            console.log(`⏭️  "${tpl.name}" pulado — arquivo de exemplo não foi aceito`);
            continue;
        }
        const success = await createTemplate(payload);
        if (success) ok++;
    }
    console.log(`\n📊 Concluído: ${ok}/${alvos.length} submetidos.`);
    console.log('   Acompanhe a aprovação em: WhatsApp Manager → Modelos de mensagem.\n');
}

main().catch((err) => {
    console.error('❌ Erro inesperado:', err);
    process.exit(1);
});
