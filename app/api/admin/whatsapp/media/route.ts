/**
 * Central de WhatsApp — mídia recebida
 *
 * GET /api/admin/whatsapp/media?id=<media_id>
 *
 * A Meta não entrega o arquivo no webhook, só um ID. O link real dura poucos
 * minutos e exige o token da conta — então nada disso pode ir para o browser.
 * Esta rota faz a ponte: confere que quem pediu é admin, busca o link, baixa
 * com o token e devolve o binário.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/adminApiAuth';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;

    const mediaId = new URL(req.url).searchParams.get('id');
    // Só o formato de ID da Meta. Sem isso, o valor entraria cru na URL do
    // Graph e daria para apontar a chamada autenticada para outro caminho.
    if (!mediaId || !/^[A-Za-z0-9_-]{1,128}$/.test(mediaId)) {
        return NextResponse.json({ error: 'id de mídia inválido' }, { status: 400 });
    }

    const accessToken = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) {
        return NextResponse.json({ error: 'WhatsApp não configurado' }, { status: 500 });
    }

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    try {
        // 1) ID → link temporário
        const meta = await fetch(`${GRAPH_API}/${mediaId}`, { headers: authHeader });
        if (!meta.ok) {
            return NextResponse.json({ error: 'Mídia não encontrada ou expirada' }, { status: 404 });
        }
        const { url, mime_type: mimeType } = await meta.json();
        if (!url) {
            return NextResponse.json({ error: 'Mídia sem URL' }, { status: 404 });
        }

        // 2) Link → binário (o download também exige o token)
        const arquivo = await fetch(url, { headers: authHeader });
        if (!arquivo.ok || !arquivo.body) {
            return NextResponse.json({ error: 'Falha ao baixar a mídia' }, { status: 502 });
        }

        return new NextResponse(arquivo.body, {
            headers: {
                'Content-Type': mimeType || arquivo.headers.get('content-type') || 'application/octet-stream',
                // Conteúdo de cliente: fica no cache do navegador de quem abriu, nunca em CDN
                'Cache-Control': 'private, max-age=3600',
            },
        });
    } catch (error) {
        console.error('❌ Central WhatsApp: erro ao buscar mídia', error);
        return NextResponse.json({ error: 'Erro ao buscar a mídia' }, { status: 500 });
    }
}
