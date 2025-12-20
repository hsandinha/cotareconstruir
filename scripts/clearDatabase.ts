#!/usr/bin/env tsx

/**
 * Script para LIMPAR todos os dados do Firestore
 * CUIDADO: Isso vai DELETAR TUDO das coleções de construção!
 * Execute: npx tsx scripts/clearDatabase.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

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

const COLLECTIONS = ['fases', 'servicos', 'grupos_insumo', 'materiais'];

async function clearDatabase() {
    console.log('⚠️  ATENÇÃO: Este script vai DELETAR TODOS os dados das coleções de construção!\n');

    // Validar variáveis de ambiente
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error('❌ Erro: Variáveis de ambiente do Firebase não configuradas!');
        process.exit(1);
    }

    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    try {
        for (const collectionName of COLLECTIONS) {
            console.log(`🗑️  Limpando coleção: ${collectionName}...`);

            const snapshot = await getDocs(collection(db, collectionName));

            if (snapshot.empty) {
                console.log(`   ✓ Coleção ${collectionName} já está vazia`);
                continue;
            }

            // Deletar em batches de 500
            const batches: any[] = [];
            let batch = writeBatch(db);
            let operationCount = 0;

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
                operationCount++;

                if (operationCount >= 500) {
                    batches.push(batch);
                    batch = writeBatch(db);
                    operationCount = 0;
                }
            });

            if (operationCount > 0) {
                batches.push(batch);
            }

            // Commit todos os batches
            for (const b of batches) {
                await b.commit();
            }

            console.log(`   ✅ ${snapshot.size} documentos deletados de ${collectionName}`);
        }

        console.log('\n✅ Banco de dados limpo com sucesso!');
        console.log('💡 Execute agora: npx tsx scripts/seedDatabaseSimple.ts para popular novamente\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao limpar banco:', error);
        process.exit(1);
    }
}

clearDatabase();
