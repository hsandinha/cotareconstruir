-- Migration: Add numero column to propostas table
-- Propostas: 10001, 10002... (just numbers, no prefix or special characters)

-- Add numero to propostas table
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS numero TEXT UNIQUE;

-- Create sequence for auto-incrementing numbers
CREATE SEQUENCE IF NOT EXISTS proposta_numero_seq START WITH 10001;

-- Function to auto-generate proposta numero
CREATE OR REPLACE FUNCTION generate_proposta_numero()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero IS NULL THEN
        NEW.numero := nextval('proposta_numero_seq')::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS set_proposta_numero ON public.propostas;
CREATE TRIGGER set_proposta_numero
    BEFORE INSERT ON public.propostas
    FOR EACH ROW
    EXECUTE FUNCTION generate_proposta_numero();

-- Update existing propostas that don't have numero (ordered by created_at)
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) + 10000 as rn
    FROM public.propostas
    WHERE numero IS NULL
)
UPDATE public.propostas p
SET numero = numbered.rn::TEXT
FROM numbered
WHERE p.id = numbered.id;

-- Reset sequence to be higher than the max existing numero
SELECT setval(
    'proposta_numero_seq',
    (SELECT COALESCE(MAX(numero::BIGINT), 10000) FROM public.propostas WHERE numero ~ '^\d+$'),
    true
);
