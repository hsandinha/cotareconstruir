import { auth } from './firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';

interface CreateUserAccountParams {
    email: string;
    entityType: 'cliente' | 'fornecedor';
    entityId: string;
    entityName: string;
    whatsapp?: string;
}

export async function createUserAccount({
    email,
    entityType,
    entityId,
    entityName,
    whatsapp
}: CreateUserAccountParams) {
    const defaultPassword = '123456';

    try {
        // 1. Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, defaultPassword);
        const userId = userCredential.user.uid;

        // 2. Criar documento na coleção users
        await setDoc(doc(db, 'users', userId), {
            email,
            name: entityName,
            role: entityType,
            roles: [entityType],
            [entityType === 'cliente' ? 'clienteId' : 'fornecedorId']: entityId,
            mustChangePassword: true,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 3. Atualizar o documento cliente/fornecedor com o userId
        const collectionName = entityType === 'cliente' ? 'clientes' : 'fornecedores';
        await updateDoc(doc(db, collectionName, entityId), {
            userId,
            hasUserAccount: true,
            updatedAt: new Date()
        });

        // 4. Enviar credenciais (você pode integrar com serviço de email/SMS)
        await sendCredentials({
            email,
            whatsapp,
            name: entityName,
            password: defaultPassword
        });

        return { success: true, userId };
    } catch (error: any) {
        console.error('Erro ao criar conta:', error);

        // Mensagens de erro mais amigáveis
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('Este email já possui uma conta cadastrada');
        }

        throw new Error('Erro ao criar conta de acesso');
    }
}

async function sendCredentials({
    email,
    whatsapp,
    name,
    password
}: {
    email: string;
    whatsapp?: string;
    name: string;
    password: string;
}) {
    // Aqui você pode integrar com:
    // - SendGrid/AWS SES para email
    // - Twilio/WhatsApp Business API para SMS/WhatsApp

    const message = `
Olá ${name}!

Sua conta foi criada no sistema Cota Reconstruir.

📧 Email: ${email}
🔑 Senha temporária: ${password}

⚠️ Por segurança, você será solicitado a alterar sua senha no primeiro acesso.

Acesse: https://cotareconstruir.com.br/login

Atenciosamente,
Equipe Cota Reconstruir
    `.trim();

    console.log('📧 Enviando credenciais:', { email, whatsapp, message });

    // TODO: Implementar envio real
    // await sendEmail(email, 'Suas credenciais de acesso', message);
    // if (whatsapp) await sendWhatsApp(whatsapp, message);
}

export async function resetUserPassword(userId: string, entityType: 'cliente' | 'fornecedor') {
    const defaultPassword = '123456';

    try {
        // Buscar dados do usuário
        const userSnap = await getDoc(doc(db, 'users', userId));

        if (!userSnap.exists()) {
            throw new Error('Usuário não encontrado');
        }

        const user = userSnap.data();

        // Marcar que deve trocar senha
        await updateDoc(doc(db, 'users', userId), {
            mustChangePassword: true,
            updatedAt: serverTimestamp()
        });

        // Enviar credenciais por email
        await sendCredentials({
            email: user.email,
            whatsapp: user.whatsapp || undefined,
            name: user.name || 'Usuário',
            password: defaultPassword
        });

        // NOTA: Para realmente resetar a senha, seria necessário Firebase Admin SDK
        // que só roda no servidor. Por ora, apenas marcamos mustChangePassword=true
        // e enviamos as credenciais.

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao resetar senha:', error);
        throw new Error(error.message || 'Erro ao resetar senha');
    }
}
