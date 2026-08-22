/**
 * API: Webhook Resend
 * POST /api/webhooks/resend
 *
 * Configure em: Resend Dashboard → Webhooks → Endpoint
 *   URL: https://seudominio.com/api/webhooks/resend
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabase } from '@/lib/supabase';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';

/**
 * Confere a assinatura Svix que a Resend envia.
 * Sem `RESEND_WEBHOOK_SECRET` configurado, o endpoint aceitava qualquer
 * POST anônimo e gravava direto em `email_events`.
 */
function assinaturaResendValida(request: NextRequest, corpoBruto: string): boolean {
    const segredo = process.env.RESEND_WEBHOOK_SECRET;
    if (!segredo) {
        console.warn('[WEBHOOK] RESEND_WEBHOOK_SECRET não configurado: evento aceito sem verificação.');
        return true;
    }

    const id = request.headers.get('svix-id');
    const timestamp = request.headers.get('svix-timestamp');
    const assinaturas = request.headers.get('svix-signature');
    if (!id || !timestamp || !assinaturas) return false;

    // Rejeita repetição de evento antigo (janela de 5 minutos)
    const idadeSegundos = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(idadeSegundos) || idadeSegundos > 300) return false;

    const chave = Buffer.from(segredo.replace(/^whsec_/, ''), 'base64');
    const esperada = createHmac('sha256', chave)
        .update(`${id}.${timestamp}.${corpoBruto}`)
        .digest('base64');

    // Comparação em tempo constante, contra ataque de temporização
    return assinaturas.split(' ').some((parte) => {
        const valor = parte.split(',')[1] || '';
        const a = Buffer.from(valor);
        const b = Buffer.from(esperada);
        return a.length === b.length && timingSafeEqual(a, b);
    });
}

export async function POST(request: NextRequest) {
    try {
        const corpoBruto = await request.text();

        if (!assinaturaResendValida(request, corpoBruto)) {
            console.error('Webhook Resend com assinatura inválida');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const body = JSON.parse(corpoBruto);

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
