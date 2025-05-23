import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

// Schema para validação dos dados do método de pagamento
const paymentMethodSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }),
  fee_percentage: z.number().min(0).max(100),
  description: z.string().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().default(true),
  icon_name: z.string().optional(),
});

/**
 * @route GET /api/payment-methods
 * @description Lista todos os métodos de pagamento
 * @access Privado - Requer autenticação com papéis admin, employee ou cashier
 */
export const GET = withRole(['admin', 'employee', 'cashier'], async (req: NextRequest) => {
  try {
    // Buscar todos os métodos de pagamento
    const { data: paymentMethods, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');

    if (error) {
      console.error('Erro ao buscar métodos de pagamento:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar métodos de pagamento: ${error.message}`);
    }

    return successResponse(paymentMethods);
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/payment-methods
 * @description Adiciona um novo método de pagamento
 * @access Privado - Apenas admin
 * 
 * @requestBody {
 *   name: string,
 *   fee_percentage: number,
 *   description?: string,
 *   is_default?: boolean,
 *   is_active?: boolean,
 *   icon_name?: string
 * }
 */
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const user = (req as any).user;
    
    // Validar corpo da requisição
    const requestBody = await req.json();
    const validationResult = paymentMethodSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }

    const paymentMethodData = validationResult.data;

    // Se está definindo como padrão, desativar outros métodos padrão
    if (paymentMethodData.is_default) {
      await supabaseAdmin
        .from('payment_methods')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    // Inserir novo método de pagamento
    const { data: newPaymentMethod, error } = await supabaseAdmin
      .from('payment_methods')
      .insert({
        ...paymentMethodData,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar método de pagamento:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao adicionar método de pagamento: ${error.message}`);
    }

    return successResponse(newPaymentMethod, { 
      status: 201, 
      message: 'Método de pagamento criado com sucesso' 
    });
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 