-- =====================================================
-- Acompanhamento de pedidos pelo administrador
-- - pedido_geral_id agrupa sub-pedidos (cotacoes por grupo)
-- - cotacao_convites registra fornecedores notificados,
--   quando visualizaram e (via propostas) quando responderam.
-- =====================================================

ALTER TABLE public.cotacoes
    ADD COLUMN IF NOT EXISTS pedido_geral_id UUID;

CREATE INDEX IF NOT EXISTS idx_cotacoes_pedido_geral
    ON public.cotacoes(pedido_geral_id);

CREATE TABLE IF NOT EXISTS public.cotacao_convites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    notificado_em TIMESTAMPTZ DEFAULT NOW(),
    visualizado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (cotacao_id, fornecedor_id)
);

CREATE INDEX IF NOT EXISTS idx_cotacao_convites_cotacao
    ON public.cotacao_convites(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_convites_fornecedor
    ON public.cotacao_convites(fornecedor_id);
