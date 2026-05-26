-- =====================================================
-- Preferência do fornecedor: receber apenas cotações
-- contendo materiais que ele tem ativos em sua lista.
-- =====================================================

ALTER TABLE public.fornecedores
    ADD COLUMN IF NOT EXISTS apenas_materiais_ativos BOOLEAN DEFAULT FALSE;
