// Tipos para o sistema de construção

export interface Material {
    id: string;
    nome: string;
    unidade: string;
    gruposInsumoIds: string[];
    descricao?: string;
}

export interface GrupoInsumo {
    id: string;
    nome: string;
    descricao?: string;
}

export interface Servico {
    id: string;
    nome: string;
    faseIds: string[]; // Um serviço pode estar em múltiplas fases
    gruposInsumoIds: string[]; // Relacionamento com grupos de insumos
    ordem?: number;
}

export interface Fase {
    id: string;
    cronologia: number;
    nome: string;
    descricao?: string;
}

