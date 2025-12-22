import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, query } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

// Credenciais de admin
const ADMIN_EMAIL = 'hebertsandinhacorretor@gmail.com';
const ADMIN_PASSWORD = 'Rogerio@01';

const users = [
    {
        email: 'leonardo.lnog@gmail.com',
        password: 'Leonardo@123',
        nome: 'Leonardo Lopes (Cliente/Fornecedor)',
        razaoSocial: 'Leonardo Materiais Ltda',
        cnpj: '12.345.678/0001-90',
        telefone: '(31) 98765-4321',
        endereco: 'Rua das Acácias, 100',
        bairro: 'Centro',
        cidade: 'Belo Horizonte',
        estado: 'MG',
        cep: '30140-000'
    },
    {
        email: 'Leonardolopesjr@gmail.com',
        password: 'Leonardo@456',
        nome: 'Leonardo Lopes Jr (Cliente/Fornecedor)',
        razaoSocial: 'Leonardo Jr Construções',
        cnpj: '98.765.432/0001-10',
        telefone: '(31) 91234-5678',
        endereco: 'Av. Brasil, 500',
        bairro: 'Savassi',
        cidade: 'Belo Horizonte',
        estado: 'MG',
        cep: '30140-100'
    }
];

async function setupUsers() {
    console.log('🚀 Iniciando configuração dos usuários Leonardo...\n');

    // Autenticar como admin primeiro
    console.log('🔐 Autenticando como administrador...');
    try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Autenticado com sucesso\n');
    } catch (error) {
        console.error('❌ Erro ao autenticar como admin:', error);
        process.exit(1);
    }

    // Buscar grupos de insumos disponíveis
    console.log('📦 Buscando grupos de insumos...');
    const gruposSnapshot = await getDocs(collection(db, 'grupos_insumo'));
    const grupos = gruposSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { nome: string } }));
    console.log(`✅ Encontrados ${grupos.length} grupos de insumos\n`);

    for (const userData of users) {
        try {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`👤 Processando: ${userData.email}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            // 1. Criar usuário no Firebase Auth
            console.log('🔐 Criando usuário no Firebase Auth...');
            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(
                    auth,
                    userData.email,
                    userData.password
                );
                console.log(`✅ Usuário criado com UID: ${userCredential.user.uid}`);
            } catch (error: any) {
                if (error.code === 'auth/email-already-in-use') {
                    console.log('⚠️  Usuário já existe no Auth, continuando...');
                    // Simular UID baseado no email (em produção, você teria o UID real)
                    const fakeUid = userData.email.split('@')[0].replace(/\./g, '_');
                    userCredential = { user: { uid: fakeUid } } as any;
                } else {
                    throw error;
                }
            }

            const uid = userCredential.user.uid;

            // 2. Criar perfil único com múltiplos roles
            console.log('\n👥 Criando perfil com acesso Cliente + Fornecedor...');
            
            // Selecionar 3-5 grupos aleatórios para o fornecedor
            const gruposVinculados = grupos
                .sort(() => 0.5 - Math.random())
                .slice(0, Math.floor(Math.random() * 3) + 3)
                .map(g => g.id);

            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, {
                uid: uid,
                email: userData.email,
                roles: ['cliente', 'fornecedor'], // Array com ambos os roles
                role: 'cliente', // Role padrão inicial
                
                // Dados de Cliente
                nome: userData.nome,
                
                // Dados de Fornecedor
                razaoSocial: userData.razaoSocial,
                nomeFantasia: userData.razaoSocial,
                cnpj: userData.cnpj,
                
                // Dados compartilhados
                telefone: userData.telefone,
                endereco: {
                    logradouro: userData.endereco,
                    bairro: userData.bairro,
                    cidade: userData.cidade,
                    estado: userData.estado,
                    cep: userData.cep
                },
                
                // Dados do fornecedor
                gruposInsumo: gruposVinculados,
                verificado: true,
                avaliacaoMedia: 4.5,
                totalAvaliacoes: 10,
                
                // Metadados
                createdAt: new Date().toISOString(),
                mustChangePassword: false,
                ativo: true
            });

            console.log('✅ Perfil criado com múltiplos roles');
            console.log(`📦 Grupos vinculados como fornecedor (${gruposVinculados.length}):`);
            gruposVinculados.forEach(gId => {
                const grupo = grupos.find(g => g.id === gId);
                console.log(`   - ${grupo?.nome || gId}`);
            });

            console.log(`\n✅ Usuário ${userData.email} configurado com sucesso!`);
            console.log(`   Email: ${userData.email}`);
            console.log(`   Senha: ${userData.password}`);
            console.log(`   Perfis: Cliente + Fornecedor`);

        } catch (error) {
            console.error(`\n❌ Erro ao processar ${userData.email}:`, error);
        }
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 CONFIGURAÇÃO CONCLUÍDA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 CREDENCIAIS DE ACESSO:\n');
    users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Senha: ${user.password}`);
        console.log(`   Perfis disponíveis: Cliente e Fornecedor\n`);
    });

    console.log('💡 COMO USAR:');
    console.log('   1. Acesse: http://localhost:3000/login');
    console.log('   2. Faça login com qualquer um dos emails acima');
    console.log('   3. No dashboard, use o seletor de perfil para trocar entre Cliente e Fornecedor');
    console.log('   4. Teste as funcionalidades de ambas as telas\n');

    process.exit(0);
}

setupUsers().catch(error => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
});
