-- Atualiza cotações legadas para manter fluxo aberto a múltiplos fornecedores
-- Regra: status 'respondida' volta para 'enviada'

UPDATE public.cotacoes
SET status = 'enviada',
    updated_at = NOW()
WHERE status = 'respondida';
