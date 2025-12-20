#!/usr/bin/env tsx

/**
 * Script para padronizar capitalização dos nomes dos grupos
 * Primeira letra maiúscula, demais minúsculas (com exceções para siglas)
 * Execute: npx tsx scripts/padronizarNomesGrupos.ts seu-email@dominio.com sua-senha
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

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

// Siglas que devem permanecer em maiúsculas
const SIGLAS = ['EPI', 'MDF', 'SPA', 'INOX', 'AÇO', 'PVC', 'CNPJ', 'CPF'];

function capitalizarNome(nome: string): string {
    // Dividir por espaços e outros separadores mantendo-os
    const partes = nome.split(/(\s+|\/|-|\(|\)|,)/);

    return partes.map(parte => {
        // Manter separadores como estão
        if (parte.match(/^\s+$/) || parte.match(/^[\/\-\(\),]$/)) {
            return parte;
        }

        // Verificar se é uma sigla conhecida
        if (SIGLAS.includes(parte.toUpperCase())) {
            return parte.toUpperCase();
        }

        // Se for só números ou vazio, manter
        if (!parte || parte.match(/^\d+$/)) {
            return parte;
        }

        // Capitalizar: primeira maiúscula, resto minúsculo
        return parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase();
    }).join('');
}

async function padronizarNomes() {
    try {
        console.log('🔤 Padronizando nomes dos grupos...\n');

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

        console.log(`📦 Total de grupos: ${gruposSnap.size}\n`);

        const gruposParaAtualizar: Array<{
            id: string;
            nomeAtual: string;
            nomeNovo: string;
        }> = [];

        gruposSnap.forEach(docSnap => {
            const nomeAtual = docSnap.data().nome;
            const nomeNovo = capitalizarNome(nomeAtual);

            if (nomeAtual !== nomeNovo) {
                gruposParaAtualizar.push({
                    id: docSnap.id,
                    nomeAtual,
                    nomeNovo
                });
            }
        });

        if (gruposParaAtualizar.length === 0) {
            console.log('✅ Todos os grupos já estão com nomes padronizados!');
            process.exit(0);
        }

        console.log(`🔄 Grupos a atualizar: ${gruposParaAtualizar.length}\n`);
        console.log('Exemplos de mudanças:');
        gruposParaAtualizar.slice(0, 10).forEach(({ nomeAtual, nomeNovo }) => {
            console.log(`   "${nomeAtual}" → "${nomeNovo}"`);
        });

        if (gruposParaAtualizar.length > 10) {
            console.log(`   ... e mais ${gruposParaAtualizar.length - 10} grupos\n`);
        } else {
            console.log('');
        }

        // Atualizar em batches
        const batchSize = 500;
        for (let i = 0; i < gruposParaAtualizar.length; i += batchSize) {
            const batch = writeBatch(db);
            const batchGrupos = gruposParaAtualizar.slice(i, i + batchSize);

            for (const grupo of batchGrupos) {
                const docRef = doc(db, 'grupos_insumo', grupo.id);
                batch.update(docRef, {
                    nome: grupo.nomeNovo,
                    updatedAt: new Date()
                });
            }

            await batch.commit();
            console.log(`✅ Atualizados ${Math.min(i + batchSize, gruposParaAtualizar.length)}/${gruposParaAtualizar.length}`);
        }

        console.log('\n✅ Padronização concluída!');
        console.log(`📊 Grupos atualizados: ${gruposParaAtualizar.length}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

padronizarNomes();
