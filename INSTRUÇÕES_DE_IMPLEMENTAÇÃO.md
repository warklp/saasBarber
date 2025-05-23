# Implementação de Comissões para Serviços e Funcionários

Este documento explica a implementação do sistema de comissões para serviços e funcionários. A estrutura permite definir uma comissão padrão para cada serviço e, opcionalmente, comissões personalizadas para funcionários específicos.

## 1. Estrutura do Banco de Dados

Foi criada a seguinte estrutura:

1. **Campo Adicional na tabela `services`**
   - `default_commission_percentage`: Percentual de comissão padrão para o serviço

2. **Nova tabela `user_services`**
   - Relação N:N entre usuários e serviços
   - Armazena quais serviços cada funcionário pode realizar
   - Permite configurar comissões personalizadas por funcionário e serviço

## 2. Implementação no Banco de Dados

Execute o script `migration_commission_fields.sql` no SQL Editor do Supabase. O script inclui:

- Adição do campo de comissão padrão na tabela `services`
- Criação da tabela `user_services`
- Configuração de índices e políticas de segurança
- Trigger para atualização automática do campo `updated_at`

## 3. Endpoints da API Implementados

Foram criados os seguintes endpoints:

### User Services API

- `GET /api/user-services` - Lista todos os serviços de usuários
- `POST /api/user-services` - Adiciona um novo serviço para um usuário
- `GET /api/user-services/:id` - Busca um serviço de usuário específico
- `PATCH /api/user-services/:id` - Atualiza um serviço de usuário específico
- `DELETE /api/user-services/:id` - Remove um serviço de usuário específico

### User Services por Usuário

- `GET /api/users/:id/services` - Lista todos os serviços associados a um usuário específico

## 4. Componente de Interface

O componente `ServiceCommissionSelector` permite que os administradores:

- Selecionem quais serviços um funcionário pode realizar
- Ativem/desativem comissões personalizadas para cada serviço
- Configurem o percentual de comissão personalizada usando slider ou campo numérico

## 5. Integração no Formulário de Funcionários

Para integrar o componente no formulário de edição de funcionários:

1. Importe o componente:
   ```tsx
   import ServiceCommissionSelector from '@/components/employees/ServiceCommissionSelector';
   ```

2. Adicione o componente no formulário de edição:
   ```tsx
   <ServiceCommissionSelector 
     userId={userId} 
     onUpdate={() => {
       // Função opcional a ser chamada quando houver atualizações
       // Por exemplo, recarregar dados do funcionário
     }} 
   />
   ```

## 6. Atualização dos Services

Você precisará atualizar a tabela `services` para incluir a comissão padrão:

```sql
-- Exemplo: Atualizar os serviços existentes com uma comissão padrão
UPDATE services 
SET default_commission_percentage = 30.0
WHERE default_commission_percentage IS NULL;
```

## 7. Uso no Cálculo de Comissões

Para calcular a comissão de um serviço para um funcionário:

1. Busque o serviço do usuário:
   ```ts
   const { data } = await supabase
     .from('user_services')
     .select('custom_commission_percentage, service:service_id(default_commission_percentage)')
     .eq('user_id', userId)
     .eq('service_id', serviceId)
     .single();
   ```

2. Determine a comissão a ser utilizada:
   ```ts
   const commissionPercentage = data.custom_commission_percentage !== null
     ? data.custom_commission_percentage
     : data.service.default_commission_percentage;
   ```

3. Calcule o valor da comissão:
   ```ts
   const commissionAmount = (servicePrice * commissionPercentage) / 100;
   ```

## 8. Próximos Passos

1. Atualize suas interfaces de relatórios para incluir os valores de comissão
2. Implemente a lógica de cálculo de comissões nos fluxos de pagamento
3. Configure as comissões padrão nos serviços existentes
4. Configure as permissões de acesso adequadas no Supabase

## 9. Considerações de Segurança

- As políticas de segurança (RLS) já estão configuradas para garantir que apenas administradores e gerentes possam gerenciar as comissões
- Os funcionários só podem ver suas próprias comissões, não as dos outros funcionários 