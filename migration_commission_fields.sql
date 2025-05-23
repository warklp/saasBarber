-- Adicionar campo de comissão padrão na tabela services
ALTER TABLE services ADD COLUMN default_commission_percentage DECIMAL(5,2) DEFAULT 0;

-- Criar tabela de relação entre funcionários e serviços
CREATE TABLE user_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    custom_commission_percentage DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, service_id)
);

-- Adicionar comentários para documentação
COMMENT ON TABLE user_services IS 'Tabela de relação entre funcionários e serviços que eles podem realizar, incluindo comissões personalizadas';
COMMENT ON COLUMN services.default_commission_percentage IS 'Percentual de comissão padrão para este serviço';
COMMENT ON COLUMN user_services.custom_commission_percentage IS 'Percentual de comissão personalizada para este funcionário neste serviço (se NULL, usa o valor padrão do serviço)';

-- Criar índices para melhorar a performance de buscas
CREATE INDEX idx_user_services_user_id ON user_services(user_id);
CREATE INDEX idx_user_services_service_id ON user_services(service_id);

-- Adicionar trigger para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_services_updated_at
BEFORE UPDATE ON user_services
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Configurar RLS (Row Level Security) para a tabela user_services
ALTER TABLE user_services ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura para administradores e funcionários
CREATE POLICY user_services_select_policy ON user_services
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND (
            -- Administradores podem ver todos os registros
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
            OR 
            -- Funcionários podem ver seus próprios registros
            user_id = auth.uid()
            OR
            -- Gerentes também podem ver
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'manager')
        )
    );

-- Política para permitir inserção para administradores e gerentes
CREATE POLICY user_services_insert_policy ON user_services
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
            OR
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'manager')
        )
    );

-- Política para permitir atualização para administradores e gerentes
CREATE POLICY user_services_update_policy ON user_services
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
            OR
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'manager')
        )
    );

-- Política para permitir exclusão para administradores e gerentes
CREATE POLICY user_services_delete_policy ON user_services
    FOR DELETE
    USING (
        auth.role() = 'authenticated' AND (
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin')
            OR
            EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'manager')
        )
    ); 