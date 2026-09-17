/**
 * Central de WhatsApp — tudo que a plataforma disparou
 *
 * GET /api/admin/whatsapp/disparos?origem=&status=&busca=&pagina=
 *
 * A lista de conversas responde "o que esse contato falou comigo". Esta rota
 * responde a outra pergunta: "o que o sistema mandou hoje, e chegou?" — todas
 * as mensagens de saída numa fila só, do disparo automático de cotação até a
 * resposta escrita na Central, com o status de entrega e o erro quando falha.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';

const POR_PAGINA = 50;

const SELECT_DISPARO = `
    id, tipo, texto, template_nome, template_params, status, erro, origem, criada_em,
    conversa:whatsapp_conversas!inner (id, telefone, nome_contato),
    autor:users!whatsapp_mensagens_enviada_por_fkey (id, nome)
`;

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const origem = searchParams.get('origem');       // automatica | central
    const status = searchParams.get('status');       // falhou | entregue | ...
    const busca = (searchParams.get('busca') || '').trim();
    const pagina = Math.max(0, Number(searchParams.get('pagina') || 0));

    let query = supabaseAdmin
        .from('whatsapp_mensagens')
        .select(SELECT_DISPARO, { count: 'exact' })
        .eq('direcao', 'saida')
        .order('criada_em', { ascending: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

    if (origem === 'automatica' || origem === 'central') query = query.eq('origem', origem);
    if (status) query = query.eq('status', status);
    if (busca) {
        // Busca no que foi escrito e no nome do template — achar "todas as
        // cotações que falharam" é o uso real desta tela.
        query = query.or(`texto.ilike.%${busca}%,template_nome.ilike.%${busca}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error('❌ Central WhatsApp: erro ao listar disparos', error);
        return NextResponse.json({ error: 'Erro ao carregar os disparos' }, { status: 500 });
    }

    // Contadores do topo: a leitura de um segundo sobre a saúde do canal.
    // `head: true` não traz linha nenhuma, só o total.
    const contar = (filtro: (q: any) => any) =>
        filtro(
            supabaseAdmin!
                .from('whatsapp_mensagens')
                .select('id', { count: 'exact', head: true })
                .eq('direcao', 'saida'),
        );

    const [total, falhas, automaticas] = await Promise.all([
        contar((q: any) => q),
        contar((q: any) => q.eq('status', 'falhou')),
        contar((q: any) => q.eq('origem', 'automatica')),
    ]);

    return NextResponse.json({
        data: data || [],
        pagina,
        por_pagina: POR_PAGINA,
        total_filtrado: count || 0,
        resumo: {
            total: total.count || 0,
            falhas: falhas.count || 0,
            automaticas: automaticas.count || 0,
            manuais: (total.count || 0) - (automaticas.count || 0),
        },
    });
}
