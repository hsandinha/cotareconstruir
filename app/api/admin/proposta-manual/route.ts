/**
 * API Route: Admin — proposta lançada pelo fornecedor, e link de resposta
 *
 * GET  ?cotacaoId=&fornecedorId= → itens e proposta atual, para o modal
 * POST { acao: 'lancar' }        → grava a proposta em nome do fornecedor
 * POST { acao: 'gerar-link' }    → cria o link que o fornecedor abre sozinho
 *
 * Existe porque fornecedor manda preço por telefone, por áudio e por foto de
 * papel. Antes isso ficava fora da plataforma e o cliente nunca via a oferta;
 * agora alguém digita e a proposta entra no mapa comparativo como as outras —
 * marcada com `origem = 'admin'`, para que a diferença fique registrada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';
import { criarOuAtualizarProposta } from '@/lib/propostaService';
import { gerarToken, hashToken, urlDaProposta, expiraEm, VALIDADE_PADRAO_DIAS } from '@/lib/propostaLink';
import { sendWhatsAppText } from '@/lib/whatsappService';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const cotacaoId = searchParams.get('cotacaoId');
    const fornecedorId = searchParams.get('fornecedorId');

    if (!cotacaoId || !fornecedorId) {
        return NextResponse.json({ error: 'Informe a cotação e o fornecedor.' }, { status: 400 });
    }

    const [cotacaoRes, itensRes, fornecedorRes, propostaRes, conviteRes] = await Promise.all([
        supabaseAdmin.from('cotacoes').select('id, numero, status').eq('id', cotacaoId).maybeSingle(),
        supabaseAdmin
            .from('cotacao_itens')
            .select('id, nome, fabricante, unidade, quantidade')
            .eq('cotacao_id', cotacaoId)
            .order('created_at', { ascending: true }),
        supabaseAdmin
            .from('fornecedores')
            .select('id, razao_social, nome_fantasia, whatsapp, telefone, user_id')
            .eq('id', fornecedorId)
            .maybeSingle(),
        supabaseAdmin
            .from('propostas')
            .select('id, origem, valor_frete, impostos, desconto, prazo_entrega, condicoes_pagamento, observacoes, data_envio, proposta_itens(cotacao_item_id, preco_unitario)')
            .eq('cotacao_id', cotacaoId)
            .eq('fornecedor_id', fornecedorId)
            .maybeSingle(),
        supabaseAdmin
            .from('cotacao_convites')
            .select('token_expira_em, token_aberto_em')
            .eq('cotacao_id', cotacaoId)
            .eq('fornecedor_id', fornecedorId)
            .maybeSingle(),
    ]);

    if (!cotacaoRes.data) {
        return NextResponse.json({ error: 'Cotação não encontrada.' }, { status: 404 });
    }

    const p = propostaRes.data;
    const linkValido = conviteRes.data?.token_expira_em
        && new Date(conviteRes.data.token_expira_em) > new Date();

    return NextResponse.json({
        cotacao: cotacaoRes.data,
        fornecedor: fornecedorRes.data,
        itens: itensRes.data || [],
        // Se já existe link vivo, a tela mostra isso em vez de gerar outro à toa
        link: { ativo: !!linkValido, expiraEm: conviteRes.data?.token_expira_em || null, abertoEm: conviteRes.data?.token_aberto_em || null },
        propostaAtual: p
            ? {
                origem: p.origem,
                enviadaEm: p.data_envio,
                frete: p.valor_frete,
                impostos: p.impostos,
                desconto: p.desconto,
                prazoEntrega: p.prazo_entrega,
                condicoesPagamento: p.condicoes_pagamento,
                observacoes: p.observacoes,
                precos: Object.fromEntries(
                    (p.proposta_itens || [])
                        .filter((i: any) => Number(i.preco_unitario) > 0)
                        .map((i: any) => [i.cotacao_item_id, String(i.preco_unitario)])
                ),
            }
            : null,
    });
}

export async function POST(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const body = await req.json();
    const cotacaoId = String(body?.cotacaoId || '');
    const fornecedorId = String(body?.fornecedorId || '');

    if (!cotacaoId || !fornecedorId) {
        return NextResponse.json({ error: 'Informe a cotação e o fornecedor.' }, { status: 400 });
    }

    // Convite é pré-requisito dos dois caminhos: sem ele o fornecedor não foi
    // chamado para esta cotação, e nem admin deve responder por ele.
    const { data: convite } = await supabaseAdmin
        .from('cotacao_convites')
        .select('id')
        .eq('cotacao_id', cotacaoId)
        .eq('fornecedor_id', fornecedorId)
        .maybeSingle();

    if (!convite) {
        return NextResponse.json(
            { error: 'Este fornecedor não foi convidado para esta cotação.' },
            { status: 400 }
        );
    }

    if (body?.acao === 'gerar-link') {
        return gerarLink({ req, auth, conviteId: convite.id, cotacaoId, fornecedorId, enviarWhatsapp: !!body.enviarWhatsapp });
    }

    // ---------- Lançar a proposta ----------
    if (!Array.isArray(body?.itens) || body.itens.length === 0) {
        return NextResponse.json({ error: 'Nenhum item recebido.' }, { status: 400 });
    }

    const { data: itensValidos } = await supabaseAdmin
        .from('cotacao_itens')
        .select('id')
        .eq('cotacao_id', cotacaoId);

    const permitidos = new Set((itensValidos || []).map((i) => i.id));
    const itens = body.itens.filter((i: any) => permitidos.has(i?.cotacao_item_id));
    if (itens.length === 0) {
        return NextResponse.json({ error: 'Os itens enviados não pertencem a esta cotação.' }, { status: 400 });
    }

    const { data: fornecedor } = await supabaseAdmin
        .from('fornecedores')
        .select('razao_social, nome_fantasia, user_id')
        .eq('id', fornecedorId)
        .maybeSingle();

    const resultado = await criarOuAtualizarProposta({
        cotacaoId,
        fornecedorId,
        // O autor continua sendo o fornecedor — é a proposta dele. Quem
        // digitou fica em `lancada_por_admin`.
        autor: {
            userId: fornecedor?.user_id || null,
            nome: fornecedor?.nome_fantasia || fornecedor?.razao_social || null,
        },
        origem: 'admin',
        lancadaPorAdmin: auth.userId,
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
        .eq('id', convite.id);

    await logAuditEvent({
        action: AuditAction.PROPOSAL_CREATED,
        userId: auth.userId,
        success: true,
        details: { cotacaoId, fornecedorId, origem: 'admin', atualizada: resultado.atualizada },
        ...extractRequestMetadata(req),
    });

    return NextResponse.json({
        success: true,
        atualizada: resultado.atualizada,
        cotacaoNumero: resultado.cotacaoNumero,
    });
}

/**
 * Cria o link de resposta e, se pedido, manda no WhatsApp do fornecedor.
 *
 * O token em claro só existe nesta resposta — o banco guarda o hash. Por isso
 * "reenviar o link" significa gerar outro: não há como recuperar o anterior,
 * e isso é proposital.
 */
async function gerarLink(params: {
    req: NextRequest;
    auth: { userId: string; nome: string | null };
    conviteId: string;
    cotacaoId: string;
    fornecedorId: string;
    enviarWhatsapp: boolean;
}): Promise<NextResponse> {
    const { req, auth, conviteId, cotacaoId, fornecedorId, enviarWhatsapp } = params;

    const token = gerarToken();
    const expira = expiraEm(VALIDADE_PADRAO_DIAS);

    const { error } = await supabaseAdmin!
        .from('cotacao_convites')
        .update({
            token_hash: hashToken(token),
            token_criado_em: new Date().toISOString(),
            token_expira_em: expira,
            // Link novo volta a contar do zero: o anterior deixou de existir.
            token_aberto_em: null,
        })
        .eq('id', conviteId);

    if (error) {
        console.error('Erro ao gerar link de proposta:', error);
        return NextResponse.json({ error: 'Não foi possível gerar o link.' }, { status: 500 });
    }

    const url = urlDaProposta(token);

    const [{ data: cotacao }, { data: fornecedor }] = await Promise.all([
        supabaseAdmin!.from('cotacoes').select('numero').eq('id', cotacaoId).maybeSingle(),
        supabaseAdmin!.from('fornecedores').select('whatsapp, telefone, nome_fantasia, razao_social').eq('id', fornecedorId).maybeSingle(),
    ]);

    let whatsapp: { tentado: boolean; enviado: boolean; erro?: string } = { tentado: false, enviado: false };

    if (enviarWhatsapp) {
        const telefone = fornecedor?.whatsapp || fornecedor?.telefone;
        if (!telefone) {
            whatsapp = { tentado: true, enviado: false, erro: 'Fornecedor sem WhatsApp cadastrado.' };
        } else {
            const texto = [
                `Olá! Sobre a cotação *#${cotacao?.numero || ''}* na Comprar e Construir.`,
                '',
                'Para enviar sua proposta, é só tocar no link abaixo e preencher os preços — sem baixar planilha e sem fazer login:',
                '',
                url,
                '',
                `O link é exclusivo da sua empresa e vale por ${VALIDADE_PADRAO_DIAS} dias.`,
            ].join('\n');

            const envio = await sendWhatsAppText({
                to: telefone,
                text: texto,
                origem: 'central',
                enviadaPor: auth.userId,
            });

            whatsapp = {
                tentado: true,
                enviado: !!envio.success,
                // Fora da janela de 24h a Meta recusa texto livre. O link
                // continua válido — o admin copia e manda por onde quiser.
                erro: envio.success ? undefined : (envio.error || 'Falha no envio'),
            };
        }
    }

    await logAuditEvent({
        action: AuditAction.QUOTATION_SENT,
        userId: auth.userId,
        success: true,
        details: { cotacaoId, fornecedorId, recurso: 'link_proposta', whatsappEnviado: whatsapp.enviado },
        ...extractRequestMetadata(req),
    });

    return NextResponse.json({ success: true, url, expiraEm: expira, whatsapp });
}
