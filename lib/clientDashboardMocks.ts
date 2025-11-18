export type Work = {
    id: number;
    obra: string;
    bairro: string;
    cidade: string;
    etapa: string;
};

export const initialWorks: Work[] = [
    {
        id: 1,
        obra: "Cond. Ed. A. Nogueira / Obra Havaí - BH",
        bairro: "Havaí",
        cidade: "Belo Horizonte - MG",
        etapa: "Estrutura",
    },
    {
        id: 2,
        obra: "Reforma Escritório Savassi",
        bairro: "Savassi",
        cidade: "Belo Horizonte - MG",
        etapa: "Acabamento",
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
            "Organize o que precisa por categoria e evite retrabalhos antes de enviar para a Cotar e Construir.",
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
