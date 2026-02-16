-- Migration: Add numero column to cotacoes + sequences for auto-numbering
-- Cotações: COT-10001, COT-10002... (prefix stripped, just numbers)
-- Pedidos: 10001, 10002... (just numbers)

-- Add numero to cotacoes table
ALTER TABLE public.cotacoes ADD COLUMN IF NOT EXISTS numero TEXT UNIQUE;

-- Create sequences for auto-incrementing numbers
CREATE SEQUENCE IF NOT EXISTS cotacao_numero_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS pedido_numero_seq START WITH 10001;

-- RPC function to get next value from sequence (for TypeScript access)
CREATE OR REPLACE FUNCTION public.get_next_pedido_numero()
RETURNS TEXT AS $$
BEGIN
    RETURN nextval('pedido_numero_seq')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_next_cotacao_numero()
RETURNS TEXT AS $$
BEGIN
    RETURN nextval('cotacao_numero_seq')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-generate cotacao numero
CREATE OR REPLACE FUNCTION generate_cotacao_numero()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero IS NULL THEN
        NEW.numero := nextval('cotacao_numero_seq')::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate pedido numero (herda da cotação quando possível)
CREATE OR REPLACE FUNCTION generate_pedido_numero()
RETURNS TRIGGER AS $$
DECLARE
    cotacao_num TEXT;
BEGIN
    IF NEW.numero IS NULL THEN
        -- Tentar herdar o numero da cotação vinculada
        IF NEW.cotacao_id IS NOT NULL THEN
            SELECT numero INTO cotacao_num FROM public.cotacoes WHERE id = NEW.cotacao_id;
            IF cotacao_num IS NOT NULL THEN
                -- Verificar se já existe pedido com esse numero
                IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE numero = cotacao_num) THEN
                    NEW.numero := cotacao_num;
                    RETURN NEW;
                END IF;
            END IF;
        END IF;
        -- Fallback: usar sequência independente
        NEW.numero := nextval('pedido_numero_seq')::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS set_cotacao_numero ON public.cotacoes;
CREATE TRIGGER set_cotacao_numero
    BEFORE INSERT ON public.cotacoes
    FOR EACH ROW
    EXECUTE FUNCTION generate_cotacao_numero();

DROP TRIGGER IF EXISTS set_pedido_numero ON public.pedidos;
CREATE TRIGGER set_pedido_numero
    BEFORE INSERT ON public.pedidos
    FOR EACH ROW
    EXECUTE FUNCTION generate_pedido_numero();

-- Update existing cotacoes that don't have numero (ordered by created_at)
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) + 10000 as rn
    FROM public.cotacoes
    WHERE numero IS NULL
)
UPDATE public.cotacoes c
SET numero = numbered.rn::TEXT
FROM numbered
WHERE c.id = numbered.id;

-- Update existing pedidos that don't have numero (ordered by created_at)
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) + 10000 as rn
    FROM public.pedidos
    WHERE numero IS NULL OR numero !~ '^\d+$'
)
UPDATE public.pedidos p
SET numero = numbered.rn::TEXT
FROM numbered
WHERE p.id = numbered.id;

-- Update sequences to start after the highest existing number
SELECT setval('cotacao_numero_seq', GREATEST(
    (SELECT COALESCE(MAX(numero::BIGINT), 10000) FROM public.cotacoes WHERE numero ~ '^\d+$'),
    10000
));

SELECT setval('pedido_numero_seq', GREATEST(
    (SELECT COALESCE(MAX(numero::BIGINT), 10000) FROM public.pedidos WHERE numero ~ '^\d+$'),
    10000
));
