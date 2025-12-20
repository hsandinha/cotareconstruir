#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

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

async function adicionarGruposAoFornecedor() {
    try {
        console.log('🔗 Adicionando grupos ao fornecedor teste...\n');

        // Autenticar
        console.log('🔐 Autenticando...');
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais não fornecidas!');
            console.error('Execute: npx tsx scripts/adicionarGruposTesteAoFornecedor.ts seu-email@dominio.com sua-senha\n');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado!\n');

        // Buscar fornecedor pelo email
        const fornecedoresRef = collection(db, 'fornecedores');
        const q = query(fornecedoresRef, where('emailResponsavel', '==', 'hebertsandinhacorretor@gmail.com'));
        const fornecedorSnap = await getDocs(q);

        if (fornecedorSnap.empty) {
            console.error('❌ Fornecedor não encontrado!');
            process.exit(1);
        }

        const fornecedorDoc = fornecedorSnap.docs[0];
        const fornecedorId = fornecedorDoc.id;
        console.log('📦 Fornecedor encontrado:', fornecedorId);

        // Buscar alguns grupos de teste
        const gruposSnap = await getDocs(collection(db, 'grupos_insumo'));
        const grupos = gruposSnap.docs.slice(0, 10); // Pegar os primeiros 10 grupos

        const grupoIds = grupos.map(g => g.id);
        const grupoNomes = grupos.map(g => g.data().nome);

        console.log('\n📋 Grupos que serão associados:');
        grupoNomes.forEach((nome, i) => {
            console.log(`   ${i + 1}. ${nome}`);
        });

        // Atualizar fornecedor
        const fornecedorRef = doc(db, 'fornecedores', fornecedorId);
        await updateDoc(fornecedorRef, {
            grupoInsumoIds: grupoIds,
            updatedAt: new Date()
        });

        console.log('\n✅ Grupos associados com sucesso!');
        console.log(`📊 Total: ${grupoIds.length} grupos`);

    } catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    }
}

adicionarGruposAoFornecedor()
    .then(() => {
        console.log('\n✅ Script concluído!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Erro:', error);
        process.exit(1);
    });
