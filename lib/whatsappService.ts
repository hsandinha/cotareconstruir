/**
 * WhatsApp Service - Meta Cloud API
 * Gerencia envio e recebimento de mensagens via WhatsApp Business API
 * 
 * Variáveis de ambiente necessárias:
 *   WHATSAPP_VERIFY_TOKEN      - Token de verificação do webhook (você define)
 *   WHATSAPP_ACCESS_TOKEN      - Token permanente da Meta (System User Token)
 *   WHATSAPP_PHONE_NUMBER_ID   - ID do número de telefone no WhatsApp Business
 *   WHATSAPP_BUSINESS_ACCOUNT_ID - ID da conta WhatsApp Business (opcional)
 */

import { registrarEnvio, paramsDoComponente } from './whatsappCentral';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * De onde partiu o envio. 'automatica' é o disparo do sistema (cotação nova,
 * proposta, pedido); 'central' é alguém respondendo na tela da Central de
 * WhatsApp — nesse caso `enviadaPor` diz quem.
 */
export interface OrigemEnvio {
    origem?: 'automatica' | 'central';
    enviadaPor?: string | null;
}

interface WhatsAppTextMessage extends OrigemEnvio {
    to: string;          // Número com código do país (ex: 5511999999999)
    text: string;
}

interface WhatsAppTemplateMessage extends OrigemEnvio {
    to: string;
    templateName: string;
    language?: string;
    components?: any[];
}

interface WhatsAppSendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ============================================================
// ENVIO DE MENSAGENS
// ============================================================

/**
 * Envia mensagem de texto simples
 */
export async function sendWhatsAppText({ to, text, origem, enviadaPor }: WhatsAppTextMessage): Promise<WhatsAppSendResult> {
    return sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formatPhoneNumber(to),
        type: 'text',
        text: { preview_url: false, body: text }
    }, { origem, enviadaPor });
}

/**
 * Envia mensagem usando template aprovado
 */
export async function sendWhatsAppTemplate({ to, templateName, language = 'pt_BR', components, origem, enviadaPor }: WhatsAppTemplateMessage): Promise<WhatsAppSendResult> {
    return sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: formatPhoneNumber(to),
        type: 'template',
        template: {
            name: templateName,
            language: { code: language },
            ...(components ? { components } : {})
        }
    }, { origem, enviadaPor });
}

/**
 * Envia mensagem genérica via Meta Cloud API
 */
async function sendWhatsAppMessage(payload: any, meta: OrigemEnvio = {}): Promise<WhatsAppSendResult> {
    const accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
        console.error('❌ WhatsApp: WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados');
        return { success: false, error: 'WhatsApp não configurado' };
    }

    try {
        const response = await fetch(
            `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ WhatsApp API error:', data);
            const erro = data.error?.message || `HTTP ${response.status}`;
            // Registra a falha também: é assim que a Central mostra template
            // não aprovado ou número fora da janela de 24h.
            await registrarEnvioNaCentral(payload, meta, null, erro);
            return { success: false, error: erro };
        }

        const messageId = data.messages?.[0]?.id;
        console.log(`✅ WhatsApp enviado para ${payload.to} (ID: ${messageId})`);

        await registrarEnvioNaCentral(payload, meta, messageId, null);

        return { success: true, messageId };
    } catch (error: any) {
        console.error('❌ WhatsApp send error:', error);
        await registrarEnvioNaCentral(payload, meta, null, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Espelha o envio na Central de WhatsApp.
 *
 * Nunca propaga erro: a mensagem já saiu (ou já falhou) na Meta e o resultado
 * do envio não pode depender do banco.
 */
async function registrarEnvioNaCentral(
    payload: any,
    meta: OrigemEnvio,
    messageId: string | null,
    erro: string | null,
): Promise<void> {
    try {
        await registrarEnvio({
            telefone: payload.to,
            tipo: payload.type,
            texto: payload.text?.body ?? null,
            templateNome: payload.template?.name ?? null,
            templateParams: payload.template ? paramsDoComponente(payload.template.components) : null,
            waMessageId: messageId,
            origem: meta.origem || 'automatica',
            enviadaPor: meta.enviadaPor || null,
            erro,
        });
    } catch (e) {
        console.error('❌ WhatsApp: falha ao espelhar envio na Central', e);
    }
}

// ============================================================
// MÍDIA (upload e download na Meta)
// ============================================================

interface WhatsAppMediaUpload {
    success: boolean;
    mediaId?: string;
    error?: string;
}

/**
 * Sobe um arquivo para a Meta e devolve o media_id.
 *
 * O id é o que vai no cabeçalho do template (ou numa mensagem de documento):
 * a Meta não aceita anexo por bytes na hora do envio. Vale ~30 dias.
 */
export async function uploadWhatsAppMedia(
    conteudo: Buffer | Uint8Array,
    filename: string,
    mimeType: string,
): Promise<WhatsAppMediaUpload> {
    const accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
        return { success: false, error: 'WhatsApp não configurado' };
    }

    try {
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', mimeType);
        form.append('file', new Blob([new Uint8Array(conteudo)], { type: mimeType }), filename);

        const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/media`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });

        const data = await response.json();
        if (!response.ok || !data?.id) {
            const erro = data?.error?.message || `HTTP ${response.status}`;
            console.error('❌ WhatsApp: falha ao subir mídia:', erro);
            return { success: false, error: erro };
        }

        return { success: true, mediaId: data.id };
    } catch (error: any) {
        console.error('❌ WhatsApp: erro ao subir mídia', error);
        return { success: false, error: error.message };
    }
}

/**
 * ID de mídia → link temporário da Meta (vale poucos minutos) e mime.
 *
 * O webhook só entrega o ID; o download exige este passo intermediário e o
 * token da conta nas duas chamadas.
 */
export async function resolveWhatsAppMediaUrl(
    mediaId: string,
): Promise<{ url: string; mimeType?: string } | null> {
    const accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) return null;

    const response = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.url) return null;
    return { url: data.url, mimeType: data.mime_type };
}

/** Baixa a mídia inteira para memória. Usado para ler a planilha devolvida. */
export async function downloadWhatsAppMedia(
    mediaId: string,
): Promise<{ buffer: ArrayBuffer; mimeType?: string } | null> {
    const accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) return null;

    try {
        const meta = await resolveWhatsAppMediaUrl(mediaId);
        if (!meta) return null;

        const arquivo = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!arquivo.ok) return null;

        return { buffer: await arquivo.arrayBuffer(), mimeType: meta.mimeType };
    } catch (error) {
        console.error('❌ WhatsApp: erro ao baixar mídia', error);
        return null;
    }
}

/**
 * Marca mensagem como lida
 */
export async function markAsRead(messageId: string): Promise<void> {
    const accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) return;

    try {
        await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            }),
        });
    } catch (error) {
        console.error('Erro ao marcar mensagem como lida:', error);
    }
}

// ============================================================
// PROCESSAMENTO DE MENSAGENS RECEBIDAS (Webhook)
// ============================================================

export interface WhatsAppIncomingMessage {
    from: string;               // Número do remetente
    messageId: string;          // ID da mensagem
    timestamp: string;          // Unix timestamp
    type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contacts' | 'interactive' | 'button' | 'reaction';
    text?: string;              // Texto, legenda da mídia ou rótulo do botão
    name?: string;              // Nome do contato
    mediaId?: string;           // ID da mídia na Meta (baixada sob demanda)
    mediaMime?: string;
    mediaFilename?: string;
    raw: any;                   // Payload original completo
}

/**
 * Tira da mensagem o texto que representa ela na conversa.
 *
 * Mídia não tem corpo, mas quase sempre tem legenda — e uma legenda diz muito
 * mais na lista de conversas do que "[imagem]". Botão e resposta rápida
 * entram pelo rótulo, que é o que o contato de fato tocou.
 */
function extrairTexto(msg: any): string | undefined {
    return (
        msg.text?.body
        || msg.image?.caption
        || msg.video?.caption
        || msg.document?.caption
        || msg.document?.filename
        || msg.interactive?.button_reply?.title
        || msg.interactive?.list_reply?.title
        || msg.button?.text
        || msg.reaction?.emoji
        || undefined
    );
}

/** Anexo da mensagem, quando há. A Meta manda o ID; o binário vem depois. */
function extrairMidia(msg: any): { id?: string; mime_type?: string; filename?: string } | undefined {
    return msg.image || msg.video || msg.audio || msg.document || msg.sticker || undefined;
}

export interface WhatsAppStatusUpdate {
    messageId: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipientId: string;
    errors?: any[];
}

/**
 * Extrai mensagens do payload do webhook da Meta
 */
export function parseWebhookMessages(body: any): WhatsAppIncomingMessage[] {
    const messages: WhatsAppIncomingMessage[] = [];

    try {
        const entries = body.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field !== 'messages') continue;

                const value = change.value || {};
                const contacts = value.contacts || [];
                const msgs = value.messages || [];

                for (const msg of msgs) {
                    const contact = contacts.find((c: any) => c.wa_id === msg.from);
                    const midia = extrairMidia(msg);
                    messages.push({
                        from: msg.from,
                        messageId: msg.id,
                        timestamp: msg.timestamp,
                        type: msg.type,
                        text: extrairTexto(msg),
                        name: contact?.profile?.name,
                        mediaId: midia?.id,
                        mediaMime: midia?.mime_type,
                        mediaFilename: midia?.filename,
                        raw: msg,
                    });
                }
            }
        }
    } catch (error) {
        console.error('Erro ao parsear webhook WhatsApp:', error);
    }

    return messages;
}

/**
 * Extrai status updates do payload do webhook
 */
export function parseWebhookStatuses(body: any): WhatsAppStatusUpdate[] {
    const statuses: WhatsAppStatusUpdate[] = [];

    try {
        const entries = body.entry || [];
        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field !== 'messages') continue;

                const value = change.value || {};
                const statusList = value.statuses || [];

                for (const status of statusList) {
                    statuses.push({
                        messageId: status.id,
                        status: status.status,
                        timestamp: status.timestamp,
                        recipientId: status.recipient_id,
                        errors: status.errors,
                    });
                }
            }
        }
    } catch (error) {
        console.error('Erro ao parsear statuses WhatsApp:', error);
    }

    return statuses;
}

// ============================================================
// TEMPLATES DE MENSAGENS DO SISTEMA
// ============================================================

/**
 * Monta os parâmetros do corpo (variáveis {{1}}, {{2}}) de um template.
 */
function bodyParams(...values: string[]): any[] {
    return [
        {
            type: 'body',
            parameters: values.map((text) => ({ type: 'text', text })),
        },
    ];
}

/** Planilha de resposta anexada à notificação de cotação. */
export interface PlanilhaCotacaoAnexo {
    conteudo: Buffer | Uint8Array;
    filename: string;
    mimeType?: string;
}

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Notifica fornecedor sobre nova cotação recebida.
 *
 * Quatro níveis de envio, do melhor para o que sempre funciona:
 *   v5 — botão que abre o FORMULÁRIO de resposta (sem login, sem arquivo),
 *        com a planilha anexada para quem ainda prefere o Excel. É o caminho
 *        mais curto até uma proposta e deve ser sempre o primeiro.
 *        (O v4 é o mesmo template com a base do link sem `www`, que
 *        redireciona; ficou na conta só para a Central conseguir renderizar
 *        mensagem antiga, e não entra mais na cadeia de envio.)
 *   v3 — anexa a planilha de resposta no cabeçalho do template. O fornecedor
 *        preenche o preço e devolve o arquivo na própria conversa; o webhook
 *        lê, monta a proposta e envia ao cliente (lib/cotacaoRespostaWhatsapp.ts).
 *   v2 — botão /login?wa=<token>, que pré-preenche o email e abre a cotação.
 *   v1 — texto puro com botão fixo para a plataforma.
 *
 * A degradação importa: template novo demora a ser aprovado pela Meta, e até
 * lá a notificação não pode parar de sair.
 *
 * Templates: nova_cotacao_fornecedor[_v2|_v3|_v5] — {{1}} = número da cotação, {{2}} = obra.
 */
export async function notifySupplierNewQuotation(
    phone: string,
    cotacaoNumero: string,
    obraNome: string,
    loginRef?: string,
    planilha?: PlanilhaCotacaoAnexo,
    propostaToken?: string,
): Promise<WhatsAppSendResult> {
    // v4: o botão abre o formulário de resposta direto, sem login e sem
    // arquivo. A planilha continua anexada para quem prefere o Excel.
    if (planilha && propostaToken) {
        const upload = await uploadWhatsAppMedia(
            planilha.conteudo,
            planilha.filename,
            planilha.mimeType || MIME_XLSX,
        );

        if (upload.success && upload.mediaId) {
            const result = await sendWhatsAppTemplate({
                to: phone,
                templateName: 'nova_cotacao_fornecedor_v5',
                language: 'pt_BR',
                components: [
                    {
                        type: 'header',
                        parameters: [
                            { type: 'document', document: { id: upload.mediaId, filename: planilha.filename } },
                        ],
                    },
                    ...bodyParams(cotacaoNumero, obraNome),
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [{ type: 'text', text: propostaToken }],
                    },
                ],
            });
            if (result.success) return result;
            // Sem tentar o v4 no meio: a única diferença dele é a base do
            // link SEM www, que responde com redirecionamento. Cair nele
            // seria trocar uma falha por uma entrega pior.
            console.warn(`⚠️ WhatsApp: template v5 (link de resposta) falhou (${result.error}), usando v3`);
        } else {
            console.warn(`⚠️ WhatsApp: planilha não subiu (${upload.error}), usando v3`);
        }
    }

    if (planilha && loginRef) {
        const upload = await uploadWhatsAppMedia(
            planilha.conteudo,
            planilha.filename,
            planilha.mimeType || MIME_XLSX,
        );

        if (upload.success && upload.mediaId) {
            const result = await sendWhatsAppTemplate({
                to: phone,
                templateName: 'nova_cotacao_fornecedor_v3',
                language: 'pt_BR',
                components: [
                    {
                        type: 'header',
                        parameters: [
                            { type: 'document', document: { id: upload.mediaId, filename: planilha.filename } },
                        ],
                    },
                    ...bodyParams(cotacaoNumero, obraNome),
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [{ type: 'text', text: loginRef }],
                    },
                ],
            });
            if (result.success) return result;
            console.warn(`⚠️ WhatsApp: template v3 (com planilha) falhou (${result.error}), usando v2`);
        } else {
            console.warn(`⚠️ WhatsApp: planilha não subiu (${upload.error}), usando v2`);
        }
    }

    if (loginRef) {
        const result = await sendWhatsAppTemplate({
            to: phone,
            templateName: 'nova_cotacao_fornecedor_v2',
            language: 'pt_BR',
            components: [
                ...bodyParams(cotacaoNumero, obraNome),
                {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: loginRef }],
                },
            ],
        });
        if (result.success) return result;
        console.warn(`⚠️ WhatsApp: template v2 falhou (${result.error}), usando nova_cotacao_fornecedor`);
    }
    return sendWhatsAppTemplate({
        to: phone,
        templateName: 'nova_cotacao_fornecedor',
        language: 'pt_BR',
        components: bodyParams(cotacaoNumero, obraNome),
    });
}

/**
 * Notifica cliente sobre nova proposta recebida.
 *
 * Três níveis, todos com o mesmo par de variáveis:
 *   v3 — texto enquadrado como atualização da cotação do próprio cliente.
 *        É o único da família classificado como UTILITY pela Meta; o v2 e o
 *        v1 caíram em MARKETING, que custa mais e não entrega para quem optou
 *        por não receber promoção (ver docs/cotacao-por-whatsapp.md).
 *   v2 — mesmo botão de deep-link, mas MARKETING.
 *   v1 — sem botão dinâmico, MARKETING.
 *
 * Templates: nova_proposta_cliente[_v2|_v3] — {{1}} = número da cotação,
 * {{2}} = rótulo do fornecedor ("Fornecedor N" até o fechamento).
 */
export async function notifyClientNewProposal(phone: string, cotacaoNumero: string, supplierName: string, loginRef?: string): Promise<WhatsAppSendResult> {
    if (loginRef) {
        const comBotao = (templateName: string) => sendWhatsAppTemplate({
            to: phone,
            templateName,
            language: 'pt_BR',
            components: [
                ...bodyParams(cotacaoNumero, supplierName),
                {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: loginRef }],
                },
            ],
        });

        const v3 = await comBotao('nova_proposta_cliente_v3');
        if (v3.success) return v3;
        console.warn(`⚠️ WhatsApp: template v3 falhou (${v3.error}), usando nova_proposta_cliente_v2`);

        const v2 = await comBotao('nova_proposta_cliente_v2');
        if (v2.success) return v2;
        console.warn(`⚠️ WhatsApp: template v2 falhou (${v2.error}), usando nova_proposta_cliente`);
    }
    return sendWhatsAppTemplate({
        to: phone,
        templateName: 'nova_proposta_cliente',
        language: 'pt_BR',
        components: bodyParams(cotacaoNumero, supplierName),
    });
}

/**
 * Deve avisar o fornecedor no WhatsApp por causa desta mensagem?
 *
 * Três condições, todas necessárias:
 *  - é a PRIMEIRA mensagem da sala (avisar a cada mensagem viraria spam e
 *    a Meta pune número que dispara demais);
 *  - quem escreveu é o cliente (o fornecedor não precisa ser avisado da
 *    própria mensagem);
 *  - a sala tem fornecedor identificado.
 */
export function devoAvisarFornecedorNoChat(params: {
    totalMensagensNaSala: number;
    autorId: string | null | undefined;
    clienteId: string | null | undefined;
    fornecedorId: string | null | undefined;
}): boolean {
    const { totalMensagensNaSala, autorId, clienteId, fornecedorId } = params;
    if (totalMensagensNaSala !== 1) return false;
    if (!autorId || !clienteId || autorId !== clienteId) return false;
    return Boolean(fornecedorId);
}

/**
 * Notifica o fornecedor de que um cliente ABRIU uma conversa no chat.
 *
 * Só na primeira mensagem de cada sala: a partir daí o fornecedor já está
 * ciente e recebe pela plataforma. Mandar a cada mensagem viraria spam e
 * queimaria o número na Meta.
 *
 * Template: nova_mensagem_chat_fornecedor — {{1}} = cliente, {{2}} = assunto.
 * Se o template não estiver aprovado, tenta texto livre — que só entrega se
 * houver janela de 24h aberta com aquele número.
 */
export async function notifySupplierNewChat(
    phone: string,
    clientName: string,
    assunto: string,
    loginRef?: string
): Promise<WhatsAppSendResult> {
    const componentes: any[] = bodyParams(clientName, assunto);
    if (loginRef) {
        componentes.push({
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: loginRef }],
        });
    }

    const result = await sendWhatsAppTemplate({
        to: phone,
        templateName: 'nova_mensagem_chat_fornecedor',
        language: 'pt_BR',
        components: componentes,
    });
    if (result.success) return result;

    console.warn(`⚠️ WhatsApp: template de chat falhou (${result.error}), tentando texto livre`);
    return sendWhatsAppText({
        to: phone,
        text: `Olá! ${clientName} iniciou uma conversa com você na Comprar e Construir sobre ${assunto}. Acesse a plataforma para responder.`,
    });
}

/**
 * Notifica fornecedor sobre pedido aprovado.
 *
 * Com `loginRef` usa o template pedido_aprovado_fornecedor_v2 com botão de URL
 * dinâmica (/login?wa=<token>), abrindo direto a cotação no painel do
 * fornecedor. Fallback para o template antigo se o v2 não estiver aprovado.
 *
 * Templates: pedido_aprovado_fornecedor[_v2] — {{1}} = número do pedido, {{2}} = cliente.
 */
export async function notifySupplierOrderApproved(phone: string, pedidoNumero: string, clientName: string, loginRef?: string): Promise<WhatsAppSendResult> {
    if (loginRef) {
        const result = await sendWhatsAppTemplate({
            to: phone,
            templateName: 'pedido_aprovado_fornecedor_v2',
            language: 'pt_BR',
            components: [
                ...bodyParams(pedidoNumero, clientName),
                {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: loginRef }],
                },
            ],
        });
        if (result.success) return result;
        console.warn(`⚠️ WhatsApp: template v2 falhou (${result.error}), usando pedido_aprovado_fornecedor`);
    }
    return sendWhatsAppTemplate({
        to: phone,
        templateName: 'pedido_aprovado_fornecedor',
        language: 'pt_BR',
        components: bodyParams(pedidoNumero, clientName),
    });
}

/**
 * Envia credenciais de acesso para novo fornecedor
 */
export async function sendSupplierCredentials(phone: string, email: string, password: string): Promise<WhatsAppSendResult> {
    return sendWhatsAppText({
        to: phone,
        text: `🏗️ *Bem-vindo ao Comprar e Construir!*\n\nSuas credenciais de acesso:\n📧 Email: ${email}\n🔑 Senha: ${password}\n\nAcesse: https://comprareconstruir.com/login`
    });
}

// ============================================================
// UTILITÁRIOS
// ============================================================

/**
 * Formata número de telefone para o padrão da Meta API (somente dígitos com DDI)
 */
function formatPhoneNumber(phone: string): string {
    // Remove tudo que não é dígito
    let digits = phone.replace(/\D/g, '');

    // Se começa com 0, remove
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }

    // Se não tem código de país (Brasil = 55), adiciona
    if (!digits.startsWith('55') && digits.length <= 11) {
        digits = '55' + digits;
    }

    return digits;
}
