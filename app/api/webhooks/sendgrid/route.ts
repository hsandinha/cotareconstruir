/**
 * API: Webhook SendGrid
 * POST /api/webhooks/sendgrid
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
    try {
        const events = await request.json();

        console.log('📧 SendGrid webhook received:', events.length, 'events');

        // SendGrid envia array de eventos
        for (const event of events) {
            const { email, event: eventType, timestamp, cotacao_id } = event;

            // Salvar evento no Supabase para análise
            await supabase
                .from('email_events')
                .insert({
                    email,
                    event: eventType,
                    timestamp: new Date(timestamp * 1000).toISOString(),
                    cotacao_id: cotacao_id || null,
                    raw_data: event,
                });

            // Processar eventos específicos
            switch (eventType) {
                case 'bounce':
                case 'dropped':
                    // Marcar email como inválido
                    console.warn(`❌ Email bounce: ${email}`);
                    // TODO: Atualizar status do email no Firestore
                    break;

                case 'spam':
                    // Email marcado como spam
                    console.warn(`🚫 Email marked as spam: ${email}`);
                    // TODO: Remover da lista de emails
                    break;

                case 'open':
                    // Email aberto
                    console.log(`👁️ Email opened: ${email}`);
                    // TODO: Atualizar métrica
                    break;

                case 'click':
                    // Link clicado
                    console.log(`🖱️ Email link clicked: ${email}`);
                    // TODO: Atualizar métrica
                    break;
            }
        }

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.WEBHOOK_RECEIVED,
            success: true,
            details: {
                webhook: 'sendgrid',
                eventCount: events.length,
            },
            ...metadata,
        });

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('SendGrid webhook error:', error);
        return NextResponse.json({ received: true });
    }
}
