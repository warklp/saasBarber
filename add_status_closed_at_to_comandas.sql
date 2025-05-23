-- Primeiro, criamos o tipo ENUM para o status da comanda
CREATE TYPE comanda_status AS ENUM ('aberta', 'fechada', 'cancelada');

-- Agora, adicionamos a coluna de status à tabela comandas com valor padrão 'aberta'
ALTER TABLE comandas ADD COLUMN status comanda_status NOT NULL DEFAULT 'aberta';

-- Adicionamos a coluna closed_at que será preenchida quando a comanda for fechada
ALTER TABLE comandas ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;

-- Criamos uma função que atualiza automaticamente o closed_at quando o status muda para 'fechada'
CREATE OR REPLACE FUNCTION update_comanda_closed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'fechada' AND OLD.status != 'fechada' THEN
        NEW.closed_at = TIMEZONE('utc'::text, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criamos um trigger que executa a função quando o status é atualizado
CREATE TRIGGER set_comanda_closed_at
BEFORE UPDATE ON comandas
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_comanda_closed_at();

-- Atualizamos comandas existentes que têm payment_method preenchido para status 'fechada'
UPDATE comandas SET status = 'fechada' WHERE payment_method IS NOT NULL;

-- Para comandas já fechadas, definimos o closed_at como updated_at (para ter uma data aproximada)
UPDATE comandas SET closed_at = updated_at WHERE status = 'fechada' AND closed_at IS NULL;

COMMENT ON COLUMN comandas.status IS 'Status da comanda (aberta, fechada ou cancelada)';
COMMENT ON COLUMN comandas.closed_at IS 'Data e hora em que a comanda foi fechada'; 