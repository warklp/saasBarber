-- Funções de gerenciamento de transações

-- Função para iniciar uma transação
CREATE OR REPLACE FUNCTION public.begin_transaction()
RETURNS void AS $$
BEGIN
    -- Inicia uma transação
    EXECUTE 'BEGIN TRANSACTION';
END;
$$ LANGUAGE plpgsql;

-- Função para confirmar uma transação
CREATE OR REPLACE FUNCTION public.commit_transaction()
RETURNS void AS $$
BEGIN
    -- Confirma a transação atual
    EXECUTE 'COMMIT';
END;
$$ LANGUAGE plpgsql;

-- Função para reverter uma transação
CREATE OR REPLACE FUNCTION public.rollback_transaction()
RETURNS void AS $$
BEGIN
    -- Reverte a transação atual
    EXECUTE 'ROLLBACK';
END;
$$ LANGUAGE plpgsql; 