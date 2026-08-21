-- =====================================================
-- Teste gratuito: limite de obras + convite automático da fila
--
-- 1) LIMITE DE OBRAS
--    O teste dá direito a `lancamento_config.obras_por_conta` obra(s).
--    A trava fica no banco porque a tela de Obras insere direto em `obras`
--    pelo cliente — validar só no front deixaria a regra contornável.
--    Quem não está na turma (contas antigas, admin) ou já converteu para
--    pagante não tem limite.
--
-- 2) CONVITE DA FILA
--    Convidar alguém da fila passa a gerar um token com validade. O link
--    do e-mail leva ao cadastro já identificado, e o token permite entrar
--    mesmo com as inscrições fechadas — desde que ainda haja vaga.
-- =====================================================

-- ---------- 1) Convite na fila de espera ----------
ALTER TABLE public.lista_espera
    ADD COLUMN IF NOT EXISTS convite_token TEXT,
    ADD COLUMN IF NOT EXISTS convite_expira_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cadastrado_em TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS lista_espera_convite_token_idx
    ON public.lista_espera (convite_token)
    WHERE convite_token IS NOT NULL;

/** Dados do convite quando o token é válido; nenhuma linha caso contrário. */
CREATE OR REPLACE FUNCTION public.validar_convite_lancamento(p_token TEXT)
RETURNS TABLE (nome TEXT, email TEXT, expira_em TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT le.nome, le.email, le.convite_expira_em
    FROM public.lista_espera le
    WHERE le.convite_token = p_token
      AND le.cadastrado_em IS NULL
      AND (le.convite_expira_em IS NULL OR le.convite_expira_em > now());
END;
$$;

-- ---------- 2) Reserva de vaga com convite ----------
-- Substitui a versão de 20260821000000: ganha `p_convite_token`, que libera
-- a entrada mesmo com inscrições fechadas (a vaga ainda precisa existir).
CREATE OR REPLACE FUNCTION public.reservar_vaga_lancamento(
    p_user_id UUID,
    p_cliente_id UUID,
    p_nome TEXT,
    p_email TEXT,
    p_convite_token TEXT DEFAULT NULL
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
    convite_valido BOOLEAN := FALSE;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('turma_lancamento'));

    -- Recadastro do mesmo usuário devolve a vaga que ele já tem
    SELECT * INTO vaga FROM public.lancamento_vagas WHERE user_id = p_user_id;
    IF FOUND THEN
        RETURN vaga;
    END IF;

    SELECT * INTO cfg FROM public.lancamento_config WHERE id IS TRUE;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF p_convite_token IS NOT NULL THEN
        SELECT TRUE INTO convite_valido
        FROM public.lista_espera le
        WHERE le.convite_token = p_convite_token
          AND le.cadastrado_em IS NULL
          AND (le.convite_expira_em IS NULL OR le.convite_expira_em > now());
        convite_valido := COALESCE(convite_valido, FALSE);
    END IF;

    -- Convite fura a fila fechada, mas nunca o total de vagas
    IF NOT cfg.inscricoes_abertas AND NOT convite_valido THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO ocupadas
    FROM public.lancamento_vagas
    WHERE status <> 'cancelado';

    IF ocupadas >= cfg.vagas_total THEN
        RETURN NULL;
    END IF;

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

    -- Fecha o convite e tira o lead da fila de pendentes
    IF convite_valido THEN
        UPDATE public.lista_espera
        SET cadastrado_em = now(), convite_token = NULL
        WHERE convite_token = p_convite_token;
    ELSE
        UPDATE public.lista_espera
        SET cadastrado_em = now(), convite_token = NULL
        WHERE lower(email) = lower(p_email) AND cadastrado_em IS NULL;
    END IF;

    RETURN vaga;
END;
$$;

-- A assinatura antiga (4 argumentos) some para não ficarem duas versões
DROP FUNCTION IF EXISTS public.reservar_vaga_lancamento(UUID, UUID, TEXT, TEXT);

-- ---------- 3) Limite de obras no teste gratuito ----------
/**
 * Quantas obras esta conta ainda pode cadastrar.
 * NULL = sem limite (fora da turma, vaga cancelada ou já convertido).
 */
CREATE OR REPLACE FUNCTION public.limite_obras_do_usuario(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    vaga_status TEXT;
    limite INTEGER;
BEGIN
    SELECT status INTO vaga_status
    FROM public.lancamento_vagas
    WHERE user_id = p_user_id;

    -- Sem vaga na turma, vaga cancelada pelo admin ou já pagante: sem limite
    IF NOT FOUND OR vaga_status IN ('cancelado', 'convertido') THEN
        RETURN NULL;
    END IF;

    SELECT obras_por_conta INTO limite FROM public.lancamento_config WHERE id IS TRUE;
    RETURN COALESCE(limite, 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.checar_limite_obras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    limite INTEGER;
    atuais INTEGER;
BEGIN
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    limite := public.limite_obras_do_usuario(NEW.user_id);
    IF limite IS NULL THEN
        RETURN NEW;
    END IF;

    -- Obra cancelada não ocupa lugar
    SELECT count(*) INTO atuais
    FROM public.obras
    WHERE user_id = NEW.user_id
      AND COALESCE(status, 'ativa') <> 'cancelada';

    IF atuais >= limite THEN
        RAISE EXCEPTION 'limite_obras_teste_gratuito'
            USING ERRCODE = 'check_violation',
                  HINT = 'O teste gratuito permite ' || limite || ' obra(s). Assine para cadastrar mais.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS obras_limite_teste_gratuito ON public.obras;
CREATE TRIGGER obras_limite_teste_gratuito
    BEFORE INSERT ON public.obras
    FOR EACH ROW
    EXECUTE FUNCTION public.checar_limite_obras();

-- ---------- 4) Permissões ----------
GRANT EXECUTE ON FUNCTION public.limite_obras_do_usuario(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validar_convite_lancamento(TEXT) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reservar_vaga_lancamento(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reservar_vaga_lancamento(UUID, UUID, TEXT, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_vaga_lancamento(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
