-- =====================================================
-- Proposta por link (sem login) + proposta lançada pelo admin
--
-- O caminho da planilha no WhatsApp (ver docs/cotacao-por-whatsapp.md) pede
-- que o fornecedor baixe um .xlsx, preencha num app de planilha e devolva o
-- arquivo. No celular, isso é demais: muita gente simplesmente não responde.
--
-- Aqui entra o caminho curto: a notificação leva um LINK. O fornecedor toca,
-- abre um formulário no próprio navegador do WhatsApp e digita os preços.
-- Sem conta, sem senha, sem arquivo.
--
-- Duas peças para isso:
--
-- 1. TOKEN NO CONVITE. Cada par (cotação, fornecedor) ganha um token próprio.
--    Guardamos só o SHA-256 — o token em claro existe apenas na URL que foi
--    enviada. Vazar o banco não dá a ninguém o poder de responder no lugar
--    de um fornecedor.
--
-- 2. ORIGEM DA PROPOSTA. Saber se os valores vieram do painel, da planilha,
--    do link ou da mão do administrador muda como se lê uma divergência de
--    preço depois. Sem isso, "o fornecedor cotou errado" e "alguém digitou
--    errado aqui dentro" são indistinguíveis.
-- =====================================================

-- ---------- 1) Token de resposta no convite ----------

ALTER TABLE public.cotacao_convites
    -- SHA-256 do token, em hex. Nunca o token em si.
    ADD COLUMN IF NOT EXISTS token_hash TEXT,
    ADD COLUMN IF NOT EXISTS token_criado_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS token_expira_em TIMESTAMPTZ,
    -- Primeira vez que o link foi aberto. Não invalida: o fornecedor pode
    -- voltar para corrigir um preço enquanto o token vale.
    ADD COLUMN IF NOT EXISTS token_aberto_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS respondido_em TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS cotacao_convites_token_idx
    ON public.cotacao_convites (token_hash)
    WHERE token_hash IS NOT NULL;

-- ---------- 2) Origem da proposta ----------

DO $$
BEGIN
    IF to_regclass('public.propostas') IS NULL THEN
        RETURN;
    END IF;

    ALTER TABLE public.propostas
        ADD COLUMN IF NOT EXISTS origem TEXT,
        -- Quem digitou, quando foi o administrador lançando pelo fornecedor.
        -- Separado de `enviada_por_user_id`, que representa o autor "oficial"
        -- da proposta — aqui é a responsabilidade de quem operou o teclado.
        ADD COLUMN IF NOT EXISTS lancada_por_admin UUID;

    -- Linhas antigas vieram todas do painel do fornecedor.
    UPDATE public.propostas SET origem = 'painel' WHERE origem IS NULL;

    ALTER TABLE public.propostas
        ALTER COLUMN origem SET DEFAULT 'painel';

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'propostas_origem_check'
    ) THEN
        ALTER TABLE public.propostas
            ADD CONSTRAINT propostas_origem_check
            CHECK (origem IN ('painel', 'planilha_whatsapp', 'link_publico', 'admin'));
    END IF;

    IF to_regclass('public.users') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'propostas_lancada_por_admin_fkey'
    ) THEN
        ALTER TABLE public.propostas
            ADD CONSTRAINT propostas_lancada_por_admin_fkey
            FOREIGN KEY (lancada_por_admin) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------- 3) Resolver o token sem expor a tabela ----------
--
-- A rota pública precisa trocar um token por (cotação, fornecedor). Fazer
-- isso com um SELECT direto exigiria abrir `cotacao_convites` para anônimo,
-- o que entregaria a lista inteira de quem foi convidado para cada cotação —
-- informação concorrencial dos fornecedores.
--
-- A função devolve só o par, e só enquanto o token vale.

CREATE OR REPLACE FUNCTION public.convite_por_token(p_token_hash TEXT)
RETURNS TABLE (
    convite_id UUID,
    cotacao_id UUID,
    fornecedor_id UUID,
    expira_em TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT cc.id, cc.cotacao_id, cc.fornecedor_id, cc.token_expira_em
      FROM public.cotacao_convites cc
     WHERE cc.token_hash = p_token_hash
       AND (cc.token_expira_em IS NULL OR cc.token_expira_em > now())
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.convite_por_token(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convite_por_token(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
