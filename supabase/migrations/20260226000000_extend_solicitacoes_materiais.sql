-- =====================================================
-- Extensão da tabela solicitacoes_materiais
-- Permite solicitações de novos materiais vindas de
-- clientes (carrinho) e fornecedores (cadastro), com
-- pré-cadastro aguardando aprovação do administrador.
-- =====================================================

-- pg_trgm para similaridade textual (usada no matching de materiais parecidos)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Permitir solicitação sem fornecedor (cliente também pode solicitar)
ALTER TABLE public.solicitacoes_materiais
    ALTER COLUMN fornecedor_id DROP NOT NULL;

-- Novas colunas para identificar o solicitante e armazenar o resultado
ALTER TABLE public.solicitacoes_materiais
    ADD COLUMN IF NOT EXISTS solicitante_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo_solicitante TEXT NOT NULL DEFAULT 'fornecedor'
        CHECK (tipo_solicitante IN ('cliente', 'fornecedor')),
    ADD COLUMN IF NOT EXISTS material_aprovado_id UUID REFERENCES public.materiais(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS similares JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS contexto JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- Índices
CREATE INDEX IF NOT EXISTS idx_solicitacoes_materiais_status
    ON public.solicitacoes_materiais(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_materiais_user
    ON public.solicitacoes_materiais(solicitante_user_id);
CREATE INDEX IF NOT EXISTS idx_materiais_nome_trgm
    ON public.materiais USING gin (nome gin_trgm_ops);

-- Função utilitária para buscar materiais similares por nome
CREATE OR REPLACE FUNCTION public.find_similar_materiais(
    p_nome TEXT,
    p_limit INTEGER DEFAULT 5,
    p_threshold REAL DEFAULT 0.35
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    unidade TEXT,
    descricao TEXT,
    similarity REAL
)
LANGUAGE sql
STABLE
AS $$
    SELECT m.id, m.nome, m.unidade, m.descricao,
           similarity(m.nome, p_nome) AS similarity
    FROM public.materiais m
    WHERE m.nome % p_nome
       OR similarity(m.nome, p_nome) >= p_threshold
    ORDER BY similarity(m.nome, p_nome) DESC
    LIMIT GREATEST(p_limit, 1);
$$;
