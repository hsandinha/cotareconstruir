#!/usr/bin/env node
/**
 * Script de diagnóstico para problemas de login de administrador
 * 
 * Verifica:
 * 1. Se existe usuário com role=admin ou 'admin' em roles[]
 * 2. Estado da autenticação no Supabase Auth
 * 3. Sincronização entre auth.users e public.users
 * 
 * Usage: node scripts/debug-admin-login.mjs <email-do-admin>
 */

import { createClient } from '@supabase/supabase-js';
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

async function debugAdminLogin(email) {
    console.log('🔍 Diagnóstico de Login Administrativo\n');
    console.log(`Email: ${email}\n`);

    try {
        // 1. Buscar usuário em public.users
        console.log('📊 Verificando tabela public.users...');
        const { data: publicUsers, error: publicError } = await supabase
            .from('users')
            .select('id, email, nome, role, roles, status, is_verified, created_at')
            .eq('email', email);

        if (publicError) {
            console.error('❌ Erro ao consultar public.users:', publicError.message);
        } else if (!publicUsers || publicUsers.length === 0) {
            console.log('⚠️  Usuário NÃO encontrado em public.users');
        } else {
            console.log('✅ Usuário encontrado em public.users:');
            publicUsers.forEach(user => {
                console.log(`   ID: ${user.id}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Nome: ${user.nome || '(não definido)'}`);
                console.log(`   Role (singular): ${user.role}`);
                console.log(`   Roles (array): ${JSON.stringify(user.roles)}`);
                console.log(`   Status: ${user.status}`);
                console.log(`   Verificado: ${user.is_verified}`);
                console.log(`   Criado em: ${user.created_at}`);
                console.log('');

                // Verificar se é admin
                const isAdminByRole = user.role === 'admin';
                const isAdminByRoles = user.roles && Array.isArray(user.roles) && user.roles.includes('admin');

                if (isAdminByRole || isAdminByRoles) {
                    console.log('✅ Usuário TEM permissões de admin');
                    if (isAdminByRole) console.log('   - Via campo "role"');
                    if (isAdminByRoles) console.log('   - Via array "roles"');
                } else {
                    console.log('❌ Usuário NÃO tem permissões de admin');
                    console.log(`   - role atual: "${user.role}"`);
                    console.log(`   - roles atual: ${JSON.stringify(user.roles)}`);
                }
                console.log('');
            });
        }

        // 2. Buscar no Supabase Auth (auth.users)
        console.log('🔐 Verificando auth.users (Supabase Auth)...');
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

        if (authError) {
            console.error('❌ Erro ao consultar auth.users:', authError.message);
        } else {
            const authUser = authData.users.find(u => u.email === email);
            if (!authUser) {
                console.log('⚠️  Usuário NÃO encontrado em auth.users');
                console.log('   O usuário pode não ter sido criado no sistema de autenticação');
            } else {
                console.log('✅ Usuário encontrado em auth.users:');
                console.log(`   ID: ${authUser.id}`);
                console.log(`   Email: ${authUser.email}`);
                console.log(`   Email confirmado: ${authUser.email_confirmed_at ? 'Sim' : 'Não'}`);
                console.log(`   Criado em: ${authUser.created_at}`);
                console.log(`   Último login: ${authUser.last_sign_in_at || '(nunca)'}`);
                console.log('');
            }
        }

        // 3. Verificar sincronização
        console.log('🔄 Verificando sincronização...');
        if (publicUsers && publicUsers.length > 0 && authData?.users) {
            const publicUser = publicUsers[0];
            const authUser = authData.users.find(u => u.id === publicUser.id);

            if (authUser) {
                console.log('✅ IDs sincronizados entre public.users e auth.users');
            } else {
                console.log('❌ DESSINCRONIZAÇÃO: ID em public.users não existe em auth.users');
                console.log('   Isso pode causar problemas de autenticação');
            }
        }

        // 4. Listar TODOS os usuários admin (para referência)
        console.log('\n📋 Todos os administradores no sistema:');
        const { data: allAdmins, error: adminError } = await supabase
            .from('users')
            .select('id, email, nome, role, roles')
            .or('role.eq.admin,roles.cs.{admin}');

        if (adminError) {
            console.error('❌ Erro ao listar admins:', adminError.message);
        } else if (!allAdmins || allAdmins.length === 0) {
            console.log('⚠️  NENHUM administrador encontrado no sistema!');
        } else {
            console.table(allAdmins.map(a => ({
                email: a.email,
                nome: a.nome || '(não definido)',
                role: a.role,
                roles: JSON.stringify(a.roles)
            })));
        }

        // 5. Recomendações
        console.log('\n💡 Recomendações:');
        if (!publicUsers || publicUsers.length === 0) {
            console.log('   1. Execute o script "create-admin-user.mjs" para criar o usuário admin');
        } else {
            const user = publicUsers[0];
            if (user.role !== 'admin' && (!user.roles || !user.roles.includes('admin'))) {
                console.log('   1. Execute o script "fix-admin-role.mjs" para corrigir as permissões');
            }
            if (!user.is_verified) {
                console.log('   2. Verifique o email do usuário (is_verified=false pode bloquear login)');
            }
            if (user.status !== 'active') {
                console.log('   3. O status do usuário não é "active" - pode estar bloqueado');
            }
        }

    } catch (error) {
        console.error('\n❌ Erro durante diagnóstico:', error.message);
        process.exit(1);
    }
}

// Executar
const email = process.argv[2];
if (!email) {
    console.error('❌ Erro: Email do administrador não fornecido');
    console.error('   Usage: node scripts/debug-admin-login.mjs <email-do-admin>');
    console.error('   Exemplo: node scripts/debug-admin-login.mjs admin@Comprareconstruir.com.br');
    process.exit(1);
}

debugAdminLogin(email);
