-- =====================================================
-- Funções de numeração abertas ao público
--
-- Medido contra o banco: um visitante ANÔNIMO chamou
-- `get_next_pedido_numero` duas vezes e a sequência avançou (10003 → 10004).
-- O mesmo vale para cotação e proposta.
--
-- Não é vazamento de dado, é vandalismo: rodando em laço, qualquer um
-- empurra a numeração de pedidos para valores arbitrários e a
-- rastreabilidade (#10059, #10074...) vira lixo.
--
-- Nenhuma dessas funções é chamada pelo aplicativo — as rotas usam
-- `nextval` direto com a service key, e o trigger `generate_pedido_numero`
-- também. Trancar não quebra nada.
--
-- `find_similar_materiais` entra junto: só é usada por rota de servidor
-- (lib/materialSimilarity, chamada de /api/fornecedor-materiais e
-- /api/material-requests), e varrer o catálogo de fora não interessa.
-- =====================================================

DO $$
DECLARE
    assinatura TEXT;
BEGIN
    FOREACH assinatura IN ARRAY ARRAY[
        'public.get_next_pedido_numero()',
        'public.get_next_cotacao_numero()',
        'public.get_next_proposta_numero()'
    ]
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', assinatura);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', assinatura);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', assinatura);
        RAISE NOTICE 'Trancada: %', assinatura;
    END LOOP;
END $$;

-- find_similar_materiais: assinatura variável entre ambientes, então
-- resolvemos pelo catálogo em vez de chutar os parâmetros.
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS assinatura
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'find_similar_materiais'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f.assinatura);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', f.assinatura);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.assinatura);
        RAISE NOTICE 'Trancada: %', f.assinatura;
    END LOOP;
END $$;

-- Continuam abertas de propósito:
--   status_turma_lancamento  -> a landing mostra as vagas sem login
--   validar_convite_lancamento -> só devolve algo com token válido em mãos
--   limite_obras_do_usuario  -> a tela de Obras consulta o próprio limite
--   is_admin                 -> usada dentro das políticas RLS

NOTIFY pgrst, 'reload schema';
