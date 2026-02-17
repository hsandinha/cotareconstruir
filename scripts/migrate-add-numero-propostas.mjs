#!/usr/bin/env node
/**
 * Script para aplicar migration: adicionar campo numero em propostas
 * Usage: node scripts/migrate-add-numero-propostas.mjs
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
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runMigration() {
    try {
        console.log('🚀 Iniciando migration: add numero to propostas...');

        // Ler o arquivo SQL da migration
        const migrationPath = join(__dirname, '../supabase/migrations/20260216000000_add_numero_propostas.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        // Executar a migration (dividir por statements para melhor controle)
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`\n📝 Executando statement ${i + 1}/${statements.length}...`);

            const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

            // Se não houver função exec_sql, tentar via SQL direto
            if (error && error.message.includes('function')) {
                console.log('⚠️  Função exec_sql não disponível, usando query direto...');
                // Para queries DDL, precisamos usar o método .from() com uma query raw
                // Como alternativa, vamos executar via fetch direto
                const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                    },
                    body: JSON.stringify({ sql_query: statement })
                });

                if (!response.ok) {
                    console.error(`❌ Erro no statement ${i + 1}:`, await response.text());
                    continue;
                }
            } else if (error) {
                console.error(`❌ Erro no statement ${i + 1}:`, error.message);
                continue;
            }

            console.log(`✅ Statement ${i + 1} executado com sucesso`);
        }

        console.log('\n✅ Migration concluída com sucesso!');
        console.log('\n📊 Verificando dados...');

        // Verificar se a coluna foi criada
        const { data: propostas, error: checkError } = await supabase
            .from('propostas')
            .select('id, numero')
            .limit(5);

        if (checkError) {
            console.error('❌ Erro ao verificar propostas:', checkError.message);
        } else {
            console.log(`\n✅ Coluna 'numero' verificada. Primeiras 5 propostas:`);
            console.table(propostas || []);
        }

    } catch (error) {
        console.error('❌ Erro durante migration:', error.message);
        process.exit(1);
    }
}

// Executar migration
runMigration();
