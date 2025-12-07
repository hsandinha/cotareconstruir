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

export const constructionStages = [
    // Fase de Execução da Obra
    // Serviços Preliminares e Mobilização
    { id: 'limpeza-preparo', name: 'Limpeza e preparo do terreno', category: 'Preliminares' },
    { id: 'fechamento-obra', name: 'Fechamento da obra (muros, tapumes)', category: 'Preliminares' },
    { id: 'canteiro-obras', name: 'Implantação do canteiro de obras', category: 'Preliminares' },
    { id: 'instalacoes-provisorias', name: 'Instalações provisórias (água, luz, etc)', category: 'Preliminares' },
    { id: 'placa-obra', name: 'Instalação da placa da obra', category: 'Preliminares' },
    { id: 'locacao-obra', name: 'Locação da obra', category: 'Preliminares' },
    { id: 'demolicoes', name: 'Demolições', category: 'Preliminares' },

    // Serviços de Terraplenagem
    { id: 'corte-aterro', name: 'Corte e aterro', category: 'Terraplenagem' },
    { id: 'compactacao-solo', name: 'Compactação do solo', category: 'Terraplenagem' },
    { id: 'escavacoes', name: 'Escavações para fundações e infraestrutura', category: 'Terraplenagem' },
    { id: 'drenagem', name: 'Drenagem do terreno', category: 'Terraplenagem' },

    // Serviços de Fundações
    { id: 'sapatas-estacas', name: 'Execução de sapatas, estacas, tubulões, blocos', category: 'Fundações' },
    { id: 'baldrames', name: 'Execução de baldrames', category: 'Fundações' },
    { id: 'impermeabilizacao-baldrames', name: 'Impermeabilização de baldrames', category: 'Fundações' },

    // Serviços de Estrutura
    { id: 'armaduras', name: 'Montagem de armaduras', category: 'Estrutura' },
    { id: 'formas', name: 'Montagem de formas', category: 'Estrutura' },
    { id: 'concretagem', name: 'Concretagem (Pilares, Vigas, Lajes, Escadas)', category: 'Estrutura' },
    { id: 'cura-desforma', name: 'Cura e desforma do concreto', category: 'Estrutura' },
    { id: 'estrutura-metalica', name: 'Instalação de estrutura metálica', category: 'Estrutura' },

    // Serviços de Instalações (Brutas/Embutidas)
    { id: 'tubulacoes-embutidas', name: 'Passagem de tubulações e fiações embutidas', category: 'Instalações Brutas' },

    // Serviços de Impermeabilização
    { id: 'preparo-lajes', name: 'Preparo da superfície das lajes', category: 'Impermeabilização' },
    { id: 'impermeabilizacao-lajes', name: 'Aplicação de sistema impermeabilizante em lajes', category: 'Impermeabilização' },
    { id: 'testes-estanqueidade', name: 'Testes de Estanqueidade', category: 'Impermeabilização' },
    { id: 'protecao-mecanica', name: 'Camada de proteção mecânica', category: 'Impermeabilização' },

    // Serviços de Alvenaria e Vedações
    { id: 'alvenaria-vedacao', name: 'Levantamento de alvenaria de vedação', category: 'Alvenaria e Vedações' },
    { id: 'vergas', name: 'Execução de vergas e contravergas', category: 'Alvenaria e Vedações' },
    { id: 'drywall', name: 'Montagem de paredes de dry-wall ou divisórias', category: 'Alvenaria e Vedações' },

    // Serviços de Cobertura
    { id: 'estrutura-telhado', name: 'Montagem da estrutura do telhado', category: 'Cobertura' },
    { id: 'telhas', name: 'Instalação de telhas', category: 'Cobertura' },
    { id: 'calhas-rufos', name: 'Instalação de calhas, rufos e condutores', category: 'Cobertura' },

    // Serviços de Instalações
    { id: 'hidraulica', name: 'Hidráulica (água, esgoto, pluvial)', category: 'Instalações' },
    { id: 'eletrica', name: 'Elétrica (fiação, quadros, proteção)', category: 'Instalações' },
    { id: 'logica-telefonia', name: 'Lógica/Telefonia e Segurança', category: 'Instalações' },
    { id: 'gas', name: 'Gás (tubulações, aquecedores)', category: 'Instalações' },
    { id: 'hvac', name: 'Mecânica (HVAC)', category: 'Instalações' },
    { id: 'ppci', name: 'PPCI (Incêndio)', category: 'Instalações' },

    // Serviços de Esquadrias
    { id: 'contramarcos', name: 'Assentamento de contramarcos', category: 'Esquadrias' },
    { id: 'marcos', name: 'Instalação de marcos (batentes)', category: 'Esquadrias' },
    { id: 'folhas-portas-janelas', name: 'Instalação de folhas de portas e janelas', category: 'Esquadrias' },
    { id: 'vidros', name: 'Instalação de vidros', category: 'Esquadrias' },

    // Serviços de Revestimentos
    { id: 'chapisco', name: 'Chapisco', category: 'Revestimentos' },
    { id: 'emboco-reboco', name: 'Emboço e reboco', category: 'Revestimentos' },
    { id: 'gesso', name: 'Aplicação de gesso', category: 'Revestimentos' },
    { id: 'fachadas', name: 'Revestimento de fachadas', category: 'Revestimentos' },
    { id: 'pisos', name: 'Assentamento de pisos e rodapés', category: 'Revestimentos' },
    { id: 'revestimento-parede', name: 'Assentamento de revestimentos de parede', category: 'Revestimentos' },

    // Serviços de Pintura
    { id: 'preparo-pintura', name: 'Preparação de superfícies', category: 'Pintura' },
    { id: 'aplicacao-tinta', name: 'Aplicação de fundo e tinta', category: 'Pintura' },

    // Serviços de Acabamentos Finais
    { id: 'loucas', name: 'Instalação de louças sanitárias', category: 'Acabamentos Finais' },
    { id: 'metais', name: 'Instalação de metais', category: 'Acabamentos Finais' },
    { id: 'eletrica-final', name: 'Instalação de luminárias, tomadas, interruptores', category: 'Acabamentos Finais' },
    { id: 'bancadas', name: 'Instalação de bancadas, soleiras e peitoris', category: 'Acabamentos Finais' },
    { id: 'corrimoes', name: 'Instalação de corrimãos e guarda-corpos', category: 'Acabamentos Finais' },
    { id: 'acessorios', name: 'Instalação de acessórios', category: 'Acabamentos Finais' },
    { id: 'mobiliario', name: 'Instalação de mobiliário fixo', category: 'Acabamentos Finais' },

    // Serviços de Urbanização e Paisagismo
    { id: 'calcadas', name: 'Execução de calçadas, passeios, rampas', category: 'Urbanização' },
    { id: 'pavimentacao', name: 'Implantação de pavimentação', category: 'Urbanização' },
    { id: 'jardinagem', name: 'Jardinagem e plantio', category: 'Urbanização' },
    { id: 'iluminacao-externa', name: 'Instalação de iluminação externa', category: 'Urbanização' },
    { id: 'muros-portoes', name: 'Construção de muros e portões', category: 'Urbanização' },

    // Fase de Finalização e Entrega
    // Serviços de Testes
    { id: 'testes-sistemas', name: 'Testes de sistemas', category: 'Finalização' },
    { id: 'testes-equipamentos', name: 'Testes de equipamentos', category: 'Finalização' },

    // Serviços de Limpeza
    { id: 'limpeza-grossa', name: 'Limpeza grossa da obra', category: 'Finalização' },
    { id: 'limpeza-fina', name: 'Limpeza fina e pós-obra', category: 'Finalização' },

    // Serviços de Vistoria e Correção
    { id: 'vistoria', name: 'Vistoria interna e externa', category: 'Entrega' },
    { id: 'reparos', name: 'Execução de reparos e ajustes', category: 'Entrega' },
];

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
