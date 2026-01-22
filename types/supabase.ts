// Tipos gerados a partir do schema Supabase
// Para regenerar: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    email: string;
                    nome: string | null;
                    role: 'admin' | 'cliente' | 'fornecedor';
                    roles: string[] | null;
                    telefone: string | null;
                    cpf_cnpj: string | null;
                    avatar_url: string | null;
                    fornecedor_id: string | null;
                    cliente_id: string | null;
                    two_factor_enabled: boolean;
                    two_factor_secret: string | null;
                    is_verified: boolean;
                    status: 'pending' | 'active' | 'suspended';
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    nome?: string | null;
                    role?: 'admin' | 'cliente' | 'fornecedor';
                    roles?: string[] | null;
                    telefone?: string | null;
                    cpf_cnpj?: string | null;
                    avatar_url?: string | null;
                    fornecedor_id?: string | null;
                    cliente_id?: string | null;
                    two_factor_enabled?: boolean;
                    two_factor_secret?: string | null;
                    is_verified?: boolean;
                    status?: 'pending' | 'active' | 'suspended';
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string;
                    nome?: string | null;
                    role?: 'admin' | 'cliente' | 'fornecedor';
                    roles?: string[] | null;
                    telefone?: string | null;
                    cpf_cnpj?: string | null;
                    avatar_url?: string | null;
                    fornecedor_id?: string | null;
                    cliente_id?: string | null;
                    two_factor_enabled?: boolean;
                    two_factor_secret?: string | null;
                    is_verified?: boolean;
                    status?: 'pending' | 'active' | 'suspended';
                    created_at?: string;
                    updated_at?: string;
                };
            };
            fases: {
                Row: {
                    id: string;
                    cronologia: number;
                    nome: string;
                    descricao: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    cronologia: number;
                    nome: string;
                    descricao?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    cronologia?: number;
                    nome?: string;
                    descricao?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            servicos: {
                Row: {
                    id: string;
                    nome: string;
                    descricao: string | null;
                    ordem: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    nome: string;
                    descricao?: string | null;
                    ordem?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    nome?: string;
                    descricao?: string | null;
                    ordem?: number;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            grupos_insumo: {
                Row: {
                    id: string;
                    nome: string;
                    descricao: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    nome: string;
                    descricao?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    nome?: string;
                    descricao?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            materiais: {
                Row: {
                    id: string;
                    nome: string;
                    unidade: string;
                    descricao: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    nome: string;
                    unidade: string;
                    descricao?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    nome?: string;
                    unidade?: string;
                    descricao?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            fornecedores: {
                Row: {
                    id: string;
                    user_id: string | null;
                    razao_social: string;
                    nome_fantasia: string | null;
                    cnpj: string | null;
                    email: string | null;
                    telefone: string | null;
                    cep: string | null;
                    logradouro: string | null;
                    numero: string | null;
                    complemento: string | null;
                    bairro: string | null;
                    cidade: string | null;
                    estado: string | null;
                    regioes_atendimento: string[] | null;
                    prazo_entrega_padrao: number;
                    is_verified: boolean;
                    status: 'pending' | 'active' | 'suspended';
                    rating: number;
                    review_count: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    razao_social: string;
                    nome_fantasia?: string | null;
                    cnpj?: string | null;
                    email?: string | null;
                    telefone?: string | null;
                    cep?: string | null;
                    logradouro?: string | null;
                    numero?: string | null;
                    complemento?: string | null;
                    bairro?: string | null;
                    cidade?: string | null;
                    estado?: string | null;
                    regioes_atendimento?: string[] | null;
                    prazo_entrega_padrao?: number;
                    is_verified?: boolean;
                    status?: 'pending' | 'active' | 'suspended';
                    rating?: number;
                    review_count?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string | null;
                    razao_social?: string;
                    nome_fantasia?: string | null;
                    cnpj?: string | null;
                    email?: string | null;
                    telefone?: string | null;
                    cep?: string | null;
                    logradouro?: string | null;
                    numero?: string | null;
                    complemento?: string | null;
                    bairro?: string | null;
                    cidade?: string | null;
                    estado?: string | null;
                    regioes_atendimento?: string[] | null;
                    prazo_entrega_padrao?: number;
                    is_verified?: boolean;
                    status?: 'pending' | 'active' | 'suspended';
                    rating?: number;
                    review_count?: number;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            clientes: {
                Row: {
                    id: string;
                    user_id: string | null;
                    razao_social: string | null;
                    nome: string;
                    cpf_cnpj: string | null;
                    email: string | null;
                    telefone: string | null;
                    cep: string | null;
                    logradouro: string | null;
                    numero: string | null;
                    complemento: string | null;
                    bairro: string | null;
                    cidade: string | null;
                    estado: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    razao_social?: string | null;
                    nome: string;
                    cpf_cnpj?: string | null;
                    email?: string | null;
                    telefone?: string | null;
                    cep?: string | null;
                    logradouro?: string | null;
                    numero?: string | null;
                    complemento?: string | null;
                    bairro?: string | null;
                    cidade?: string | null;
                    estado?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string | null;
                    razao_social?: string | null;
                    nome?: string;
                    cpf_cnpj?: string | null;
                    email?: string | null;
                    telefone?: string | null;
                    cep?: string | null;
                    logradouro?: string | null;
                    numero?: string | null;
                    complemento?: string | null;
                    bairro?: string | null;
                    cidade?: string | null;
                    estado?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            obras: {
                Row: {
                    id: string;
                    cliente_id: string | null;
                    user_id: string;
                    nome: string;
                    descricao: string | null;
                    tipo: string | null;
                    etapa: string | null;
                    fase_id: string | null;
                    cep: string | null;
                    logradouro: string | null;
                    numero: string | null;
                    complemento: string | null;
                    bairro: string | null;
                    cidade: string | null;
                    estado: string | null;
                    data_inicio: string | null;
                    data_previsao_fim: string | null;
                    status: 'ativa' | 'pausada' | 'concluida' | 'cancelada';
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    cliente_id?: string | null;
                    user_id: string;
                    nome: string;
                    descricao?: string | null;
                    tipo?: string | null;
                    etapa?: string | null;
                    fase_id?: string | null;
                    cep?: string | null;
                    logradouro?: string | null;
                    numero?: string | null;
                    complemento?: string | null;
                    bairro?: string | null;
                    cidade?: string | null;
                    estado?: string | null;
                    data_inicio?: string | null;
                    data_previsao_fim?: string | null;
                    status?: 'ativa' | 'pausada' | 'concluida' | 'cancelada';
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    cliente_id?: string | null;
                    user_id?: string;
                    nome?: string;
                    descricao?: string | null;
                    tipo?: string | null;
                    etapa?: string | null;
                    fase_id?: string | null;
                    cep?: string | null;
                    logradouro?: string | null;
                    numero?: string | null;
                    complemento?: string | null;
                    bairro?: string | null;
                    cidade?: string | null;
                    estado?: string | null;
                    data_inicio?: string | null;
                    data_previsao_fim?: string | null;
                    status?: 'ativa' | 'pausada' | 'concluida' | 'cancelada';
                    created_at?: string;
                    updated_at?: string;
                };
            };
            servico_fase: {
                Row: {
                    servico_id: string;
                    fase_id: string;
                };
                Insert: {
                    servico_id: string;
                    fase_id: string;
                };
                Update: {
                    servico_id?: string;
                    fase_id?: string;
                };
            };
            servico_grupo: {
                Row: {
                    servico_id: string;
                    grupo_id: string;
                };
                Insert: {
                    servico_id: string;
                    grupo_id: string;
                };
                Update: {
                    servico_id?: string;
                    grupo_id?: string;
                };
            };
            material_grupo: {
                Row: {
                    material_id: string;
                    grupo_id: string;
                };
                Insert: {
                    material_id: string;
                    grupo_id: string;
                };
                Update: {
                    material_id?: string;
                    grupo_id?: string;
                };
            };
            fornecedor_grupo: {
                Row: {
                    fornecedor_id: string;
                    grupo_id: string;
                };
                Insert: {
                    fornecedor_id: string;
                    grupo_id: string;
                };
                Update: {
                    fornecedor_id?: string;
                    grupo_id?: string;
                };
            };
            ofertas: {
                Row: {
                    id: string;
                    fornecedor_id: string;
                    fornecedor_material_id: string;
                    material_id: string;
                    material_nome: string;
                    material_unidade: string;
                    tipo_oferta: 'valor' | 'percentual';
                    valor_oferta: number;
                    preco_original: number;
                    preco_final: number;
                    desconto_percentual: number | null;
                    quantidade_minima: number;
                    estoque: number;
                    data_inicio: string;
                    data_fim: string | null;
                    ativo: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    fornecedor_id: string;
                    fornecedor_material_id: string;
                    material_id: string;
                    material_nome: string;
                    material_unidade: string;
                    tipo_oferta: 'valor' | 'percentual';
                    valor_oferta: number;
                    preco_original: number;
                    preco_final: number;
                    desconto_percentual?: number | null;
                    quantidade_minima?: number;
                    estoque?: number;
                    data_inicio?: string;
                    data_fim?: string | null;
                    ativo?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    fornecedor_id?: string;
                    fornecedor_material_id?: string;
                    material_id?: string;
                    material_nome?: string;
                    material_unidade?: string;
                    tipo_oferta?: 'valor' | 'percentual';
                    valor_oferta?: number;
                    preco_original?: number;
                    preco_final?: number;
                    desconto_percentual?: number | null;
                    quantidade_minima?: number;
                    estoque?: number;
                    data_inicio?: string;
                    data_fim?: string | null;
                    ativo?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            notificacoes: {
                Row: {
                    id: string;
                    user_id: string;
                    tipo: string;
                    titulo: string;
                    mensagem: string;
                    link: string | null;
                    lida: boolean;
                    data_leitura: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    tipo: string;
                    titulo: string;
                    mensagem: string;
                    link?: string | null;
                    lida?: boolean;
                    data_leitura?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    tipo?: string;
                    titulo?: string;
                    mensagem?: string;
                    link?: string | null;
                    lida?: boolean;
                    data_leitura?: string | null;
                    created_at?: string;
                };
            };
            audit_logs: {
                Row: {
                    id: string;
                    user_id: string | null;
                    action: string;
                    entity_type: string | null;
                    entity_id: string | null;
                    details: Json | null;
                    ip_address: string | null;
                    user_agent: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    action: string;
                    entity_type?: string | null;
                    entity_id?: string | null;
                    details?: Json | null;
                    ip_address?: string | null;
                    user_agent?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string | null;
                    action?: string;
                    entity_type?: string | null;
                    entity_id?: string | null;
                    details?: Json | null;
                    ip_address?: string | null;
                    user_agent?: string | null;
                    created_at?: string;
                };
            };
        };
        Views: {
            ofertas_completas: {
                Row: {
                    id: string;
                    fornecedor_id: string;
                    material_id: string;
                    material_nome: string;
                    material_unidade: string;
                    fornecedor_nome: string;
                    fornecedor_cidade: string | null;
                    fornecedor_estado: string | null;
                    fornecedor_rating: number;
                    preco_original: number;
                    preco_final: number;
                    desconto_percentual: number | null;
                    estoque: number;
                    ativo: boolean;
                    grupo_ids: string[];
                    grupo_nomes: string[];
                };
            };
            materiais_por_fase: {
                Row: {
                    fase_id: string;
                    fase_nome: string;
                    cronologia: number;
                    material_id: string;
                    material_nome: string;
                    material_unidade: string;
                    grupo_id: string;
                    grupo_nome: string;
                    servico_id: string;
                    servico_nome: string;
                };
            };
            ofertas_por_fase: {
                Row: {
                    fase_id: string;
                    fase_nome: string;
                    id: string;
                    fornecedor_id: string;
                    material_id: string;
                    material_nome: string;
                    fornecedor_nome: string;
                    fornecedor_rating: number;
                    preco_final: number;
                    ativo: boolean;
                };
            };
        };
        Functions: {
            get_ofertas_by_fase: {
                Args: {
                    p_fase_id: string;
                };
                Returns: {
                    oferta_id: string;
                    material_id: string;
                    material_nome: string;
                    material_unidade: string;
                    fornecedor_id: string;
                    fornecedor_nome: string;
                    preco_original: number;
                    preco_final: number;
                    desconto_percentual: number;
                    estoque: number;
                }[];
            };
            is_admin: {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
        };
        Enums: {
            [_ in never]: never;
        };
    };
}

// Tipos auxiliares para uso nos componentes
export type User = Database['public']['Tables']['users']['Row'];
export type Fase = Database['public']['Tables']['fases']['Row'];
export type Servico = Database['public']['Tables']['servicos']['Row'];
export type GrupoInsumo = Database['public']['Tables']['grupos_insumo']['Row'];
export type Material = Database['public']['Tables']['materiais']['Row'];
export type Fornecedor = Database['public']['Tables']['fornecedores']['Row'];
export type Cliente = Database['public']['Tables']['clientes']['Row'];
export type Obra = Database['public']['Tables']['obras']['Row'];
export type Oferta = Database['public']['Tables']['ofertas']['Row'];
export type Notificacao = Database['public']['Tables']['notificacoes']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

// Tipos para relacionamentos
export type ServicoFase = Database['public']['Tables']['servico_fase']['Row'];
export type ServicoGrupo = Database['public']['Tables']['servico_grupo']['Row'];
export type MaterialGrupo = Database['public']['Tables']['material_grupo']['Row'];
export type FornecedorGrupo = Database['public']['Tables']['fornecedor_grupo']['Row'];

// Tipos para views
export type OfertaCompleta = Database['public']['Views']['ofertas_completas']['Row'];
export type MaterialPorFase = Database['public']['Views']['materiais_por_fase']['Row'];
export type OfertaPorFase = Database['public']['Views']['ofertas_por_fase']['Row'];

// Tipos para inserção
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type FaseInsert = Database['public']['Tables']['fases']['Insert'];
export type ServicoInsert = Database['public']['Tables']['servicos']['Insert'];
export type GrupoInsumoInsert = Database['public']['Tables']['grupos_insumo']['Insert'];
export type MaterialInsert = Database['public']['Tables']['materiais']['Insert'];
export type FornecedorInsert = Database['public']['Tables']['fornecedores']['Insert'];
export type ObraInsert = Database['public']['Tables']['obras']['Insert'];
export type OfertaInsert = Database['public']['Tables']['ofertas']['Insert'];

// Tipos com relacionamentos expandidos (para queries com joins)
export type ServicoComRelacoes = Servico & {
    fases?: Fase[];
    grupos?: GrupoInsumo[];
};

export type MaterialComRelacoes = Material & {
    grupos?: GrupoInsumo[];
};

export type FornecedorComRelacoes = Fornecedor & {
    grupos?: GrupoInsumo[];
    user?: User;
};

export type OfertaComRelacoes = Oferta & {
    fornecedor?: Fornecedor;
    material?: Material;
};
