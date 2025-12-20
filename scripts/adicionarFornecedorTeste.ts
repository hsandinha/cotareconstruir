#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

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
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual?: string;
    endereco: string;
    cep: string;
    telefoneComercial: string;
    nomeResponsavel: string;
    cargoResponsavel?: string;
    emailResponsavel: string;
    whatsapp?: string;
    grupoInsumoIds: string[];
    ativo: boolean;
    dataCadastro: string;
}

async function adicionarFornecedorTeste() {
    try {
        console.log('Iniciando cadastro de fornecedor teste...\n');

        // Autenticar
        console.log('🔐 Autenticando...');
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais não fornecidas!');
            console.error('Execute: npx tsx scripts/adicionarFornecedorTeste.ts seu-email@dominio.com sua-senha\n');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado!\n');

        const fornecedorData: Fornecedor = {
            razaoSocial: 'HEBERT SANDINHA CONSULTOR LTDA',
            cnpj: '59.866.904/0001-47',
            inscricaoEstadual: '',
            endereco: 'LAURA SOARES CARNEIRO, 177 APT 301 - BURITIS, BELO HORIZONTE',
            cep: '30575-220',
            telefoneComercial: '(31)9 8400-5308',
            nomeResponsavel: 'HEBERT SANDINHA',
            cargoResponsavel: '',
            emailResponsavel: 'hebertsandinhacorretor@gmail.com',
            whatsapp: '',
            grupoInsumoIds: [], // Será associado posteriormente
            ativo: true,
            dataCadastro: new Date().toISOString()
        };

        // Verificar se já existe fornecedor com este CNPJ
        const fornecedoresRef = collection(db, 'fornecedores');
        const q = query(fornecedoresRef, where('cnpj', '==', fornecedorData.cnpj));
        const existente = await getDocs(q);

        if (!existente.empty) {
            console.log('⚠️  Fornecedor com este CNPJ já existe!');
            const fornecedorDoc = existente.docs[0];
            console.log('ID:', fornecedorDoc.id);
            console.log('Dados:', fornecedorDoc.data());
            return;
        }

        // Criar fornecedor
        const fornecedorRef = await addDoc(fornecedoresRef, fornecedorData);
        console.log('✅ Fornecedor criado com sucesso!');
        console.log('ID:', fornecedorRef.id);

        // Atualizar usuário com fornecedorId
        const usersRef = collection(db, 'users');
        const userQ = query(usersRef, where('email', '==', fornecedorData.emailResponsavel));
        const userQuery = await getDocs(userQ);

        if (!userQuery.empty) {
            const userDoc = userQuery.docs[0];
            await updateDoc(doc(db, 'users', userDoc.id), {
                fornecedorId: fornecedorRef.id
            });
            console.log('✅ Usuário vinculado ao fornecedor!');
            console.log('User ID:', userDoc.id);
        } else {
            console.log('⚠️  Usuário não encontrado. Crie o usuário primeiro ou vincule manualmente.');
        }

        console.log('\n📋 Resumo:');
        console.log('Razão Social:', fornecedorData.razaoSocial);
        console.log('CNPJ:', fornecedorData.cnpj);
        console.log('E-mail:', fornecedorData.emailResponsavel);
        console.log('Fornecedor ID:', fornecedorRef.id);
        console.log('\n⚠️  Lembre-se de associar o fornecedor aos grupos de insumo!');

    } catch (error) {
        console.error('❌ Erro ao cadastrar fornecedor:', error);
        throw error;
    }
}

adicionarFornecedorTeste()
    .then(() => {
        console.log('\n✅ Script concluído!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Erro:', error);
        process.exit(1);
    });
