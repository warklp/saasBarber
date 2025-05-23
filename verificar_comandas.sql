-- Verificar se a coluna status e closed_at foram adicionadas
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'comandas' AND 
    column_name IN ('status', 'closed_at');

-- Verificar se o tipo ENUM comanda_status foi criado
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM 
    pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
WHERE 
    t.typname = 'comanda_status'
ORDER BY 
    e.enumsortorder;

-- Verificar quantas comandas existem em cada status
SELECT 
    status, 
    COUNT(*) as total_comandas,
    COUNT(closed_at) as comandas_com_data_fechamento,
    COUNT(*) - COUNT(closed_at) as comandas_sem_data_fechamento
FROM 
    comandas 
GROUP BY 
    status;

-- Verificar se existe alguma comanda com payment_method mas sem status fechada
SELECT 
    id, 
    status, 
    payment_method, 
    closed_at 
FROM 
    comandas 
WHERE 
    payment_method IS NOT NULL AND 
    status != 'fechada';

-- Verificar se existe alguma comanda com status fechada mas sem closed_at
SELECT 
    id, 
    status, 
    payment_method, 
    closed_at 
FROM 
    comandas 
WHERE 
    status = 'fechada' AND 
    closed_at IS NULL;

-- Verificar se o trigger foi criado corretamente
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM 
    information_schema.triggers
WHERE 
    event_object_table = 'comandas' AND 
    trigger_name = 'set_comanda_closed_at'; 