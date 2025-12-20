export type WorkStage = {
    id: string;
    name: string;
    category: string;
    predictedDate: string;
    isCompleted: boolean;
    completedDate?: string;
    quotationAdvanceDays: number;
};

export const constructionStages = [
    { id: 'servicos-preliminares', name: 'Serviços Preliminares e Mobilização', category: 'Início' },
    { id: 'terraplenagem', name: 'Terraplenagem', category: 'Fundações' },
    { id: 'fundacoes', name: 'Fundações', category: 'Fundações' },
    { id: 'estrutura', name: 'Estrutura', category: 'Estrutura' },
    { id: 'instalacoes-brutas', name: 'Instalações (Brutas/Embutidas)', category: 'Instalações' },
    { id: 'alvenaria-vedacoes', name: 'Alvenaria e Vedações', category: 'Vedação' },
    { id: 'impermeabilizacao', name: 'Impermeabilização', category: 'Impermeabilização' },
    { id: 'cobertura', name: 'Cobertura', category: 'Cobertura' },
    { id: 'instalacoes', name: 'Instalações', category: 'Instalações' },
    { id: 'esquadrias', name: 'Esquadrias', category: 'Acabamentos' },
    { id: 'revestimentos', name: 'Revestimentos', category: 'Acabamentos' },
];

export type Work = {
    id: string | number;
    obra: string;
    centroCustos?: string;
    cep?: string;
    bairro: string;
    cidade: string;
    endereco?: string;
    restricoesEntrega?: string;
    etapa: string;
    tipoObra?: string;
    area?: string;
    padrao?: string;
    dataInicio?: string;
    previsaoTermino?: string;
    horarioEntrega?: string;
    stages?: WorkStage[];
};


export const initialWorks: Work[] = [
    {
        id: 1,
        obra: "Cond. Ed. A. Nogueira / Obra Havaí - BH",
        centroCustos: "CC-001",
        cep: "30555-000",
        bairro: "Havaí",
        cidade: "Belo Horizonte - MG",
        endereco: "Rua A, 123",
        restricoesEntrega: "Não receber após as 16h",
        etapa: "Estrutura",
        tipoObra: "Prédio",
        area: "1500",
        padrao: "Alto",
        dataInicio: "2024-11-01",
        previsaoTermino: "2026-05-30",
        horarioEntrega: "Seg-Sex, 8h às 16h",
        stages: [
            {
                id: 'sapatas-estacas',
                name: 'Execução de sapatas, estacas, tubulões, blocos',
                category: 'Fundações',
                predictedDate: '2025-01-15',
                isCompleted: true,
                completedDate: '2025-01-10',
                quotationAdvanceDays: 15
            },
            {
                id: 'concretagem',
                name: 'Concretagem (Pilares, Vigas, Lajes, Escadas)',
                category: 'Estrutura',
                predictedDate: '2025-03-20',
                isCompleted: false,
                quotationAdvanceDays: 20
            }
        ]
    },
    {
        id: 2,
        obra: "Reforma Escritório Savassi",
        bairro: "Savassi",
        cidade: "Belo Horizonte - MG",
        etapa: "Acabamentos Finais",
        stages: []
    },
];

export type CartItem = {
    id: number;
    descricao: string;
    categoria: string;
    quantidade: number;
    unidade: string;
    observacao?: string;
};

export const cartCategories = ["Aglomerante", "Agregado", "Elétrico", "Hidráulico"] as const;

export const initialCartItems: CartItem[] = [
    {
        id: 1,
        descricao: "Madeirite 12mm res. fenólico",
        categoria: "Aglomerante",
        quantidade: 50,
        unidade: "unid",
        observacao: "Uso em formas especiais",
    },
    {
        id: 2,
        descricao: "Brita 1",
        categoria: "Agregado",
        quantidade: 30,
        unidade: "m³",
    },
    {
        id: 3,
        descricao: "Cabo elétrico 6mm",
        categoria: "Elétrico",
        quantidade: 500,
        unidade: "m",
    },
];

export type SupplierKey = "fornecedorA" | "fornecedorB" | "fornecedorC" | "fornecedorD";

export const supplierColumns: { key: SupplierKey; label: string }[] = [
    { key: "fornecedorA", label: "Fornecedor A" },
    { key: "fornecedorB", label: "Fornecedor B" },
    { key: "fornecedorC", label: "Fornecedor C" },
    { key: "fornecedorD", label: "Fornecedor D" },
];

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

export const comparativeRows: ComparativeRow[] = [
    {
        id: 1,
        descricao: "Madeirite 12mm res. fenólico",
        unidade: "unid",
        quantidade: 50,
        fornecedores: {
            fornecedorA: { unitario: 27, total: 1350 },
            fornecedorB: { unitario: null, total: null },
            fornecedorC: { unitario: 22.5, total: 1125 },
            fornecedorD: { unitario: 24, total: 1200 },
        },
    },
    {
        id: 2,
        descricao: "Pontalete de pinus 7x7 c/ 3m",
        unidade: "unid",
        quantidade: 50,
        fornecedores: {
            fornecedorA: { unitario: 7.8, total: 390 },
            fornecedorB: { unitario: null, total: null },
            fornecedorC: { unitario: 8.45, total: 422.5 },
            fornecedorD: { unitario: 8.1, total: 405 },
        },
    },
    {
        id: 3,
        descricao: "Sarrafão de pinus 10cm c/ 3m",
        unidade: "unid",
        quantidade: 10,
        fornecedores: {
            fornecedorA: { unitario: 3.18, total: 31.8 },
            fornecedorB: { unitario: 2.98, total: 29.8 },
            fornecedorC: { unitario: 3.1, total: 31 },
            fornecedorD: { unitario: 2.9, total: 29 },
        },
    },
];

export type Guide = { id: number; title: string; description: string; tags: string[] };

export const guides: Guide[] = [
    {
        id: 1,
        title: "Checklist para iniciar uma cotação completa",
        description:
            "Organize o que precisa por categoria e evite retrabalhos antes de enviar para a Cotar & Construir.",
        tags: ["Planejamento", "MVP"],
    },
    {
        id: 2,
        title: "Como informar o bairro correto para frete",
        description:
            "Saiba por que usamos o bairro da obra e como isso protege sua operação e dados.",
        tags: ["Obras", "Logística"],
    },
    {
        id: 3,
        title: "Materiais hidráulicos essenciais para novas obras",
        description:
            "Sugestões de kits hidráulicos para acelerar o preenchimento do carrinho.",
        tags: ["Hidráulico"],
    },
];
