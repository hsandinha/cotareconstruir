/**
 * Sistema de Filas com BullMQ
 * Background Jobs para processar tarefas assíncronas
 * 
 * NOTA: Requer Redis local rodando para funcionar.
 * Em dev sem Redis, as funções retornam fallback silencioso.
 */

import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Verifica se Redis está configurado
const isRedisConfigured = process.env.REDIS_HOST || process.env.REDIS_PORT;

// Configuração de conexão Redis para BullMQ (apenas se configurado)
let connection: IORedis | null = null;

if (isRedisConfigured) {
    try {
        connection = new IORedis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true, // Não conecta automaticamente
        });
    } catch (error) {
        console.warn('⚠️ Redis não configurado, filas desabilitadas');
        connection = null;
    }
}

// Filas só são criadas se Redis estiver disponível
const createQueue = (name: string, options: object) => {
    if (!connection) return null;
    try {
        return new Queue(name, { connection, ...options });
    } catch {
        return null;
    }
};

/**
 * FILA DE EMAILS
 * Processa envio de emails em background
 */
export const emailQueue = createQueue('emails', {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
    },
});

/**
 * FILA DE NOTIFICAÇÕES
 * Envia notificações push e SMS
 */
export const notificationQueue = createQueue('notifications', {
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});

/**
 * FILA DE PROCESSAMENTO
 * Tarefas pesadas (gerar PDFs, processar imagens, etc)
 */
export const processingQueue = createQueue('processing', {
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});

/**
 * FILA DE CLEANUP
 * Limpeza de dados antigos, logs, etc
 */
export const cleanupQueue = createQueue('cleanup', {
    defaultJobOptions: {
        attempts: 1,
    },
});

/**
 * Interface de Jobs de Email
 */
export interface EmailJob {
    type: 'welcome' | 'password-reset' | 'password-changed' | 'cotacao-notification' | 'payment-confirmation';
    to: string;
    data: any;
}

/**
 * Interface de Jobs de Notificação
 */
export interface NotificationJob {
    userId: string;
    title: string;
    body: string;
    type: 'cotacao' | 'proposta' | 'payment' | 'system';
    data?: any;
}

/**
 * Interface de Jobs de Processamento
 */
export interface ProcessingJob {
    type: 'generate-pdf' | 'process-images' | 'generate-report';
    data: any;
}

/**
 * Adicionar job de email na fila
 */
export async function queueEmail(job: EmailJob) {
    if (!emailQueue) {
        console.warn('⚠️ Email queue not available, skipping job');
        return null;
    }
    return emailQueue.add(job.type, job, {
        priority: job.type === 'password-reset' ? 1 : 5, // Password reset tem prioridade
    });
}

/**
 * Adicionar job de notificação na fila
 */
export async function queueNotification(job: NotificationJob) {
    if (!notificationQueue) {
        console.warn('⚠️ Notification queue not available, skipping job');
        return null;
    }
    return notificationQueue.add('send-notification', job);
}

/**
 * Adicionar job de processamento na fila
 */
export async function queueProcessing(job: ProcessingJob) {
    if (!processingQueue) {
        console.warn('⚠️ Processing queue not available, skipping job');
        return null;
    }
    return processingQueue.add(job.type, job);
}

/**
 * Agendar limpeza periódica
 */
export async function scheduleCleanup(cronExpression: string = '0 3 * * *') {
    if (!cleanupQueue) {
        console.warn('⚠️ Cleanup queue not available, skipping schedule');
        return null;
    }
    return cleanupQueue.add(
        'daily-cleanup',
        {},
        {
            repeat: {
                pattern: cronExpression, // Diariamente às 3h
            },
        }
    );
}

/**
 * Event Listeners para monitoramento (apenas se Redis disponível)
 */
let emailQueueEvents: QueueEvents | null = null;
if (connection) {
    try {
        emailQueueEvents = new QueueEvents('emails', { connection });
        emailQueueEvents.on('completed', ({ jobId }) => {
            console.log(`✅ Email job ${jobId} completed`);
        });
        emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
            console.error(`❌ Email job ${jobId} failed:`, failedReason);
        });
    } catch {
        // Redis não disponível
    }
}

/**
 * Obter estatísticas das filas
 */
export async function getQueueStats() {
    if (!emailQueue || !notificationQueue || !processingQueue || !cleanupQueue) {
        return {
            emails: { waiting: 0, active: 0, completed: 0, failed: 0 },
            notifications: { waiting: 0, active: 0, completed: 0, failed: 0 },
            processing: { waiting: 0, active: 0, completed: 0, failed: 0 },
            cleanup: { waiting: 0, active: 0, completed: 0, failed: 0 },
            redisAvailable: false,
        };
    }

    const [emailStats, notificationStats, processingStats, cleanupStats] = await Promise.all([
        emailQueue.getJobCounts(),
        notificationQueue.getJobCounts(),
        processingQueue.getJobCounts(),
        cleanupQueue.getJobCounts(),
    ]);

    return {
        emails: emailStats,
        notifications: notificationStats,
        processing: processingStats,
        cleanup: cleanupStats,
        redisAvailable: true,
    };
}

/**
 * Limpar todas as filas (útil para dev)
 */
export async function clearAllQueues() {
    if (!emailQueue || !notificationQueue || !processingQueue || !cleanupQueue) {
        console.warn('⚠️ Queues not available, nothing to clear');
        return;
    }
    await Promise.all([
        emailQueue.obliterate({ force: true }),
        notificationQueue.obliterate({ force: true }),
        processingQueue.obliterate({ force: true }),
        cleanupQueue.obliterate({ force: true }),
    ]);
    console.log('🗑️ All queues cleared');
}
