// Types for Work Management
export type WorkStage = {
    id: string;
    name: string;
    category: string;
    predictedDate: string;
    isCompleted: boolean;
    completedDate?: string;
    quotationAdvanceDays: number;
};

export type Work = {
    id: string | number;
    obra: string;
    centroCustos?: string;
    cep?: string;
    bairro: string;
    cidade: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    restricoesEntrega?: string;
    etapa: string;
    tipoObra?: string;
    area?: string;
    padrao?: string;
    dataInicio?: string;
    previsaoTermino?: string;
    diasAntecedenciaOferta?: number;
    inicioRecebimentoOferta?: string;
    horarioEntrega?: string;
    deliverySchedule?: {
        [key: string]: {
            enabled: boolean;
            startTime: string;
            endTime: string;
        };
    };
    stages?: WorkStage[];
};

// Types for Cart Management
export type CartItem = {
    id: number;
    descricao: string;
    categoria: string;
    quantidade: number;
    unidade: string;
    observacao?: string;
};

// Types for Comparative Analysis
export type SupplierKey = "fornecedorA" | "fornecedorB" | "fornecedorC" | "fornecedorD";

export type ComparativeRow = {
    id: number;
    descricao: string;
    unidade: string;
    quantidade: number;
    fornecedores: Record<
        SupplierKey,
        { unitario: number | null; total: number | null; condicao?: string }
    >;
};
