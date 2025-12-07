# Checklist de Testes Manuais - Cotar & Construir

Este documento serve como guia para validação manual das funcionalidades críticas do sistema antes de cada deploy, dada a ausência de testes automatizados (E2E/Unit).

## 1. Perfil do Cliente/Fornecedor
- [ ] **Salvar Perfil (Pessoa Física)**
    - [ ] Preencher nome, telefone e CPF válido.
    - [ ] Salvar e recarregar a página.
    - [ ] Verificar se os dados persistem.
- [ ] **Salvar Perfil (Pessoa Jurídica)**
    - [ ] Preencher Razão Social e CNPJ válido.
    - [ ] Salvar e recarregar a página.
    - [ ] Verificar se os dados persistem.
- [ ] **Auto-preenchimento de CNPJ**
    - [ ] Digitar um CNPJ válido no campo.
    - [ ] Verificar se Razão Social/Nome Fantasia são preenchidos automaticamente (se a API estiver integrada).
- [ ] **Auto-preenchimento de CEP**
    - [ ] Digitar um CEP válido.
    - [ ] Verificar se Endereço, Bairro, Cidade e Estado são preenchidos automaticamente.

## 2. Gestão de Funcionários (Se aplicável ao perfil)
- [ ] **Incluir Funcionário**
    - [ ] Adicionar nome e email de um novo funcionário.
    - [ ] Verificar se aparece na lista imediatamente.
- [ ] **Excluir Funcionário**
    - [ ] Remover um funcionário existente.
    - [ ] Confirmar a exclusão (se houver modal).
    - [ ] Verificar se sumiu da lista.

## 3. Painel Administrativo (Admin Dashboard)
- [ ] **Navegação entre Abas**
    - [ ] Clicar em "Visão Geral", "Gerenciar Usuários", "Auditoria" e "Denúncias".
    - [ ] Verificar se o conteúdo muda corretamente sem recarregar a página inteira.
    - [ ] Verificar se o estado de carregamento (Skeletons) aparece brevemente.
- [ ] **Gerenciar Usuários**
    - [ ] **Filtrar:** Testar filtros de Perfil (Cliente/Fornecedor) e Status (Ativo/Inativo).
    - [ ] **Toggle Status:** Clicar em "Ativo/Inativo" e verificar se o status muda visualmente e se aparece o Toast de sucesso.
    - [ ] **Alterar Role:** Mudar o papel de um usuário (ex: Cliente -> Fornecedor) e confirmar a mudança.
    - [ ] **Excluir:** Tentar excluir um usuário e verificar se ele é removido da lista.
- [ ] **Auditoria**
    - [ ] Verificar se ações recentes (como o toggle status acima) aparecem no log.
    - [ ] Testar a paginação (Próxima/Anterior).
- [ ] **Denúncias**
    - [ ] Visualizar uma denúncia pendente.
    - [ ] Clicar em "Resolver".
    - [ ] Verificar se o status muda para "Resolvida" e o botão de ação some.

## 4. Segurança e Acesso
- [ ] **Route Guard (Admin)**
    - [ ] Tentar acessar `/dashboard/admin` com um usuário comum (Cliente/Fornecedor).
    - [ ] Verificar se é redirecionado para `/dashboard/cliente` ou `/login`.
- [ ] **Login/Logout**
    - [ ] Fazer logout e garantir que não é possível acessar páginas protegidas.

## 5. Responsividade (Mobile)
- [ ] **Admin Mobile**
    - [ ] Acessar o painel admin em resolução de celular (< 768px).
    - [ ] Verificar se as tabelas foram substituídas por Cards empilhados.
    - [ ] Testar se os botões de ação nos cards funcionam corretamente.
