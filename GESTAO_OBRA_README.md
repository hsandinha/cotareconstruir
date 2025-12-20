# Sistema de Gestão de Estrutura de Obra

## 📋 Visão Geral

Sistema completo para gerenciar a estrutura de uma obra através de 4 tabelas relacionadas:

1. **Fases** - Cronologia da obra (15 fases baseadas na estrutura padrão)
2. **Serviços** - Serviços específicos de cada fase
3. **Grupos de Insumos** - Categorias de materiais
4. **Materiais** - Itens específicos de cada grupo

## 🎯 Funcionalidades

### Visualização Interativa
- Estrutura hierárquica expandível por fases
- Mostra serviços de cada fase
- Exibe grupos de insumos vinculados a cada serviço
- Lista materiais de cada grupo
- Interface com acordeão (clique para expandir/recolher)

### Gestão de Fases
- Criar, editar e excluir fases
- Ordenação por cronologia
- Descrição opcional

### Gestão de Serviços
- Criar, editar e excluir serviços
- Vincular serviços a fases
- Relacionamento múltiplo com grupos de insumos (muitos-para-muitos)
- Interface visual com checkboxes para vincular grupos
- Ordenação dentro de cada fase

### Gestão de Grupos de Insumos
- Criar, editar e excluir grupos
- Visualização em cards
- Contador de materiais por grupo

### Gestão de Materiais
- Criar, editar e excluir materiais
- Vincular a um grupo de insumo
- Definir unidade de medida (m³, kg, sc, un, etc.)
- Descrição opcional
- Organização por grupo

## 🔗 Relacionamentos

```
Fase (1) ──→ (N) Serviço
              ↓
              (N) ←──→ (N) Grupo de Insumo
                         ↓
                         (1) ──→ (N) Material
```

- **Fase → Serviço**: Um para muitos (uma fase tem vários serviços)
- **Serviço ↔ Grupo**: Muitos para muitos (um serviço pode ter vários grupos e um grupo pode estar em vários serviços)
- **Grupo → Material**: Um para muitos (um grupo tem vários materiais)

## 📊 Estrutura de Dados

### Fase
```typescript
{
  id: string
  cronologia: number
  nome: string
  descricao?: string
}
```

### Serviço
```typescript
{
  id: string
  nome: string
  faseId: string
  gruposInsumoIds: string[]  // Array de IDs dos grupos vinculados
  ordem?: number
}
```

### Grupo de Insumo
```typescript
{
  id: string
  nome: string
  descricao?: string
}
```

### Material
```typescript
{
  id: string
  nome: string
  unidade: string
  grupoInsumoId: string
  descricao?: string
}
```

## 🎨 Interface

### 5 Abas Principais

1. **Visualização Interativa** (padrão)
   - Mostra toda a hierarquia
   - Expansível/retrátil
   - Indicadores visuais de quantidade

2. **Fases**
   - Tabela com todas as fases
   - Edição inline
   - Botão de adicionar

3. **Serviços**
   - Agrupado por fase
   - Checkboxes para vincular grupos de insumos
   - Modal de edição completo

4. **Grupos de Insumos**
   - Cards visuais
   - Contador de materiais
   - Modais para adicionar/editar

5. **Materiais**
   - Organizado por grupo
   - Tabelas por categoria
   - Formulário de edição

## 🚀 Como Usar

### Acesso
1. Faça login como administrador
2. Vá para o Dashboard Admin
3. Na aba "Visão Geral", clique em **"Gerenciar Estrutura de Obra"**

### Fluxo de Trabalho Recomendado

1. **Configure as Fases** (já vem pré-configuradas com 15 fases)
2. **Crie Grupos de Insumos** para categorizar materiais
3. **Adicione Materiais** aos grupos
4. **Configure Serviços** e vincule aos grupos necessários
5. **Use a Visualização Interativa** para ver toda a estrutura

## 📁 Arquivos Criados

- `/lib/constructionData.ts` - Tipos e dados iniciais
- `/components/dashboard/admin/ConstructionManagement.tsx` - Componente principal
- Integrado em `/app/dashboard/admin/page.tsx`

## 🎯 Dados Pré-Carregados

O sistema já vem com:
- ✅ 15 Fases padrão de construção
- ✅ 70+ Serviços distribuídos pelas fases
- ✅ 15 Grupos de insumos
- ✅ 45+ Materiais categorizados

## 🔧 Personalização

Todos os dados são editáveis:
- Adicione novas fases conforme necessário
- Crie serviços específicos do seu projeto
- Personalize grupos de insumos
- Adicione materiais específicos

## 💡 Recursos Interativos

- ✨ Animações suaves ao expandir/recolher
- 🎨 Código de cores por tipo
- 🔍 Indicadores visuais de quantidade
- 📱 Interface responsiva
- ⚡ Edição rápida inline (onde aplicável)
- 🎯 Modais para edições complexas

## 🎨 Design

- Interface limpa e moderna
- Gradientes em botões principais
- Cards com sombra e hover effects
- Sistema de cores consistente:
  - Azul para fases e ações principais
  - Roxo/Violeta para grupos
  - Verde para confirmações
  - Vermelho para exclusões

## 📱 Responsividade

- Grid adaptativo (1/2/3 colunas conforme tela)
- Tabs horizontais com scroll
- Modais centralizados e responsivos
- Tabelas com scroll horizontal em telas pequenas
