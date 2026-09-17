/**
 * Central de WhatsApp — o número da plataforma
 *
 * GET /api/admin/whatsapp/numero
 *
 * Quem abre a Central precisa saber de qual número as mensagens saem. O
 * número não fica no banco: a fonte é a Meta, que também diz o nome
 * verificado e a qualidade — e é onde aparece primeiro quando o token expira
 * ou o número é bloqueado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/adminApiAuth';

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const CAMPOS = 'display_phone_number,verified_name,quality_rating,platform_type,code_verification_status';

/**
 * O número muda de mês em mês, no máximo — não faz sentido bater na Meta a
 * cada vez que alguém abre a tela (e a Central recarrega a cada 15s).
 */
const CACHE_MS = 5 * 60 * 1000;
let cache: { em: number; corpo: any } | null = null;

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;

    if (cache && Date.now() - cache.em < CACHE_MS) {
        return NextResponse.json(cache.corpo);
    }

    const accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
        return NextResponse.json({
            configurado: false,
            erro: 'WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID não estão configurados neste ambiente.',
        });
    }

    try {
        const res = await fetch(`${GRAPH_API}/${phoneNumberId}?fields=${CAMPOS}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const dados = await res.json();

        if (!res.ok) {
            // Token vencido ou número removido: a Central mostra isso em vez
            // de fingir que está tudo certo e falhar só na hora do envio.
            return NextResponse.json({
                configurado: false,
                erro: dados?.error?.message || `A Meta respondeu ${res.status}`,
            });
        }

        const corpo = {
            configurado: true,
            numero: dados.display_phone_number || null,
            nome: dados.verified_name || null,
            qualidade: dados.quality_rating || null,
            plataforma: dados.platform_type || null,
            verificacao: dados.code_verification_status || null,
        };

        cache = { em: Date.now(), corpo };
        return NextResponse.json(corpo);
    } catch (error: any) {
        console.error('❌ Central WhatsApp: erro ao consultar o número', error);
        return NextResponse.json({
            configurado: false,
            erro: 'Não foi possível falar com a Meta agora.',
        });
    }
}
