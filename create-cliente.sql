-- Script para criar o cliente e vincular ao usuário

-- 1. Primeiro, limpar o cliente_id incorreto do users
UPDATE users 
SET cliente_id = NULL
WHERE email = 'cliente@cotareconstruir.com.br';

-- 2. Criar o cliente com dados básicos
-- IMPORTANTE: Ajuste os dados abaixo conforme necessário
INSERT INTO clientes (
    id,
    user_id,
    nome,
    email,
    telefone,
    status,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),  -- Gera um novo UUID
    '114e3734-9dbc-43fb-afb3-2bfd5ae00bf2',  -- ID do usuário
    'Cliente',
    'cliente@cotareconstruir.com.br',
    NULL,
    'active',
    NOW(),
    NOW()
) RETURNING id;

-- 3. Depois de executar o INSERT acima, copie o ID retornado e use no UPDATE abaixo
-- UPDATE users 
-- SET cliente_id = 'COLE_O_ID_RETORNADO_AQUI'
-- WHERE id = '114e3734-9dbc-43fb-afb3-2bfd5ae00bf2';

-- OU faça tudo de uma vez com esta query:
WITH new_cliente AS (
    INSERT INTO clientes (
        user_id,
        nome,
        email,
        status,
        created_at,
        updated_at
    ) VALUES (
        '114e3734-9dbc-43fb-afb3-2bfd5ae00bf2',
        'Cliente',
        'cliente@cotareconstruir.com.br',
        'active',
        NOW(),
        NOW()
    ) RETURNING id
)
UPDATE users
SET cliente_id = (SELECT id FROM new_cliente)
WHERE id = '114e3734-9dbc-43fb-afb3-2bfd5ae00bf2'
RETURNING cliente_id;
