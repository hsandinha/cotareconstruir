#!/usr/bin/env tsx

/**
 * Script para importar grupos de insumos extraídos do CSV de fornecedores
 * Execute: npx tsx scripts/importGruposInsumo.ts seu-email@dominio.com sua-senha
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Carregar .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Configuração do Firebase
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function importGrupos() {
    try {
        console.log('📥 Iniciando importação de grupos de insumos...\n');

        // Autenticar
        console.log('🔐 Autenticando...');
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais de administrador não fornecidas!');
            console.error('Execute: npx tsx scripts/importGruposInsumo.ts seu-email@dominio.com sua-senha\n');
            process.exit(1);
        }

        if (email.includes('seu-email') || password === 'sua-senha') {
            console.error('\n❌ Use suas credenciais REAIS!\n');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado!\n');

        // Verificar se já existem grupos
        const existingGrupos = await getDocs(collection(db, 'grupos_insumo'));
        if (existingGrupos.size > 0) {
            console.log(`⚠️  Já existem ${existingGrupos.size} grupos cadastrados.`);
            console.log('Este script irá adicionar apenas grupos novos.\n');
        }

        // Ler CSV e extrair grupos únicos
        const csvPath = resolve(process.cwd(), 'Fornecedores.csv');
        const csvContent = readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        const gruposSet = new Set<string>();

        // Processar cada linha (pular cabeçalho)
        for (let i = 1; i < lines.length; i++) {
            const fields = lines[i].split(';');
            if (fields.length >= 4) {
                const grupo = fields[3].trim();
                if (grupo) {
                    gruposSet.add(grupo);
                }
            }
        }

        const grupos = Array.from(gruposSet).sort();
        console.log(`📊 Total de grupos únicos encontrados: ${grupos.length}\n`);

        // Criar map de grupos existentes
        const existingNames = new Set<string>();
        existingGrupos.forEach(doc => {
            existingNames.add(doc.data().nome);
        });

        // Filtrar apenas grupos novos
        const novosGrupos = grupos.filter(g => !existingNames.has(g));

        if (novosGrupos.length === 0) {
            console.log('✅ Todos os grupos já estão cadastrados!');
            process.exit(0);
        }

        console.log(`➕ Grupos novos a serem adicionados: ${novosGrupos.length}`);
        console.log('Exemplos:', novosGrupos.slice(0, 5).join(', '), '...\n');

        // Importar em batch
        const batch = writeBatch(db);
        let contador = existingGrupos.size;

        novosGrupos.forEach((grupo) => {
            contador++;
            const id = `GI${String(contador).padStart(4, '0')}`;
            const docRef = doc(db, 'grupos_insumo', id);

            batch.set(docRef, {
                nome: grupo,
                descricao: `Grupo de insumos: ${grupo}`,
                ativo: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        });

        await batch.commit();

        console.log('✅ Importação concluída!');
        console.log(`📦 Total de grupos importados: ${novosGrupos.length}`);
        console.log(`📊 Total de grupos no sistema: ${contador}\n`);

        // Listar alguns exemplos
        console.log('Exemplos de grupos cadastrados:');
        novosGrupos.slice(0, 10).forEach((g, i) => {
            console.log(`  ${i + 1}. ${g}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao importar grupos:', error);
        process.exit(1);
    }
}

importGrupos();
