# Serviço centralizado de API

Este serviço centraliza todas as chamadas à API do sistema, garantindo consistência, tratamento adequado de erros e segurança na autenticação.

## Características

- **Autenticação automática**: Adiciona automaticamente o token de autenticação em todas as requisições
- **Tratamento unificado de erros**: Exibe mensagens de erro padronizadas através de toasts
- **Tipagem forte**: Suporte completo para TypeScript
- **Redirecionamento automático**: Quando não autenticado, redireciona para a página de login
- **Métodos simplificados**: Interfaces claras para GET, POST, PUT, PATCH e DELETE

## Como usar

### Importando o serviço

```typescript
import apiService from '@/lib/api';
// ou importando métodos específicos
import { api, getAuthToken, ApiError } from '@/lib/api';
```

### Exemplos de uso

#### Requisição GET simples

```typescript
// Buscar lista de serviços
try {
  const services = await apiService.get('/api/services');
  // Faça algo com os serviços retornados
} catch (error) {
  // Tratamento de erro específico da aplicação, se necessário
  // Os erros básicos já são tratados pelo serviço
}
```

#### Requisição POST com dados

```typescript
// Criar um novo serviço
try {
  const newService = await apiService.post('/api/services', {
    name: 'Novo Serviço',
    duration_minutes: 30,
    price: 50.00,
    is_active: true
  }, {
    showSuccessToast: true,
    successMessage: 'Serviço criado com sucesso!'
  });
  
  // Utilize o serviço criado...
} catch (error) {
  // Tratamento adicional, se necessário
}
```

#### Requisição PUT para atualização

```typescript
// Atualizar um serviço existente
try {
  await apiService.put(`/api/services/${serviceId}`, updatedData);
} catch (error) {
  // Tratamento específico
}
```

#### Requisição DELETE

```typescript
// Excluir um serviço
try {
  await apiService.delete(`/api/services/${serviceId}`);
} catch (error) {
  // Tratamento específico
}
```

### Opções disponíveis

Você pode personalizar o comportamento de qualquer requisição usando as seguintes opções:

```typescript
interface ApiOptions extends RequestInit {
  showErrorToast?: boolean;       // Exibir toast de erro (padrão: true)
  showSuccessToast?: boolean;     // Exibir toast de sucesso (padrão: false)
  successMessage?: string;        // Mensagem de sucesso personalizada
  redirectOnUnauthorized?: boolean; // Redirecionar quando não autenticado (padrão: true)
  redirectPath?: string;          // Caminho para redirecionamento (padrão: '/login')
}
```

## Tratamento de erros

O serviço já trata os erros comuns e exibe mensagens de erro via toast. Se precisar de um tratamento mais específico, você pode capturar erros do tipo `ApiError`:

```typescript
import { ApiError } from '@/lib/api';

try {
  await apiService.post('/api/services', data);
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      // Tratamento específico para conflito
      console.log('Código de erro:', error.code);
    }
  }
}
```

## Considerações de segurança

- Nunca armazene tokens sensíveis no localStorage em ambiente de produção sem proteções adicionais
- Para operações sensíveis, considere implementar autenticação em várias etapas
- Monitore regularmente as solicitações para detectar padrões de abuso 