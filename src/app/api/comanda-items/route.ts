import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route POST /api/comanda-items
 * @description Adiciona um novo item a uma comanda
 * @access Privado - Apenas admin, employee ou cashier
 * 
 * @requestBody {
 *   comanda_id: string,
 *   product_id?: string,
 *   service_id?: string,
 *   quantity: number,
 *   unit_price?: number,
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
 * 1. Valida que a comanda está aberta
 * 2. Valida que produto ou serviço existe
 * 3. Calcula preço unitário e total
 * 4. Atualiza os totais da comanda
 * 5. Diminui o estoque do produto, se aplicável
 */
export const POST = withRole(['admin', 'employee', 'cashier'], async (req: NextRequest) => {
  try {
    const user = (req as any).user;
    
    // Schema de validação
    const itemSchema = z.object({
      comanda_id: z.string().uuid({ message: 'ID da comanda inválido' }),
      product_id: z.string().uuid({ message: 'ID do produto inválido' }).optional(),
      service_id: z.string().uuid({ message: 'ID do serviço inválido' }).optional(),
      quantity: z.number().positive({ message: 'Quantidade deve ser maior que zero' }),
      unit_price: z.number().optional(),
      discount_amount: z.number().nonnegative({ message: 'Desconto deve ser não negativo' }).default(0),
      notes: z.string().optional(),
    }).refine(data => data.product_id || data.service_id, {
      message: 'Deve ser fornecido product_id ou service_id'
    }).refine(data => !(data.product_id && data.service_id), {
      message: 'Não pode fornecer product_id e service_id simultaneamente'
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = itemSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { comanda_id, product_id, service_id, quantity, unit_price: providedUnitPrice, discount_amount, notes } = validationResult.data;
    
    try {
      // Buscar preço unitário, se não foi fornecido
      let unitPrice = providedUnitPrice;
      
      if (!unitPrice) {
        if (product_id) {
          const { data: product } = await supabaseAdmin
            .from('products')
            .select('price')
            .eq('id', product_id)
            .single();
            
          unitPrice = product?.price || 0;
        } else if (service_id) {
          const { data: service } = await supabaseAdmin
            .from('services')
            .select('price')
            .eq('id', service_id)
            .single();
            
          unitPrice = service?.price || 0;
        }
      }
      
      // Usar a função add_comanda_item para fazer tudo em uma transação
      const { data: item, error } = await supabaseAdmin.rpc('add_comanda_item', {
        p_comanda_id: comanda_id,
        p_product_id: product_id || null,
        p_service_id: service_id || null,
        p_quantity: quantity,
        p_unit_price: unitPrice,
        p_user_id: user.id
      });
      
      if (error) {
        return ApiErrors.DATABASE_ERROR(`Erro ao adicionar item: ${error.message}`);
      }
      
      return successResponse(item, { 
        message: 'Item adicionado com sucesso' 
      });
      
    } catch (error: any) {
      return ApiErrors.VALIDATION_ERROR(error.message);
    }
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 