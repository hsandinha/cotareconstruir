# Scripts de Diagnóstico e Correção - Login Administrativo

## Problema
Não consegue fazer login como administrador? Use estes scripts para diagnosticar e corrigir.

## Scripts Disponíveis

### 1. 🔍 Diagnóstico Completo
**debug-admin-login.mjs** — Verifica estado atual de um usuário admin

```bash
node scripts/debug-admin-login.mjs <email-do-admin>
```

**O que verifica:**
- ✅ Se o usuário existe em `public.users`
- ✅ Se o usuário existe em `auth.users` (Supabase Auth)
- ✅ Se os campos `role` e `roles` estão corretos
- ✅ Se há sincronização entre Auth e banco de dados
- ✅ Lista todos os admins no sistema

**Exemplo:**
```bash
node scripts/debug-admin-login.mjs admin@comprareconstruir.com
```

---

### 2. 🔧 Corrigir Permissões de Admin
**fix-admin-role.mjs** — Converte um usuário existente em administrador

```bash
node scripts/fix-admin-role.mjs <email>
```

**O que faz:**
- Atualiza `role` para `"admin"`
- Atualiza `roles` para `["admin"]`
- Define `status` como `"active"`
- Define `is_verified` como `true`

**Use quando:**
- Um usuário já existe mas não tem permissões de admin
- As permissões estão incorretas ou desatualizadas

**Exemplo:**
```bash
node scripts/fix-admin-role.mjs usuario@empresa.com.br
```

---

### 3. ⚡ Criar Novo Administrador
**create-admin-user.mjs** — Cria um novo usuário administrador do zero

```bash
node scripts/create-admin-user.mjs
```

**O script perguntará:**
1. Email do admin
2. Nome completo
3. Senha (mínimo 6 caracteres)

**O que faz:**
- ✅ Cria usuário no **Supabase Auth** (`auth.users`)
- ✅ Confirma email automaticamente
- ✅ Cria registro em **public.users** com permissões admin
- ✅ Define status como `active` e verificado

**Use quando:**
- Não existe nenhum usuário admin no sistema
- Precisa criar um novo administrador

---

## Pré-requisitos

### Variáveis de Ambiente
Certifique-se de que estas variáveis estão definidas:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

**Onde encontrar:**
1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie a **URL** e a **service_role key** (não a anon key!)

### Instalar dependências
```bash
npm install @supabase/supabase-js
```

---

## Fluxo de Diagnóstico Recomendado

### Passo 1: Diagnosticar
```bash
node scripts/debug-admin-login.mjs admin@comprareconstruir.com
```

### Passo 2: Agir baseado no resultado

**Se o usuário NÃO EXISTE:**
```bash
node scripts/create-admin-user.mjs
```

**Se o usuário EXISTE mas não é admin:**
```bash
node scripts/fix-admin-role.mjs admin@comprareconstruir.com
```

**Se o usuário EXISTE e É admin mas não consegue logar:**
- Verifique a senha (reset via Supabase Dashboard → Authentication → Users)
- Verifique se o email está confirmado
- Verifique logs do servidor durante tentativa de login

---

## Estrutura de Permissões

### Campo `role` (singular)
```sql
role TEXT NOT NULL DEFAULT 'cliente' 
CHECK (role IN ('admin', 'cliente', 'fornecedor'))
```

### Campo `roles` (array)
```sql
roles TEXT[] DEFAULT ARRAY['cliente']
```

**Para ser admin, o usuário precisa:**
- `role = 'admin'` **OU**
- `'admin' IN roles[]` (array contém 'admin')

**Os scripts garantem ambos** para máxima compatibilidade.

---

## Troubleshooting

### Erro: "Variáveis de ambiente não configuradas"
```bash
# Defina as variáveis antes de executar:
export NEXT_PUBLIC_SUPABASE_URL="https://..."
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### Erro: "Invalid API key"
- Certifique-se de usar a **service_role key**, não a anon key
- A service_role key começa com `eyJ` e é muito longa

### Erro: "Cannot find module @supabase/supabase-js"
```bash
npm install @supabase/supabase-js
```

### Erro ao criar usuário: "User already exists"
- O email já está cadastrado
- Use `fix-admin-role.mjs` ao invés de criar novo

### Admin ainda não consegue logar após correção
1. Limpe cache e cookies do navegador
2. Tente em uma janela anônima
3. Verifique console do navegador (F12) para erros
4. Verifique se a senha está correta
5. Reset senha via Supabase Dashboard se necessário

---

## Próximos Passos Após Criação

### 1. Fazer Login
```
URL: https://seu-dominio.com/login
Email: admin@empresa.com.br
Senha: (a que você definiu)
```

### 2. Acesso ao Dashboard Admin
Após login bem-sucedido, será redirecionado para:
```
/dashboard/admin
```

### 3. Recursos Disponíveis
- Gerenciamento de usuários
- Gerenciamento de fornecedores
- Gerenciamento de clientes
- Relatórios e análises
- Configurações do sistema

---

## Segurança

⚠️ **IMPORTANTE:**
- **NUNCA** compartilhe a `service_role key`
- **NUNCA** commite a `service_role key` no Git
- Use senhas fortes para contas admin (min. 12 caracteres)
- Ative 2FA quando disponível
- Revise logs de acesso regularmente

---

## Suporte

Se ainda tiver problemas:
1. Execute o script de diagnóstico e salve a saída
2. Verifique logs do servidor (`npm run dev`)
3. Verifique logs do Supabase Dashboard → Logs
4. Documente os erros exatos e quando ocorrem
