const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');

// Configuração Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBAUx1qdTY6bkIjg-gmC2YOehGMQEuEaBs",
    authDomain: "cotareconstruir-d276d.firebaseapp.com",
    projectId: "cotareconstruir-d276d",
    storageBucket: "cotareconstruir-d276d.firebasestorage.app",
    messagingSenderId: "1009263099610",
    appId: "1:1009263099610:web:9b638f38adc29264bbafe3",
    measurementId: "G-06P6B8170J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function adicionarFornecedorTeste() {
    try {
        console.log('Iniciando cadastro de fornecedor teste...\n');

        const fornecedorData = {
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
            grupoInsumoIds: [],
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
