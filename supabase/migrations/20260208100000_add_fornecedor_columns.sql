-- Add missing columns to fornecedores table
-- Columns used by the admin management UI and Excel import

ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS contato TEXT DEFAULT '';
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS cartao_credito BOOLEAN DEFAULT FALSE;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT DEFAULT '';
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '';
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS codigo_grupo TEXT DEFAULT '';
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS grupo_insumos TEXT DEFAULT '';
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
