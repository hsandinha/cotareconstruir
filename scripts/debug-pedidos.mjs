/**
 * Script de debug para verificar pedidos e vínculos de fornecedor
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente não configuradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debug() {
    console.log('\n🔍 DEBUG: Verificando Pedidos e Fornecedores\n');

    // 1. Listar todos os pedidos
    const { data: pedidos, error: pedidosError } = await supabase
        .from('pedidos')
        .select('id, numero, fornecedor_id, user_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (pedidosError) {
        console.error('❌ Erro ao buscar pedidos:', pedidosError);
        return;
    }

    console.log('📦 PEDIDOS NO BANCO (últimos 10):\n');
    pedidos?.forEach((p, i) => {
        console.log(`  ${i + 1}. Pedido #${p.numero || 'SEM NÚMERO'}`);
        console.log(`     ID: ${p.id}`);
        console.log(`     Fornecedor ID: ${p.fornecedor_id}`);
        console.log(`     Cliente ID: ${p.user_id}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Criado em: ${p.created_at}`);
        console.log('');
    });

    // 2. Listar fornecedores e seus users
    const { data: fornecedores, error: fornError } = await supabase
        .from('fornecedores')
        .select('id, user_id, razao_social, nome_fantasia, email')
        .limit(5);

    console.log('\n🏢 FORNECEDORES NO BANCO (primeiros 5):\n');
    fornecedores?.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.razao_social || f.nome_fantasia}`);
        console.log(`     Fornecedor ID: ${f.id}`);
        console.log(`     User ID: ${f.user_id || 'NÃO VINCULADO'}`);
        console.log(`     Email: ${f.email}`);
        console.log('');
    });

    // 3. Verificar users com role fornecedor
    const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, roles, fornecedor_id')
        .contains('roles', ['fornecedor'])
        .limit(5);

    console.log('\n👤 USUÁRIOS COM ROLE FORNECEDOR:\n');
    users?.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.email}`);
        console.log(`     User ID: ${u.id}`);
        console.log(`     Fornecedor ID (legado): ${u.fornecedor_id || 'NÃO DEFINIDO'}`);
        console.log(`     Roles: ${u.roles?.join(', ')}`);
        console.log('');
    });

    // 4. Verificar se há pedidos sem fornecedor_id
    const { count: pedidosSemFornecedor } = await supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .is('fornecedor_id', null);

    console.log('\n⚠️  ESTATÍSTICAS:\n');
    console.log(`  Total de pedidos: ${pedidos?.length || 0}`);
    console.log(`  Pedidos sem fornecedor_id: ${pedidosSemFornecedor || 0}`);

    // 5. Verificar vínculos
    if (pedidos && pedidos.length > 0) {
        console.log('\n🔗 VERIFICANDO VÍNCULOS:\n');
        for (const pedido of pedidos.slice(0, 3)) {
            const fornecedorMatch = fornecedores?.find(f => f.id === pedido.fornecedor_id);
            const userMatch = users?.find(u => u.id === fornecedorMatch?.user_id || u.fornecedor_id === pedido.fornecedor_id);

            console.log(`  Pedido #${pedido.numero || pedido.id.slice(0, 8)}:`);
            console.log(`    Fornecedor ID: ${pedido.fornecedor_id}`);
            console.log(`    Fornecedor: ${fornecedorMatch?.razao_social || 'NÃO ENCONTRADO'}`);
            console.log(`    User vinculado: ${userMatch?.email || 'NÃO ENCONTRADO'}`);
            console.log('');
        }
    }
}

debug().catch(console.error);
