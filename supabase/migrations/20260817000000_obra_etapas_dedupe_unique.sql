-- =====================================================
-- Cronograma de etapas: remove duplicidades e impede novas
--
-- Sintoma reportado: na aba "Obras e Endereços / Cronograma de Etapas"
-- a mesma fase entrava mais de uma vez (ex.: "Acabamentos Finais" 3x),
-- e a duplicidade se propagava para a aba "Nova Cotação", que monta a
-- árvore a partir de obra_etapas.
--
-- A checagem existia só no cliente (WorksSection), então qualquer duplo
-- clique, segunda aba ou estado desatualizado gerava linha repetida.
-- =====================================================

DO $$
BEGIN
    IF to_regclass('public.obra_etapas') IS NULL THEN
        RAISE NOTICE 'Tabela public.obra_etapas não existe neste ambiente; migration ignorada.';
        RETURN;
    END IF;

    -- 1) Duplicatas por fase: mantém a etapa de menor ordem no cronograma
    WITH ranked AS (
        SELECT id,
               row_number() OVER (
                   PARTITION BY obra_id, fase_id
                   ORDER BY COALESCE(ordem, 2147483647), id
               ) AS rn
        FROM public.obra_etapas
        WHERE fase_id IS NOT NULL
    )
    DELETE FROM public.obra_etapas e
    USING ranked r
    WHERE e.id = r.id
      AND r.rn > 1;

    -- 2) Linhas legadas sem fase_id: desduplica pelo nome da etapa
    WITH ranked_nome AS (
        SELECT id,
               row_number() OVER (
                   PARTITION BY obra_id, lower(btrim(nome))
                   ORDER BY COALESCE(ordem, 2147483647), id
               ) AS rn
        FROM public.obra_etapas
        WHERE fase_id IS NULL
    )
    DELETE FROM public.obra_etapas e
    USING ranked_nome r
    WHERE e.id = r.id
      AND r.rn > 1;

    -- 3) Trava definitiva no banco
    CREATE UNIQUE INDEX IF NOT EXISTS obra_etapas_obra_fase_uniq
        ON public.obra_etapas (obra_id, fase_id)
        WHERE fase_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS obra_etapas_obra_nome_uniq
        ON public.obra_etapas (obra_id, lower(btrim(nome)))
        WHERE fase_id IS NULL;
END $$;
