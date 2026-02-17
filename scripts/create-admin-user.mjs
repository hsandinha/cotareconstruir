#!/usr/bin/env node
/**
 * Script para criar um novo usuário administrador
 * 
 * Cria o usuário tanto no Supabase Auth quanto em public.users
 * com permissões completas de administrador.
 * 
 * Usage: node scripts/create-admin-user.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas');
    console.error('   NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function createAdminUser() {
    console.log('🔐 Criação de Usuário Administrador\n');

    try {
        // 1. Coletar dados
        const email = await askQuestion('Email do admin: ');
        if (!email || !email.includes('@')) {
            console.error('❌ Email inválido');
            process.exit(1);
        }

        const nome = await askQuestion('Nome completo: ');
        const password = await askQuestion('Senha (min. 6 caracteres): ');

        if (!password || password.length < 6) {
            console.error('❌ Senha deve ter no mínimo 6 caracteres');
            process.exit(1);
        }

        console.log('\n📋 Dados do novo administrador:');
        console.log(`   Email: ${email}`);
        console.log(`   Nome: ${nome}`);
        console.log(`   Role: admin`);
        console.log(`   Senha: ${'*'.repeat(password.length)}\n`);

        const confirm = await askQuestion('Confirma a criação? (s/N): ');
        if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'sim') {
            console.log('❌ Operação cancelada');
            process.exit(0);
        }

        // 2. Verificar se já existe
        console.log('\n🔍 Verificando se usuário já existe...');
        const { data: existingUsers } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email);

        if (existingUsers && existingUsers.length > 0) {
            console.error('❌ Já existe um usuário com este email');
            console.error('   Use o script fix-admin-role.mjs para converter em admin');
            process.exit(1);
        }

        // 3. Criar usuário no Supabase Auth
        console.log('🔄 Criando usuário no Supabase Auth...');
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Confirmar email automaticamente
            user_metadata: {
                nome: nome,
                role: 'admin'
            }
        });

        if (authError) {
            console.error('❌ Erro ao criar usuário no Auth:', authError.message);
            process.exit(1);
        }

        if (!authData.user) {
            console.error('❌ Usuário não foi criado no Auth');
            process.exit(1);
        }

        console.log('✅ Usuário criado no Auth');
        console.log(`   User ID: ${authData.user.id}`);

        // 4. Criar registro em public.users
        console.log('🔄 Criando registro em public.users...');
        const { error: insertError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id,
                email: email,
                nome: nome,
                role: 'admin',
                roles: ['admin'],
                status: 'active',
                is_verified: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('❌ Erro ao criar registro em public.users:', insertError.message);
            console.error('   O usuário foi criado no Auth mas não no banco de dados');
            console.error('   Você pode tentar criar manualmente via SQL Editor');
            process.exit(1);
        }

        console.log('✅ Registro criado em public.users\n');

        // 5. Verificar resultado
        console.log('🔍 Verificando criação...');
        const { data: newUser, error: verifyError } = await supabase
            .from('users')
            .select('id, email, nome, role, roles, status, is_verified')
            .eq('id', authData.user.id)
            .single();

        if (verifyError || !newUser) {
            console.error('⚠️  Não foi possível verificar o usuário criado');
        } else {
            console.log('✅ Usuário administrador criado com sucesso!\n');
            console.log('📊 Detalhes:');
            console.log(`   ID: ${newUser.id}`);
            console.log(`   Email: ${newUser.email}`);
            console.log(`   Nome: ${newUser.nome}`);
            console.log(`   Role: ${newUser.role}`);
            console.log(`   Roles: ${JSON.stringify(newUser.roles)}`);
            console.log(`   Status: ${newUser.status}`);
            console.log(`   Verificado: ${newUser.is_verified}`);
            console.log('');
            console.log('✅ O usuário pode fazer login imediatamente com:');
            console.log(`   Email: ${email}`);
            console.log(`   Senha: (a que você definiu)`);
            console.log(`   URL: ${SUPABASE_URL.replace('.supabase.co', '')}/login`);
        }

    } catch (error) {
        console.error('\n❌ Erro durante execução:', error.message);
        process.exit(1);
    }
}

createAdminUser();
