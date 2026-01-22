-- =====================================================
-- COTAR & CONSTRUIR - Schema Supabase (PostgreSQL)
-- Migração de Firestore NoSQL para SQL Relacional
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELAS PRINCIPAIS
-- =====================================================

-- USUÁRIOS (extende auth.users do Supabase)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nome TEXT,
    role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('admin', 'cliente', 'fornecedor')),
    roles TEXT[] DEFAULT ARRAY['cliente'],
    telefone TEXT,
    cpf_cnpj TEXT,
    avatar_url TEXT,
    
    -- Para fornecedores
    fornecedor_id UUID,
    
    -- Para clientes
    cliente_id UUID,
    
    -- 2FA
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    
    -- Metadata
    is_verified BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FASES DA OBRA
CREATE TABLE public.fases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cronologia INTEGER NOT NULL,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SERVIÇOS
CREATE TABLE public.servicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GRUPOS DE INSUMO
CREATE TABLE public.grupos_insumo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MATERIAIS
CREATE TABLE public.materiais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    unidade TEXT NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FORNECEDORES
CREATE TABLE public.fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT UNIQUE,
    email TEXT,
    telefone TEXT,
    
    -- Endereço
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    
    -- Configurações
    regioes_atendimento TEXT[],
    prazo_entrega_padrao INTEGER DEFAULT 7,
    
    -- Status
    is_verified BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    razao_social TEXT,
    nome TEXT NOT NULL,
    cpf_cnpj TEXT,
    email TEXT,
    telefone TEXT,
    
    -- Endereço
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OBRAS
CREATE TABLE public.obras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT,
    etapa TEXT, -- Fase atual da obra
    fase_id UUID REFERENCES public.fases(id) ON DELETE SET NULL,
    
    -- Endereço
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    
    -- Datas
    data_inicio DATE,
    data_previsao_fim DATE,
    
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'concluida', 'cancelada')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FABRICANTES
CREATE TABLE public.fabricantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    logo_url TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELAS DE RELACIONAMENTO (MANY-TO-MANY)
-- =====================================================

-- SERVIÇO <-> FASE (um serviço pode estar em múltiplas fases)
CREATE TABLE public.servico_fase (
    servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE,
    fase_id UUID REFERENCES public.fases(id) ON DELETE CASCADE,
    PRIMARY KEY (servico_id, fase_id)
);

-- SERVIÇO <-> GRUPO DE INSUMO
CREATE TABLE public.servico_grupo (
    servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES public.grupos_insumo(id) ON DELETE CASCADE,
    PRIMARY KEY (servico_id, grupo_id)
);

-- MATERIAL <-> GRUPO DE INSUMO
CREATE TABLE public.material_grupo (
    material_id UUID REFERENCES public.materiais(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES public.grupos_insumo(id) ON DELETE CASCADE,
    PRIMARY KEY (material_id, grupo_id)
);

-- FORNECEDOR <-> GRUPO DE INSUMO (grupos que o fornecedor atende)
CREATE TABLE public.fornecedor_grupo (
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES public.grupos_insumo(id) ON DELETE CASCADE,
    PRIMARY KEY (fornecedor_id, grupo_id)
);

-- FORNECEDOR <-> FABRICANTE (fabricantes que o fornecedor representa)
CREATE TABLE public.fornecedor_fabricante (
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    fabricante_id UUID REFERENCES public.fabricantes(id) ON DELETE CASCADE,
    PRIMARY KEY (fornecedor_id, fabricante_id)
);

-- =====================================================
-- TABELAS DE NEGÓCIO
-- =====================================================

-- PRODUTOS DO FORNECEDOR (materiais que o fornecedor vende)
CREATE TABLE public.fornecedor_materiais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
    
    -- Preço e estoque
    preco DECIMAL(12,2) NOT NULL,
    preco_promocional DECIMAL(12,2),
    estoque INTEGER DEFAULT 0,
    estoque_minimo INTEGER DEFAULT 0,
    
    -- Detalhes
    marca TEXT,
    fabricante_id UUID REFERENCES public.fabricantes(id) ON DELETE SET NULL,
    codigo_sku TEXT,
    descricao TEXT,
    
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(fornecedor_id, material_id)
);

-- OFERTAS (promoções dos fornecedores)
CREATE TABLE public.ofertas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    fornecedor_material_id UUID NOT NULL REFERENCES public.fornecedor_materiais(id) ON DELETE CASCADE,
    
    -- Dados do material (desnormalizado para performance)
    material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
    material_nome TEXT NOT NULL,
    material_unidade TEXT NOT NULL,
    
    -- Oferta
    tipo_oferta TEXT NOT NULL CHECK (tipo_oferta IN ('valor', 'percentual')),
    valor_oferta DECIMAL(12,2) NOT NULL,
    preco_original DECIMAL(12,2) NOT NULL,
    preco_final DECIMAL(12,2) NOT NULL,
    desconto_percentual DECIMAL(5,2),
    
    -- Condições
    quantidade_minima INTEGER DEFAULT 1,
    estoque INTEGER DEFAULT 0,
    
    -- Período
    data_inicio TIMESTAMPTZ DEFAULT NOW(),
    data_fim TIMESTAMPTZ,
    
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COTAÇÕES
CREATE TABLE public.cotacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
    
    -- Status
    status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviada', 'em_analise', 'respondida', 'fechada', 'cancelada')),
    
    -- Datas
    data_envio TIMESTAMPTZ,
    data_validade TIMESTAMPTZ,
    
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ITENS DA COTAÇÃO
CREATE TABLE public.cotacao_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materiais(id) ON DELETE SET NULL,
    
    nome TEXT NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL,
    unidade TEXT NOT NULL,
    grupo TEXT,
    observacao TEXT,
    
    -- Contexto (de qual fase/serviço veio)
    fase_nome TEXT,
    servico_nome TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROPOSTAS (respostas dos fornecedores às cotações)
CREATE TABLE public.propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviada', 'aceita', 'recusada', 'expirada')),
    
    valor_total DECIMAL(12,2),
    prazo_entrega INTEGER, -- dias
    condicoes_pagamento TEXT,
    observacoes TEXT,
    
    data_envio TIMESTAMPTZ,
    data_validade TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ITENS DA PROPOSTA
CREATE TABLE public.proposta_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
    cotacao_item_id UUID NOT NULL REFERENCES public.cotacao_itens(id) ON DELETE CASCADE,
    fornecedor_material_id UUID REFERENCES public.fornecedor_materiais(id) ON DELETE SET NULL,
    
    preco_unitario DECIMAL(12,2) NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    
    disponibilidade TEXT DEFAULT 'disponivel' CHECK (disponibilidade IN ('disponivel', 'sob_consulta', 'indisponivel')),
    prazo_dias INTEGER,
    observacao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PEDIDOS
CREATE TABLE public.pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposta_id UUID REFERENCES public.propostas(id) ON DELETE SET NULL,
    cotacao_id UUID REFERENCES public.cotacoes(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
    
    numero TEXT UNIQUE,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'em_preparacao', 'enviado', 'entregue', 'cancelado')),
    
    valor_total DECIMAL(12,2) NOT NULL,
    forma_pagamento TEXT,
    condicoes_pagamento TEXT,
    
    data_confirmacao TIMESTAMPTZ,
    data_previsao_entrega DATE,
    data_entrega TIMESTAMPTZ,
    
    endereco_entrega JSONB,
    observacoes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ITENS DO PEDIDO
CREATE TABLE public.pedido_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materiais(id) ON DELETE SET NULL,
    fornecedor_material_id UUID REFERENCES public.fornecedor_materiais(id) ON DELETE SET NULL,
    
    nome TEXT NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL,
    unidade TEXT NOT NULL,
    preco_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELAS DE SUPORTE
-- =====================================================

-- NOTIFICAÇÕES
CREATE TABLE public.notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    link TEXT,
    
    lida BOOLEAN DEFAULT FALSE,
    data_leitura TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHAT/MENSAGENS
CREATE TABLE public.mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    conteudo TEXT NOT NULL,
    tipo TEXT DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'arquivo')),
    arquivo_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AVALIAÇÕES
CREATE TABLE public.avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avaliador_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
    
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comentario TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOG
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOLICITAÇÕES DE MATERIAIS (fornecedores pedem novos materiais)
CREATE TABLE public.solicitacoes_materiais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    
    nome TEXT NOT NULL,
    unidade TEXT NOT NULL,
    grupo_sugerido TEXT,
    descricao TEXT,
    
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')),
    resposta_admin TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PASSWORD RESETS (tokens para recuperação de senha)
CREATE TABLE public.password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REPORTS/DENÚNCIAS (usuários reportam problemas)
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Tipo e entidade reportada
    tipo TEXT NOT NULL CHECK (tipo IN ('fornecedor', 'pedido', 'proposta', 'usuario', 'oferta', 'outro')),
    entity_type TEXT, -- tipo da entidade reportada (fornecedores, pedidos, etc)
    entity_id UUID, -- ID da entidade reportada
    
    -- Detalhes da denúncia
    motivo TEXT NOT NULL CHECK (motivo IN (
        'fraude', 
        'produto_falso', 
        'nao_entregou', 
        'qualidade_ruim', 
        'comportamento_inadequado',
        'preco_abusivo',
        'spam',
        'outro'
    )),
    descricao TEXT NOT NULL,
    evidencias JSONB, -- URLs de imagens/documentos
    
    -- Status e resolução
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'resolvido', 'rejeitado')),
    prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    
    -- Resposta do admin
    admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resposta_admin TEXT,
    acao_tomada TEXT,
    data_resolucao TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para buscas frequentes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_fornecedores_cnpj ON public.fornecedores(cnpj);
CREATE INDEX idx_fornecedores_status ON public.fornecedores(status);
CREATE INDEX idx_obras_user_id ON public.obras(user_id);
CREATE INDEX idx_obras_cliente_id ON public.obras(cliente_id);
CREATE INDEX idx_obras_fase_id ON public.obras(fase_id);
CREATE INDEX idx_ofertas_ativo ON public.ofertas(ativo) WHERE ativo = TRUE;
CREATE INDEX idx_ofertas_fornecedor ON public.ofertas(fornecedor_id);
CREATE INDEX idx_ofertas_material ON public.ofertas(material_id);
CREATE INDEX idx_cotacoes_user ON public.cotacoes(user_id);
CREATE INDEX idx_cotacoes_status ON public.cotacoes(status);
CREATE INDEX idx_propostas_cotacao ON public.propostas(cotacao_id);
CREATE INDEX idx_propostas_fornecedor ON public.propostas(fornecedor_id);
CREATE INDEX idx_pedidos_user ON public.pedidos(user_id);
CREATE INDEX idx_pedidos_fornecedor ON public.pedidos(fornecedor_id);
CREATE INDEX idx_pedidos_status ON public.pedidos(status);
CREATE INDEX idx_notificacoes_user ON public.notificacoes(user_id);
CREATE INDEX idx_notificacoes_lida ON public.notificacoes(user_id, lida) WHERE lida = FALSE;
CREATE INDEX idx_mensagens_chat ON public.mensagens(chat_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Índices para reports
CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_tipo ON public.reports(tipo);
CREATE INDEX idx_reports_entity ON public.reports(entity_type, entity_id);
CREATE INDEX idx_reports_created ON public.reports(created_at DESC);

-- Índices para password_resets
CREATE INDEX idx_password_resets_user ON public.password_resets(user_id);
CREATE INDEX idx_password_resets_token ON public.password_resets(token_hash);
CREATE INDEX idx_password_resets_expires ON public.password_resets(expires_at) WHERE used = FALSE;

-- Índices para relacionamentos
CREATE INDEX idx_servico_fase_fase ON public.servico_fase(fase_id);
CREATE INDEX idx_servico_grupo_grupo ON public.servico_grupo(grupo_id);
CREATE INDEX idx_material_grupo_grupo ON public.material_grupo(grupo_id);
CREATE INDEX idx_fornecedor_grupo_grupo ON public.fornecedor_grupo(grupo_id);
CREATE INDEX idx_fornecedor_materiais_material ON public.fornecedor_materiais(material_id);

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fases_updated_at BEFORE UPDATE ON public.fases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON public.servicos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grupos_insumo_updated_at BEFORE UPDATE ON public.grupos_insumo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materiais_updated_at BEFORE UPDATE ON public.materiais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_obras_updated_at BEFORE UPDATE ON public.obras FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fornecedor_materiais_updated_at BEFORE UPDATE ON public.fornecedor_materiais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ofertas_updated_at BEFORE UPDATE ON public.ofertas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cotacoes_updated_at BEFORE UPDATE ON public.cotacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_propostas_updated_at BEFORE UPDATE ON public.propostas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_insumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_fase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servico_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedor_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedor_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposta_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Função helper para verificar se é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR 'admin' = ANY(roles))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

-- USERS: usuários veem seu próprio perfil, admins veem todos
CREATE POLICY users_select ON public.users FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY users_update ON public.users FOR UPDATE USING (id = auth.uid() OR is_admin());

-- FASES, SERVICOS, GRUPOS, MATERIAIS: todos autenticados podem ler, admins escrevem
CREATE POLICY fases_select ON public.fases FOR SELECT TO authenticated USING (true);
CREATE POLICY fases_all ON public.fases FOR ALL USING (is_admin());

CREATE POLICY servicos_select ON public.servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY servicos_all ON public.servicos FOR ALL USING (is_admin());

CREATE POLICY grupos_select ON public.grupos_insumo FOR SELECT TO authenticated USING (true);
CREATE POLICY grupos_all ON public.grupos_insumo FOR ALL USING (is_admin());

CREATE POLICY materiais_select ON public.materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY materiais_all ON public.materiais FOR ALL USING (is_admin());

-- Tabelas de junção: todos leem, admins escrevem
CREATE POLICY servico_fase_select ON public.servico_fase FOR SELECT TO authenticated USING (true);
CREATE POLICY servico_fase_all ON public.servico_fase FOR ALL USING (is_admin());

CREATE POLICY servico_grupo_select ON public.servico_grupo FOR SELECT TO authenticated USING (true);
CREATE POLICY servico_grupo_all ON public.servico_grupo FOR ALL USING (is_admin());

CREATE POLICY material_grupo_select ON public.material_grupo FOR SELECT TO authenticated USING (true);
CREATE POLICY material_grupo_all ON public.material_grupo FOR ALL USING (is_admin());

-- FORNECEDORES: todos leem, admin gerencia
CREATE POLICY fornecedores_select ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY fornecedores_all ON public.fornecedores FOR ALL USING (is_admin());

-- FORNECEDOR_GRUPO: fornecedor pode gerenciar seus grupos
CREATE POLICY fornecedor_grupo_select ON public.fornecedor_grupo FOR SELECT TO authenticated USING (true);
CREATE POLICY fornecedor_grupo_insert ON public.fornecedor_grupo FOR INSERT WITH CHECK (
    is_admin() OR 
    EXISTS (SELECT 1 FROM public.fornecedores f JOIN public.users u ON f.user_id = u.id WHERE f.id = fornecedor_id AND u.id = auth.uid())
);
CREATE POLICY fornecedor_grupo_delete ON public.fornecedor_grupo FOR DELETE USING (
    is_admin() OR 
    EXISTS (SELECT 1 FROM public.fornecedores f JOIN public.users u ON f.user_id = u.id WHERE f.id = fornecedor_id AND u.id = auth.uid())
);

-- OBRAS: usuário vê suas obras, admin vê todas
CREATE POLICY obras_select ON public.obras FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY obras_insert ON public.obras FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());
CREATE POLICY obras_update ON public.obras FOR UPDATE USING (user_id = auth.uid() OR is_admin());
CREATE POLICY obras_delete ON public.obras FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- OFERTAS: todos leem ofertas ativas
CREATE POLICY ofertas_select ON public.ofertas FOR SELECT TO authenticated USING (true);
CREATE POLICY ofertas_manage ON public.ofertas FOR ALL USING (
    is_admin() OR
    EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.id = fornecedor_id AND f.user_id = auth.uid())
);

-- COTAÇÕES: usuário vê suas cotações, fornecedores veem cotações enviadas
CREATE POLICY cotacoes_select ON public.cotacoes FOR SELECT USING (
    user_id = auth.uid() OR 
    is_admin() OR
    (status != 'rascunho' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'fornecedor'))
);
CREATE POLICY cotacoes_insert ON public.cotacoes FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());
CREATE POLICY cotacoes_update ON public.cotacoes FOR UPDATE USING (user_id = auth.uid() OR is_admin());
CREATE POLICY cotacoes_delete ON public.cotacoes FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- NOTIFICAÇÕES: usuário vê suas notificações
CREATE POLICY notificacoes_select ON public.notificacoes FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY notificacoes_insert ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY notificacoes_update ON public.notificacoes FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- AUDIT LOGS: apenas admins leem, todos podem criar
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT USING (is_admin());
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- REPORTS: usuário vê suas denúncias, admins veem todas
CREATE POLICY reports_select ON public.reports FOR SELECT USING (reporter_id = auth.uid() OR is_admin());
CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY reports_update ON public.reports FOR UPDATE USING (is_admin());
CREATE POLICY reports_delete ON public.reports FOR DELETE USING (is_admin());

-- PASSWORD_RESETS: apenas sistema pode gerenciar (via service_role), admins podem ver
CREATE POLICY password_resets_select ON public.password_resets FOR SELECT USING (is_admin());
CREATE POLICY password_resets_insert ON public.password_resets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY password_resets_update ON public.password_resets FOR UPDATE USING (is_admin());
CREATE POLICY password_resets_delete ON public.password_resets FOR DELETE USING (is_admin());

-- =====================================================
-- VIEWS ÚTEIS PARA QUERIES COMPLEXAS
-- =====================================================

-- View: Ofertas com dados completos
CREATE OR REPLACE VIEW public.ofertas_completas AS
SELECT 
    o.*,
    f.razao_social as fornecedor_nome,
    f.cidade as fornecedor_cidade,
    f.estado as fornecedor_estado,
    f.rating as fornecedor_rating,
    m.nome as material_nome_atual,
    m.unidade as material_unidade_atual,
    array_agg(DISTINCT gi.id) as grupo_ids,
    array_agg(DISTINCT gi.nome) as grupo_nomes
FROM public.ofertas o
JOIN public.fornecedores f ON o.fornecedor_id = f.id
JOIN public.materiais m ON o.material_id = m.id
LEFT JOIN public.material_grupo mg ON m.id = mg.material_id
LEFT JOIN public.grupos_insumo gi ON mg.grupo_id = gi.id
WHERE o.ativo = true
GROUP BY o.id, f.id, m.id;

-- View: Materiais por fase (através de serviços e grupos)
CREATE OR REPLACE VIEW public.materiais_por_fase AS
SELECT DISTINCT
    fa.id as fase_id,
    fa.nome as fase_nome,
    fa.cronologia,
    m.id as material_id,
    m.nome as material_nome,
    m.unidade as material_unidade,
    gi.id as grupo_id,
    gi.nome as grupo_nome,
    s.id as servico_id,
    s.nome as servico_nome,
    s.ordem as servico_ordem
FROM public.fases fa
JOIN public.servico_fase sf ON fa.id = sf.fase_id
JOIN public.servicos s ON sf.servico_id = s.id
JOIN public.servico_grupo sg ON s.id = sg.servico_id
JOIN public.grupos_insumo gi ON sg.grupo_id = gi.id
JOIN public.material_grupo mg ON gi.id = mg.grupo_id
JOIN public.materiais m ON mg.material_id = m.id;

-- View: Ofertas por fase
CREATE OR REPLACE VIEW public.ofertas_por_fase AS
SELECT 
    fa.id as fase_id,
    fa.nome as fase_nome,
    o.*,
    f.razao_social as fornecedor_nome,
    f.rating as fornecedor_rating
FROM public.fases fa
JOIN public.servico_fase sf ON fa.id = sf.fase_id
JOIN public.servico_grupo sg ON sf.servico_id = sg.servico_id
JOIN public.material_grupo mg ON sg.grupo_id = mg.grupo_id
JOIN public.ofertas o ON mg.material_id = o.material_id
JOIN public.fornecedores f ON o.fornecedor_id = f.id
WHERE o.ativo = true;

-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função: Buscar ofertas por fase
CREATE OR REPLACE FUNCTION get_ofertas_by_fase(p_fase_id UUID)
RETURNS TABLE (
    oferta_id UUID,
    material_id UUID,
    material_nome TEXT,
    material_unidade TEXT,
    fornecedor_id UUID,
    fornecedor_nome TEXT,
    preco_original DECIMAL,
    preco_final DECIMAL,
    desconto_percentual DECIMAL,
    estoque INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        o.id,
        o.material_id,
        o.material_nome,
        o.material_unidade,
        o.fornecedor_id,
        f.razao_social,
        o.preco_original,
        o.preco_final,
        o.desconto_percentual,
        o.estoque
    FROM public.ofertas o
    JOIN public.fornecedores f ON o.fornecedor_id = f.id
    JOIN public.material_grupo mg ON o.material_id = mg.material_id
    JOIN public.servico_grupo sg ON mg.grupo_id = sg.grupo_id
    JOIN public.servico_fase sf ON sg.servico_id = sf.servico_id
    WHERE sf.fase_id = p_fase_id
    AND o.ativo = true
    ORDER BY o.preco_final;
END;
$$ LANGUAGE plpgsql;

-- Função: Atualizar rating do fornecedor
CREATE OR REPLACE FUNCTION update_fornecedor_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.fornecedores
    SET 
        rating = (SELECT COALESCE(AVG(rating), 0) FROM public.avaliacoes WHERE fornecedor_id = NEW.fornecedor_id),
        review_count = (SELECT COUNT(*) FROM public.avaliacoes WHERE fornecedor_id = NEW.fornecedor_id)
    WHERE id = NEW.fornecedor_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fornecedor_rating
AFTER INSERT OR UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION update_fornecedor_rating();

-- =====================================================
-- DADOS INICIAIS (opcional)
-- =====================================================

-- Inserir fases padrão
INSERT INTO public.fases (cronologia, nome, descricao) VALUES
(1, 'Fundação', 'Etapa inicial de fundação da obra'),
(2, 'Estrutura', 'Estrutura de concreto, pilares e vigas'),
(3, 'Alvenaria', 'Levantamento de paredes e vedações'),
(4, 'Cobertura', 'Telhado e impermeabilização'),
(5, 'Instalações', 'Instalações elétricas e hidráulicas'),
(6, 'Acabamento', 'Revestimentos, pintura e acabamentos finais')
ON CONFLICT (nome) DO NOTHING;
