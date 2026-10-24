/**
 * API Route: Admin — parceiros do programa de afiliados
 *
 * GET    /api/admin/afiliados         → lista com o funil de cada parceiro
 * GET    /api/admin/afiliados?id=...  → detalhe: indicados e extrato
 * POST   /api/admin/afiliados         → cadastra parceiro
 * PATCH  /api/admin/afiliados         → edita parceiro (ou quita comissões)
 *
 * Percentual e duração vivem no parceiro, não numa regra global: cada
 * negociação é própria. Mudá-los aqui vale para quem ele trouxer DEPOIS — as
 * indicações já existentes guardam os termos que valiam no dia do cadastro
 * (ver `afiliado_indicacoes.percentual`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';
import { codigoSugerido, normalizarCodigo, codigoValido, gerarCodigoAfiliado } from '@/lib/cobrancaModelo';

const STATUS_VALIDOS = ['ativo', 'pausado', 'encerrado'];

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (id) return detalhe(id);

    const { data: afiliados, error } = await supabaseAdmin
        .from('afiliados')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (afiliados || []).map((a) => a.id);

    // Funil de cada parceiro em três consultas, não três por parceiro.
    const [cliquesRes, indicacoesRes, comissoesRes] = await Promise.all([
        supabaseAdmin.from('afiliado_cliques').select('afiliado_id').in('afiliado_id', ids),
        supabaseAdmin.from('afiliado_indicacoes').select('afiliado_id, status').in('afiliado_id', ids),
        supabaseAdmin.from('afiliado_comissoes').select('afiliado_id, status, valor_centavos').in('afiliado_id', ids),
    ]);

    const porAfiliado = new Map<string, any>();
    for (const id of ids) {
        porAfiliado.set(id, {
            cliques: 0, indicados: 0, pagantes: 0,
            comissaoPrevistaCentavos: 0, comissaoPagaCentavos: 0,
        });
    }

    for (const c of cliquesRes.data || []) {
        const r = porAfiliado.get(c.afiliado_id);
        if (r) r.cliques += 1;
    }
    for (const i of indicacoesRes.data || []) {
        const r = porAfiliado.get(i.afiliado_id);
        if (!r) continue;
        r.indicados += 1;
        if (i.status === 'pagante') r.pagantes += 1;
    }
    for (const c of comissoesRes.data || []) {
        const r = porAfiliado.get(c.afiliado_id);
        if (!r) continue;
        if (c.status === 'paga') r.comissaoPagaCentavos += c.valor_centavos || 0;
        else if (c.status !== 'cancelada') r.comissaoPrevistaCentavos += c.valor_centavos || 0;
    }

    return NextResponse.json({
        afiliados: (afiliados || []).map((a) => ({ ...a, ...porAfiliado.get(a.id) })),
    });
}

async function detalhe(id: string) {
    const { data: afiliado } = await supabaseAdmin!
        .from('afiliados')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (!afiliado) {
        return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });
    }

    const [indicacoesRes, comissoesRes] = await Promise.all([
        supabaseAdmin!
            .from('afiliado_indicacoes')
            .select('*, clientes(nome, email)')
            .eq('afiliado_id', id)
            .order('cadastrou_em', { ascending: false }),
        supabaseAdmin!
            .from('afiliado_comissoes')
            .select('*')
            .eq('afiliado_id', id)
            .order('competencia', { ascending: false })
            .limit(500),
    ]);

    return NextResponse.json({
        afiliado,
        indicacoes: indicacoesRes.data || [],
        comissoes: comissoesRes.data || [],
    });
}

export async function POST(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const body = await req.json();
    const nome = String(body?.nome || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!nome) return NextResponse.json({ error: 'Informe o nome do parceiro.' }, { status: 400 });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }

    // Padrões da configuração — ponto de partida de uma negociação nova.
    const { data: config } = await supabaseAdmin
        .from('cobranca_config')
        .select('afiliado_percentual_padrao, afiliado_duracao_meses_padrao')
        .eq('id', true)
        .maybeSingle();

    const percentual = body.percentual !== undefined
        ? Number(body.percentual)
        : Number(config?.afiliado_percentual_padrao ?? 20);

    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
        return NextResponse.json({ error: 'Percentual deve estar entre 0 e 100.' }, { status: 400 });
    }

    // Vazio/null = vitalício, e é uma escolha, não ausência de dado.
    let duracaoMeses: number | null;
    if (body.duracaoMeses === undefined) {
        duracaoMeses = config?.afiliado_duracao_meses_padrao ?? 12;
    } else if (body.duracaoMeses === null || body.duracaoMeses === '') {
        duracaoMeses = null;
    } else {
        const n = Number(body.duracaoMeses);
        if (!Number.isInteger(n) || n <= 0) {
            return NextResponse.json({ error: 'Duração deve ser um número de meses, ou vazio para vitalício.' }, { status: 400 });
        }
        duracaoMeses = n;
    }

    // Código: o que o admin pediu, ou derivado do nome. Em caso de colisão,
    // tenta variações antes de desistir — o cadastro não pode travar porque
    // existe outro "MARCOS".
    let codigo = normalizarCodigo(body.codigo || codigoSugerido(nome));
    if (!codigoValido(codigo)) codigo = gerarCodigoAfiliado();

    for (let tentativa = 0; tentativa < 5; tentativa++) {
        const { data: existente } = await supabaseAdmin
            .from('afiliados')
            .select('id')
            .eq('codigo', codigo)
            .maybeSingle();
        if (!existente) break;

        if (body.codigo) {
            return NextResponse.json({ error: `O código ${codigo} já está em uso.` }, { status: 409 });
        }
        codigo = normalizarCodigo(`${codigoSugerido(nome).slice(0, 8)}${gerarCodigoAfiliado(3)}`);
    }

    const { data, error } = await supabaseAdmin
        .from('afiliados')
        .insert({
            codigo,
            nome,
            email,
            telefone: body.telefone ? String(body.telefone).trim() : null,
            documento: body.documento ? String(body.documento).replace(/\D/g, '') : null,
            chave_pix: body.chavePix ? String(body.chavePix).trim() : null,
            percentual,
            duracao_meses: duracaoMeses,
            observacoes: body.observacoes ? String(body.observacoes).slice(0, 2000) : null,
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'Já existe parceiro com este e-mail ou código.' }, { status: 409 });
        }
        console.error('Erro ao criar afiliado:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAuditEvent({
        action: AuditAction.AFFILIATE_CREATED,
        userId: auth.userId,
        success: true,
        details: { afiliadoId: data.id, codigo, percentual, duracaoMeses },
        ...extractRequestMetadata(req),
    });

    return NextResponse.json({ success: true, afiliado: data });
}

export async function PATCH(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const body = await req.json();

    // Quitação de comissões: marca como paga o que já foi repassado.
    if (body?.acao === 'quitar') {
        const ids: string[] = Array.isArray(body.comissaoIds) ? body.comissaoIds : [];
        if (ids.length === 0) {
            return NextResponse.json({ error: 'Nenhuma comissão selecionada.' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('afiliado_comissoes')
            .update({
                status: 'paga',
                pago_em: new Date().toISOString(),
                comprovante: body.comprovante ? String(body.comprovante).slice(0, 500) : null,
            })
            .in('id', ids)
            // Só o que ainda não saiu: quitar duas vezes pagaria em dobro.
            .in('status', ['prevista', 'aprovada'])
            .select('id, valor_centavos');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const total = (data || []).reduce((s, c) => s + (c.valor_centavos || 0), 0);
        await logAuditEvent({
            action: AuditAction.COMMISSION_PAID,
            userId: auth.userId,
            success: true,
            details: { quantidade: data?.length || 0, totalCentavos: total },
            ...extractRequestMetadata(req),
        });

        return NextResponse.json({ success: true, quitadas: data?.length || 0, totalCentavos: total });
    }

    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'Informe o parceiro.' }, { status: 400 });

    const mudancas: Record<string, any> = {};

    if (body.nome !== undefined) mudancas.nome = String(body.nome).trim();
    if (body.telefone !== undefined) mudancas.telefone = body.telefone ? String(body.telefone).trim() : null;
    if (body.documento !== undefined) mudancas.documento = body.documento ? String(body.documento).replace(/\D/g, '') : null;
    if (body.chavePix !== undefined) mudancas.chave_pix = body.chavePix ? String(body.chavePix).trim() : null;
    if (body.observacoes !== undefined) mudancas.observacoes = body.observacoes ? String(body.observacoes).slice(0, 2000) : null;

    if (body.status !== undefined) {
        if (!STATUS_VALIDOS.includes(body.status)) {
            return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
        }
        mudancas.status = body.status;
    }

    if (body.percentual !== undefined) {
        const pct = Number(body.percentual);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
            return NextResponse.json({ error: 'Percentual deve estar entre 0 e 100.' }, { status: 400 });
        }
        mudancas.percentual = pct;
    }

    if (body.duracaoMeses !== undefined) {
        if (body.duracaoMeses === null || body.duracaoMeses === '') {
            mudancas.duracao_meses = null;
        } else {
            const n = Number(body.duracaoMeses);
            if (!Number.isInteger(n) || n <= 0) {
                return NextResponse.json({ error: 'Duração deve ser um número de meses, ou vazio para vitalício.' }, { status: 400 });
            }
            mudancas.duracao_meses = n;
        }
    }

    if (Object.keys(mudancas).length === 0) {
        return NextResponse.json({ error: 'Nada para alterar.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('afiliados')
        .update(mudancas)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAuditEvent({
        action: AuditAction.AFFILIATE_UPDATED,
        userId: auth.userId,
        success: true,
        details: { afiliadoId: id, mudancas },
        ...extractRequestMetadata(req),
    });

    return NextResponse.json({ success: true, afiliado: data });
}
