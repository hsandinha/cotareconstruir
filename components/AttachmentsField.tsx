"use client";

import { useRef, type ChangeEvent } from "react";
import { Paperclip, Upload, X, FileText } from "lucide-react";
import { ANEXOS_ACCEPT, ANEXO_MAX_MB, ANEXOS_MAX_COUNT, formatFileSize, type AnexoMeta } from "@/lib/anexos";

interface AttachmentsFieldProps {
    label?: string;
    description?: string;
    /** Anexos já enviados anteriormente (modo edição) */
    existing?: AnexoMeta[];
    onRemoveExisting?: (index: number) => void;
    /** Novos arquivos selecionados (ainda não enviados) */
    files: File[];
    onChange: (files: File[]) => void;
    disabled?: boolean;
    onError?: (message: string) => void;
}

/**
 * Campo de anexos reutilizável (cotação do cliente e proposta do fornecedor).
 * Lista anexos existentes + novos arquivos, com validação de quantidade/tamanho.
 */
export function AttachmentsField({
    label = "Anexos",
    description,
    existing = [],
    onRemoveExisting,
    files,
    onChange,
    disabled = false,
    onError,
}: AttachmentsFieldProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const totalCount = existing.length + files.length;

    const handleSelectFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(event.target.files || []);
        event.target.value = "";
        if (selected.length === 0) return;

        const errors: string[] = [];
        const accepted: File[] = [];

        for (const file of selected) {
            if (totalCount + accepted.length >= ANEXOS_MAX_COUNT) {
                errors.push(`Limite de ${ANEXOS_MAX_COUNT} anexos atingido.`);
                break;
            }
            if (file.size > ANEXO_MAX_MB * 1024 * 1024) {
                errors.push(`"${file.name}" excede ${ANEXO_MAX_MB}MB.`);
                continue;
            }
            const duplicated = files.some(f => f.name === file.name && f.size === file.size);
            if (!duplicated) accepted.push(file);
        }

        if (errors.length > 0) {
            onError?.(errors.join(' '));
        }
        if (accepted.length > 0) {
            onChange([...files, ...accepted]);
        }
    };

    return (
        <div>
            <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Paperclip className="h-4 w-4 text-gray-500" />
                {label}
            </label>
            {description && (
                <p className="text-xs text-gray-400 mb-2">{description}</p>
            )}

            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || totalCount >= ANEXOS_MAX_COUNT}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 border-dashed rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
                <Upload className="h-4 w-4" />
                Selecionar arquivos
            </button>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={ANEXOS_ACCEPT}
                className="hidden"
                onChange={handleSelectFiles}
            />
            <p className="mt-1 text-[11px] text-gray-400">
                Até {ANEXOS_MAX_COUNT} arquivos de {ANEXO_MAX_MB}MB (PDF, imagens, DWG, DXF, Office, ZIP...)
            </p>

            {(existing.length > 0 || files.length > 0) && (
                <ul className="mt-2 space-y-1.5">
                    {existing.map((anexo, index) => (
                        <li key={`existing-${index}`} className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                            <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                            <a
                                href={anexo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0 truncate text-xs font-medium text-blue-700 hover:underline"
                            >
                                {anexo.nome}
                            </a>
                            {formatFileSize(anexo.tamanho) && (
                                <span className="text-[10px] text-gray-400 shrink-0">{formatFileSize(anexo.tamanho)}</span>
                            )}
                            {onRemoveExisting && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveExisting(index)}
                                    disabled={disabled}
                                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                                    aria-label={`Remover ${anexo.nome}`}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </li>
                    ))}
                    {files.map((file, index) => (
                        <li key={`file-${index}`} className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50/50 px-2.5 py-1.5">
                            <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                            <span className="flex-1 min-w-0 truncate text-xs font-medium text-gray-700">{file.name}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
                            <button
                                type="button"
                                onClick={() => onChange(files.filter((_, i) => i !== index))}
                                disabled={disabled}
                                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                                aria-label={`Remover ${file.name}`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
