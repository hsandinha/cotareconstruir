-- =====================================================
-- Cronograma de etapas na cronologia da fase
--
-- Sintoma reportado: em "Obras e Endereços / Minhas Obras / Adicionar Etapa"
-- o cronograma listava as etapas na ordem em que foram adicionadas
-- (#1 Acabamentos Finais, #2 Revestimentos, #3 Instalações...), e não na
-- cronologia do cadastro "Etapa / Fase" (#1 Instalações, #2 Esquadrias
-- (Contramarcos e Marcos), #3 Revestimentos...).
--
-- A causa era obra_etapas.ordem receber max(ordem)+1 no insert. Agora a
-- coluna passa a espelhar fases.cronologia; esta migration corrige as
-- etapas já gravadas.
-- =====================================================

DO $$
BEGIN
    IF to_regclass('public.obra_etapas') IS NULL THEN
        RAISE NOTICE 'Tabela public.obra_etapas não existe neste ambiente; migration ignorada.';
        RETURN;
    END IF;

    IF to_regclass('public.fases') IS NULL THEN
        RAISE NOTICE 'Tabela public.fases não existe neste ambiente; migration ignorada.';
        RETURN;
    END IF;

    UPDATE public.obra_etapas e
    SET ordem = f.cronologia
    FROM public.fases f
    WHERE e.fase_id = f.id
      AND e.ordem IS DISTINCT FROM f.cronologia;
END $$;
