import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

// Schema para validação dos dados de atualização
const updatePaymentMethodSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }).optional(),
  fee_percentage: z.number().min(0).max(100).optional(),
  description: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  icon_name: z.string().optional().nullable(),
});

/**
 * @route GET /api/payment-methods/[id]
 * @description Obtém um método de pagamento específico
 * @access Privado - Apenas admin
 */
export const GET = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const id = context.params.id;

    const { data, error } = await supabaseAdmin
      .from('payment_methods')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Método de pagamento não encontrado');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar método de pagamento: ${error.message}`);
    }

    return successResponse(data);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/payment-methods/[id]
 * @description Atualiza um método de pagamento
 * @access Privado - Apenas admin
 * 
 * @param id - ID do método de pagamento
 * 
 * @requestBody {
 *   name?: string,
 *   fee_percentage?: number,
 *   description?: string,
 *   is_default?: boolean,
 *   is_active?: boolean,
 *   icon_name?: string
 * }
 */
export const PATCH = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const id = context.params.id;

    // Verificar se o método de pagamento existe
    const { data: existingMethod, error: checkError } = await supabaseAdmin
      .from('payment_methods')
      .select('id, is_default')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Método de pagamento não encontrado');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar método de pagamento: ${checkError.message}`);
    }

    // Validar corpo da requisição
    const requestBody = await req.json();
    const validationResult = updatePaymentMethodSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }

    const updateData = validationResult.data;

    // Se está definindo como padrão, desativar outros métodos padrão
    if (updateData.is_default && !existingMethod.is_default) {
      await supabaseAdmin
        .from('payment_methods')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    // Atualizar método de pagamento
    const { data: updatedMethod, error } = await supabaseAdmin
      .from('payment_methods')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar método de pagamento: ${error.message}`);
    }

    return successResponse(updatedMethod, { message: 'Método de pagamento atualizado com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/payment-methods/[id]
 * @description Remove um método de pagamento
 * @access Privado - Apenas admin
 * 
 * @param id - ID do método de pagamento
 */
export const DELETE = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const id = context.params.id;

    // Verificar se o método existe e se é padrão
    const { data: method, error: checkError } = await supabaseAdmin
      .from('payment_methods')
      .select('is_default')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Método de pagamento não encontrado');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar método de pagamento: ${checkError.message}`);
    }

    // Não permitir exclusão do método padrão
    if (method.is_default) {
      return ApiErrors.VALIDATION_ERROR('Não é possível excluir o método de pagamento padrão');
    }

    // Verificar se o método está sendo usado em alguma transação
    const { count, error: usageError } = await supabaseAdmin
      .from('financial_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('payment_method_id', id);

    if (usageError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar uso do método de pagamento: ${usageError.message}`);
    }

    if (count && count > 0) {
      return ApiErrors.VALIDATION_ERROR(
        'Este método de pagamento não pode ser excluído pois está sendo usado em transações'
      );
    }

    // Excluir método de pagamento
    const { error } = await supabaseAdmin
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao excluir método de pagamento: ${error.message}`);
    }

    return successResponse(null, { 
      message: 'Método de pagamento excluído com sucesso',
      status: 204
    });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 