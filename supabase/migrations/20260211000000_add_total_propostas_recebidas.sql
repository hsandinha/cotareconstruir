-- Adiciona campo para armazenar o total de propostas recebidas antes do fechamento
-- Quando a cotação é fechada, as propostas são limpas (mantendo apenas as 3 melhores),
-- mas o total de propostas recebidas fica registrado neste campo.
ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS total_propostas_recebidas INTEGER DEFAULT 0;
