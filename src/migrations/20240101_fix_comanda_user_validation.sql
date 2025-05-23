-- Migração: Correção do trigger validate_user_role para comandas
-- Descrição: Atualiza a validação de cliente para verificar na tabela customers em vez de users
-- Data: 2024-01-01

-- Transação para garantir que todas as alterações sejam feitas juntas
BEGIN;

-- 1. Atualizar a função validate_user_role para verificar clientes na tabela customers
CREATE OR REPLACE FUNCTION validate_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Validação para user_subscriptions
    IF TG_TABLE_NAME = 'user_subscriptions' THEN
        IF NEW.user_id IS NULL THEN
            RAISE EXCEPTION 'User ID cannot be null for subscriptions';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM users 
            WHERE id = NEW.user_id AND role = 'client'
        ) THEN
            RAISE EXCEPTION 'User % must be a client to have a subscription', NEW.user_id;
        END IF;
    END IF;

    -- Validação para appointments
    IF TG_TABLE_NAME = 'appointments' THEN
        IF NEW.client_id IS NULL THEN
            RAISE EXCEPTION 'Client ID cannot be null for appointments';
        END IF;

        -- Verificar na tabela customers em vez de users
        IF NOT EXISTS (
            SELECT 1 FROM customers 
            WHERE id = NEW.client_id
        ) THEN
            RAISE EXCEPTION 'Appointment client % does not exist in customers table', NEW.client_id;
        END IF;

        IF NEW.employee_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM users 
            WHERE id = NEW.employee_id AND role = 'employee'
        ) THEN
            RAISE EXCEPTION 'Appointment employee % must have employee role', NEW.employee_id;
        END IF;

        -- Validação de sobreposição de horários para funcionários
        IF NEW.employee_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.employee_id = NEW.employee_id
            AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
            AND a.status NOT IN ('canceled', 'completed')
            AND (
                (NEW.start_time, NEW.end_time) OVERLAPS (a.start_time, a.end_time)
            )
        ) THEN
            RAISE EXCEPTION 'Employee % has overlapping appointments at this time', NEW.employee_id;
        END IF;
    END IF;

    -- Validação para comandas
    IF TG_TABLE_NAME = 'comandas' THEN
        IF NEW.client_id IS NULL THEN
            RAISE EXCEPTION 'Client ID cannot be null for comandas';
        END IF;

        IF NEW.cashier_id IS NULL THEN
            RAISE EXCEPTION 'Cashier ID cannot be null for comandas';
        END IF;

        -- Verificar na tabela customers em vez de users
        IF NOT EXISTS (
            SELECT 1 FROM customers 
            WHERE id = NEW.client_id
        ) THEN
            RAISE EXCEPTION 'Comanda client % does not exist in customers table', NEW.client_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM users 
            WHERE id = NEW.cashier_id AND role IN ('cashier', 'admin')
        ) THEN
            RAISE EXCEPTION 'Comanda cashier % must have cashier or admin role', NEW.cashier_id;
        END IF;

        -- Validação do total final
        IF NEW.final_total != (NEW.total - COALESCE(NEW.discount, 0) + COALESCE(NEW.taxes, 0)) THEN
            RAISE EXCEPTION 'Final total does not match calculation: total - discount + taxes';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Ativar o trigger para garantir que ele está funcionando
DROP TRIGGER IF EXISTS validate_appointments_trigger ON appointments;
DROP TRIGGER IF EXISTS validate_comandas_trigger ON comandas;
DROP TRIGGER IF EXISTS validate_user_subscriptions_trigger ON user_subscriptions;

CREATE TRIGGER validate_appointments_trigger
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION validate_user_role();

CREATE TRIGGER validate_comandas_trigger
BEFORE INSERT OR UPDATE ON comandas
FOR EACH ROW
EXECUTE FUNCTION validate_user_role();

CREATE TRIGGER validate_user_subscriptions_trigger
BEFORE INSERT OR UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION validate_user_role();

-- Concluir a transação
COMMIT; 