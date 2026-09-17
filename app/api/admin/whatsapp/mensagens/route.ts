/**
 * Central de WhatsApp — histórico e resposta de uma conversa
 *
 * GET  /api/admin/whatsapp/mensagens?conversa_id=...
 * POST /api/admin/whatsapp/mensagens  { conversa_id, texto }
 *                                     { conversa_id, template, params: [] }
 *
 * A regra que manda aqui é a janela de 24h da Meta: texto livre só entrega
 * até 24h depois da última mensagem do contato. Passou disso, só template
 * aprovado — e a rota recusa antes de gastar a chamada na Meta.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';
import { sendWhatsAppText, sendWhatsAppTemplate } from '@/lib/whatsappService';
import {
    janelaAberta,
    marcarConversaLida,
    TEMPLATES_DISPONIVEIS,
    JANELA_HORAS,
} from '@/lib/whatsappCentral';

const SELECT_MENSAGEM = `
    id, direcao, tipo, texto, template_nome, template_params,
    media_id, media_mime, media_nome, status, erro, origem, criada_em,
    autor:users!whatsapp_mensagens_enviada_por_fkey (id, nome)
`;

const LIMITE_HISTORICO = 300;

async function carregarConversa(conversaId: string) {
    const { data } = await supabaseAdmin!
        .from('whatsapp_conversas')
        .select('id, telefone, nome_contato, ultima_entrada_em')
        .eq('id', conversaId)
        .maybeSingle();
    return data;
}

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const conversaId = searchParams.get('conversa_id');
    if (!conversaId) {
        return NextResponse.json({ error: 'conversa_id é obrigatório' }, { status: 400 });
    }

    const conversa = await carregarConversa(conversaId);
    if (!conversa) {
        return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    // Busca decrescente (pega as MAIS recentes quando passa do limite) e
    // devolve em ordem cronológica, que é como a tela desenha.
    const { data, error } = await supabaseAdmin
        .from('whatsapp_mensagens')
        .select(SELECT_MENSAGEM)
        .eq('conversa_id', conversaId)
        .order('criada_em', { ascending: false })
        .limit(LIMITE_HISTORICO);

    if (error) {
        console.error('❌ Central WhatsApp: erro ao carregar mensagens', error);
        return NextResponse.json({ error: 'Erro ao carregar mensagens' }, { status: 500 });
    }

    // Abrir a conversa é ler a conversa
    await marcarConversaLida(conversaId);

    const aberta = janelaAberta(conversa.ultima_entrada_em);

    return NextResponse.json({
        data: (data || []).reverse(),
        janela_aberta: aberta,
        janela_expira_em: conversa.ultima_entrada_em
            ? new Date(new Date(conversa.ultima_entrada_em).getTime() + JANELA_HORAS * 3600 * 1000).toISOString()
            : null,
        // Fora da janela a tela precisa oferecer os templates aprovados
        templates: aberta ? [] : TEMPLATES_DISPONIVEIS,
    });
}

export async function POST(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const { conversa_id: conversaId, texto, template, params } = await req.json();
    if (!conversaId) {
        return NextResponse.json({ error: 'conversa_id é obrigatório' }, { status: 400 });
    }

    const conversa = await carregarConversa(conversaId);
    if (!conversa) {
        return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    const remetente = { origem: 'central' as const, enviadaPor: auth.userId };

    if (template) {
        const valores: string[] = Array.isArray(params) ? params.map((p: unknown) => String(p ?? '')) : [];
        const definicao = TEMPLATES_DISPONIVEIS.find((t) => t.nome === template);
        if (!definicao) {
            return NextResponse.json({ error: 'Template desconhecido' }, { status: 400 });
        }
        if (valores.length !== definicao.variaveis || valores.some((v) => !v.trim())) {
            return NextResponse.json(
                { error: `O template ${template} precisa de ${definicao.variaveis} variável(is) preenchida(s)` },
                { status: 400 },
            );
        }

        const resultado = await sendWhatsAppTemplate({
            to: conversa.telefone,
            templateName: template,
            language: 'pt_BR',
            components: [{ type: 'body', parameters: valores.map((text) => ({ type: 'text', text })) }],
            ...remetente,
        });

        if (!resultado.success) {
            return NextResponse.json({ error: resultado.error || 'Falha ao enviar template' }, { status: 502 });
        }
        return NextResponse.json({ ok: true, messageId: resultado.messageId });
    }

    const corpo = typeof texto === 'string' ? texto.trim() : '';
    if (!corpo) {
        return NextResponse.json({ error: 'Escreva uma mensagem' }, { status: 400 });
    }
    if (corpo.length > 4096) {
        return NextResponse.json({ error: 'A mensagem passa do limite de 4096 caracteres' }, { status: 400 });
    }

    if (!janelaAberta(conversa.ultima_entrada_em)) {
        return NextResponse.json(
            {
                error: 'A janela de 24h desta conversa fechou. Só é possível enviar um template aprovado — '
                    + 'quando o contato responder, a conversa livre reabre.',
                janela_aberta: false,
            },
            { status: 422 },
        );
    }

    const resultado = await sendWhatsAppText({ to: conversa.telefone, text: corpo, ...remetente });

    if (!resultado.success) {
        return NextResponse.json({ error: resultado.error || 'Falha ao enviar' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, messageId: resultado.messageId });
}
