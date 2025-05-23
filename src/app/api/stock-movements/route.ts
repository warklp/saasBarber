import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/stock-movements
 * @description Lista movimentações de estoque com filtros opcionais
 * @access Privado - Apenas admin, employee ou cashier
 * 
 * @queryParams {
 *   product_id: string - ID do produto (opcional)
 *   start_date: string - Data inicial (opcional)
 *   end_date: string - Data final (opcional)
 *   movement_type: string - Tipo de movimentação (optional)
 * }
 * 
 * @response {
 *   success: true,
 *   data: Array<StockMovement>
 * }
 */
export const GET = withRole(['admin', 'employee', 'cashier'], async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    
    // Obter parâmetros de query
    const productId = url.searchParams.get('product_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const movementType = url.searchParams.get('movement_type');
    
    // Construir a query base
    let query = supabaseAdmin
      .from('stock_movements')
      .select(`
        id,
        product_id,
        product:product_id (id, name, sku),
        quantity,
        movement_type,
        reference_id,
        notes,
        created_at,
        created_by
      `)
      .order('created_at', { ascending: false });
    
    // Aplicar filtros
    if (productId) {
      query = query.eq('product_id', productId);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      const endDateWithTime = new Date(endDate);
      endDateWithTime.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDateWithTime.toISOString());
    }
    
    if (movementType) {
      query = query.eq('movement_type', movementType);
    }
    
    // Executar a consulta
    const { data, error } = await query;
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar movimentações de estoque: ${error.message}`);
    }
    
    return successResponse(data);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/stock-movements
 * @description Registra uma nova movimentação de estoque
 * @access Privado - Apenas admin, employee ou cashier
 * 
 * @requestBody {
 *   product_id: string,
 *   quantity: number,
 *   movement_type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'loss',
 *   reference_id?: string,
 *   notes?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: StockMovement
 * }
 * 
 * O endpoint:
 * 1. Valida os dados da movimentação
 * 2. Atualiza o estoque do produto
 * 3. Registra a movimentação
 * 4. Verifica se o estoque ficou abaixo do mínimo
 */
export const POST = withRole(['admin', 'employee', 'cashier'], async (req: NextRequest) => {
  try {
    const user = (req as any).user;
    
    // Schema de validação
    const movementSchema = z.object({
      product_id: z.string().uuid({ message: 'ID do produto inválido' }),
      quantity: z.number().int({ message: 'Quantidade deve ser um número inteiro' }).refine(val => val !== 0, { 
        message: 'Quantidade não pode ser zero' 
      }),
      movement_type: z.enum(['purchase', 'sale', 'adjustment', 'return', 'loss'], {
        errorMap: () => ({ message: 'Tipo de movimentação inválido' })
      }),
      reference_id: z.string().uuid({ message: 'ID de referência inválido' }).optional(),
      notes: z.string().optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = movementSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { product_id, quantity, movement_type, reference_id, notes } = validationResult.data;
    
    // Verificar se o produto existe
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name, stock_quantity, stock_minimum')
      .eq('id', product_id)
      .single();
      
    if (productError || !product) {
      return ApiErrors.VALIDATION_ERROR('Produto não encontrado');
    }
    
    // Calcular nova quantidade em estoque
    const stockDelta = ['purchase', 'return', 'adjustment'].includes(movement_type) ? 
      quantity : // Entrada em estoque (valor positivo para compras, retornos e ajustes positivos)
      -Math.abs(quantity); // Saída de estoque (valor negativo para vendas, perdas e ajustes negativos)
      
    const newStockQuantity = product.stock_quantity + stockDelta;
    
    // Impedir estoque negativo (exceto para ajustes)
    if (newStockQuantity < 0 && movement_type !== 'adjustment') {
      return ApiErrors.VALIDATION_ERROR('Estoque insuficiente para esta operação');
    }
    
    // Iniciar uma transação para garantir consistência
    const { error: txError } = await supabaseAdmin.rpc('begin_transaction');
    if (txError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao iniciar transação: ${txError.message}`);
    }
    
    try {
      // 1. Atualizar o estoque do produto
      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({ stock_quantity: newStockQuantity })
        .eq('id', product_id);
        
      if (updateError) {
        throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);
      }
      
      // 2. Registrar a movimentação
      const { data: movement, error: movementError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id,
          quantity: stockDelta, // Armazenamos o delta (positivo ou negativo)
          movement_type,
          reference_id,
          notes,
          created_by: user.id
        })
        .select(`
          id,
          product_id,
          product:product_id (id, name),
          quantity,
          movement_type,
          reference_id,
          notes,
          created_at,
          created_by
        `)
        .single();
        
      if (movementError) {
        throw new Error(`Erro ao registrar movimentação: ${movementError.message}`);
      }
      
      // 3. Verificar estoque mínimo
      if (newStockQuantity < product.stock_minimum) {
        // Registrar alerta de estoque baixo
        const { error: auditError } = await supabaseAdmin
          .from('audit_logs')
          .insert({
            entity_type: 'product',
            entity_id: product_id,
            action: 'low_stock_warning',
            details: {
              current_stock: newStockQuantity,
              minimum_stock: product.stock_minimum,
              product_name: product.name,
              triggered_by_movement: movement.id
            }
          });
          
        if (auditError) {
          console.error('Erro ao registrar alerta de estoque baixo:', auditError);
          // Não interrompemos o fluxo para esse erro
        }
      }
      
      // Confirmar a transação
      const { error: commitError } = await supabaseAdmin.rpc('commit_transaction');
      if (commitError) {
        throw new Error(`Erro ao confirmar transação: ${commitError.message}`);
      }
      
      return successResponse(movement, { 
        message: 'Movimentação de estoque registrada com sucesso',
        newStockQuantity
      }, 201);
      
    } catch (error: any) {
      // Reverter a transação em caso de erro
      await supabaseAdmin.rpc('rollback_transaction');
      return ApiErrors.DATABASE_ERROR(error.message);
    }
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 