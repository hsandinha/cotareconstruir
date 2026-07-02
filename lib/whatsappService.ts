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

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface WhatsAppTextMessage {
    to: string;          // Número com código do país (ex: 5511999999999)
    text: string;
}

interface WhatsAppTemplateMessage {
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
export async function sendWhatsAppText({ to, text }: WhatsAppTextMessage): Promise<WhatsAppSendResult> {
    return sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formatPhoneNumber(to),
        type: 'text',
        text: { preview_url: false, body: text }
    });
}

/**
 * Envia mensagem usando template aprovado
 */
export async function sendWhatsAppTemplate({ to, templateName, language = 'pt_BR', components }: WhatsAppTemplateMessage): Promise<WhatsAppSendResult> {
    return sendWhatsAppMessage({
        messaging_product: 'whatsapp',
        to: formatPhoneNumber(to),
        type: 'template',
        template: {
            name: templateName,
            language: { code: language },
            ...(components ? { components } : {})
        }
    });
}

/**
 * Envia mensagem genérica via Meta Cloud API
 */
async function sendWhatsAppMessage(payload: any): Promise<WhatsAppSendResult> {
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
            return {
                success: false,
                error: data.error?.message || `HTTP ${response.status}`
            };
        }

        const messageId = data.messages?.[0]?.id;
        console.log(`✅ WhatsApp enviado para ${payload.to} (ID: ${messageId})`);

        return { success: true, messageId };
    } catch (error: any) {
        console.error('❌ WhatsApp send error:', error);
        return { success: false, error: error.message };
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
    text?: string;              // Conteúdo se type=text
    name?: string;              // Nome do contato
    raw: any;                   // Payload original completo
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
                    messages.push({
                        from: msg.from,
                        messageId: msg.id,
                        timestamp: msg.timestamp,
                        type: msg.type,
                        text: msg.text?.body || msg.interactive?.button_reply?.title || msg.button?.text || undefined,
                        name: contact?.profile?.name,
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

/**
 * Notifica fornecedor sobre nova cotação recebida.
 * Template: nova_cotacao_fornecedor — {{1}} = número da cotação, {{2}} = obra.
 */
export async function notifySupplierNewQuotation(phone: string, cotacaoNumero: string, obraNome: string): Promise<WhatsAppSendResult> {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: 'nova_cotacao_fornecedor',
        language: 'pt_BR',
        components: bodyParams(cotacaoNumero, obraNome),
    });
}

/**
 * Notifica cliente sobre nova proposta recebida.
 * Template: nova_proposta_cliente — {{1}} = número da cotação, {{2}} = fornecedor.
 */
export async function notifyClientNewProposal(phone: string, cotacaoNumero: string, supplierName: string): Promise<WhatsAppSendResult> {
    return sendWhatsAppTemplate({
        to: phone,
        templateName: 'nova_proposta_cliente',
        language: 'pt_BR',
        components: bodyParams(cotacaoNumero, supplierName),
    });
}

/**
 * Notifica fornecedor sobre pedido aprovado.
 * Template: pedido_aprovado_fornecedor — {{1}} = número do pedido, {{2}} = cliente.
 */
export async function notifySupplierOrderApproved(phone: string, pedidoNumero: string, clientName: string): Promise<WhatsAppSendResult> {
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
        text: `🏗️ *Bem-vindo ao Cota Reconstruir!*\n\nSuas credenciais de acesso:\n📧 Email: ${email}\n🔑 Senha: ${password}\n\nAcesse: https://Comprareconstruir.com.br/login`
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
