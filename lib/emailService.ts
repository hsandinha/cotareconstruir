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

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getEmailAssetsBaseUrl(): string {
    const configuredBaseUrl = (
        process.env.EMAIL_ASSETS_BASE_URL
        || process.env.APP_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || 'https://comprareconstruir.com'
    ).replace(/\/$/, '');

    if (/\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredBaseUrl)) {
        return 'https://comprareconstruir.com';
    }

    return configuredBaseUrl;
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
                    ...(options.text ? [{
                        type: 'text/plain',
                        value: options.text,
                    }] : []),
                    {
                        type: 'text/html',
                        value: options.html,
                    },
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

export function getFornecedorRecadastroEmailTemplate(options: { recipientEmail: string; temporaryPassword?: string }): { subject: string; html: string; text: string } {
    const baseUrl = getEmailAssetsBaseUrl();
    const logoUrl = `${baseUrl}/logo.png`;
    const temporaryPassword = options.temporaryPassword || '123456';
    const recipientEmail = options.recipientEmail;

    const credentialsHtml = `
        <div style="margin:10px 0 16px 0;padding:14px;border-radius:10px;background-color:#f8fafc;border:1px solid #e2e8f0;font-size:14px;line-height:22px;">
            <p style="margin:0 0 8px 0;font-weight:700;">Credenciais de acesso:</p>
            <p style="margin:0;"><strong>Usuário:</strong> ${escapeHtml(recipientEmail)}</p>
            <p style="margin:0;"><strong>Senha temporária:</strong> ${escapeHtml(temporaryPassword)}</p>
            <p style="margin:8px 0 0 0;color:#475569;font-size:12px;line-height:18px;">
                No primeiro acesso, será obrigatório trocar a senha.
            </p>
        </div>
    `;

    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Recadastramento de Fornecedores</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;">
            <div style="width:100%;padding:24px 12px;">
                <div style="max-width:720px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                    <div style="padding:28px;text-align:center;">
                        <img src="${logoUrl}" alt="Cotar & Construir" style="height:52px;width:auto;display:inline-block;" />
                    </div>
                    <div style="padding:0 28px 28px 28px;color:#111827;font-family:Arial,sans-serif;">
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;"><strong>Prezados parceiros fornecedores,</strong></p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            A Cotar e Construir resolveu transformar sua experiência de 34 anos de atendimento a milhares de clientes em uma Plataforma de compras de materiais para construção civil.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            O nosso objetivo é agilizar o processo de compras e estender a um número maior de empresas construtoras, engenheiros e arquitetos autônomos e consumidores finais que buscam empresas especializadas no fornecimento dos diversos materiais e equipamentos da construção civil.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Dessa forma, estamos recadastrando todos os fornecedores que fazem parte do nosso banco de dados, já que foram nossos parceiros ao longo desses anos, nada mais justo prestigiá-los, nesta nova fase da empresa.
                        </p>
                        <p style="margin:0 0 12px 0;font-size:14px;line-height:22px;">
                            Para acessar o sistema e realizar o recadastramento, utilize o link abaixo:
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            <a href="https://comprareconstruir.com/login" style="color:#2563eb;text-decoration:underline;font-weight:700;">https://comprareconstruir.com/login</a>
                        </p>
                        ${credentialsHtml}
                        <p style="margin:16px 0 14px 0;font-size:13px;line-height:20px;font-weight:700;text-transform:uppercase;">
                            IMPORTANTE: NO CADASTRO DE MATERIAIS SERÁ NECESSÁRIO APENAS INSERIR A DESCRIÇÃO PRINCIPAL DE CADA GRUPO DE MATERIAIS, CONFORME EXEMPLO NO FORMULÁRIO.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:13px;line-height:20px;font-weight:700;text-transform:uppercase;">
                            ESTE CADASTRO DE MATERIAIS FICARÁ NO NOSSO BANCO DE DADOS PARA DIRECIONAR AS CONSULTAS DOS NOSSOS CLIENTES ATRAVÉS DE UM LINK QUE SERÁ ENVIADO PELO E-MAIL DA COTAR E CONSTRUIR PARA OS FORNECEDORES ESPECIALIZADOS QUE COMERCIALIZAM ESSES MATERIAIS. GERANDO ASSIM, MAIS OPORTUNIDADE DE VENDAS DE TODA A LINHA DE MATERIAIS.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Caso haja alguma dúvida não hesite em nos contatar, estaremos à disposição para atendê-los.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Desde já agradeço a atenção de todos.
                        </p>
                        <div style="margin-top:18px;font-size:14px;line-height:22px;">
                            <p style="margin:0 0 10px 0;">Att.</p>
                            <p style="margin:0;">Leonardo Lopes Nogueira.</p>
                            <p style="margin:0;">Diretor Comercial</p>
                            <p style="margin:0;">(31) 99219-4237</p>
                        </div>
                        <p style="margin:18px 0 0 0;font-size:14px;line-height:22px;font-weight:700;">
                            Favor confirmar o recebimento deste e-mail!
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return {
        subject: 'Recadastramento de Fornecedores - Cotar & Construir',
        html,
        text: [
            'Prezados parceiros fornecedores,',
            '',
            'A Cotar e Construir resolveu transformar sua experiência de 34 anos de atendimento a',
            'milhares de clientes em uma Plataforma de compras de materiais para construção civil.',
            '',
            'O nosso objetivo é agilizar o processo de compras e estender a um número maior de empresas',
            'construtoras, engenheiros e arquitetos autônomos e consumidores finais que buscam',
            'empresas especializadas no fornecimento dos diversos materiais e equipamentos da',
            'construção civil.',
            '',
            'Dessa forma, estamos recadastrando todos os fornecedores que fazem parte do nosso banco',
            'de dados, já que foram nossos parceiros ao longo desses anos, nada mais justo prestigiá-los,',
            'nesta nova fase da empresa.',
            '',
            'Para acessar o sistema e realizar o recadastramento, utilize o link abaixo:',
            'https://comprareconstruir.com/login',
            '',
            'Credenciais de acesso:',
            `Usuário: ${recipientEmail}`,
            `Senha temporária: ${temporaryPassword}`,
            'No primeiro acesso, será obrigatório trocar a senha.',
            '',
            'IMPORTANTE: NO CADASTRO DE MATERIAIS SERÁ NECESSÁRIO APENAS INSERIR A DESCRIÇÃO',
            'PRINCIPAL DE CADA GRUPO DE MATERIAIS, CONFORME EXEMPLO NO FORMULÁRIO.',
            'ESTE CADASTRO DE MATERIAIS FICARÁ NO NOSSO BANCO DE DADOS PARA DIRECIONAR AS',
            'CONSULTAS DOS NOSSOS CLIENTES ATRAVÉS DE UM LINK QUE SERÁ ENVIADO PELO E-MAIL',
            'DA COTAR E CONSTRUIR PARA OS FORNECEDORES ESPECIALIZADOS QUE COMERCIALIZAM',
            'ESSES MATERIAIS. GERANDO ASSIM, MAIS OPORTUNIDADE DE VENDAS DE TODA A LINHA DE',
            'MATERIAIS.',
            '',
            'Caso haja alguma dúvida não hesite em nos contatar, estaremos à disposição para atendê-los.',
            'Desde já agradeço a atenção de todos.',
            '',
            'Att.',
            'Leonardo Lopes Nogueira.',
            'Diretor Comercial',
            '(31) 99219-4237',
            '',
            'Favor confirmar o recebimento deste e-mail!',
        ].join('\n'),
    };
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
