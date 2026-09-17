/**
 * Central de WhatsApp — lista de conversas
 *
 * GET   /api/admin/whatsapp/conversas?busca=&arquivadas=1
 * PATCH /api/admin/whatsapp/conversas   { id, arquivada?, lida? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';
import { janelaAberta, normalizarTelefone, JANELA_HORAS } from '@/lib/whatsappCentral';

const SELECT_CONVERSA = `
    id, telefone, nome_contato, nao_lidas, arquivada,
    ultima_mensagem_texto, ultima_mensagem_em, ultima_mensagem_direcao, ultima_entrada_em,
    fornecedor:fornecedores (id, razao_social, nome_fantasia),
    cliente:clientes (id, nome, razao_social),
    usuario:users (id, nome, email)
`;

/** Um só nome para a lista: o do cadastro ganha do nome do perfil do WhatsApp. */
function nomeExibicao(c: any): string {
    const fornecedor = c.fornecedor?.nome_fantasia || c.fornecedor?.razao_social;
    const cliente = c.cliente?.nome || c.cliente?.razao_social;
    return fornecedor || cliente || c.usuario?.nome || c.nome_contato || '';
}

function comDadosDerivados(c: any) {
    return {
        ...c,
        nome_exibicao: nomeExibicao(c),
        // 'fornecedor' / 'cliente' / 'usuario' / null — vira o selo na lista
        vinculo: c.fornecedor ? 'fornecedor' : c.cliente ? 'cliente' : c.usuario ? 'usuario' : null,
        // Fora da janela, texto livre não entrega: a tela só oferece template
        janela_aberta: janelaAberta(c.ultima_entrada_em),
        janela_expira_em: c.ultima_entrada_em
            ? new Date(new Date(c.ultima_entrada_em).getTime() + JANELA_HORAS * 3600 * 1000).toISOString()
            : null,
    };
}

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const busca = (searchParams.get('busca') || '').trim();
    const arquivadas = searchParams.get('arquivadas') === '1';

    let query = supabaseAdmin
        .from('whatsapp_conversas')
        .select(SELECT_CONVERSA)
        .eq('arquivada', arquivadas)
        .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
        .limit(200);

    if (busca) {
        // Quem digita "31 99999-8888" quer achar 5531999998888: buscamos pelo
        // que a pessoa escreveu e, se for número, também pelo telefone limpo.
        const somenteDigitos = busca.replace(/\D/g, '');
        const alvos = [`nome_contato.ilike.%${busca}%`, `telefone.ilike.%${busca}%`];
        if (somenteDigitos.length >= 4) {
            alvos.push(`telefone.ilike.%${normalizarTelefone(somenteDigitos)}%`);
            alvos.push(`telefone.ilike.%${somenteDigitos}%`);
        }
        query = query.or(alvos.join(','));
    }

    const { data, error } = await query;

    if (error) {
        console.error('❌ Central WhatsApp: erro ao listar conversas', error);
        return NextResponse.json({ error: 'Erro ao carregar conversas' }, { status: 500 });
    }

    const conversas = (data || []).map(comDadosDerivados);
    const naoLidas = conversas.reduce((total, c) => total + (c.nao_lidas || 0), 0);

    return NextResponse.json({ data: conversas, nao_lidas: naoLidas });
}

/** Arquivar/desarquivar e marcar como lida. */
export async function PATCH(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase não configurado' }, { status: 500 });
    }

    const { id, arquivada, lida } = await req.json();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof arquivada === 'boolean') patch.arquivada = arquivada;
    if (lida === true) patch.nao_lidas = 0;

    const { error } = await supabaseAdmin.from('whatsapp_conversas').update(patch).eq('id', id);

    if (error) {
        console.error('❌ Central WhatsApp: erro ao atualizar conversa', error);
        return NextResponse.json({ error: 'Erro ao atualizar conversa' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
