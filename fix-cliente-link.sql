-- Script para verificar e corrigir o vínculo entre users e clientes

-- 1. Ver todos os clientes cadastrados
SELECT id, user_id, nome, email, cpf, cnpj, telefone FROM clientes;

-- 2. Ver o usuário cliente e seu cliente_id
SELECT id, email, nome, role, cliente_id FROM users WHERE email = 'cliente@cotareconstruir.com.br';

-- 3. Encontrar o cliente que deveria estar vinculado ao usuário
-- (procurar por user_id ou email matching)
SELECT c.id, c.user_id, c.nome, c.email, u.id as user_id_from_users, u.email as user_email
FROM clientes c
LEFT JOIN users u ON c.email = u.email
WHERE c.email = 'cliente@cotareconstruir.com.br';

-- 4. CORRIGIR o vínculo (ajuste os IDs conforme necessário)
-- Primeiro, busque o ID correto do cliente usando a query #3
-- Depois execute o UPDATE abaixo substituindo o UUID pelo ID correto

-- UPDATE users 
-- SET cliente_id = 'ID_DO_CLIENTE_CORRETO_AQUI'
-- WHERE email = 'cliente@cotareconstruir.com.br';

-- UPDATE clientes
-- SET user_id = '114e3734-9dbc-43fb-afb3-2bfd5ae00bf2'
-- WHERE email = 'cliente@cotareconstruir.com.br';
