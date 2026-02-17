-- ============================================================
-- Migration: Adicionar coluna impostos em propostas e pedidos
-- ============================================================

-- Adicionar coluna impostos na tabela propostas
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS impostos DECIMAL(12,2) DEFAULT 0;

-- Adicionar coluna impostos na tabela pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS impostos DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN public.propostas.impostos IS 'Valor monetário de impostos (R$) informado pelo fornecedor na proposta';
COMMENT ON COLUMN public.pedidos.impostos IS 'Valor monetário de impostos (R$) do pedido confirmado';
