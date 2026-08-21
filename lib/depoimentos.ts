/**
 * Depoimentos em vídeo da página inicial.
 *
 * O admin carrega os arquivos para o bucket público `depoimentos` do Supabase
 * Storage (migration 20260823000000) e a landing lê só os registros ativos.
 */

import { supabase } from './supabaseAuth';

export const DEPOIMENTOS_BUCKET = 'depoimentos';

export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';
export const POSTER_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Espelha o `file_size_limit` do bucket. */
export const VIDEO_MAX_MB = 200;
export const POSTER_MAX_MB = 5;

export type Depoimento = {
    id: string;
    nome: string;
    cargo: string | null;
    empresa: string | null;
    obra: string | null;
    citacao: string | null;
    video_url: string;
    poster_url: string | null;
    duracao_segundos: number | null;
    ordem: number;
    ativo: boolean;
};

function sanitizeFileName(name: string): string {
    return String(name || 'arquivo')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-80);
}

/**
 * Envia um arquivo ao bucket de depoimentos e devolve a URL pública.
 * `pasta` separa vídeos de capas ('videos' | 'capas').
 */
export async function uploadArquivoDepoimento(file: File, pasta: 'videos' | 'capas'): Promise<string> {
    const limiteMb = pasta === 'videos' ? VIDEO_MAX_MB : POSTER_MAX_MB;
    if (file.size > limiteMb * 1024 * 1024) {
        throw new Error(`"${file.name}" excede o limite de ${limiteMb}MB.`);
    }

    const path = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;

    const { error } = await supabase.storage
        .from(DEPOIMENTOS_BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (error) {
        throw new Error(`Falha ao enviar "${file.name}": ${error.message}`);
    }

    const { data } = supabase.storage.from(DEPOIMENTOS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Remove do Storage um arquivo que está no nosso bucket.
 * Ignora URLs de fora (o campo aceita link externo colado à mão).
 */
export async function removerArquivoDepoimento(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const marcador = `/${DEPOIMENTOS_BUCKET}/`;
    const idx = url.indexOf(marcador);
    if (idx === -1) return;

    const path = url.slice(idx + marcador.length).split('?')[0];
    if (!path) return;

    const { error } = await supabase.storage.from(DEPOIMENTOS_BUCKET).remove([decodeURIComponent(path)]);
    if (error) console.error('[DEPOIMENTOS] Falha ao remover arquivo do storage:', error.message);
}

/** Duração do vídeo em segundos, lida do próprio arquivo antes do upload. */
export function lerDuracaoDoVideo(file: File): Promise<number | null> {
    return new Promise((resolve) => {
        try {
            const video = document.createElement('video');
            video.preload = 'metadata';
            const url = URL.createObjectURL(file);

            const limpar = () => URL.revokeObjectURL(url);

            video.onloadedmetadata = () => {
                const duracao = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
                limpar();
                resolve(duracao);
            };
            video.onerror = () => { limpar(); resolve(null); };
            video.src = url;
        } catch {
            resolve(null);
        }
    });
}

/** "1:42" a partir dos segundos. */
export function formatarDuracao(segundos: number | null | undefined): string {
    const total = Number(segundos);
    if (!Number.isFinite(total) || total <= 0) return '';
    const min = Math.floor(total / 60);
    const seg = Math.floor(total % 60);
    return `${min}:${String(seg).padStart(2, '0')}`;
}

/** Linha de identificação: "Engenheiro Civil · Construtora Palhares". */
export function legendaDoAutor(depoimento: Pick<Depoimento, 'cargo' | 'empresa' | 'obra'>): string {
    return [depoimento.cargo, depoimento.empresa, depoimento.obra].filter(Boolean).join(' · ');
}
