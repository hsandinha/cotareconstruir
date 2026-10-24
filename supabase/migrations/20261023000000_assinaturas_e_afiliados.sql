-- =====================================================
-- Assinatura (cobrança por obra) + Programa de Afiliados
--
-- Hoje a plataforma não cobra nada: a turma de lançamento dá 30 dias de teste
-- e `lancamento_vagas.status = 'convertido'` nunca é preenchido porque não há
-- o que converter. Os Termos já prometem "assinatura mensal por obra" — estas
-- tabelas são o que torna isso real, e servem de base de cálculo para a
-- comissão dos parceiros.
--
--   cobranca_config       — o que é cobrado, quanto, com que gateway
--   assinaturas           — uma linha por coisa cobrada (obra, cliente ou conta)
--   pagamentos            — cada cobrança emitida e seu desfecho
--   afiliados             — parceiros que vendem, cada um com sua negociação
--   afiliado_cliques      — quem chegou por link de parceiro
--   afiliado_indicacoes   — de quem é cada cliente, com os termos congelados
--   afiliado_comissoes    — o extrato, alimentado por pagamento confirmado
--
-- Três decisões estruturais que o resto do sistema depende:
--
-- 1. DINHEIRO EM CENTAVOS (INTEGER). Nunca em float — 499.00 em ponto
--    flutuante vira 498.99999 e a comissão de 20% erra o centavo.
--
-- 2. TERMOS CONGELADOS. `assinaturas` guarda o preço e o modelo vigentes
--    quando foi criada, e `afiliado_indicacoes` guarda o percentual e a
--    duração acordados quando o cliente entrou. Mudar o preço de tabela ou
--    renegociar com o parceiro NÃO pode reescrever o passado de ninguém.
--
-- 3. A JANELA DA COMISSÃO CONTA DO PRIMEIRO PAGAMENTO, não do cadastro.
--    Com 30 dias de teste, contar do cadastro queimaria o primeiro mês do
--    parceiro com um período em que ninguém pagou nada.
-- =====================================================

-- =====================================================
-- 1) CONFIGURAÇÃO DA COBRANÇA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cobranca_config (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),

    -- O QUE é cobrado. 'por_obra' = uma assinatura por obra cadastrada
    -- (o modelo escolhido); 'por_cliente' = uma por cliente, quantas obras
    -- ele tiver; 'por_conta' = uma por login.
    modelo TEXT NOT NULL DEFAULT 'por_obra'
        CHECK (modelo IN ('por_obra', 'por_cliente', 'por_conta')),

    valor_centavos INTEGER NOT NULL DEFAULT 49900 CHECK (valor_centavos >= 0),

    ciclo TEXT NOT NULL DEFAULT 'mensal'
        CHECK (ciclo IN ('mensal', 'trimestral', 'semestral', 'anual')),

    -- Teste grátis antes da primeira cobrança. 0 = cobra na hora.
    dias_trial INTEGER NOT NULL DEFAULT 30 CHECK (dias_trial >= 0),

    -- Dias entre o vencimento e o corte do acesso por inadimplência.
    dias_tolerancia INTEGER NOT NULL DEFAULT 5 CHECK (dias_tolerancia >= 0),

    gateway TEXT NOT NULL DEFAULT 'asaas'
        CHECK (gateway IN ('asaas', 'manual')),
    ambiente TEXT NOT NULL DEFAULT 'sandbox'
        CHECK (ambiente IN ('sandbox', 'producao')),

    -- Chave geral. Enquanto FALSE, nada é cobrado e nenhuma assinatura é
    -- criada automaticamente — é o estado de hoje, com a turma em teste.
    -- Ligar isto é uma decisão de negócio, não um efeito colateral do deploy.
    cobranca_ativa BOOLEAN NOT NULL DEFAULT FALSE,

    -- Padrões do programa de afiliados. Cada parceiro pode ter os seus
    -- (ver `afiliados`); isto é só o ponto de partida de um cadastro novo.
    afiliado_percentual_padrao NUMERIC(5,2) NOT NULL DEFAULT 20
        CHECK (afiliado_percentual_padrao >= 0 AND afiliado_percentual_padrao <= 100),
    -- NULL = vitalício
    afiliado_duracao_meses_padrao INTEGER DEFAULT 12
        CHECK (afiliado_duracao_meses_padrao IS NULL OR afiliado_duracao_meses_padrao > 0),
    -- Dias que o clique no link do parceiro continua valendo para atribuir
    -- um cadastro a ele.
    afiliado_janela_dias INTEGER NOT NULL DEFAULT 90
        CHECK (afiliado_janela_dias > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.cobranca_config (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2) ASSINATURAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    -- Preenchido só quando `modelo = 'por_obra'`. É o que permite cobrar
    -- R$ 499 por obra e cortar o acesso de uma obra sem derrubar as outras.
    obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,

    -- Congelados na criação (ver cabeçalho): mudar a tabela de preços não
    -- reajusta quem já assinou.
    modelo TEXT NOT NULL CHECK (modelo IN ('por_obra', 'por_cliente', 'por_conta')),
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
    ciclo TEXT NOT NULL CHECK (ciclo IN ('mensal', 'trimestral', 'semestral', 'anual')),

    status TEXT NOT NULL DEFAULT 'trial'
        CHECK (status IN ('trial', 'ativa', 'inadimplente', 'cancelada', 'encerrada')),

    trial_fim TIMESTAMPTZ,
    inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
    proxima_cobranca DATE,
    cancelada_em TIMESTAMPTZ,
    motivo_cancelamento TEXT,

    gateway TEXT CHECK (gateway IN ('asaas', 'manual')),
    gateway_assinatura_id TEXT,
    gateway_cliente_id TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma obra não pode ter duas assinaturas vivas ao mesmo tempo. Cancelada e
-- encerrada ficam de fora para permitir reassinar depois.
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_obra_viva_idx
    ON public.assinaturas (obra_id)
    WHERE obra_id IS NOT NULL AND status IN ('trial', 'ativa', 'inadimplente');

-- Mesma ideia para os modelos que cobram por cliente/conta.
CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_cliente_viva_idx
    ON public.assinaturas (cliente_id)
    WHERE obra_id IS NULL AND status IN ('trial', 'ativa', 'inadimplente');

CREATE UNIQUE INDEX IF NOT EXISTS assinaturas_gateway_id_idx
    ON public.assinaturas (gateway_assinatura_id)
    WHERE gateway_assinatura_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS assinaturas_cliente_idx ON public.assinaturas (cliente_id);
CREATE INDEX IF NOT EXISTS assinaturas_status_idx ON public.assinaturas (status);
CREATE INDEX IF NOT EXISTS assinaturas_cobranca_idx
    ON public.assinaturas (proxima_cobranca)
    WHERE status IN ('trial', 'ativa', 'inadimplente');

-- =====================================================
-- 3) PAGAMENTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    assinatura_id UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,

    -- Mês de referência, sempre no dia 1. É a chave que impede cobrar (e
    -- comissionar) o mesmo período duas vezes.
    competencia DATE NOT NULL,

    valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),

    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'confirmado', 'vencido', 'estornado', 'cancelado')),

    vencimento DATE,
    pago_em TIMESTAMPTZ,
    forma_pagamento TEXT,          -- PIX, BOLETO, CREDIT_CARD... como o Asaas devolve

    gateway TEXT CHECK (gateway IN ('asaas', 'manual')),
    -- UNIQUE: é o que torna o webhook idempotente. O Asaas reenvia o evento
    -- quando não recebe 200, e sem isto o reenvio geraria comissão em dobro.
    gateway_pagamento_id TEXT,
    payload JSONB,                 -- evento cru, para auditar caso raro

    -- Quem registrou, quando a cobrança é lançada à mão pelo admin
    registrado_por UUID REFERENCES public.users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_gateway_id_idx
    ON public.pagamentos (gateway_pagamento_id)
    WHERE gateway_pagamento_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_competencia_idx
    ON public.pagamentos (assinatura_id, competencia)
    WHERE status <> 'cancelado';

CREATE INDEX IF NOT EXISTS pagamentos_status_idx ON public.pagamentos (status, competencia DESC);

-- =====================================================
-- 4) AFILIADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.afiliados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vai no link: comprareconstruir.com/?ref=<codigo>
    codigo TEXT NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9]{4,20}$'),

    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT,
    documento TEXT,                -- CPF/CNPJ de quem recebe
    chave_pix TEXT,

    -- Cada parceiro é uma negociação própria: percentual e duração ficam
    -- aqui, não numa regra global. NULL em duracao_meses = vitalício.
    percentual NUMERIC(5,2) NOT NULL DEFAULT 20
        CHECK (percentual >= 0 AND percentual <= 100),
    duracao_meses INTEGER CHECK (duracao_meses IS NULL OR duracao_meses > 0),

    status TEXT NOT NULL DEFAULT 'ativo'
        CHECK (status IN ('ativo', 'pausado', 'encerrado')),

    -- Se um dia o parceiro tiver login próprio para ver o painel dele
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    observacoes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS afiliados_status_idx ON public.afiliados (status);

-- ---------- Cliques ----------
-- Só para medir o funil do parceiro (quantos cliques viraram cadastro).
-- A atribuição em si é decidida no cadastro, pelo cookie.
CREATE TABLE IF NOT EXISTS public.afiliado_cliques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_id UUID NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,

    -- Id anônimo do cookie. Não guardamos IP: identifica pessoa e não
    -- acrescenta nada que o cookie já não resolva (LGPD).
    visitante TEXT NOT NULL,
    destino TEXT,                  -- página onde caiu
    utm JSONB,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS afiliado_cliques_afiliado_idx
    ON public.afiliado_cliques (afiliado_id, created_at DESC);
CREATE INDEX IF NOT EXISTS afiliado_cliques_visitante_idx
    ON public.afiliado_cliques (visitante);

-- ---------- Indicações ----------
CREATE TABLE IF NOT EXISTS public.afiliado_indicacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_id UUID NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,

    -- UNIQUE: um cliente pertence a um parceiro e pronto. Sem isto, dois
    -- parceiros poderiam reivindicar o mesmo cliente e a comissão dobraria.
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,

    codigo TEXT NOT NULL,          -- código usado, como veio no link

    -- Termos congelados no momento do cadastro. Renegociar com o parceiro
    -- vale para quem ele trouxer DEPOIS, nunca para trás.
    percentual NUMERIC(5,2) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
    duracao_meses INTEGER CHECK (duracao_meses IS NULL OR duracao_meses > 0),

    clicou_em TIMESTAMPTZ,
    cadastrou_em TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Preenchidos no PRIMEIRO pagamento confirmado deste cliente. A janela de
    -- comissão conta daqui, não do cadastro (ver cabeçalho).
    comissao_inicio DATE,
    comissao_fim DATE,             -- NULL com duracao_meses NULL = vitalício

    status TEXT NOT NULL DEFAULT 'cadastrado'
        CHECK (status IN ('cadastrado', 'pagante', 'encerrado', 'cancelado')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS afiliado_indicacoes_afiliado_idx
    ON public.afiliado_indicacoes (afiliado_id, cadastrou_em DESC);
CREATE INDEX IF NOT EXISTS afiliado_indicacoes_cliente_idx
    ON public.afiliado_indicacoes (cliente_id);

-- ---------- Comissões ----------
CREATE TABLE IF NOT EXISTS public.afiliado_comissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_id UUID NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,
    indicacao_id UUID NOT NULL REFERENCES public.afiliado_indicacoes(id) ON DELETE CASCADE,

    -- UNIQUE: uma comissão por pagamento. Junto com o UNIQUE de
    -- `pagamentos.gateway_pagamento_id`, é o que garante que reprocessar o
    -- webhook do Asaas não paga o parceiro duas vezes.
    pagamento_id UUID NOT NULL UNIQUE REFERENCES public.pagamentos(id) ON DELETE CASCADE,

    competencia DATE NOT NULL,
    base_centavos INTEGER NOT NULL CHECK (base_centavos >= 0),
    percentual NUMERIC(5,2) NOT NULL,
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),

    status TEXT NOT NULL DEFAULT 'prevista'
        CHECK (status IN ('prevista', 'aprovada', 'paga', 'cancelada')),

    pago_em TIMESTAMPTZ,
    comprovante TEXT,
    observacao TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS afiliado_comissoes_afiliado_idx
    ON public.afiliado_comissoes (afiliado_id, competencia DESC);
CREATE INDEX IF NOT EXISTS afiliado_comissoes_status_idx
    ON public.afiliado_comissoes (status);

-- =====================================================
-- 5) updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION public.toca_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'cobranca_config', 'assinaturas', 'pagamentos',
        'afiliados', 'afiliado_indicacoes', 'afiliado_comissoes'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %1$s_updated_at ON public.%1$s;
             CREATE TRIGGER %1$s_updated_at BEFORE UPDATE ON public.%1$s
             FOR EACH ROW EXECUTE FUNCTION public.toca_updated_at();', t);
    END LOOP;
END $$;

-- =====================================================
-- 6) RLS
--
-- Dados financeiros e de parceiros: leitura só para admin. A escrita vem do
-- servidor (rotas /api com service_role, que ignora RLS), então não há
-- policy de INSERT/UPDATE para usuário logado em lugar nenhum.
--
-- Exceção: o cliente precisa enxergar a própria assinatura para o painel
-- dele saber se está em teste, ativo ou cortado.
-- =====================================================

ALTER TABLE public.cobranca_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_cliques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cobranca_config_admin ON public.cobranca_config;
CREATE POLICY cobranca_config_admin ON public.cobranca_config
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS assinaturas_admin ON public.assinaturas;
CREATE POLICY assinaturas_admin ON public.assinaturas
    FOR SELECT TO authenticated USING (is_admin());

-- O dono vê a própria assinatura (o painel precisa saber o status do acesso)
DROP POLICY IF EXISTS assinaturas_propria ON public.assinaturas;
CREATE POLICY assinaturas_propria ON public.assinaturas
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS pagamentos_admin ON public.pagamentos;
CREATE POLICY pagamentos_admin ON public.pagamentos
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS afiliados_admin ON public.afiliados;
CREATE POLICY afiliados_admin ON public.afiliados
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS afiliado_cliques_admin ON public.afiliado_cliques;
CREATE POLICY afiliado_cliques_admin ON public.afiliado_cliques
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS afiliado_indicacoes_admin ON public.afiliado_indicacoes;
CREATE POLICY afiliado_indicacoes_admin ON public.afiliado_indicacoes
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS afiliado_comissoes_admin ON public.afiliado_comissoes;
CREATE POLICY afiliado_comissoes_admin ON public.afiliado_comissoes
    FOR SELECT TO authenticated USING (is_admin());

-- =====================================================
-- 7) Resolver código de afiliado sem expor a tabela
--
-- A landing precisa saber se `?ref=XPTO` existe para registrar o clique,
-- mas `afiliados` tem e-mail, documento e chave PIX de terceiros — nada
-- disso pode vazar para visitante anônimo. A função devolve só o id.
-- =====================================================

CREATE OR REPLACE FUNCTION public.afiliado_por_codigo(p_codigo TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT id FROM public.afiliados
     WHERE codigo = upper(trim(p_codigo))
       AND status = 'ativo'
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.afiliado_por_codigo(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.afiliado_por_codigo(TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
