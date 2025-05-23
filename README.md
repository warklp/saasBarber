# Sistema de Gerenciamento para Barbearia

Um sistema completo para gerenciamento de barbearias, incluindo agendamentos, gestão de clientes, colaboradores, vendas e relatórios.

## Estrutura do Projeto

O projeto segue a estrutura de pastas recomendada pelo Next.js com App Router:

```
src/
├── app/                  # Páginas e rotas da aplicação (Next.js App Router)
│   ├── api/              # Rotas de API
│   ├── agendamento/      # Página de agendamentos
│   ├── calendario/       # Página de calendário
│   ├── catalogo/         # Página de catálogo
│   ├── clientes/         # Página de gestão de clientes
│   ├── configuracoes/    # Página de configurações
│   ├── equipe/           # Página de gestão de colaboradores
│   ├── relatorios/       # Página de relatórios
│   ├── vendas/           # Página de vendas
│   ├── layout.tsx        # Layout principal da aplicação
│   ├── page.tsx          # Página inicial (Dashboard)
│   └── globals.css       # Estilos globais
│
├── components/           # Componentes reutilizáveis
│   ├── layout/           # Componentes de layout (Sidebar, Header, etc)
│   ├── ui/               # Componentes de UI (Botões, Inputs, etc)
│   └── ...               # Outros componentes específicos
│
├── lib/                  # Utilitários e serviços
│   ├── services/         # Serviços para comunicação com APIs
│   └── utils.ts          # Funções utilitárias
│
├── hooks/                # Hooks personalizados
│
└── types/                # Definições de tipos TypeScript
```

## Configuração do Supabase

O projeto utiliza o Supabase para autenticação e banco de dados. Configure as seguintes variáveis de ambiente em um arquivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

Para corrigir problemas de RLS (Row Level Security) no Supabase, execute o script SQL contido em `fix_rls_policies.sql` no editor SQL do Supabase.

## Executando o Projeto

1. Instale as dependências:
   ```
   npm install
   ```

2. Execute o projeto em desenvolvimento:
   ```
   npm run dev
   ```

3. Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

## Build para Produção

Para gerar a versão de produção:

```
npm run build
```

Para iniciar o servidor de produção:

```
npm start
```

# API REST para Sistema de Gerenciamento de Barbearia

API REST completa para gerenciamento de barbearia, construída com Next.js API Routes e Supabase como backend.

## Estrutura do Projeto

A API está organizada por recursos seguindo o padrão REST:

```
src/app/api/
├── appointments/               # Agendamentos
├── comandas/                   # Comandas (vendas)
├── comanda-items/              # Itens de comanda
├── employees/                  # Funcionários
├── products/                   # Produtos
├── services/                   # Serviços
├── stock-movements/            # Movimentações de estoque
├── subscription-plans/         # Planos de assinatura
└── user-subscriptions/         # Assinaturas de usuários
```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```
# Variáveis públicas (acessíveis no frontend)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-do-supabase

# Variáveis privadas (apenas no servidor)
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-do-supabase
```

### Segurança

#### Uso das Keys

- **Anon Key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): Usada no frontend para operações de leitura e escritas permitidas pelas políticas RLS.
- **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`): Usada apenas no servidor (API Routes) para operações que requerem permissões elevadas, como criar usuários ou atualizar dados sensíveis.

As variáveis que começam com `NEXT_PUBLIC_` são acessíveis no cliente, enquanto as outras são acessíveis apenas no servidor.

### Row Level Security (RLS)

A segurança dos dados é garantida por políticas de Row Level Security no Supabase. É necessário configurar as políticas para cada tabela para garantir que os usuários só acessem os dados que têm permissão.

Exemplos de políticas:

- Clientes só podem ver seus próprios dados
- Funcionários podem ver dados relevantes para suas funções
- Administradores têm acesso total

## Endpoints

A API implementa operações CRUD para todos os recursos principais:

- **GET**: Recupera dados (lista ou item específico)
- **POST**: Cria um novo recurso
- **PATCH**: Atualiza parcialmente um recurso existente
- **DELETE**: Remove ou desativa um recurso

Cada endpoint inclui:
- Validação de dados com Zod
- Controle de acesso baseado em papéis
- Tratamento de erros consistente
- Documentação detalhada

## Middlewares

A API utiliza middlewares para:

- **withAuth**: Garante que o usuário está autenticado
- **withRole**: Verifica se o usuário tem o papel necessário
- **withAdmin**: Restringe acesso apenas a administradores
- **withSelfOrAdmin**: Permite acesso apenas ao próprio usuário ou admin

## Uso da API

Exemplos de uso:

### Autenticação

Todas as chamadas autenticadas devem incluir o token de autenticação no cabeçalho:

```javascript
const response = await fetch('/api/employees', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

### Obter Lista de Recursos

```javascript
// Obter todos os serviços ativos
const response = await fetch('/api/services?only_active=true');
const data = await response.json();
```

### Criar um Recurso

```javascript
// Adicionar um produto
const response = await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Shampoo Premium',
    description: 'Shampoo para cabelos com tratamento',
    price: 45.90,
    stock_quantity: 20,
    stock_minimum: 5
  })
});
```

## Considerações

- A API implementa validação rigorosa de dados para garantir integridade
- Transações são usadas para operações que afetam múltiplas tabelas
- Logs de auditoria são gerados para operações sensíveis
- Estoque é controlado automaticamente em vendas e devoluções

## Tabelas Necessárias no Supabase

Para que a API funcione corretamente, as seguintes tabelas são necessárias:

- `users` (usuários, com papéis client, admin, cashier, employee)
- `subscription_plans` (planos de assinatura)
- `user_subscriptions` (assinaturas dos usuários)
- `services` (serviços oferecidos)
- `appointments` (agendamentos)
- `products` (produtos com controle de estoque)
- `comandas` (vendas)
- `comanda_items` (itens da comanda)
- `taxes` (taxas aplicadas)
- `financial_transactions` (transações financeiras)
- `stock_movements` (movimentação de estoque)
- `audit_logs` (tabela de auditoria)
- `user_metadata` (metadados dos usuários) 