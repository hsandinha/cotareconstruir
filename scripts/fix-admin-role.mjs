#!/usr/bin/env node
/**
 * Script para corrigir permissões de administrador de um usuário existente
 * 
 * Atualiza tanto o campo `role` quanto o array `roles` para garantir
 * que o usuário tenha acesso administrativo completo.
 * 
 * Usage: node scripts/fix-admin-role.mjs <email>
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

async function fixAdminRole(email) {
    console.log('🔧 Corrigindo permissões de administrador\n');
    console.log(`Email: ${email}\n`);

    try {
        // 1. Buscar usuário
        console.log('🔍 Buscando usuário...');
        const { data: users, error: searchError } = await supabase
            .from('users')
            .select('id, email, nome, role, roles, status')
            .eq('email', email);

        if (searchError) {
            console.error('❌ Erro ao buscar usuário:', searchError.message);
            process.exit(1);
        }

        if (!users || users.length === 0) {
            console.error('❌ Usuário não encontrado');
            console.error('   Use o script create-admin-user.mjs para criar um novo admin');
            process.exit(1);
        }

        const user = users[0];
        console.log('✅ Usuário encontrado:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Nome: ${user.nome || '(não definido)'}`);
        console.log(`   Role atual: ${user.role}`);
        console.log(`   Roles atual: ${JSON.stringify(user.roles)}`);
        console.log(`   Status: ${user.status}`);
        console.log('');

        // Verificar se já é admin
        const isAdminByRole = user.role === 'admin';
        const isAdminByRoles = user.roles && Array.isArray(user.roles) && user.roles.includes('admin');

        if (isAdminByRole && isAdminByRoles) {
            console.log('✅ Usuário já possui permissões de admin corretas!');
            console.log('   Não é necessário fazer alterações.');
            return;
        }

        // 2. Confirmar mudança
        console.log('⚠️  O usuário será atualizado para:');
        console.log('   role: "admin"');
        console.log('   roles: ["admin"]');
        console.log('   status: "active"');
        console.log('   is_verified: true\n');

        const confirm = await askQuestion('Confirma a atualização? (s/N): ');
        if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'sim') {
            console.log('❌ Operação cancelada');
            process.exit(0);
        }

        // 3. Atualizar permissões
        console.log('\n🔄 Atualizando permissões...');
        const { error: updateError } = await supabase
            .from('users')
            .update({
                role: 'admin',
                roles: ['admin'],
                status: 'active',
                is_verified: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('❌ Erro ao atualizar:', updateError.message);
            process.exit(1);
        }

        console.log('✅ Permissões atualizadas com sucesso!\n');

        // 4. Verificar resultado
        const { data: updatedUser, error: verifyError } = await supabase
            .from('users')
            .select('id, email, nome, role, roles, status, is_verified')
            .eq('id', user.id)
            .single();

        if (!verifyError && updatedUser) {
            console.log('📊 Estado final:');
            console.log(`   Email: ${updatedUser.email}`);
            console.log(`   Nome: ${updatedUser.nome || '(não definido)'}`);
            console.log(`   Role: ${updatedUser.role}`);
            console.log(`   Roles: ${JSON.stringify(updatedUser.roles)}`);
            console.log(`   Status: ${updatedUser.status}`);
            console.log(`   Verificado: ${updatedUser.is_verified}`);
            console.log('');
        }

        console.log('✅ Operação concluída!');
        console.log('   O usuário agora pode fazer login como administrador.');

    } catch (error) {
        console.error('\n❌ Erro durante execução:', error.message);
        process.exit(1);
    }
}

// Executar
const email = process.argv[2];
if (!email) {
    console.error('❌ Erro: Email não fornecido');
    console.error('   Usage: node scripts/fix-admin-role.mjs <email>');
    console.error('   Exemplo: node scripts/fix-admin-role.mjs admin@cotareconstruir.com.br');
    process.exit(1);
}

fixAdminRole(email);
