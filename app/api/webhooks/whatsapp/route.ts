/**
 * API Route: Webhook WhatsApp (Meta Cloud API)
 * 
 * GET  /api/webhooks/whatsapp → Verificação do webhook (challenge da Meta)
 * POST /api/webhooks/whatsapp → Receber mensagens e status updates
 * 
 * Configuração no Meta Developers:
 *   Callback URL:   https://seudominio.com/api/webhooks/whatsapp
 *   Verify Token:   (valor de WHATSAPP_VERIFY_TOKEN no .env)
 *   Webhook fields: messages
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    parseWebhookMessages,
    parseWebhookStatuses,
    markAsRead,
    type WhatsAppIncomingMessage,
    type WhatsAppStatusUpdate,
} from '@/lib/whatsappService';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';

// ============================================================
// GET - Verificação do Webhook (Meta envia um challenge)
// ============================================================
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ WhatsApp webhook verificado com sucesso');
        // Meta espera receber o challenge como resposta (plain text)
        return new NextResponse(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    console.warn('⚠️ WhatsApp webhook verification failed:', { mode, token: token?.slice(0, 5) + '...' });
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================================
// POST - Receber mensagens e status updates
// ============================================================
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Extrair mensagens recebidas
        const messages = parseWebhookMessages(body);
        const statuses = parseWebhookStatuses(body);

        // Processar mensagens recebidas
        for (const message of messages) {
            await handleIncomingMessage(message);
        }

        // Processar status updates (enviado, entregue, lido, falhou)
        for (const status of statuses) {
            await handleStatusUpdate(status);
        }

        // Audit log
        if (messages.length > 0 || statuses.length > 0) {
            const metadata = extractRequestMetadata(request);
            await logAuditEvent({
                action: AuditAction.WEBHOOK_RECEIVED,
                success: true,
                details: {
                    webhook: 'whatsapp',
                    messagesCount: messages.length,
                    statusesCount: statuses.length,
                },
                ...metadata,
            });
        }

        // SEMPRE retornar 200 OK (Meta reenvia se não receber 200)
        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('❌ WhatsApp webhook error:', error);
        // Retorna 200 mesmo com erro para evitar reenvios infinitos
        return NextResponse.json({ received: true, error: 'Processing failed' });
    }
}

// ============================================================
// HANDLERS
// ============================================================

/**
 * Processa mensagem recebida de um contato
 */
async function handleIncomingMessage(message: WhatsAppIncomingMessage) {
    console.log(`📩 WhatsApp de ${message.name || message.from}: [${message.type}] ${message.text || '(mídia)'}`);

    // Marcar como lida automaticamente
    await markAsRead(message.messageId);

    // TODO: Implementar lógica de processamento
    // Exemplos:
    // - Responder automaticamente com menu
    // - Buscar pedido pelo número
    // - Encaminhar para o chat do sistema
    // - Notificar admin sobre mensagem recebida

    if (message.type === 'text' && message.text) {
        // Exemplo: buscar pedido se a mensagem contiver um número
        const pedidoMatch = message.text.match(/\b(1\d{4})\b/);
        if (pedidoMatch) {
            console.log(`🔍 Possível consulta de pedido: #${pedidoMatch[1]}`);
            // TODO: Buscar pedido e responder com status
        }
    }
}

/**
 * Processa atualização de status de mensagem enviada
 */
async function handleStatusUpdate(status: WhatsAppStatusUpdate) {
    if (status.status === 'failed') {
        console.error(`❌ WhatsApp falhou para ${status.recipientId}:`, status.errors);
        // TODO: Registrar falha no banco, tentar canal alternativo (email)
    } else {
        console.log(`📊 WhatsApp status: ${status.messageId} → ${status.status}`);
    }

    // TODO: Atualizar status da notificação no banco de dados
}
