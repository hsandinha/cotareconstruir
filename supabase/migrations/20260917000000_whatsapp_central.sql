-- =====================================================
-- Central de WhatsApp
--
-- Hoje o WhatsApp é de mão única: a plataforma dispara notificações pela
-- Meta Cloud API e o que o cliente responde se perde (o webhook gravava em
-- `whatsapp_logs`, tabela que nunca existiu — todo insert falhava calado).
--
-- Estas duas tabelas dão memória ao canal:
--   whatsapp_conversas — uma linha por número, com o resumo que a lista usa
--   whatsapp_mensagens — o histórico, entrada e saída, na mesma linha do tempo
--
-- A janela de 24h da Meta (só dá para mandar texto livre até 24h depois da
-- ÚLTIMA mensagem do contato) sai de `ultima_entrada_em`, mantido pelo
-- trigger — fora dela, só template aprovado.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Só dígitos, com DDI (5531999998888). É como a Meta identifica o contato.
    telefone TEXT NOT NULL UNIQUE,
    nome_contato TEXT,               -- nome do perfil do WhatsApp, quando vem

    -- Quem é essa pessoa na plataforma. Preenchido por whatsapp_vincular_contato().
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Resumo para a lista de conversas não precisar varrer as mensagens
    ultima_mensagem_texto TEXT,
    ultima_mensagem_em TIMESTAMPTZ,
    ultima_mensagem_direcao TEXT CHECK (ultima_mensagem_direcao IN ('entrada', 'saida')),

    -- Última mensagem RECEBIDA: é daqui que sai a janela de 24h da Meta
    ultima_entrada_em TIMESTAMPTZ,

    nao_lidas INTEGER NOT NULL DEFAULT 0,
    arquivada BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ordem padrão da central: mais recente primeiro, arquivadas fora
CREATE INDEX IF NOT EXISTS whatsapp_conversas_recentes_idx
    ON public.whatsapp_conversas (ultima_mensagem_em DESC NULLS LAST)
    WHERE NOT arquivada;

CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,

    -- ID da Meta (wamid...). UNIQUE porque a Meta reenvia o webhook quando
    -- não recebe 200 — sem isso a mesma mensagem apareceria duas vezes.
    wa_message_id TEXT UNIQUE,

    direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
    tipo TEXT NOT NULL DEFAULT 'text',
    texto TEXT,                      -- corpo do texto ou preview do template

    -- Saída por template: o que foi disparado e com quais variáveis
    template_nome TEXT,
    template_params JSONB,

    -- Mídia recebida: guardamos o ID da Meta; o binário é buscado sob demanda
    -- por /api/admin/whatsapp/media (o link direto da Meta expira em 5 min).
    media_id TEXT,
    media_mime TEXT,
    media_nome TEXT,

    -- entrada: 'recebida' | saída: pendente, enviada, entregue, lida, falhou
    status TEXT NOT NULL DEFAULT 'recebida'
        CHECK (status IN ('recebida', 'pendente', 'enviada', 'entregue', 'lida', 'falhou')),
    erro JSONB,

    -- 'automatica' = disparo do sistema; 'central' = alguém respondeu na tela
    origem TEXT NOT NULL DEFAULT 'automatica'
        CHECK (origem IN ('automatica', 'central', 'recebida')),
    enviada_por UUID REFERENCES public.users(id) ON DELETE SET NULL,

    payload JSONB,                   -- webhook cru, para depurar caso raro

    criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_mensagens_conversa_idx
    ON public.whatsapp_mensagens (conversa_id, criada_em DESC);

-- -----------------------------------------------------
-- Trigger: cada mensagem atualiza o resumo da conversa
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_atualiza_conversa()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.whatsapp_conversas
    SET ultima_mensagem_texto = COALESCE(
            NEW.texto,
            CASE NEW.tipo
                WHEN 'image' THEN '[imagem]'
                WHEN 'audio' THEN '[áudio]'
                WHEN 'video' THEN '[vídeo]'
                WHEN 'document' THEN '[documento]'
                WHEN 'location' THEN '[localização]'
                ELSE '[' || NEW.tipo || ']'
            END
        ),
        ultima_mensagem_em = NEW.criada_em,
        ultima_mensagem_direcao = NEW.direcao,
        -- Só mensagem recebida reabre a janela de 24h
        ultima_entrada_em = CASE WHEN NEW.direcao = 'entrada'
                                 THEN NEW.criada_em ELSE ultima_entrada_em END,
        nao_lidas = CASE WHEN NEW.direcao = 'entrada'
                         THEN nao_lidas + 1 ELSE nao_lidas END,
        -- Conversa arquivada volta para a lista quando o contato escreve
        arquivada = CASE WHEN NEW.direcao = 'entrada' THEN FALSE ELSE arquivada END,
        updated_at = now()
    WHERE id = NEW.conversa_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS whatsapp_mensagens_resumo ON public.whatsapp_mensagens;
CREATE TRIGGER whatsapp_mensagens_resumo
    AFTER INSERT ON public.whatsapp_mensagens
    FOR EACH ROW EXECUTE FUNCTION public.whatsapp_atualiza_conversa();

-- -----------------------------------------------------
-- Vincular o número a fornecedor / cliente / usuário
--
-- Os telefones no cadastro estão em formatos variados — "(31) 99999-8888",
-- "31999998888", "+55 31 9 9999-8888". Comparamos só os 8 últimos dígitos,
-- que é o que não muda entre o nono dígito, o DDI e a máscara.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.whatsapp_vincular_contato(p_conversa_id UUID)
RETURNS VOID AS $$
DECLARE
    v_sufixo TEXT;
BEGIN
    SELECT right(regexp_replace(telefone, '\D', '', 'g'), 8)
      INTO v_sufixo
      FROM public.whatsapp_conversas
     WHERE id = p_conversa_id;

    IF v_sufixo IS NULL OR length(v_sufixo) < 8 THEN
        RETURN;
    END IF;

    UPDATE public.whatsapp_conversas c
    SET fornecedor_id = COALESCE(c.fornecedor_id, (
            SELECT f.id FROM public.fornecedores f
             WHERE right(regexp_replace(COALESCE(NULLIF(f.whatsapp, ''), f.telefone, ''), '\D', '', 'g'), 8) = v_sufixo
             ORDER BY f.created_at LIMIT 1
        )),
        cliente_id = COALESCE(c.cliente_id, (
            SELECT cl.id FROM public.clientes cl
             WHERE right(regexp_replace(COALESCE(NULLIF(cl.whatsapp, ''), cl.telefone, ''), '\D', '', 'g'), 8) = v_sufixo
             ORDER BY cl.created_at LIMIT 1
        )),
        user_id = COALESCE(c.user_id, (
            SELECT u.id FROM public.users u
             WHERE right(regexp_replace(COALESCE(u.telefone, ''), '\D', '', 'g'), 8) = v_sufixo
             ORDER BY u.created_at LIMIT 1
        )),
        updated_at = now()
    WHERE c.id = p_conversa_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- A função varre cadastro inteiro: só o servidor chama (rotas /api/admin)
REVOKE ALL ON FUNCTION public.whatsapp_vincular_contato(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_vincular_contato(UUID) TO service_role;

-- -----------------------------------------------------
-- RLS: conversa de WhatsApp é dado sensível de cliente — só admin lê.
-- A gravação vem do webhook e das rotas /api/admin, ambas com service_role
-- (que ignora RLS), então não há policy de escrita para usuário logado.
-- -----------------------------------------------------
ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversas_admin ON public.whatsapp_conversas;
CREATE POLICY whatsapp_conversas_admin ON public.whatsapp_conversas
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS whatsapp_mensagens_admin ON public.whatsapp_mensagens;
CREATE POLICY whatsapp_mensagens_admin ON public.whatsapp_mensagens
    FOR SELECT TO authenticated USING (is_admin());

NOTIFY pgrst, 'reload schema';
