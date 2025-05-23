import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route DELETE /api/comanda-items/:id
 * @description Remove um item de uma comanda
 * @access Privado - Apenas admin, employee ou cashier
 * 
 * @param id - ID do item da comanda
 * 
 * @response {
 *   success: true,
 *   data: { message: string, id: string, item: object, comanda: object }
 * }
 * 
 * O endpoint remove o item da comanda usando a função remove_comanda_item do banco de dados,
 * que atualiza automaticamente os totais da comanda através de triggers.
 */
export const DELETE = withRole(['admin', 'employee', 'cashier'], async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const itemId = context.params.id;
    console.log(`Removendo item ID: ${itemId}`);
    
    // Usar a função remove_comanda_item para remover o item
    const { data, error } = await supabaseAdmin.rpc('remove_comanda_item', {
      p_item_id: itemId
    });
    
    console.log('Resposta da função remove_comanda_item:', { data, error });
    
    if (error) {
      console.error('Erro ao remover item:', error);
      return ApiErrors.VALIDATION_ERROR(error.message);
    }
    
    return successResponse({ 
      message: 'Item removido com sucesso',
      id: itemId,
      item: data?.item,
      comanda: data?.comanda
    });
    
  } catch (error: any) {
    console.error('Erro inesperado ao remover item:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/comanda-items/:id
 * @description Atualiza a quantidade ou desconto de um item de comanda
 * @access Privado - Apenas admin, employee ou cashier
 * 
 * @param id - ID do item da comanda
 * 
 * @requestBody {
 *   quantity?: number,
 *   discount_amount?: number,
 *   notes?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: ComandaItem
 * }
 * 
 * O endpoint:
 * 1. Verifica se a comanda está aberta
 * 2. Atualiza o item
 * 3. Recalcula o preço total do item
 * 4. Atualiza os totais da comanda
 * 5. Ajusta o estoque do produto, se aplicável
 */
export const PATCH = withRole(['admin', 'employee', 'cashier'], async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const itemId = context.params.id;
    
    // Schema de validação
    const updateSchema = z.object({
      quantity: z.number().positive({ message: 'Quantidade deve ser maior que zero' }).optional(),
      discount_amount: z.number().nonnegative({ message: 'Desconto deve ser não negativo' }).optional(),
      notes: z.string().optional(),
    }).refine(data => Object.keys(data).length > 0, {
      message: 'Nenhum campo para atualizar foi fornecido'
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = updateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const updates = validationResult.data;
    
    // Iniciar uma transação
    const { error: txError } = await supabaseAdmin.rpc('begin_transaction');
    if (txError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao iniciar transação: ${txError.message}`);
    }
    
    try {
      // Buscar informações do item
      const { data: item, error: itemError } = await supabaseAdmin
        .from('comanda_items')
        .select(`
          id,
          comanda_id,
          product_id,
          service_id,
          quantity,
          unit_price,
          discount_amount,
          total_price
        `)
        .eq('id', itemId)
        .single();
        
      if (itemError || !item) {
        throw new Error('Item não encontrado');
      }
      
      // Verificar se a comanda existe e está aberta
      const { data: comanda, error: comandaError } = await supabaseAdmin
        .from('comandas')
        .select('id, status, subtotal, tax_amount, discount_amount, total_amount')
        .eq('id', item.comanda_id)
        .single();
        
      if (comandaError || !comanda) {
        throw new Error('Comanda não encontrada');
      }
      
      if (comanda.status !== 'open') {
        throw new Error(`Comanda está ${comanda.status}, não é possível editar itens`);
      }
      
      // Se estiver alterando a quantidade e for um produto, verificar estoque
      if (updates.quantity && item.product_id) {
        const quantityDiff = updates.quantity - item.quantity;
        
        if (quantityDiff < 0) {
          // Devolvendo ao estoque (quantidade diminuiu)
          const quantityToReturn = -quantityDiff;
          
          // Atualizar estoque do produto
          const { data: product, error: productError } = await supabaseAdmin
            .from('products')
            .select('id, stock_quantity')
            .eq('id', item.product_id)
            .single();
            
          if (productError || !product) {
            throw new Error('Produto não encontrado');
          }
          
          const { error: stockError } = await supabaseAdmin
            .from('products')
            .update({ stock_quantity: product.stock_quantity + quantityToReturn })
            .eq('id', item.product_id);
            
          if (stockError) {
            throw new Error(`Erro ao atualizar estoque: ${stockError.message}`);
          }
          
          // Registrar movimentação de estoque
          const { error: movementError } = await supabaseAdmin
            .from('stock_movements')
            .insert({
              product_id: item.product_id,
              quantity: quantityToReturn,
              movement_type: 'return',
              reference_id: item.comanda_id,
              notes: `Ajuste - Quantidade reduzida no item da comanda #${item.comanda_id}`,
              created_by: user.id
            });
            
          if (movementError) {
            console.error('Erro ao registrar movimentação de estoque:', movementError);
            // Não interrompemos o fluxo para esse erro
          }
          
        } else if (quantityDiff > 0) {
          // Retirando do estoque (quantidade aumentou)
          const quantityToRemove = quantityDiff;
          
          // Verificar se há estoque suficiente
          const { data: product, error: productError } = await supabaseAdmin
            .from('products')
            .select('id, name, stock_quantity')
            .eq('id', item.product_id)
            .single();
            
          if (productError || !product) {
            throw new Error('Produto não encontrado');
          }
          
          if (product.stock_quantity < quantityToRemove) {
            throw new Error(`Estoque insuficiente para ${product.name}`);
          }
          
          const { error: stockError } = await supabaseAdmin
            .from('products')
            .update({ stock_quantity: product.stock_quantity - quantityToRemove })
            .eq('id', item.product_id);
            
          if (stockError) {
            throw new Error(`Erro ao atualizar estoque: ${stockError.message}`);
          }
          
          // Registrar movimentação de estoque
          const { error: movementError } = await supabaseAdmin
            .from('stock_movements')
            .insert({
              product_id: item.product_id,
              quantity: -quantityToRemove,
              movement_type: 'sale',
              reference_id: item.comanda_id,
              notes: `Ajuste - Quantidade aumentada no item da comanda #${item.comanda_id}`,
              created_by: user.id
            });
            
          if (movementError) {
            console.error('Erro ao registrar movimentação de estoque:', movementError);
            // Não interrompemos o fluxo para esse erro
          }
        }
      }
      
      // Calcular novo preço total do item
      const quantity = updates.quantity || item.quantity;
      const discountAmount = updates.discount_amount !== undefined ? updates.discount_amount : item.discount_amount;
      const newTotalPrice = (item.unit_price * quantity) - discountAmount;
      
      // Atualizar o item
      const updateData = {
        ...updates,
        total_price: newTotalPrice
      };
      
      const { data: updatedItem, error: updateItemError } = await supabaseAdmin
        .from('comanda_items')
        .update(updateData)
        .eq('id', itemId)
        .select(`
          id,
          comanda_id,
          product_id,
          product:product_id (id, name, price),
          service_id,
          service:service_id (id, name, price),
          quantity,
          unit_price,
          discount_amount,
          total_price,
          notes,
          created_at
        `)
        .single();
        
      if (updateItemError) {
        throw new Error(`Erro ao atualizar item: ${updateItemError.message}`);
      }
      
      // Recalcular totais da comanda
      // Buscar todos os itens atualizados
      const { data: allItems, error: allItemsError } = await supabaseAdmin
        .from('comanda_items')
        .select('total_price')
        .eq('comanda_id', item.comanda_id);
        
      if (allItemsError) {
        throw new Error(`Erro ao buscar itens da comanda: ${allItemsError.message}`);
      }
      
      const newSubtotal = (allItems || []).reduce((sum, i) => sum + i.total_price, 0);
      const taxRate = 0.10;
      const newTaxAmount = newSubtotal * taxRate;
      const newTotalAmount = newSubtotal + newTaxAmount - (comanda.discount_amount || 0);
      
      const { error: updateComandaError } = await supabaseAdmin
        .from('comandas')
        .update({
          subtotal: newSubtotal,
          tax_amount: newTaxAmount,
          total_amount: newTotalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.comanda_id);
        
      if (updateComandaError) {
        throw new Error(`Erro ao atualizar totais da comanda: ${updateComandaError.message}`);
      }
      
      // Registrar log de auditoria
      const { error: auditError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          entity_type: 'comanda_item',
          entity_id: itemId,
          action: 'update',
          created_by: user.id,
          details: {
            comanda_id: item.comanda_id,
            previous: {
              quantity: item.quantity,
              discount_amount: item.discount_amount,
              total_price: item.total_price
            },
            current: {
              quantity: updatedItem.quantity,
              discount_amount: updatedItem.discount_amount,
              total_price: updatedItem.total_price
            }
          }
        });
        
      if (auditError) {
        console.error('Erro ao registrar log de auditoria:', auditError);
        // Não interrompemos o fluxo para esse erro
      }
      
      // Confirmar a transação
      const { error: commitError } = await supabaseAdmin.rpc('commit_transaction');
      if (commitError) {
        throw new Error(`Erro ao confirmar transação: ${commitError.message}`);
      }
      
      return successResponse(updatedItem, { 
        message: 'Item atualizado com sucesso',
        comanda_total: newTotalAmount
      });
      
    } catch (error: any) {
      // Reverter a transação em caso de erro
      await supabaseAdmin.rpc('rollback_transaction');
      return ApiErrors.VALIDATION_ERROR(error.message);
    }
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 