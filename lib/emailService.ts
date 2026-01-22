/**
 * Email Service usando SendGrid
 * Gerencia envio de emails transacionais
 */

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Envia email usando SendGrid API
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
    try {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@cotareconstruir.com.br';
        const fromName = process.env.SENDGRID_FROM_NAME || 'Cota Reconstruir';

        if (!apiKey) {
            throw new Error('SENDGRID_API_KEY não configurada');
        }

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [
                    {
                        to: [{ email: options.to }],
                        subject: options.subject,
                    },
                ],
                from: {
                    email: fromEmail,
                    name: fromName,
                },
                content: [
                    {
                        type: 'text/html',
                        value: options.html,
                    },
                    ...(options.text ? [{
                        type: 'text/plain',
                        value: options.text,
                    }] : []),
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.errors?.[0]?.message || 'Erro ao enviar email');
        }

        // SendGrid retorna 202 Accepted com header X-Message-Id
        const messageId = response.headers.get('x-message-id');

        return {
            success: true,
            messageId: messageId || 'sent',
        };

    } catch (error: any) {
        console.error('Erro ao enviar email:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Template: Email de boas-vindas
 */
export function getWelcomeEmailTemplate(name: string, email: string): { subject: string; html: string; text: string } {
    return {
        subject: '🎉 Bem-vindo ao Cota Reconstruir!',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏗️ Bem-vindo ao Cota Reconstruir!</h1>
                    </div>
                    <div class="content">
                        <p>Olá <strong>${name}</strong>,</p>
                        <p>É um prazer tê-lo conosco! Sua conta foi criada com sucesso.</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p>Agora você pode:</p>
                        <ul>
                            <li>✅ Gerenciar suas obras e projetos</li>
                            <li>✅ Solicitar cotações de materiais</li>
                            <li>✅ Comparar preços de fornecedores</li>
                            <li>✅ Acompanhar pedidos em tempo real</li>
                        </ul>
                        <center>
                            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Acessar Dashboard</a>
                        </center>
                        <p>Se você tiver alguma dúvida, nossa equipe está sempre disponível para ajudar!</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Cota Reconstruir. Todos os direitos reservados.</p>
                        <p>Este é um email automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Olá ${name},\n\nBem-vindo ao Cota Reconstruir!\n\nSua conta foi criada com sucesso: ${email}\n\nAcesse: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard\n\nEquipe Cota Reconstruir`,
    };
}

/**
 * Template: Email de recuperação de senha
 */
export function getPasswordResetEmailTemplate(name: string, resetLink: string): { subject: string; html: string; text: string } {
    return {
        subject: '🔐 Recuperação de Senha - Cota Reconstruir',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Recuperação de Senha</h1>
                    </div>
                    <div class="content">
                        <p>Olá <strong>${name}</strong>,</p>
                        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
                        <p>Clique no botão abaixo para criar uma nova senha:</p>
                        <center>
                            <a href="${resetLink}" class="button">Redefinir Senha</a>
                        </center>
                        <div class="warning">
                            <strong>⚠️ Importante:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li>Este link expira em <strong>15 minutos</strong></li>
                                <li>Se você não solicitou esta alteração, ignore este email</li>
                                <li>Sua senha atual permanecerá ativa</li>
                            </ul>
                        </div>
                        <p style="margin-top: 20px; color: #666; font-size: 14px;">
                            Se o botão não funcionar, copie e cole este link no navegador:<br>
                            <code style="background: #e9ecef; padding: 5px 10px; border-radius: 3px; display: inline-block; margin-top: 10px;">${resetLink}</code>
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Cota Reconstruir. Todos os direitos reservados.</p>
                        <p>Este é um email automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Olá ${name},\n\nRecebemos uma solicitação para redefinir sua senha.\n\nClique neste link para criar uma nova senha:\n${resetLink}\n\n⚠️ Este link expira em 15 minutos.\n\nSe você não solicitou esta alteração, ignore este email.\n\nEquipe Cota Reconstruir`,
    };
}

/**
 * Template: Notificação de mudança de senha
 */
export function getPasswordChangedEmailTemplate(name: string): { subject: string; html: string; text: string } {
    return {
        subject: '✅ Senha Alterada - Cota Reconstruir',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .alert { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Senha Alterada com Sucesso</h1>
                    </div>
                    <div class="content">
                        <p>Olá <strong>${name}</strong>,</p>
                        <div class="alert">
                            <strong>✅ Confirmação:</strong><br>
                            A senha da sua conta foi alterada com sucesso.
                        </div>
                        <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                        <p>Se você não realizou esta alteração, entre em contato com nossa equipe imediatamente:</p>
                        <p>📧 Email: suporte@cotareconstruir.com.br<br>
                        📱 WhatsApp: (11) 99999-9999</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Cota Reconstruir. Todos os direitos reservados.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Olá ${name},\n\n✅ Sua senha foi alterada com sucesso.\n\nData/Hora: ${new Date().toLocaleString('pt-BR')}\n\nSe você não realizou esta alteração, entre em contato:\nsuporte@cotareconstruir.com.br\n\nEquipe Cota Reconstruir`,
    };
}
