-- =====================================================
-- Turma de lançamento: 20 vagas de teste gratuito
--
-- A landing anunciava "os 20 primeiros construtores" e "fila de espera",
-- mas nada disso existia no sistema: o cadastro era ilimitado. Este
-- migration cria o controle real das vagas.
--
--   lancamento_config  — parâmetros da turma (vagas, dias de teste, ...)
--   lancamento_vagas   — quem ocupou cada vaga, com início/fim do teste
--   lista_espera       — quem chegou depois de fechar as vagas
--
-- A reserva passa por reservar_vaga_lancamento(), que usa lock de
-- transação: dois cadastros simultâneos não podem levar a mesma vaga.
-- =====================================================

-- 1) Configuração da turma (linha única)
CREATE TABLE IF NOT EXISTS public.lancamento_config (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    vagas_total INTEGER NOT NULL DEFAULT 20 CHECK (vagas_total >= 0),
    dias_teste INTEGER NOT NULL DEFAULT 30 CHECK (dias_teste > 0),
    obras_por_conta INTEGER NOT NULL DEFAULT 1 CHECK (obras_por_conta > 0),
    inscricoes_abertas BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.lancamento_config (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- 2) Vagas ocupadas
CREATE TABLE IF NOT EXISTS public.lancamento_vagas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    posicao INTEGER NOT NULL,
    nome TEXT,
    email TEXT,
    teste_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
    teste_fim TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo', 'expirado', 'convertido', 'cancelado')),
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma posição só pode estar ocupada por uma vaga viva; cancelar libera o número
CREATE UNIQUE INDEX IF NOT EXISTS lancamento_vagas_posicao_ativa
    ON public.lancamento_vagas (posicao)
    WHERE status <> 'cancelado';

CREATE INDEX IF NOT EXISTS lancamento_vagas_status_idx ON public.lancamento_vagas (status);

-- 3) Fila de espera
CREATE TABLE IF NOT EXISTS public.lista_espera (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT,
    razao_social TEXT,
    cpf_cnpj TEXT,
    origem TEXT NOT NULL DEFAULT 'cadastro',
    convidado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lista_espera_created_idx ON public.lista_espera (created_at);

-- 4) Situação da turma (usado pela landing e pelo painel)
CREATE OR REPLACE FUNCTION public.status_turma_lancamento()
RETURNS TABLE (
    vagas_total INTEGER,
    vagas_ocupadas INTEGER,
    vagas_restantes INTEGER,
    inscricoes_abertas BOOLEAN,
    dias_teste INTEGER,
    obras_por_conta INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cfg public.lancamento_config%ROWTYPE;
    ocupadas INTEGER;
BEGIN
    SELECT * INTO cfg FROM public.lancamento_config WHERE id IS TRUE;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT count(*) INTO ocupadas
    FROM public.lancamento_vagas
    WHERE status <> 'cancelado';

    vagas_total := cfg.vagas_total;
    vagas_ocupadas := ocupadas;
    vagas_restantes := GREATEST(cfg.vagas_total - ocupadas, 0);
    inscricoes_abertas := cfg.inscricoes_abertas AND (cfg.vagas_total - ocupadas) > 0;
    dias_teste := cfg.dias_teste;
    obras_por_conta := cfg.obras_por_conta;
    RETURN NEXT;
END;
$$;

-- 5) Reserva de vaga — atômica
--    Devolve a vaga criada, ou nenhuma linha quando a turma está cheia.
CREATE OR REPLACE FUNCTION public.reservar_vaga_lancamento(
    p_user_id UUID,
    p_cliente_id UUID,
    p_nome TEXT,
    p_email TEXT
)
RETURNS public.lancamento_vagas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cfg public.lancamento_config%ROWTYPE;
    ocupadas INTEGER;
    proxima INTEGER;
    vaga public.lancamento_vagas;
BEGIN
    -- Serializa as reservas concorrentes até o fim da transação
    PERFORM pg_advisory_xact_lock(hashtext('turma_lancamento'));

    -- Recadastro do mesmo usuário devolve a vaga que ele já tem
    SELECT * INTO vaga FROM public.lancamento_vagas WHERE user_id = p_user_id;
    IF FOUND THEN
        RETURN vaga;
    END IF;

    SELECT * INTO cfg FROM public.lancamento_config WHERE id IS TRUE;
    IF NOT FOUND OR NOT cfg.inscricoes_abertas THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO ocupadas
    FROM public.lancamento_vagas
    WHERE status <> 'cancelado';

    IF ocupadas >= cfg.vagas_total THEN
        RETURN NULL;
    END IF;

    -- Menor posição livre (reaproveita número de vaga cancelada)
    SELECT COALESCE(MIN(n), 1) INTO proxima
    FROM generate_series(1, cfg.vagas_total) AS n
    WHERE NOT EXISTS (
        SELECT 1 FROM public.lancamento_vagas v
        WHERE v.posicao = n AND v.status <> 'cancelado'
    );

    INSERT INTO public.lancamento_vagas (
        user_id, cliente_id, posicao, nome, email, teste_inicio, teste_fim
    ) VALUES (
        p_user_id, p_cliente_id, proxima, p_nome, p_email,
        now(), now() + make_interval(days => cfg.dias_teste)
    )
    RETURNING * INTO vaga;

    RETURN vaga;
END;
$$;

-- 6) RLS: leitura/escrita só para admin (as rotas usam service key)
ALTER TABLE public.lancamento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamento_vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lancamento_config_admin ON public.lancamento_config;
CREATE POLICY lancamento_config_admin ON public.lancamento_config
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS lancamento_vagas_admin ON public.lancamento_vagas;
CREATE POLICY lancamento_vagas_admin ON public.lancamento_vagas
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- O construtor enxerga a própria vaga (dias restantes do teste)
DROP POLICY IF EXISTS lancamento_vagas_dono ON public.lancamento_vagas;
CREATE POLICY lancamento_vagas_dono ON public.lancamento_vagas
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS lista_espera_admin ON public.lista_espera;
CREATE POLICY lista_espera_admin ON public.lista_espera
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 7) Permissões das funções
--    A situação da turma é pública (a landing mostra as vagas restantes).
GRANT EXECUTE ON FUNCTION public.status_turma_lancamento() TO anon, authenticated, service_role;

--    A reserva só pode ser chamada pelo backend (rota de cadastro, service key).
REVOKE EXECUTE ON FUNCTION public.reservar_vaga_lancamento(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reservar_vaga_lancamento(UUID, UUID, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_vaga_lancamento(UUID, UUID, TEXT, TEXT) TO service_role;

-- Faz o PostgREST recarregar o cache de schema e enxergar as funções novas
NOTIFY pgrst, 'reload schema';
