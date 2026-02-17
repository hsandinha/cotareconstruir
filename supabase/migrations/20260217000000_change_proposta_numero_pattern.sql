-- ============================================================
-- Migration: Alterar padrão de numeração das propostas
-- De: 10001, 10002, ... (igual pedidos - confuso)
-- Para: P-0001, P-0002, ... (padrão único e claro)
-- ============================================================

-- 1. Adicionar coluna numero se não existir
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS numero TEXT UNIQUE;

-- 2. Criar/recriar sequence começando em 1 (o prefixo P- já diferencia)
DROP SEQUENCE IF EXISTS proposta_numero_seq CASCADE;
CREATE SEQUENCE proposta_numero_seq START WITH 1;

-- 3. Atualizar a função trigger para gerar no formato P-XXXX
CREATE OR REPLACE FUNCTION generate_proposta_numero()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero IS NULL THEN
        NEW.numero := 'P-' || LPAD(nextval('proposta_numero_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recriar trigger
DROP TRIGGER IF EXISTS set_proposta_numero ON public.propostas;
CREATE TRIGGER set_proposta_numero
    BEFORE INSERT ON public.propostas
    FOR EACH ROW
    EXECUTE FUNCTION generate_proposta_numero();

-- 5. RPC para obter o próximo número formatado (caso necessário no app)
CREATE OR REPLACE FUNCTION public.get_next_proposta_numero()
RETURNS TEXT AS $$
BEGIN
    RETURN 'P-' || LPAD(nextval('proposta_numero_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Renumerar propostas existentes no novo formato (ordem cronológica)
DO $$
DECLARE
    rec RECORD;
    counter INT := 0;
BEGIN
    FOR rec IN
        SELECT id FROM public.propostas ORDER BY created_at ASC
    LOOP
        counter := counter + 1;
        UPDATE public.propostas
        SET numero = 'P-' || LPAD(counter::TEXT, 4, '0')
        WHERE id = rec.id;
    END LOOP;

    -- Sincronizar a sequence com o último número usado
    IF counter > 0 THEN
        PERFORM setval('proposta_numero_seq', counter);
    END IF;
    
    RAISE NOTICE 'Renumeradas % propostas no formato P-XXXX', counter;
END $$;
