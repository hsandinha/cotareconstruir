/**
 * Cadastro público de CLIENTE (construtor/comprador).
 *
 * Fornecedores continuam sendo cadastrados internamente pela administração —
 * esta rota cria apenas contas com papel "cliente".
 *
 * Cria a conta no Supabase Auth e, com a service key, já monta o perfil
 * (users + clientes) mesmo quando o projeto exige confirmação de e-mail,
 * para que o primeiro login caia direto no painel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';
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

        // Sem sessão = projeto exige confirmação de e-mail antes do primeiro login
        const needsEmailConfirmation = !signUpData?.session;

        return NextResponse.json({
            success: true,
            needsEmailConfirmation,
            clienteId: cliente?.id || null,
        });
    } catch (error: any) {
        console.error('Erro no cadastro:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
