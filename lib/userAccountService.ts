import { supabaseAdmin } from './supabaseAuth';
import { supabase } from './supabase';

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
        // Verificar se admin client está disponível
        if (!supabaseAdmin) {
            throw new Error('Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.');
        }

        // 1. Criar usuário no Supabase Auth usando admin client
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true, // Auto-confirm email
        });

        if (authError) {
            if (authError.message.includes('already been registered')) {
                throw new Error('Este email já possui uma conta cadastrada');
            }
            throw authError;
        }

        const userId = authData.user.id;

        // 2. Criar registro na tabela users
        const { error: userError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                email,
                nome: entityName,
                role: entityType,
                roles: [entityType],
                [entityType === 'cliente' ? 'cliente_id' : 'fornecedor_id']: entityId,
                status: 'pending', // Must change password
                is_verified: false,
            });

        if (userError) throw userError;

        // 3. Atualizar o documento cliente/fornecedor com o userId
        const tableName = entityType === 'cliente' ? 'clientes' : 'fornecedores';
        const { error: entityError } = await supabaseAdmin
            .from(tableName)
            .update({
                user_id: userId,
            })
            .eq('id', entityId);

        if (entityError) throw entityError;

        // 4. Enviar credenciais
        await sendCredentials({
            email,
            whatsapp,
            name: entityName,
            password: defaultPassword
        });

        return { success: true, userId };
    } catch (error: any) {
        console.error('Erro ao criar conta:', error);
        throw new Error(error.message || 'Erro ao criar conta de acesso');
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
    const message = `
Olá ${name}!

Sua conta foi criada no sistema Cota Reconstruir.

📧 Email: ${email}
🔑 Senha temporária: ${password}

⚠️ Por segurança, você será solicitado a alterar sua senha no primeiro acesso.

Acesse: https://Comprareconstruir.com.br/login

Atenciosamente,
Equipe Cota Reconstruir
    `.trim();

    console.log('📧 Enviando credenciais:', { email, whatsapp, message });

    // TODO: Implementar envio real via SendGrid ou outro serviço
    // await sendEmail(email, 'Suas credenciais de acesso', message);
    // if (whatsapp) await sendWhatsApp(whatsapp, message);
}

export async function resetUserPassword(userId: string, entityType: 'cliente' | 'fornecedor') {
    const defaultPassword = '123456';

    try {
        // Verificar se admin client está disponível
        if (!supabaseAdmin) {
            throw new Error('Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.');
        }

        // Buscar dados do usuário
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('email, nome')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            throw new Error('Usuário não encontrado');
        }

        // Resetar senha no Supabase Auth usando admin client
        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: defaultPassword,
        });

        if (resetError) throw resetError;

        // Marcar que deve trocar senha
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ status: 'pending' })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Enviar credenciais por email
        await sendCredentials({
            email: userData.email,
            name: userData.nome || 'Usuário',
            password: defaultPassword
        });

        return { success: true };
    } catch (error: any) {
        console.error('Erro ao resetar senha:', error);
        throw new Error(error.message || 'Erro ao resetar senha');
    }
}
