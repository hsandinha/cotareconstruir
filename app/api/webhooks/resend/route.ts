/**
 * API: Webhook Resend
 * POST /api/webhooks/resend
 *
 * Configure em: Resend Dashboard → Webhooks → Endpoint
 *   URL: https://seudominio.com/api/webhooks/resend
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Resend envia um único evento por requisição: { type, created_at, data }
        const eventType: string = (body.type || '').replace(/^email\./, '');
        const data = body.data || {};
        const email = Array.isArray(data.to) ? data.to[0] : data.to;
        const timestamp = body.created_at || new Date().toISOString();

        console.log('📧 Resend webhook received:', body.type);

        // Salvar evento no Supabase para análise
        await supabase
            .from('email_events')
            .insert({
                email: email || null,
                event: eventType,
                timestamp: new Date(timestamp).toISOString(),
                cotacao_id: null,
                raw_data: body,
            });

        // Processar eventos específicos
        switch (eventType) {
            case 'bounced':
                console.warn(`❌ Email bounce (registrado em email_events): ${email}`);
                break;

            case 'complained':
                console.warn(`🚫 Email marcado como spam pelo usuário: ${email}`);
                break;

            case 'opened':
                console.log(`👁️ Email aberto: ${email}`);
                break;

            case 'clicked':
                console.log(`🖱️ Link do email clicado: ${email}`);
                break;
        }

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.WEBHOOK_RECEIVED,
            success: true,
            details: {
                webhook: 'resend',
                eventType: body.type,
            },
            ...metadata,
        });

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Resend webhook error:', error);
        return NextResponse.json({ received: true });
    }
}
