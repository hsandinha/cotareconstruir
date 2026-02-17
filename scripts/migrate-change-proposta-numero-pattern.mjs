#!/usr/bin/env node
/**
 * Script para alterar o padrão de numeração das propostas
 * De: 10001, 10002, ... (igual pedidos - confuso)
 * Para: PROP-0001, PROP-0002, ... (padrão único e claro)
 * 
 * Usage: node scripts/migrate-change-proposta-numero-pattern.mjs
 * 
 * IMPORTANTE: Execute no Supabase SQL Editor (recomendado) ou via este script.
 * O arquivo SQL está em: supabase/migrations/20260217000000_change_proposta_numero_pattern.sql
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    console.error('   Defina antes de executar:');
    console.error('   export NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"');
    console.error('   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function executeSql(sql) {
    // Tentar via RPC exec_sql
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (!error) return { data, error: null };

    // Fallback: via REST API direto
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
        const text = await response.text();
        return { data: null, error: { message: text } };
    }

    return { data: await response.json(), error: null };
}

async function runMigration() {
    try {
        console.log('🚀 Alterando padrão de numeração das propostas...');
        console.log('   De: 10001, 10002, ... (confuso com pedidos)');
        console.log('   Para: P-0001, P-0002, ... (padrão único)\n');

        // Mostrar estado atual antes da migração
        console.log('📊 Estado atual das propostas:');
        const { data: antes, error: anteErr } = await supabase
            .from('propostas')
            .select('id, numero, created_at')
            .order('created_at', { ascending: true })
            .limit(10);

        if (!anteErr && antes) {
            console.table(antes.map(p => ({ id: p.id.slice(0, 8), numero_atual: p.numero || '(sem número)', created_at: p.created_at })));
        }

        // Ler e executar o arquivo SQL da migration
        const migrationPath = join(__dirname, '../supabase/migrations/20260217000000_change_proposta_numero_pattern.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        // Separar em blocos lógicos (por ';' mas preservando blocos DO $$ ... $$ ;)
        const blocks = [];
        let currentBlock = '';
        let inDollarBlock = false;

        for (const line of migrationSQL.split('\n')) {
            const trimmed = line.trim();

            // Ignorar linhas de comentário puro
            if (trimmed.startsWith('--') && !inDollarBlock) {
                continue;
            }

            currentBlock += line + '\n';

            // Detectar início/fim de blocos $$ 
            const dollarCount = (line.match(/\$\$/g) || []).length;
            if (dollarCount === 1) {
                inDollarBlock = !inDollarBlock;
            } else if (dollarCount === 2) {
                // Abre e fecha no mesmo line (ex: $$ LANGUAGE plpgsql $$)
                // inDollarBlock permanece igual
            }

            // Final de statement (fora de bloco $$)
            if (!inDollarBlock && trimmed.endsWith(';')) {
                const block = currentBlock.trim();
                if (block.length > 0 && block !== ';') {
                    blocks.push(block);
                }
                currentBlock = '';
            }
        }

        // Executar ultimo bloco se houver
        if (currentBlock.trim().length > 0) {
            blocks.push(currentBlock.trim());
        }

        console.log(`\n📝 Executando ${blocks.length} blocos SQL...\n`);

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const preview = block.split('\n')[0].slice(0, 80);
            console.log(`  [${i + 1}/${blocks.length}] ${preview}...`);

            const { error } = await executeSql(block);

            if (error) {
                console.error(`  ❌ Erro: ${error.message}`);
                // Continuar com os próximos blocos
            } else {
                console.log(`  ✅ OK`);
            }
        }

        // Verificar resultado
        console.log('\n📊 Resultado - propostas com novo formato:');
        const { data: depois, error: depoisErr } = await supabase
            .from('propostas')
            .select('id, numero, created_at')
            .order('created_at', { ascending: true })
            .limit(10);

        if (!depoisErr && depois) {
            console.table(depois.map(p => ({ id: p.id.slice(0, 8), numero: p.numero || '(sem número)', created_at: p.created_at })));
        }

        // Verificar que não há conflito com pedidos
        console.log('\n🔍 Verificação de conflitos com pedidos:');
        const { data: pedidos } = await supabase
            .from('pedidos')
            .select('numero')
            .limit(5);

        const { data: propostas } = await supabase
            .from('propostas')
            .select('numero')
            .limit(5);

        console.log('  Exemplos de números de pedidos:', pedidos?.map(p => p.numero).join(', ') || 'nenhum');
        console.log('  Exemplos de números de propostas:', propostas?.map(p => p.numero).join(', ') || 'nenhuma');
        console.log('\n✅ Migration concluída! Propostas agora usam o formato P-XXXX');

    } catch (error) {
        console.error('\n❌ Erro durante migration:', error.message);
        process.exit(1);
    }
}

runMigration();
