/**
 * API Route: Admin — Controlador da turma de lançamento.
 *
 * Lê e ajusta as vagas do teste gratuito (quantas, por quantos dias, quantas
 * obras), lista quem ocupou cada vaga e administra a fila de espera.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStatusTurma, gerarConviteToken, CONVITE_VALIDADE_DIAS } from '@/lib/lancamentoService';
import { notifyConviteTurmaLancamento } from '@/lib/emailService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value
        || request.cookies.get('sb-access-token')?.value;

    if (!token) return null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) return null;

    return { user, supabase };
}

export async function GET(request: NextRequest) {
    const auth = await verifyAdmin(request);
    if (!auth) {
        return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const { supabase } = auth;

    const [status, vagasRes, filaRes] = await Promise.all([
        getStatusTurma(supabase as any),
        supabase
            .from('lancamento_vagas')
            .select('id, user_id, cliente_id, posicao, nome, email, teste_inicio, teste_fim, status, observacao, created_at')
            .order('posicao', { ascending: true }),
        supabase
            .from('lista_espera')
            .select('id, nome, email, telefone, razao_social, cpf_cnpj, origem, convidado_em, convite_expira_em, cadastrado_em, created_at')
            .order('created_at', { ascending: true }),
    ]);

    if (vagasRes.error) {
        console.error('[ADMIN LANCAMENTO] Erro ao listar vagas:', vagasRes.error);
    }
    if (filaRes.error) {
        console.error('[ADMIN LANCAMENTO] Erro ao listar fila:', filaRes.error);
    }

    return NextResponse.json({
        status,
        vagas: vagasRes.data || [],
        fila: filaRes.data || [],
    });
}

export async function POST(request: NextRequest) {
    const auth = await verifyAdmin(request);
    if (!auth) {
        return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
    }

    const { supabase } = auth;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '');

    // Ajusta os parâmetros da turma
    if (action === 'update_config') {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (body.vagasTotal !== undefined) {
            const vagas = Number(body.vagasTotal);
            if (!Number.isInteger(vagas) || vagas < 0) {
                return NextResponse.json({ error: 'Número de vagas inválido.' }, { status: 400 });
            }
            patch.vagas_total = vagas;
        }
        if (body.diasTeste !== undefined) {
            const dias = Number(body.diasTeste);
            if (!Number.isInteger(dias) || dias <= 0) {
                return NextResponse.json({ error: 'Período de teste inválido.' }, { status: 400 });
            }
            patch.dias_teste = dias;
        }
        if (body.obrasPorConta !== undefined) {
            const obras = Number(body.obrasPorConta);
            if (!Number.isInteger(obras) || obras <= 0) {
                return NextResponse.json({ error: 'Limite de obras inválido.' }, { status: 400 });
            }
            patch.obras_por_conta = obras;
        }
        if (body.inscricoesAbertas !== undefined) {
            patch.inscricoes_abertas = Boolean(body.inscricoesAbertas);
        }

        const { error } = await supabase.from('lancamento_config').update(patch).eq('id', true);
        if (error) {
            console.error('[ADMIN LANCAMENTO] Erro ao salvar config:', error);
            return NextResponse.json({ error: 'Não foi possível salvar as configurações.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, status: await getStatusTurma(supabase as any) });
    }

    // Muda a situação de uma vaga. Cancelar libera o número para a fila.
    if (action === 'update_vaga') {
        const vagaId = String(body?.vagaId || '');
        const status = String(body?.status || '');
        const permitidos = ['ativo', 'expirado', 'convertido', 'cancelado'];

        if (!vagaId || !permitidos.includes(status)) {
            return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('lancamento_vagas')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', vagaId);

        if (error) {
            console.error('[ADMIN LANCAMENTO] Erro ao atualizar vaga:', error);
            return NextResponse.json({ error: 'Não foi possível atualizar a vaga.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }

    // Estende o teste de uma vaga em N dias
    if (action === 'estender_teste') {
        const vagaId = String(body?.vagaId || '');
        const dias = Number(body?.dias);

        if (!vagaId || !Number.isInteger(dias) || dias === 0) {
            return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
        }

        const { data: vaga, error: readError } = await supabase
            .from('lancamento_vagas')
            .select('teste_fim')
            .eq('id', vagaId)
            .single();

        if (readError || !vaga) {
            return NextResponse.json({ error: 'Vaga não encontrada.' }, { status: 404 });
        }

        // Conta a partir de hoje quando o teste já venceu
        const base = Math.max(new Date(vaga.teste_fim).getTime(), Date.now());
        const novoFim = new Date(base + dias * 24 * 60 * 60 * 1000).toISOString();

        const { error } = await supabase
            .from('lancamento_vagas')
            .update({ teste_fim: novoFim, status: 'ativo', updated_at: new Date().toISOString() })
            .eq('id', vagaId);

        if (error) {
            console.error('[ADMIN LANCAMENTO] Erro ao estender teste:', error);
            return NextResponse.json({ error: 'Não foi possível estender o teste.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, testeFim: novoFim });
    }

    // Convida um lead da fila: gera o token, grava a validade e dispara o
    // e-mail com o link de cadastro já identificado.
    if (action === 'convidar_fila') {
        const filaId = String(body?.filaId || '');
        if (!filaId) {
            return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
        }

        const status = await getStatusTurma(supabase as any);
        if (status.vagasRestantes <= 0) {
            return NextResponse.json(
                { error: 'Não há vaga livre. Libere uma vaga antes de convidar.' },
                { status: 400 }
            );
        }

        const { data: lead, error: leadError } = await supabase
            .from('lista_espera')
            .select('id, nome, email, cadastrado_em')
            .eq('id', filaId)
            .single();

        if (leadError || !lead) {
            return NextResponse.json({ error: 'Lead não encontrado na fila.' }, { status: 404 });
        }
        if (lead.cadastrado_em) {
            return NextResponse.json({ error: 'Este lead já se cadastrou.' }, { status: 400 });
        }

        const token = gerarConviteToken();
        const expiraEm = new Date(Date.now() + CONVITE_VALIDADE_DIAS * 24 * 60 * 60 * 1000).toISOString();

        const { error: updateError } = await supabase
            .from('lista_espera')
            .update({
                convidado_em: new Date().toISOString(),
                convite_token: token,
                convite_expira_em: expiraEm,
            })
            .eq('id', filaId);

        if (updateError) {
            console.error('[ADMIN LANCAMENTO] Erro ao gerar convite:', updateError);
            return NextResponse.json({ error: 'Não foi possível gerar o convite.' }, { status: 500 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
        const cadastroUrl = `${baseUrl}/cadastro?convite=${encodeURIComponent(token)}`;

        const envio = await notifyConviteTurmaLancamento({
            email: lead.email,
            nome: lead.nome || 'Construtor',
            cadastroUrl,
            diasTeste: status.diasTeste,
            obrasPorConta: status.obrasPorConta,
            expiraEm,
        });

        if (!envio?.success) {
            // Token continua válido: o admin pode reenviar ou passar o link
            console.error('[ADMIN LANCAMENTO] Convite gravado mas e-mail falhou:', envio?.error);
            return NextResponse.json({
                success: true,
                emailEnviado: false,
                cadastroUrl,
                error: 'Convite gerado, mas o e-mail não saiu. Envie o link manualmente.',
            });
        }

        return NextResponse.json({ success: true, emailEnviado: true, cadastroUrl });
    }

    if (action === 'remover_fila') {
        const filaId = String(body?.filaId || '');
        if (!filaId) {
            return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
        }

        const { error } = await supabase.from('lista_espera').delete().eq('id', filaId);
        if (error) {
            console.error('[ADMIN LANCAMENTO] Erro ao remover da fila:', error);
            return NextResponse.json({ error: 'Não foi possível remover da fila.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 });
}
