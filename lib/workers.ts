/**
 * Workers para processar jobs das filas
 * Execute este arquivo separadamente: node lib/workers.js
 */

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { sendEmail, getWelcomeEmailTemplate, getPasswordResetEmailTemplate, getPasswordChangedEmailTemplate } from './emailService';
import { EmailJob, NotificationJob, ProcessingJob } from './queue';

const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
});

/**
 * WORKER: Processar Emails
 */
const emailWorker = new Worker(
    'emails',
    async (job) => {
        const emailJob = job.data as EmailJob;
        console.log(`📧 Processing email job: ${job.id} - ${emailJob.type}`);

        try {
            switch (emailJob.type) {
                case 'welcome':
                    const welcomeTemplate = getWelcomeEmailTemplate(
                        emailJob.data.name,
                        emailJob.to
                    );
                    await sendEmail({
                        to: emailJob.to,
                        subject: welcomeTemplate.subject,
                        html: welcomeTemplate.html,
                        text: welcomeTemplate.text,
                    });
                    break;

                case 'password-reset':
                    const resetTemplate = getPasswordResetEmailTemplate(
                        emailJob.data.name,
                        emailJob.data.resetLink
                    );
                    await sendEmail({
                        to: emailJob.to,
                        subject: resetTemplate.subject,
                        html: resetTemplate.html,
                        text: resetTemplate.text,
                    });
                    break;

                case 'password-changed':
                    const changedTemplate = getPasswordChangedEmailTemplate(
                        emailJob.data.name
                    );
                    await sendEmail({
                        to: emailJob.to,
                        subject: changedTemplate.subject,
                        html: changedTemplate.html,
                        text: changedTemplate.text,
                    });
                    break;

                case 'cotacao-notification':
                    // Implementar template de cotação
                    await sendEmail({
                        to: emailJob.to,
                        subject: 'Nova Cotação Disponível',
                        html: `<p>Você tem uma nova cotação: ${emailJob.data.cotacaoId}</p>`,
                    });
                    break;

                default:
                    throw new Error(`Unknown email type: ${emailJob.type}`);
            }

            await job.updateProgress(100);
            return { success: true };
        } catch (error) {
            console.error('Email job failed:', error);
            throw error;
        }
    },
    {
        connection,
        concurrency: 5, // Processa 5 emails simultaneamente
    }
);

/**
 * WORKER: Processar Notificações
 */
const notificationWorker = new Worker(
    'notifications',
    async (job) => {
        const notification = job.data as NotificationJob;
        console.log(`🔔 Processing notification: ${job.id}`);

        // TODO: Implementar push notifications (OneSignal, Pusher, ou Web Push API)
        console.log('Sending notification:', notification);

        return { success: true };
    },
    {
        connection,
        concurrency: 10,
    }
);

/**
 * WORKER: Processar Tarefas Pesadas
 */
const processingWorker = new Worker(
    'processing',
    async (job) => {
        const task = job.data as ProcessingJob;
        console.log(`⚙️ Processing task: ${job.id} - ${task.type}`);

        switch (task.type) {
            case 'generate-pdf':
                // TODO: Implementar geração de PDF
                await new Promise(resolve => setTimeout(resolve, 2000));
                break;

            case 'process-images':
                // TODO: Implementar processamento de imagens
                await new Promise(resolve => setTimeout(resolve, 3000));
                break;

            case 'generate-report':
                // TODO: Implementar geração de relatório
                await new Promise(resolve => setTimeout(resolve, 1000));
                break;
        }

        return { success: true };
    },
    {
        connection,
        concurrency: 2, // Tarefas pesadas - menos concorrência
    }
);

/**
 * WORKER: Limpeza de Dados
 */
const cleanupWorker = new Worker(
    'cleanup',
    async (job) => {
        console.log('🧹 Running cleanup job');

        // TODO: Implementar limpeza de dados antigos
        // - Logs antigos
        // - Sessões expiradas
        // - Tokens usados de password reset
        // - Audit logs > 90 dias

        return { success: true };
    },
    {
        connection,
    }
);

// Event listeners
emailWorker.on('completed', (job) => {
    console.log(`✅ Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`❌ Email job ${job?.id} failed:`, err.message);
});

notificationWorker.on('completed', (job) => {
    console.log(`✅ Notification job ${job.id} completed`);
});

processingWorker.on('completed', (job) => {
    console.log(`✅ Processing job ${job.id} completed`);
});

cleanupWorker.on('completed', (job) => {
    console.log(`✅ Cleanup job ${job.id} completed`);
});

console.log('🚀 Workers started successfully!');
console.log('📧 Email worker: 5 concurrent jobs');
console.log('🔔 Notification worker: 10 concurrent jobs');
console.log('⚙️ Processing worker: 2 concurrent jobs');
console.log('🧹 Cleanup worker: ready');

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down workers...');
    await emailWorker.close();
    await notificationWorker.close();
    await processingWorker.close();
    await cleanupWorker.close();
    process.exit(0);
});
