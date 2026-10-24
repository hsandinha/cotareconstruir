/**
 * API Route: Admin — configuração de cobrança
 *
 * GET  /api/admin/cobranca → configuração atual + resumo das assinaturas
 * PUT  /api/admin/cobranca → altera a configuração
 *
 * O que se altera aqui vale para assinatura NOVA. As que já existem guardam
 * o próprio preço e modelo (ver `assinaturas.valor_centavos`), porque mudar a
 * tabela de preços não pode reajustar silenciosamente quem já assinou.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verificarAdmin } from '@/lib/adminApiAuth';
import { logAuditEvent, AuditAction, extractRequestMetadata } from '@/lib/auditLog';
import { centavosDeTexto, type CicloCobranca, type ModeloCobranca } from '@/lib/cobrancaModelo';

const MODELOS: ModeloCobranca[] = ['por_obra', 'por_cliente', 'por_conta'];
const CICLOS: CicloCobranca[] = ['mensal', 'trimestral', 'semestral', 'anual'];

export async function GET(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const { data: config } = await supabaseAdmin
        .from('cobranca_config')
        .select('*')
        .eq('id', true)
        .maybeSingle();

    // Resumo por status: é o que diz se ligar a cobrança vai afetar alguém.
    const { data: assinaturas } = await supabaseAdmin
        .from('assinaturas')
        .select('status, valor_centavos');

    const resumo = { trial: 0, ativa: 0, inadimplente: 0, cancelada: 0, encerrada: 0 };
    let mrrCentavos = 0;
    for (const a of assinaturas || []) {
        if (a.status in resumo) (resumo as any)[a.status] += 1;
        if (a.status === 'ativa') mrrCentavos += a.valor_centavos || 0;
    }

    const { count: afiliadosAtivos } = await supabaseAdmin
        .from('afiliados')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ativo');

    return NextResponse.json({ config, resumo, mrrCentavos, afiliadosAtivos: afiliadosAtivos || 0 });
}

export async function PUT(req: NextRequest) {
    const auth = await verificarAdmin(req);
    if ('error' in auth) return auth.error;
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
    }

    const body = await req.json();
    const mudancas: Record<string, any> = {};

    if (body.modelo !== undefined) {
        if (!MODELOS.includes(body.modelo)) {
            return NextResponse.json({ error: 'Modelo de cobrança inválido' }, { status: 400 });
        }
        mudancas.modelo = body.modelo;
    }

    if (body.valor !== undefined) {
        const centavos = centavosDeTexto(body.valor);
        if (centavos === null || centavos < 0) {
            return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
        }
        mudancas.valor_centavos = centavos;
    }

    if (body.ciclo !== undefined) {
        if (!CICLOS.includes(body.ciclo)) {
            return NextResponse.json({ error: 'Ciclo inválido' }, { status: 400 });
        }
        mudancas.ciclo = body.ciclo;
    }

    for (const [campo, chave] of [
        ['diasTrial', 'dias_trial'],
        ['diasTolerancia', 'dias_tolerancia'],
        ['afiliadoJanelaDias', 'afiliado_janela_dias'],
    ] as const) {
        if (body[campo] !== undefined) {
            const n = Number(body[campo]);
            if (!Number.isInteger(n) || n < 0) {
                return NextResponse.json({ error: `Valor inválido em ${campo}` }, { status: 400 });
            }
            mudancas[chave] = n;
        }
    }

    if (body.afiliadoPercentualPadrao !== undefined) {
        const pct = Number(body.afiliadoPercentualPadrao);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
            return NextResponse.json({ error: 'Percentual deve estar entre 0 e 100' }, { status: 400 });
        }
        mudancas.afiliado_percentual_padrao = pct;
    }

    // `null` explícito = vitalício, e é diferente de "não mandou o campo".
    if (body.afiliadoDuracaoMesesPadrao !== undefined) {
        const meses = body.afiliadoDuracaoMesesPadrao;
        if (meses === null || meses === '') {
            mudancas.afiliado_duracao_meses_padrao = null;
        } else {
            const n = Number(meses);
            if (!Number.isInteger(n) || n <= 0) {
                return NextResponse.json({ error: 'Duração deve ser um número de meses ou vazio para vitalício' }, { status: 400 });
            }
            mudancas.afiliado_duracao_meses_padrao = n;
        }
    }

    if (body.gateway !== undefined) {
        if (!['asaas', 'manual'].includes(body.gateway)) {
            return NextResponse.json({ error: 'Gateway inválido' }, { status: 400 });
        }
        mudancas.gateway = body.gateway;
    }

    if (body.ambiente !== undefined) {
        if (!['sandbox', 'producao'].includes(body.ambiente)) {
            return NextResponse.json({ error: 'Ambiente inválido' }, { status: 400 });
        }
        mudancas.ambiente = body.ambiente;
    }

    if (body.cobrancaAtiva !== undefined) {
        mudancas.cobranca_ativa = !!body.cobrancaAtiva;
    }

    if (Object.keys(mudancas).length === 0) {
        return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('cobranca_config')
        .update(mudancas)
        .eq('id', true)
        .select()
        .single();

    if (error) {
        console.error('Erro ao salvar configuração de cobrança:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ligar/desligar cobrança e mexer em preço são decisões que precisam de
    // rastro: é a diferença entre "mudou" e "fulano mudou, nesta data".
    await logAuditEvent({
        action: AuditAction.BILLING_CONFIG_UPDATED,
        userId: auth.userId,
        success: true,
        details: { recurso: 'cobranca_config', mudancas },
        ...extractRequestMetadata(req),
    });

    return NextResponse.json({ success: true, config: data });
}
