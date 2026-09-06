-- =====================================================
-- Catálogo: descrição que só repete o nome
--
-- A importação preencheu `materiais.descricao` com uma cópia do `nome` em
-- 14.566 dos 14.592 materiais que têm descrição (99,8%). Na tela do
-- fornecedor isso aparecia como a mesma especificação repetida logo
-- abaixo, numa fonte menor.
--
-- A tela já esconde a repetição (lib/materialSearch → descricaoAcrescentaAlgo),
-- mas o dado continuava sujo e voltaria a incomodar em relatório, busca e
-- exportação. Aqui ele é limpo na origem.
--
-- Só apaga o que NÃO acrescenta nada: descrição igual ao nome, ou contida
-- nele. Descrição com informação de verdade ("ALCANCE DE 8MTS A 12MTS")
-- permanece.
-- =====================================================

-- Remoção de acentos sem depender da extensão `unaccent` (que nem todo
-- projeto Supabase tem habilitada).
CREATE OR REPLACE FUNCTION public.unaccent_simples(texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT translate(
        COALESCE(texto, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    );
$$;

DO $$
DECLARE
    afetados INTEGER;
BEGIN
    IF to_regclass('public.materiais') IS NULL THEN
        RAISE NOTICE 'Tabela public.materiais não existe; migration ignorada.';
        RETURN;
    END IF;

    WITH limpos AS (
        UPDATE public.materiais
        SET descricao = NULL
        WHERE descricao IS NOT NULL
          AND btrim(descricao) <> ''
          AND (
              -- comparação sem caixa e sem acento, como na tela
              lower(unaccent_simples(btrim(descricao))) = lower(unaccent_simples(btrim(nome)))
              OR position(lower(unaccent_simples(btrim(descricao))) in lower(unaccent_simples(btrim(nome)))) > 0
          )
        RETURNING 1
    )
    SELECT count(*) INTO afetados FROM limpos;

    RAISE NOTICE 'Descrições redundantes limpas: %', afetados;
END $$;
