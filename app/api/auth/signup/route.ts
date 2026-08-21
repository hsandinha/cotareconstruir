/**
 * Cadastro público de CLIENTE (construtor/comprador).
 *
 * Fornecedores continuam sendo cadastrados internamente pela administração —
 * esta rota cria apenas contas com papel "cliente".
 *
 * Cria a conta no Supabase Auth e, com a service key, já monta o perfil
 * (users + clientes) mesmo quando o projeto exige confirmação de e-mail,
 * para que o primeiro login caia direto no painel.
 *
 * Turma de lançamento: o teste gratuito tem um número fixo de vagas
 * (ver lib/lancamentoService). Com as vagas esgotadas nenhuma conta é
 * criada — o lead entra na fila de espera, como a landing promete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';
import { getStatusTurma, reservarVaga, validarConvite } from '@/lib/lancamentoService';
import {
    sanitizeEmail,
    sanitizeString,
    sanitizeNumeric,
    validateEmail,
    validatePassword,
    validateCPF,
    validateCNPJ,
} from '@/lib/validation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type LeadFila = {
    nome: string;
    email: string;
    telefone?: string;
    razaoSocial?: string;
    documento?: string;
};

/** Registra o lead na fila de espera (idempotente pelo e-mail). */
async function entrarNaFilaDeEspera(lead: LeadFila) {
    if (!supabaseAdmin) return;
    const { error } = await supabaseAdmin
        .from('lista_espera')
        .upsert({
            nome: lead.nome,
            email: lead.email,
            telefone: lead.telefone || null,
            razao_social: lead.razaoSocial || null,
            cpf_cnpj: lead.documento || null,
            origem: 'cadastro',
        }, { onConflict: 'email' });

    if (error) console.error('Erro ao registrar na fila de espera:', error);
}

/**
 * Desfaz a conta recém-criada quando a vaga não pôde ser reservada.
 * Sem isso ficaria um cadastro fora da turma, com acesso que não deveria ter.
 */
async function desfazerCadastro(userId: string, clienteId: string | null) {
    if (!supabaseAdmin) return;
    try {
        if (clienteId) await supabaseAdmin.from('clientes').delete().eq('id', clienteId);
        await supabaseAdmin.from('users').delete().eq('id', userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (error) {
        console.error('Erro ao desfazer cadastro sem vaga:', error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const identifier = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
        const rateLimit = await checkRateLimit(`signup:${identifier}`, 5, 600);
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Muitas tentativas de cadastro. Tente novamente em alguns minutos.' },
                { status: 429 }
            );
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await request.json();

        const nome = sanitizeString(String(body?.nome || '')).trim();
        const email = sanitizeEmail(String(body?.email || ''));
        const password = String(body?.password || '');
        const telefone = sanitizeString(String(body?.telefone || '')).trim();
        const razaoSocial = sanitizeString(String(body?.razaoSocial || '')).trim();
        const documento = sanitizeNumeric(String(body?.cpfCnpj || ''));
        // Token do convite da fila de espera (link enviado por e-mail)
        const conviteToken = sanitizeString(String(body?.convite || '')).trim() || null;

        if (!nome) {
            return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 });
        }

        if (!email || !validateEmail(email)) {
            return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            return NextResponse.json({ error: passwordCheck.errors.join('. ') }, { status: 400 });
        }

        if (documento) {
            const documentoValido = documento.length > 11 ? validateCNPJ(documento) : validateCPF(documento);
            if (!documentoValido) {
                return NextResponse.json({ error: 'CPF/CNPJ inválido.' }, { status: 400 });
            }
        }

        // Conta já existente: manda para o login em vez de criar duplicata
        const { data: existingProfile } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existingProfile?.id) {
            return NextResponse.json(
                { error: 'Já existe uma conta com este e-mail. Faça login ou use "Esqueci minha senha".', code: 'email_taken' },
                { status: 409 }
            );
        }

        // Convite da fila: vale mesmo com as inscrições fechadas, desde que
        // ainda exista vaga (quem confere de verdade é a reserva).
        const convite = conviteToken ? await validarConvite(supabaseAdmin as any, conviteToken) : null;

        // Turma cheia: ninguém vira conta, o lead vai para a fila de espera
        const turma = await getStatusTurma(supabaseAdmin as any);
        if (!turma.inscricoesAbertas && !convite) {
            await entrarNaFilaDeEspera({ nome, email, telefone, razaoSocial, documento });
            return NextResponse.json({
                success: true,
                waitlisted: true,
                vagasTotal: turma.vagasTotal,
                message: 'As vagas da turma de lançamento foram preenchidas. Você entrou na fila de espera e avisaremos assim que abrir uma vaga.',
            });
        }

        // signUp pelo cliente anônimo para respeitar a política de confirmação do projeto
        const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: signUpData, error: signUpError } = await supabasePublic.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: nome, telefone, cpf_cnpj: documento },
                emailRedirectTo: `${new URL(request.url).origin}/login`,
            },
        });

        if (signUpError) {
            const message = String(signUpError.message || '');
            if (message.toLowerCase().includes('already registered') || message.toLowerCase().includes('already been registered')) {
                return NextResponse.json(
                    { error: 'Já existe uma conta com este e-mail. Faça login ou use "Esqueci minha senha".', code: 'email_taken' },
                    { status: 409 }
                );
            }
            console.error('Erro no signUp:', signUpError);
            return NextResponse.json({ error: 'Não foi possível criar a conta. Tente novamente.' }, { status: 400 });
        }

        const authUser = signUpData?.user;
        if (!authUser?.id) {
            return NextResponse.json({ error: 'Não foi possível criar a conta. Tente novamente.' }, { status: 400 });
        }

        // Perfil na tabela users (papel cliente, sempre)
        const { error: userInsertError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: authUser.id,
                email,
                nome,
                telefone: telefone || null,
                cpf_cnpj: documento || null,
                role: 'cliente',
                roles: ['cliente'],
                status: 'active',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (userInsertError) {
            console.error('Erro ao criar perfil do usuário:', userInsertError);
            return NextResponse.json({ error: 'Conta criada, mas houve falha ao montar o perfil. Fale com o suporte.' }, { status: 500 });
        }

        // Registro em clientes, para obras e cotações
        const { data: cliente, error: clienteError } = await supabaseAdmin
            .from('clientes')
            .insert({
                user_id: authUser.id,
                nome,
                razao_social: razaoSocial || null,
                email,
                telefone: telefone || null,
                cpf_cnpj: documento || null,
            })
            .select('id')
            .single();

        if (clienteError) {
            console.error('Erro ao criar cliente:', clienteError);
        } else if (cliente?.id) {
            await supabaseAdmin
                .from('users')
                .update({ cliente_id: cliente.id, updated_at: new Date().toISOString() })
                .eq('id', authUser.id);
        }

        // Reserva a vaga da turma. A checagem acima é só para evitar trabalho à
        // toa — quem decide é esta chamada, que serializa cadastros simultâneos.
        const reserva = await reservarVaga(supabaseAdmin as any, {
            userId: authUser.id,
            clienteId: cliente?.id || null,
            nome,
            email,
            conviteToken: convite ? conviteToken : null,
        });

        if (!reserva.ok && reserva.motivo === 'sem_vaga') {
            // Alguém levou a última vaga entre a checagem e a reserva. Desfaz a
            // conta para não deixar cadastro órfão fora da turma.
            await desfazerCadastro(authUser.id, cliente?.id || null);
            await entrarNaFilaDeEspera({ nome, email, telefone, razaoSocial, documento });
            return NextResponse.json({
                success: true,
                waitlisted: true,
                vagasTotal: turma.vagasTotal,
                message: 'As vagas da turma de lançamento foram preenchidas. Você entrou na fila de espera e avisaremos assim que abrir uma vaga.',
            });
        }

        // `indisponivel` = o controle de vagas não respondeu (migration ainda
        // não aplicada, banco fora). A conta segue válida: melhor uma vaga a
        // conciliar depois do que barrar cadastro por falha nossa.
        if (!reserva.ok) {
            console.error('[SIGNUP] Conta criada sem reserva de vaga:', email);
        }

        // Sem sessão = projeto exige confirmação de e-mail antes do primeiro login
        const needsEmailConfirmation = !signUpData?.session;

        return NextResponse.json({
            success: true,
            needsEmailConfirmation,
            clienteId: cliente?.id || null,
            vaga: reserva.ok ? { posicao: reserva.vaga.posicao, testeFim: reserva.vaga.teste_fim } : null,
            diasTeste: turma.diasTeste,
            obrasPorConta: turma.obrasPorConta,
        });
    } catch (error: any) {
        console.error('Erro no cadastro:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
