/**
 * Upload de anexos (projetos, detalhes, especificações) para o bucket
 * público `cotacao-anexos` do Supabase Storage. Usado pelo cliente (cotação)
 * e pelo fornecedor (proposta). Os metadados são gravados nas tabelas
 * cotacao_anexos / proposta_anexos pelas APIs.
 */

import { supabase } from './supabaseAuth';

export const ANEXOS_BUCKET = 'cotacao-anexos';
export const ANEXOS_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.dwg,.dxf,.skp,.zip,.rar';
export const ANEXO_MAX_MB = 20;
export const ANEXOS_MAX_COUNT = 10;

export interface AnexoMeta {
    nome: string;
    url: string;
    tipo?: string | null;
    tamanho?: number | null;
}

function sanitizeFileName(name: string): string {
    return String(name || 'arquivo')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-80);
}

/**
 * Envia os arquivos ao bucket e retorna os metadados (nome original + URL
 * pública). Lança erro na primeira falha de upload.
 */
export async function uploadAnexos(files: File[], pathPrefix: string): Promise<AnexoMeta[]> {
    const uploaded: AnexoMeta[] = [];
    for (const file of files) {
        if (file.size > ANEXO_MAX_MB * 1024 * 1024) {
            throw new Error(`"${file.name}" excede o limite de ${ANEXO_MAX_MB}MB.`);
        }
        const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;
        const { error } = await supabase.storage
            .from(ANEXOS_BUCKET)
            .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) {
            throw new Error(`Falha ao enviar "${file.name}": ${error.message}`);
        }
        const { data } = supabase.storage.from(ANEXOS_BUCKET).getPublicUrl(path);
        uploaded.push({
            nome: file.name,
            url: data.publicUrl,
            tipo: file.type || null,
            tamanho: Number.isFinite(file.size) ? file.size : null,
        });
    }
    return uploaded;
}

export function formatFileSize(bytes?: number | null): string {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
