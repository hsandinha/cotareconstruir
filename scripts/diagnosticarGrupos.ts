#!/usr/bin/env tsx

/**
 * Script para diagnosticar grupos não encontrados
 * Execute: npx tsx scripts/diagnosticarGrupos.ts seu-email@dominio.com sua-senha
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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

interface Fornecedor {
    id: string;
    grupoInsumos?: string;
    [key: string]: any;
}

async function diagnosticar() {
    try {
        console.log('🔍 Diagnosticando grupos...\n');

        // Autenticar
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais não fornecidas!');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado!\n');

        // Carregar grupos
        const gruposSnap = await getDocs(collection(db, 'grupos_insumo'));
        const gruposMap = new Map<string, string>();

        gruposSnap.forEach(doc => {
            const nome = doc.data().nome;
            gruposMap.set(nome.toLowerCase().trim(), nome);
        });

        console.log(`📦 Grupos no banco: ${gruposMap.size}\n`);

        // Carregar fornecedores
        const fornecedoresSnap = await getDocs(collection(db, 'fornecedores'));
        const fornecedores: Fornecedor[] = fornecedoresSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`🏢 Fornecedores: ${fornecedores.length}\n`);

        // Analisar grupos nos fornecedores
        const gruposDosFornecedores = new Set<string>();
        const gruposNaoEncontrados = new Set<string>();

        fornecedores.forEach(fornecedor => {
            const grupoInsumos = fornecedor.grupoInsumos || '';

            if (grupoInsumos) {
                // Separar por vírgula
                const grupos = grupoInsumos.split(',').map((g: string) => g.trim()).filter((g: string) => g);

                grupos.forEach((grupo: string) => {
                    gruposDosFornecedores.add(grupo);

                    if (!gruposMap.has(grupo.toLowerCase().trim())) {
                        gruposNaoEncontrados.add(grupo);
                    }
                });
            }
        });

        console.log(`📊 Grupos únicos nos fornecedores: ${gruposDosFornecedores.size}\n`);

        if (gruposNaoEncontrados.size > 0) {
            console.log(`❌ Grupos NÃO ENCONTRADOS (${gruposNaoEncontrados.size}):\n`);

            const lista = Array.from(gruposNaoEncontrados).sort();
            lista.forEach((grupo, i) => {
                console.log(`${i + 1}. "${grupo}"`);

                // Tentar encontrar similar
                for (const [key, value] of gruposMap) {
                    if (key.includes(grupo.toLowerCase().slice(0, 10))) {
                        console.log(`   💡 Possível match: "${value}"`);
                        break;
                    }
                }
            });
        } else {
            console.log('✅ Todos os grupos foram encontrados!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

diagnosticar();
