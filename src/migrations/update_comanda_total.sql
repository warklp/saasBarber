-- Função para atualizar o total de uma comanda com base em seus itens
CREATE OR REPLACE FUNCTION update_comanda_total(comanda_id_param UUID)
RETURNS VOID AS $$
BEGIN
  -- Atualizar o total da comanda com base na soma dos valores dos itens
  UPDATE comandas
  SET total = (
    SELECT COALESCE(SUM(total_price), 0)
    FROM comanda_items
    WHERE comanda_id = comanda_id_param
  )
  WHERE id = comanda_id_param;
END;
$$ LANGUAGE plpgsql; 