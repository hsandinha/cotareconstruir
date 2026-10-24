/**
 * API: resposta de cotação por link, sem login
 *
 * GET  /api/proposta-link?token=... → o que o formulário precisa mostrar
 * POST /api/proposta-link           → grava a proposta
 *
 * O token É a autenticação (ver lib/propostaLink.ts). Por isso tudo aqui
 * parte dele: o cliente nunca manda `cotacao_id` nem `fornecedor_id`, esses
 * valores saem do convite. Aceitá-los do corpo da requisição permitiria a um
 * fornecedor responder no lugar de outro com o próprio token válido.
 *
 * O que o link deliberadamente NÃO entrega: nome, e-mail ou telefone do
 * cliente, endereço exato da obra, e qualquer proposta de concorrente. O
 * fornecedor vê os itens, a localização aproximada e o que ele mesmo cotou.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashToken, tokenPlausivel } from '@/lib/propostaLink';
import { criarOuAtualizarProposta } from '@/lib/propostaService';
import { rateLimit } from '@/lib/rateLimit';

/** Teto por IP: o token tem 256 bits, mas força bruta não precisa de convite. */
const limitador = rateLimit({ interval: 60_000 });

interface ConviteResolvido {
    conviteId: string;
    cotacaoId: string;
    fornecedorId: string;
}

/** Token → convite, só enquanto válido. Devolve null em qualquer outro caso. */
async function resolverConvite(token: unknown): Promise<ConviteResolvido | null> {
    if (!supabaseAdmin || !tokenPlausivel(token)) return null;

    const { data, error } = await supabaseAdmin.rpc('convite_por_token', {
        p_token_hash: hashToken(token as string),
    });

    if (error) {
        console.error('❌ Proposta por link: falha ao resolver token', error);
        return null;
    }

    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha?.cotacao_id) return null;

    return {
        conviteId: linha.convite_id,
        cotacaoId: linha.cotacao_id,
        fornecedorId: linha.fornecedor_id,
    };
}

function ipDe(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'desconhecido';
}

// ============================================================
// GET — dados do formulário
// ============================================================

export async function GET(req: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Serviço indisponível' }, { status: 500 });
    }

    const limite = await limitador.check(`proposta-link:${ipDe(req)}`, 30);
    if (!limite.success) {
        return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    }

    const token = new URL(req.url).searchParams.get('token');
    const convite = await resolverConvite(token);

    // Mensagem única para token inexistente, expirado ou malformado: dizer
    // qual dos três é entrega informação a quem está tentando adivinhar.
    if (!convite) {
        return NextResponse.json(
            { error: 'Este link não é mais válido. Peça um novo pela conversa no WhatsApp.' },
            { status: 404 }
        );
    }

    const { data: cotacao } = await supabaseAdmin
        .from('cotacoes')
        .select('id, numero, status, data_validade, observacoes, obra_id')
        .eq('id', convite.cotacaoId)
        .maybeSingle();

    if (!cotacao) {
        return NextResponse.json({ error: 'Cotação não encontrada.' }, { status: 404 });
    }

    const [itensRes, obraRes, fornecedorRes, propostaRes] = await Promise.all([
        supabaseAdmin
            .from('cotacao_itens')
            .select('id, nome, fabricante, unidade, quantidade')
            .eq('cotacao_id', convite.cotacaoId)
            .order('created_at', { ascending: true }),
        cotacao.obra_id
            // Só bairro e cidade: o endereço completo é do cliente, e o
            // fornecedor não precisa dele para formar preço.
            ? supabaseAdmin.from('obras').select('bairro, cidade, estado').eq('id', cotacao.obra_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
        supabaseAdmin
            .from('fornecedores')
            .select('razao_social, nome_fantasia')
            .eq('id', convite.fornecedorId)
            .maybeSingle(),
        supabaseAdmin
            .from('propostas')
            .select('id, valor_frete, impostos, desconto, prazo_entrega, condicoes_pagamento, observacoes, data_envio, proposta_itens(cotacao_item_id, preco_unitario)')
            .eq('cotacao_id', convite.cotacaoId)
            .eq('fornecedor_id', convite.fornecedorId)
            .maybeSingle(),
    ]);

    // Marca a abertura. São dois UPDATEs porque os campos têm regras
    // diferentes: `token_aberto_em` registra toda abertura do link, enquanto
    // `visualizado_em` guarda a PRIMEIRA vez que o fornecedor viu a cotação
    // por qualquer caminho — num único update guardado por
    // `visualizado_em IS NULL`, quem já tinha visto pela plataforma nunca
    // teria a abertura do link registrada.
    const agora = new Date().toISOString();

    await supabaseAdmin
        .from('cotacao_convites')
        .update({ token_aberto_em: agora })
        .eq('id', convite.conviteId);

    await supabaseAdmin
        .from('cotacao_convites')
        .update({ visualizado_em: agora })
        .eq('id', convite.conviteId)
        .is('visualizado_em', null);

    const aberta = cotacao.status === 'enviada' || cotacao.status === 'respondida';
    const obra = obraRes?.data;

    return NextResponse.json({
        cotacao: {
            numero: cotacao.numero,
            aberta,
            local: obra
                ? [obra.bairro, obra.cidade, obra.estado].filter(Boolean).join(', ')
                : null,
        },
        fornecedor: {
            nome: fornecedorRes.data?.nome_fantasia || fornecedorRes.data?.razao_social || null,
        },
        itens: itensRes.data || [],
        // Proposta anterior, para o fornecedor corrigir em vez de redigitar
        propostaAtual: propostaRes.data
            ? {
                enviadaEm: propostaRes.data.data_envio,
                frete: propostaRes.data.valor_frete,
                impostos: propostaRes.data.impostos,
                desconto: propostaRes.data.desconto,
                prazoEntrega: propostaRes.data.prazo_entrega,
                condicoesPagamento: propostaRes.data.condicoes_pagamento,
                observacoes: propostaRes.data.observacoes,
                precos: Object.fromEntries(
                    (propostaRes.data.proposta_itens || [])
                        .filter((i: any) => Number(i.preco_unitario) > 0)
                        .map((i: any) => [i.cotacao_item_id, String(i.preco_unitario)])
                ),
            }
            : null,
    });
}

// ============================================================
// POST — grava a proposta
// ============================================================

export async function POST(req: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Serviço indisponível' }, { status: 500 });
    }

    const limite = await limitador.check(`proposta-link-post:${ipDe(req)}`, 15);
    if (!limite.success) {
        return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const convite = await resolverConvite(body?.token);

    if (!convite) {
        return NextResponse.json(
            { error: 'Este link não é mais válido. Peça um novo pela conversa no WhatsApp.' },
            { status: 404 }
        );
    }

    if (!Array.isArray(body?.itens) || body.itens.length === 0) {
        return NextResponse.json({ error: 'Nenhum item recebido.' }, { status: 400 });
    }

    // Os itens têm que pertencer a ESTA cotação. Sem esta checagem, um token
    // válido permitiria gravar preço em item de outra cotação qualquer.
    const { data: itensValidos } = await supabaseAdmin
        .from('cotacao_itens')
        .select('id')
        .eq('cotacao_id', convite.cotacaoId);

    const permitidos = new Set((itensValidos || []).map((i) => i.id));
    const itens = body.itens.filter((i: any) => permitidos.has(i?.cotacao_item_id));

    if (itens.length === 0) {
        return NextResponse.json({ error: 'Os itens enviados não pertencem a esta cotação.' }, { status: 400 });
    }

    const { data: fornecedor } = await supabaseAdmin
        .from('fornecedores')
        .select('razao_social, nome_fantasia, user_id')
        .eq('id', convite.fornecedorId)
        .maybeSingle();

    const resultado = await criarOuAtualizarProposta({
        cotacaoId: convite.cotacaoId,
        fornecedorId: convite.fornecedorId,
        autor: {
            userId: fornecedor?.user_id || null,
            nome: fornecedor?.nome_fantasia || fornecedor?.razao_social || null,
        },
        origem: 'link_publico',
        valorTotal: Number(body.valorTotal) || 0,
        valorFrete: Number(body.valorFrete) || 0,
        valorImpostos: Number(body.valorImpostos) || 0,
        valorDesconto: Number(body.valorDesconto) || 0,
        prazoEntrega: body.prazoEntrega ?? null,
        condicoesPagamento: body.condicoesPagamento || null,
        observacoes: body.observacoes || null,
        dataValidade: body.dataValidade || null,
        itens,
    });

    if (!resultado.ok) {
        return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    await supabaseAdmin
        .from('cotacao_convites')
        .update({ respondido_em: new Date().toISOString() })
        .eq('id', convite.conviteId);

    return NextResponse.json({
        success: true,
        atualizada: resultado.atualizada,
        cotacaoNumero: resultado.cotacaoNumero,
    });
}
