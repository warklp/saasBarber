-- Criação dos tipos ENUM
CREATE TYPE user_role AS ENUM ('client', 'admin', 'cashier', 'employee');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'canceled', 'completed', 'in_progress', 'no_show');
CREATE TYPE payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'pix');
CREATE TYPE item_type AS ENUM ('service', 'product');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE stock_movement_type AS ENUM ('entry', 'exit', 'adjustment');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- Tabela de Audit Trail
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action audit_action NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Tabela de usuários (extends auth.users do Supabase)
CREATE TABLE users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Planos de assinatura
CREATE TABLE subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Assinaturas dos usuários
CREATE TABLE user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES subscription_plans(id) ON DELETE RESTRICT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Serviços
CREATE TABLE services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Agendamentos
CREATE TABLE appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    employee_id UUID REFERENCES users(id) ON DELETE RESTRICT,  -- Pode ser null inicialmente
    service_id UUID REFERENCES services(id) ON DELETE RESTRICT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status appointment_status DEFAULT 'scheduled' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT valid_appointment_time CHECK (end_time > start_time)
);

-- Produtos
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
    sale_price DECIMAL(10,2) NOT NULL CHECK (sale_price >= cost_price),
    quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
    min_stock_alert INTEGER DEFAULT 5 CHECK (min_stock_alert >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Comandas
CREATE TABLE comandas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    client_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
    discount DECIMAL(10,2) DEFAULT 0 CHECK (discount >= 0),
    taxes DECIMAL(10,2) DEFAULT 0 CHECK (taxes >= 0),
    final_total DECIMAL(10,2) NOT NULL CHECK (final_total >= 0),
    payment_method payment_method NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Itens da Comanda
CREATE TABLE comanda_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comanda_id UUID REFERENCES comandas(id) ON DELETE CASCADE NOT NULL,
    item_type item_type NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT valid_item_reference CHECK (
        (item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL) OR
        (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
    )
);

-- Taxas
CREATE TABLE taxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    description TEXT,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Transações Financeiras
CREATE TABLE financial_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type transaction_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    comanda_id UUID REFERENCES comandas(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Movimentações de Estoque
CREATE TABLE stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
    movement_type stock_movement_type NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity != 0),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para otimização
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_employee_id ON appointments(employee_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_comanda_items_comanda_id ON comanda_items(comanda_id);
CREATE INDEX idx_financial_transactions_comanda_id ON financial_transactions(comanda_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Função para validação de roles com mensagens mais detalhadas
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

        IF NOT EXISTS (
            SELECT 1 FROM users 
            WHERE id = NEW.client_id AND role = 'client'
        ) THEN
            RAISE EXCEPTION 'Appointment client % must have client role', NEW.client_id;
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

        IF NOT EXISTS (
            SELECT 1 FROM users 
            WHERE id = NEW.client_id AND role = 'client'
        ) THEN
            RAISE EXCEPTION 'Comanda client % must have client role', NEW.client_id;
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

-- Função para audit trail
CREATE OR REPLACE FUNCTION audit_trail_trigger()
RETURNS TRIGGER AS $$
DECLARE
    old_data_json JSONB;
    new_data_json JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        old_data_json = to_jsonb(OLD);
        new_data_json = NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data_json = to_jsonb(OLD);
        new_data_json = to_jsonb(NEW);
    ELSE
        old_data_json = NULL;
        new_data_json = to_jsonb(NEW);
    END IF;

    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by,
        changed_at
    ) VALUES (
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP::audit_action,
        old_data_json,
        new_data_json,
        auth.uid(),
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para alerta de estoque baixo
CREATE OR REPLACE FUNCTION check_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity_in_stock <= NEW.min_stock_alert THEN
        -- Aqui você pode implementar a lógica de notificação
        -- Por exemplo, inserir em uma tabela de notificações
        RAISE NOTICE 'Low stock alert for product %: % units remaining', NEW.id, NEW.quantity_in_stock;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de audit trail para tabelas principais
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trail_trigger();

CREATE TRIGGER audit_appointments
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION audit_trail_trigger();

CREATE TRIGGER audit_comandas
    AFTER INSERT OR UPDATE OR DELETE ON comandas
    FOR EACH ROW EXECUTE FUNCTION audit_trail_trigger();

CREATE TRIGGER audit_financial_transactions
    AFTER INSERT OR UPDATE OR DELETE ON financial_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trail_trigger();

-- Trigger para alerta de estoque
CREATE TRIGGER check_product_stock
    AFTER INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION check_stock_alert();

-- Políticas RLS adicionais e ajustadas
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Políticas RLS (Row Level Security)
-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data" ON users 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view users" ON users 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert users" ON users 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update users" ON users 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete users" ON users 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can view client data" ON users 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'employee'
        ) 
        AND role = 'client'
    );

-- Appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own appointments" ON appointments 
    FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Employees can view their assigned appointments" ON appointments 
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Admins can view appointments" ON appointments 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert appointments" ON appointments 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update appointments" ON appointments 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete appointments" ON appointments 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can update their appointments" ON appointments 
    FOR UPDATE USING (
        auth.uid() = employee_id 
        AND status NOT IN ('completed', 'canceled')
    );

CREATE POLICY "Employees can delete their appointments" ON appointments 
    FOR DELETE USING (
        auth.uid() = employee_id 
        AND status NOT IN ('completed', 'canceled')
    );

-- Services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active services" ON services 
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all services" ON services 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert services" ON services 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update services" ON services 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete services" ON services 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON products 
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all products" ON products 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert products" ON products 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update products" ON products 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete products" ON products 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Comandas
ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own comandas" ON comandas 
    FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "Cashiers can view comandas" ON comandas 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('cashier', 'admin')
        )
    );

CREATE POLICY "Cashiers can insert comandas" ON comandas 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('cashier', 'admin')
        )
    );

CREATE POLICY "Cashiers can update comandas" ON comandas 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('cashier', 'admin')
        )
    );

CREATE POLICY "Cashiers can delete comandas" ON comandas 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('cashier', 'admin')
        )
    );

-- Financial Transactions
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" ON financial_transactions 
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all transactions" ON financial_transactions 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert transactions" ON financial_transactions 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update transactions" ON financial_transactions 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete transactions" ON financial_transactions 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Stock Movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view stock" ON stock_movements 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'employee'
        )
    );

CREATE POLICY "Admins can view stock" ON stock_movements 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert stock movements" ON stock_movements 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update stock movements" ON stock_movements 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete stock movements" ON stock_movements 
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_subscription_plans
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_user_subscriptions
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_services
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_appointments
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_products
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_comandas
    BEFORE UPDATE ON comandas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_comanda_items
    BEFORE UPDATE ON comanda_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_taxes
    BEFORE UPDATE ON taxes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_financial_transactions
    BEFORE UPDATE ON financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_timestamp_stock_movements
    BEFORE UPDATE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 