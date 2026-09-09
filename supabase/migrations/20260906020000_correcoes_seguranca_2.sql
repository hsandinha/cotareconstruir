-- =====================================================
-- Correções de segurança (2ª rodada)
--
-- Dois problemas, ambos apontados por verificador de segurança e
-- confirmados contra o banco:
--
-- 1) VIEW FURANDO O RLS — crítico
--    View no Postgres roda com os privilégios do DONO, não de quem
--    consulta. Resultado medido: `materiais_por_fase` devolvia 187.845
--    linhas para um visitante ANÔNIMO, apesar de `materiais`, `fases`,
--    `servicos` e `grupos_insumo` estarem todas protegidas por RLS.
--    O catálogo inteiro (19 mil materiais e a estrutura de fases e
--    serviços) estava aberto com a chave anon, que é pública.
--
--    `security_invoker = on` faz a view respeitar o RLS de quem consulta.
--    As tabelas de baixo já liberam SELECT para `authenticated`, então
--    quem está logado continua enxergando igual — só o anônimo perde.
--
-- 2) SECURITY DEFINER SEM search_path FIXO — escalação de privilégio
--    Função SECURITY DEFINER sem `SET search_path` resolve os nomes pelo
--    search_path de QUEM CHAMA. Quem conseguir criar um objeto num schema
--    à frente na busca consegue sombrear a tabela que a função usa e fazer
--    o corpo rodar com os privilégios elevados do dono.
--
--    `is_admin()` é a mais grave: ela decide TODA política de admin do
--    sistema. Sombrear `public.users` viraria admin instantâneo.
-- =====================================================

-- ---------- 1) Views respeitam o RLS de quem consulta ----------
DO $$
DECLARE
    v TEXT;
BEGIN
    FOREACH v IN ARRAY ARRAY['ofertas_completas', 'materiais_por_fase', 'ofertas_por_fase']
    LOOP
        IF to_regclass('public.' || v) IS NOT NULL THEN
            EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
            RAISE NOTICE 'View %: security_invoker ligado', v;
        END IF;
    END LOOP;
END $$;

-- ---------- 2) search_path fixo nas funções SECURITY DEFINER ----------

-- Decide toda política de admin: a mais sensível do sistema
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND (role = 'admin' OR 'admin' = ANY(roles))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_pedido_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN nextval('pedido_numero_seq')::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_cotacao_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN nextval('cotacao_numero_seq')::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_proposta_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN 'P-' || LPAD(nextval('proposta_numero_seq')::TEXT, 4, '0');
END;
$$;

-- ---------- 3) Varredura: sobrou alguma sem search_path? ----------
-- Só avisa. Função criada fora do repositório (pelo painel) apareceria aqui.
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.proname, n.nspname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef                                   -- SECURITY DEFINER
          AND NOT EXISTS (
              SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS c
              WHERE c LIKE 'search_path=%'
          )
    LOOP
        RAISE NOTICE 'ATENÇÃO: %.% é SECURITY DEFINER sem search_path fixo.', f.nspname, f.proname;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
