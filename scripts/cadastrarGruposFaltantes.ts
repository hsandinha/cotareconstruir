#!/usr/bin/env tsx

/**
 * Script para identificar e cadastrar grupos faltantes do CSV de fornecedores
 * Execute: npx tsx scripts/cadastrarGruposFaltantes.ts seu-email@dominio.com sua-senha
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
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

async function cadastrarGruposFaltantes() {
    try {
        console.log('📋 Identificando grupos faltantes...\n');

        // Autenticar
        console.log('🔐 Autenticando...');
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais não fornecidas!');
            console.error('Execute: npx tsx scripts/cadastrarGruposFaltantes.ts seu-email@dominio.com sua-senha\n');
            process.exit(1);
        }

        if (email.includes('seu-email') || password === 'sua-senha') {
            console.error('\n❌ Use suas credenciais REAIS!\n');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado!\n');

        // Carregar grupos existentes
        console.log('📦 Carregando grupos existentes...');
        const gruposSnap = await getDocs(collection(db, 'grupos_insumo'));
        const gruposExistentes = new Set<string>();
        let ultimoId = 0;

        gruposSnap.forEach(doc => {
            const nome = doc.data().nome;
            gruposExistentes.add(nome.toLowerCase().trim());

            // Pegar o último ID numérico (GI0001 -> 1)
            const match = doc.id.match(/GI(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > ultimoId) {
                    ultimoId = num;
                }
            }
        });

        console.log(`   ${gruposExistentes.size} grupos cadastrados\n`);

        // Ler CSV e extrair grupos únicos
        console.log('📄 Lendo CSV de fornecedores...');
        const csvPath = resolve(process.cwd(), 'Fornecedores.csv');
        const csvContent = readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        const gruposDoCSV = new Set<string>();

        // Processar cada linha (pular cabeçalho)
        for (let i = 1; i < lines.length; i++) {
            const fields = lines[i].split(';');
            if (fields.length >= 4) {
                const grupo = fields[3].trim();
                if (grupo) {
                    gruposDoCSV.add(grupo);
                }
            }
        }

        console.log(`   ${gruposDoCSV.size} grupos únicos no CSV\n`);

        // Identificar grupos faltantes
        const gruposFaltantes: string[] = [];

        for (const grupo of gruposDoCSV) {
            if (!gruposExistentes.has(grupo.toLowerCase().trim())) {
                gruposFaltantes.push(grupo);
            }
        }

        if (gruposFaltantes.length === 0) {
            console.log('✅ Todos os grupos do CSV já estão cadastrados!');
            process.exit(0);
        }

        gruposFaltantes.sort();

        console.log(`⚠️  Grupos faltantes encontrados: ${gruposFaltantes.length}\n`);
        console.log('Grupos a serem cadastrados:');
        gruposFaltantes.forEach((grupo, i) => {
            console.log(`   ${i + 1}. ${grupo}`);
        });

        console.log('\n🔄 Cadastrando grupos faltantes...\n');

        // Cadastrar em batch
        const batch = writeBatch(db);
        let contador = ultimoId;

        gruposFaltantes.forEach((grupo) => {
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

        console.log('✅ Grupos cadastrados com sucesso!');
        console.log(`📊 Total de novos grupos: ${gruposFaltantes.length}`);
        console.log(`📈 Total de grupos no sistema: ${gruposExistentes.size + gruposFaltantes.length}\n`);

        console.log('💡 Próximo passo: Execute o script de vinculação novamente:');
        console.log(`   npx tsx scripts/vincularFornecedoresGrupos.ts ${email} ${password}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao cadastrar grupos:', error);
        process.exit(1);
    }
}

cadastrarGruposFaltantes();
