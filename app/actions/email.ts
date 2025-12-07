'use server'

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
    if (!process.env.RESEND_API_KEY) {
        console.warn("RESEND_API_KEY is not set. Email not sent.");
        return { success: false, error: "API Key missing" };
    }

    try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'Cota Reconstruir <onboarding@resend.dev>';
        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: subject,
            html: html,
        });
        return { success: true, data };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error };
    }
}
