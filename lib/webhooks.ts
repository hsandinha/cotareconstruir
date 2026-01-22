/**
 * Sistema de Webhooks
 * Permite receber notificações de serviços externos
 */

import crypto from 'crypto';

/**
 * Verificar assinatura de webhook (HMAC SHA256)
 */
export function verifyWebhookSignature(
    payload: any,
    signature: string | null,
    secret: string = process.env.WEBHOOK_SECRET!
): boolean {
    if (!signature || !secret) {
        return false;
    }

    try {
        const payloadString = typeof payload === 'string'
            ? payload
            : JSON.stringify(payload);

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');

        // Comparação segura contra timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch (error) {
        console.error('Webhook signature verification failed:', error);
        return false;
    }
}

/**
 * Verificar assinatura Mercado Pago
 */
export function verifyMercadoPagoSignature(
    dataId: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(dataId)
        .digest('hex');

    return signature === expectedSignature;
}

/**
 * Verificar assinatura SendGrid
 */
export function verifySendGridSignature(
    payload: string,
    signature: string,
    publicKey: string,
    timestamp: string
): boolean {
    try {
        const crypto = require('crypto');

        // SendGrid usa ECDSA
        const verifier = crypto.createVerify('sha256');
        verifier.update(timestamp + payload);

        return verifier.verify(publicKey, signature, 'base64');
    } catch (error) {
        console.error('SendGrid signature verification failed:', error);
        return false;
    }
}

/**
 * Tipos de eventos de webhook
 */
export enum WebhookEvent {
    // Pagamentos
    PAYMENT_APPROVED = 'payment.approved',
    PAYMENT_REJECTED = 'payment.rejected',
    PAYMENT_PENDING = 'payment.pending',
    PAYMENT_REFUNDED = 'payment.refunded',

    // Emails
    EMAIL_DELIVERED = 'email.delivered',
    EMAIL_OPENED = 'email.opened',
    EMAIL_CLICKED = 'email.clicked',
    EMAIL_BOUNCED = 'email.bounced',
    EMAIL_SPAM = 'email.spam',

    // Sistema
    USER_CREATED = 'user.created',
    USER_UPDATED = 'user.updated',
    COTACAO_CREATED = 'cotacao.created',
    PROPOSTA_RECEIVED = 'proposta.received',
}

/**
 * Interface de payload de webhook
 */
export interface WebhookPayload {
    event: WebhookEvent | string;
    timestamp: number;
    data: any;
    metadata?: Record<string, any>;
}

/**
 * Processar webhook baseado no evento
 */
export async function processWebhook(payload: WebhookPayload) {
    console.log(`📥 Processing webhook: ${payload.event}`);

    switch (payload.event) {
        case WebhookEvent.PAYMENT_APPROVED:
            await handlePaymentApproved(payload.data);
            break;

        case WebhookEvent.PAYMENT_REJECTED:
            await handlePaymentRejected(payload.data);
            break;

        case WebhookEvent.EMAIL_BOUNCED:
            await handleEmailBounced(payload.data);
            break;

        case WebhookEvent.EMAIL_SPAM:
            await handleEmailSpam(payload.data);
            break;

        default:
            console.log(`Unhandled webhook event: ${payload.event}`);
    }
}

/**
 * Handlers de eventos específicos
 */
async function handlePaymentApproved(data: any) {
    console.log('💰 Payment approved:', data);
    // TODO: Atualizar status da cotação
    // TODO: Notificar fornecedor
    // TODO: Enviar email de confirmação
}

async function handlePaymentRejected(data: any) {
    console.log('❌ Payment rejected:', data);
    // TODO: Notificar cliente
    // TODO: Oferecer métodos alternativos
}

async function handleEmailBounced(data: any) {
    console.log('📧 Email bounced:', data);
    // TODO: Marcar email como inválido
    // TODO: Notificar admin
}

async function handleEmailSpam(data: any) {
    console.log('🚫 Email marked as spam:', data);
    // TODO: Revisar conteúdo do email
    // TODO: Remover usuário da lista
}

/**
 * Criar payload de webhook para enviar
 */
export function createWebhookPayload(
    event: WebhookEvent | string,
    data: any,
    metadata?: Record<string, any>
): WebhookPayload {
    return {
        event,
        timestamp: Date.now(),
        data,
        metadata,
    };
}

/**
 * Assinar payload de webhook
 */
export function signWebhookPayload(
    payload: WebhookPayload,
    secret: string = process.env.WEBHOOK_SECRET!
): string {
    const payloadString = JSON.stringify(payload);

    return crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
}

/**
 * Enviar webhook para URL externa
 */
export async function sendWebhook(
    url: string,
    payload: WebhookPayload,
    secret?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const signature = secret ? signWebhookPayload(payload, secret) : undefined;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(signature && { 'X-Webhook-Signature': signature }),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Webhook failed with status ${response.status}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Failed to send webhook:', error);
        return { success: false, error: error.message };
    }
}
