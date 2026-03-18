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
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@Comprareconstruir.com.br';
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

export function getFornecedorRecadastroEmailTemplate(options: { recipientEmail: string; temporaryPassword?: string | null }): { subject: string; html: string; text: string } {
    const baseUrl = getEmailAssetsBaseUrl();
    const logoUrl = `${baseUrl}/logo.png`;
    const recipientEmail = options.recipientEmail;
    const subject = 'Convite Prioritário: Atualize Seu Perfil na comprareconstruir.com e Impulsione Seus Negócios';
    const temporaryPassword = typeof options.temporaryPassword === 'string' && options.temporaryPassword.trim()
        ? options.temporaryPassword.trim()
        : null;
    const hasTemporaryPassword = Boolean(temporaryPassword);

    const credentialsHtml = `
        <div style="margin:10px 0 16px 0;padding:14px;border-radius:10px;background-color:#f8fafc;border:1px solid #e2e8f0;font-size:14px;line-height:22px;">
            <p style="margin:0 0 8px 0;font-weight:700;">${hasTemporaryPassword ? 'Suas credenciais para o primeiro acesso são:' : 'Seu acesso à plataforma:'}</p>
            <p style="margin:0;"><strong>Usuário:</strong> ${escapeHtml(recipientEmail)}</p>
            ${hasTemporaryPassword
            ? `<p style="margin:0;"><strong>Senha temporária:</strong> ${escapeHtml(temporaryPassword || '')}</p>`
            : `<p style="margin:8px 0 0 0;color:#475569;font-size:12px;line-height:18px;">Se você já definiu sua senha, utilize sua senha atual. Caso não se recorde dela, solicite a redefinição de senha.</p>`}
        </div>
    `;

    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charSet="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${subject}</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;">
            <div style="width:100%;padding:24px 12px;">
                <div style="max-width:720px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                    <div style="padding:36px 28px 24px 28px;text-align:center;background:linear-gradient(180deg,#fff7ed 0%,#ffffff 100%);border-bottom:1px solid #fed7aa;">
                        <img src="${logoUrl}" alt="Comprar & Construir" style="height:110px;width:auto;max-width:100%;display:inline-block;" />
                        <p style="margin:10px 0 0 0;font-size:13px;letter-spacing:.08em;font-weight:700;color:#9a3412;text-transform:uppercase;">
                            Comprar e Construir
                        </p>
                    </div>
                    <div style="padding:0 28px 28px 28px;color:#111827;font-family:Arial,sans-serif;">
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;"><strong>Prezado(a) Parceiro(a) Fornecedor(a),</strong></p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Aqui é Leonardo Nogueira, diretor comercial da Cotar e Construir.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Com base em nossa sólida experiência de 38 anos no atendimento a milhares de clientes, a Cotar e Construir tem o prazer de apresentar a evolução de nossos serviços: a comprareconstruir.com, nossa plataforma especializada em suprimentos para a construção civil. Esta iniciativa visa otimizar o processo de compras e expandir o alcance de empresas construtoras, engenheiros, arquitetos autônomos e consumidores finais que buscam fornecedores qualificados.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            <strong>Uma Plataforma Que Prioriza o Seu Negócio (e é Gratuita):</strong>
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Ao contrário de plataformas genéricas, a comprareconstruir.com foi concebida para ser uma ferramenta estratégica, não apenas um portal de compras. Nosso foco é conectar você a um mercado que valoriza a qualidade da especificação, o compromisso com a entrega e, em seguida, o preço e as condições comerciais mais vantajosas. Queremos garantir que sua empresa esteja na vanguarda, diferenciando-se pela excelência. É importante ressaltar que o acesso e a participação na plataforma não terão custos para você.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Para assegurar a continuidade dessa parceria e garantir sua posição privilegiada nesta nova fase, estamos convidando nossos fornecedores mais valiosos a atualizarem seus dados. É nosso compromisso prestar-lhe o devido prestígio por sua trajetória conosco.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            <strong>Seu Acesso e os Próximos Passos:</strong>
                        </p>
                        <p style="margin:0 0 12px 0;font-size:14px;line-height:22px;">
                            Para acessar o sistema e realizar a atualização de seu perfil, utilize o link seguro abaixo:
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            <a href="https://comprareconstruir.com/login" style="color:#2563eb;text-decoration:underline;font-weight:700;">https://comprareconstruir.com/login</a>
                        </p>
                        ${credentialsHtml}
                        <p style="margin:16px 0 14px 0;font-size:14px;line-height:22px;font-weight:700;">
                            Atenção aos Detalhes Essenciais:
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            ${hasTemporaryPassword
            ? '<strong>1. Troca de Senha:</strong> No primeiro acesso, será obrigatória a alteração de sua senha temporária.'
            : '<strong>1. Acesso à Conta:</strong> Utilize seu e-mail cadastrado e sua senha atual para entrar na plataforma. Caso necessário, solicite uma redefinição de senha.'}
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            <strong>2. Confirmação de Grupos de Materiais:</strong> No perfil do seu cadastro, solicitamos que confirme cada Grupo de Materiais ou Serviços que sua empresa comercializa. Esta etapa é crucial para que possamos direcionar consultas altamente qualificadas, maximizando suas chances de venda e otimizando seu tempo.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            <strong>3. Conecte seu WhatsApp Profissional:</strong> É fundamental que você cadastre seu número de WhatsApp profissional na plataforma. Este será o canal exclusivo para receber notificações instantâneas de novas consultas e ordens de compra, garantindo agilidade e maximizando suas oportunidades de negócio em tempo real.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Estamos confiantes de que a comprareconstruir.com será um divisor de águas no setor, e queremos que sua empresa esteja na vanguarda dessa transformação.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Nossa equipe está à disposição para qualquer dúvida ou suporte durante este processo.
                        </p>
                        <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;">
                            Estou pessoalmente empenhado nesta jornada e à disposição para caminharmos juntos.
                        </p>
                        <div style="margin-top:18px;font-size:14px;line-height:22px;">
                            <p style="margin:0 0 10px 0;">Atenciosamente,</p>
                            <p style="margin:0;">Leonardo Nogueira</p>
                            <p style="margin:0;">Diretor Comercial</p>
                            <p style="margin:0;">Cotar e Construir</p>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return {
        subject,
        html,
        text: [
            'Prezado(a) Parceiro(a) Fornecedor(a),',
            '',
            'Aqui é Leonardo Nogueira, diretor comercial da Cotar e Construir.',
            '',
            'Com base em nossa sólida experiência de 38 anos no atendimento a milhares de clientes,',
            'a Cotar e Construir tem o prazer de apresentar a evolução de nossos serviços:',
            'a comprareconstruir.com, nossa plataforma especializada em suprimentos para a',
            'construção civil. Esta iniciativa visa otimizar o processo de compras e expandir o alcance de',
            'empresas construtoras, engenheiros, arquitetos autônomos e consumidores finais que',
            'buscam fornecedores qualificados.',
            '',
            'Uma Plataforma Que Prioriza o Seu Negócio (e é Gratuita):',
            'Ao contrário de plataformas genéricas, a comprareconstruir.com foi concebida para ser',
            'uma ferramenta estratégica, não apenas um portal de compras. Nosso foco é conectar',
            'você a um mercado que valoriza a qualidade da especificação, o compromisso com a',
            'entrega e, em seguida, o preço e as condições comerciais mais vantajosas. Queremos',
            'garantir que sua empresa esteja na vanguarda, diferenciando-se pela excelência. É',
            'importante ressaltar que o acesso e a participação na plataforma não terão custos',
            'para você.',
            '',
            'Para assegurar a continuidade dessa parceria e garantir sua posição privilegiada nesta',
            'nova fase, estamos convidando nossos fornecedores mais valiosos a atualizarem seus',
            'dados. É nosso compromisso prestar-lhe o devido prestígio por sua trajetória conosco.',
            '',
            'Seu Acesso e os Próximos Passos:',
            'Para acessar o sistema e realizar a atualização de seu perfil, utilize o link seguro abaixo:',
            'https://comprareconstruir.com/login',
            '',
            hasTemporaryPassword ? 'Suas credenciais para o primeiro acesso são:' : 'Seu acesso à plataforma:',
            `Usuário: ${recipientEmail}`,
            ...(hasTemporaryPassword
                ? [`Senha temporária: ${temporaryPassword}`]
                : ['Se você já definiu sua senha, utilize sua senha atual.', 'Caso não se recorde dela, solicite a redefinição de senha.']),
            '',
            'Atenção aos Detalhes Essenciais:',
            ...(hasTemporaryPassword
                ? ['1. Troca de Senha: No primeiro acesso, será obrigatória a alteração de sua senha', 'temporária.']
                : ['1. Acesso à Conta: Utilize seu e-mail cadastrado e sua senha atual para entrar na', 'plataforma. Caso necessário, solicite uma redefinição de senha.']),
            '2. Confirmação de Grupos de Materiais: No perfil do seu cadastro, solicitamos que',
            'confirme cada Grupo de Materiais ou Serviços que sua empresa comercializa. Esta etapa é',
            'crucial para que possamos direcionar consultas altamente qualificadas, maximizando suas',
            'chances de venda e otimizando seu tempo.',
            '3. Conecte seu WhatsApp Profissional: É fundamental que você cadastre seu número de',
            'WhatsApp profissional na plataforma. Este será o canal exclusivo para receber',
            'notificações instantâneas de novas consultas e ordens de compra, garantindo agilidade e',
            'maximizando suas oportunidades de negócio em tempo real.',
            '',
            'Estamos confiantes de que a comprareconstruir.com será um divisor de águas no setor, e',
            'queremos que sua empresa esteja na vanguarda dessa transformação.',
            'Nossa equipe está à disposição para qualquer dúvida ou suporte durante este processo.',
            'Estou pessoalmente empenhado nesta jornada e à disposição para caminharmos juntos.',
            '',
            'Atenciosamente,',
            'Leonardo Nogueira',
            'Diretor Comercial',
            'Cotar e Construir',
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
                        <p>📧 Email: suporte@Comprareconstruir.com.br<br>
                        📱 WhatsApp: (11) 99999-9999</p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Cota Reconstruir. Todos os direitos reservados.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Olá ${name},\n\n✅ Sua senha foi alterada com sucesso.\n\nData/Hora: ${new Date().toLocaleString('pt-BR')}\n\nSe você não realizou esta alteração, entre em contato:\nsuporte@Comprareconstruir.com.br\n\nEquipe Cota Reconstruir`,
    };
}
