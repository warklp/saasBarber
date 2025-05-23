-- Migração: Correção da chave estrangeira de clientes na tabela comandas
-- Descrição: Atualiza a restrição de chave estrangeira para apontar para a tabela correta de clientes
-- Data: 2023-11-06

-- Transação para garantir que todas as alterações sejam feitas juntas
BEGIN;

-- 1. Remover a restrição existente (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'comandas_client_id_fkey'
    AND table_name = 'comandas'
  ) THEN
    ALTER TABLE comandas DROP CONSTRAINT comandas_client_id_fkey;
  END IF;
END $$;

-- 2. Adicionar a nova restrição apontando para a tabela customers
-- Assumindo que a coluna id na tabela customers é a chave primária
ALTER TABLE comandas
ADD CONSTRAINT comandas_client_id_fkey
FOREIGN KEY (client_id)
REFERENCES customers(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- 3. Criar ou atualizar um trigger para validar que o cliente existe antes de inserir/atualizar
CREATE OR REPLACE FUNCTION validate_comanda_client()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar se o cliente existe na tabela customers
    IF NOT EXISTS (SELECT 1 FROM customers WHERE id = NEW.client_id) THEN
        RAISE EXCEPTION 'Cliente com ID % não existe na tabela customers', NEW.client_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover o trigger se já existir
DROP TRIGGER IF EXISTS validate_comanda_client_trigger ON comandas;

-- Criar o trigger
CREATE TRIGGER validate_comanda_client_trigger
BEFORE INSERT OR UPDATE ON comandas
FOR EACH ROW
EXECUTE FUNCTION validate_comanda_client();

-- Concluir a transação
COMMIT; 