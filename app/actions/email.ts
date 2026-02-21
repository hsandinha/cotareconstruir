'use server'

import { sendEmail as sendEmailViaSendGrid, getFornecedorRecadastroEmailTemplate } from '@/lib/emailService';

interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
    try {
        const result = await sendEmailViaSendGrid({ to, subject, html });
        return result.success
            ? { success: true, messageId: result.messageId }
            : { success: false, error: result.error };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error };
    }
}

export async function sendFornecedorRecadastroEmail(to: string) {
    const template = getFornecedorRecadastroEmailTemplate({ recipientEmail: to, temporaryPassword: '123456' });
    return sendEmail({ to, subject: template.subject, html: template.html });
}
