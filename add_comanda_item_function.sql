-- Função para adicionar um item à comanda em uma única transação
CREATE OR REPLACE FUNCTION add_comanda_item(
  p_comanda_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_unit_price NUMERIC DEFAULT 0,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_comanda RECORD;
  v_item_id UUID;
  v_total_price NUMERIC;
  v_result JSON;
  v_item_type item_type;
BEGIN
  -- Verificar parâmetros obrigatórios
  IF p_comanda_id IS NULL THEN
    RAISE EXCEPTION 'ID da comanda não pode ser nulo';
  END IF;
  
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  
  IF p_unit_price < 0 THEN
    RAISE EXCEPTION 'Preço unitário não pode ser negativo';
  END IF;

  -- Determinar o tipo de item com base nos parâmetros
  IF p_product_id IS NOT NULL THEN
    v_item_type := 'product'::item_type;
  ELSIF p_service_id IS NOT NULL THEN
    v_item_type := 'service'::item_type;
  ELSE
    RAISE EXCEPTION 'É necessário fornecer um produto ou serviço';
  END IF;

  -- Verificar se a comanda existe e está aberta
  SELECT id, status, total
  INTO v_comanda
  FROM comandas
  WHERE id = p_comanda_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada';
  END IF;
  
  IF v_comanda.status <> 'aberta' THEN
    RAISE EXCEPTION 'Comanda não está aberta. Status atual: %', v_comanda.status;
  END IF;
  
  -- Calcular preço total do item
  v_total_price := p_quantity * p_unit_price;
  
  -- Inserir o item na comanda
  INSERT INTO comanda_items (
    comanda_id,
    product_id,
    service_id,
    quantity,
    unit_price,
    total_price,
    item_type
  )
  VALUES (
    p_comanda_id,
    p_product_id,
    p_service_id,
    p_quantity,
    p_unit_price,
    v_total_price,
    v_item_type
  )
  RETURNING id INTO v_item_id;
  
  -- Atualização simples do total da comanda (sem verificações complexas)
  UPDATE comandas
  SET total = COALESCE(total, 0) + v_total_price,
      final_total = COALESCE(total, 0) + v_total_price  -- Atualizamos final_total igual a total por enquanto
  WHERE id = p_comanda_id;
  
  -- Preparar resultado
  SELECT row_to_json(i.*)
  FROM comanda_items i
  WHERE i.id = v_item_id
  INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql; 