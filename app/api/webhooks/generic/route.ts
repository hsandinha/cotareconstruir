/**
 * API: Webhook genérico
 * POST /api/webhooks/generic
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, processWebhook, WebhookPayload } from '@/lib/webhooks';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
    try {
        const signature = request.headers.get('x-webhook-signature');
        const body = await request.text();
        const payload: WebhookPayload = JSON.parse(body);

        // Verificar assinatura
        const isValid = verifyWebhookSignature(body, signature);

        if (!isValid) {
            console.error('Invalid webhook signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // Processar webhook
        await processWebhook(payload);

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.WEBHOOK_RECEIVED,
            success: true,
            details: {
                webhook: 'generic',
                event: payload.event,
                timestamp: payload.timestamp,
            },
            ...metadata,
        });

        // SEMPRE retornar 200 OK
        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Webhook processing error:', error);

        // Log erro mas retorna 200 (para não ficar retentando)
        return NextResponse.json({ received: true, error: 'Processing failed' });
    }
}
