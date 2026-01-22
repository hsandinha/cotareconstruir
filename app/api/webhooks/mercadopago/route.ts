/**
 * API: Webhook Mercado Pago
 * POST /api/webhooks/mercadopago
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyMercadoPagoSignature } from '@/lib/webhooks';
import { supabase } from '@/lib/supabase';
import { queueEmail } from '@/lib/queue';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const signature = request.headers.get('x-signature');
        const dataId = request.headers.get('x-request-id');

        console.log('📥 Mercado Pago webhook received:', body);

        // Verificar assinatura (se configurado)
        if (signature && dataId && process.env.MERCADOPAGO_WEBHOOK_SECRET) {
            const isValid = verifyMercadoPagoSignature(
                dataId,
                signature,
                process.env.MERCADOPAGO_WEBHOOK_SECRET
            );

            if (!isValid) {
                console.error('Invalid Mercado Pago signature');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        // Processar eventos
        const { type, action, data } = body;

        if (type === 'payment') {
            const paymentId = data.id;

            // Buscar detalhes do pagamento na API do Mercado Pago
            // const payment = await fetchMercadoPagoPayment(paymentId);

            switch (action) {
                case 'payment.created':
                case 'payment.updated':
                    // Atualizar status no banco
                    if (body.metadata?.cotacaoId) {
                        await supabase
                            .from('cotacoes')
                            .update({
                                payment_status: data.status,
                                payment_id: paymentId,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', body.metadata.cotacaoId);

                        // Se aprovado, enviar email
                        if (data.status === 'approved') {
                            await queueEmail({
                                type: 'payment-confirmation',
                                to: body.payer?.email || '',
                                data: {
                                    cotacaoId: body.metadata.cotacaoId,
                                    amount: data.transaction_amount,
                                },
                            });
                        }
                    }
                    break;
            }
        }

        // Audit log
        const metadata = extractRequestMetadata(request);
        await logAuditEvent({
            action: AuditAction.WEBHOOK_RECEIVED,
            success: true,
            details: {
                webhook: 'mercadopago',
                type,
                action,
                paymentId: data?.id,
            },
            ...metadata,
        });

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Mercado Pago webhook error:', error);
        return NextResponse.json({ received: true });
    }
}
