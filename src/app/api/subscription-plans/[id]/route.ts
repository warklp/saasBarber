import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/subscription-plans/:id
 * @description Recupera os detalhes de um plano de assinatura específico
 * @access Público (com anon key)
 * 
 * @param id - ID do plano de assinatura
 * 
 * @response {
 *   success: true,
 *   data: SubscriptionPlan
 * }
 */
export const GET = async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const planId = context.params.id;
    
    // Buscar o plano no banco de dados
    const { data: plan, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();
      
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar plano de assinatura: ${error.message}`);
    }
    
    if (!plan) {
      return ApiErrors.NOT_FOUND('Plano de assinatura não encontrado');
    }
    
    return successResponse(plan);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
};

/**
 * @route PATCH /api/subscription-plans/:id
 * @description Atualiza os dados de um plano de assinatura
 * @access Privado - Apenas admin
 * 
 * @param id - ID do plano de assinatura
 * 
 * @requestBody {
 *   name?: string,
 *   description?: string,
 *   price?: number,
 *   duration_days?: number,
 *   benefits?: string[],
 *   is_active?: boolean
 * }
 * 
 * @response {
 *   success: true,
 *   data: SubscriptionPlan
 * }
 */
export const PATCH = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const planId = context.params.id;
    
    // Schema de validação
    const updateSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }).optional(),
      description: z.string().optional().nullable(),
      price: z.number().nonnegative({ message: 'Preço deve ser um valor não negativo' }).optional(),
      duration_days: z.number().int().positive({ message: 'Duração deve ser um número positivo de dias' }).optional(),
      benefits: z.array(z.string()).optional(),
      is_active: z.boolean().optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = updateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    // Verificar se o plano existe
    const { data: existingPlan, error: checkError } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('id', planId)
      .single();
      
    if (checkError || !existingPlan) {
      return ApiErrors.NOT_FOUND('Plano de assinatura não encontrado');
    }
    
    // Atualizar o plano
    const { data: updatedPlan, error: updateError } = await supabaseAdmin
      .from('subscription_plans')
      .update(validationResult.data)
      .eq('id', planId)
      .select()
      .single();
      
    if (updateError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar plano de assinatura: ${updateError.message}`);
    }
    
    return successResponse(updatedPlan, { message: 'Plano de assinatura atualizado com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/subscription-plans/:id
 * @description Remove um plano de assinatura
 * @access Privado - Apenas admin
 * 
 * @param id - ID do plano de assinatura
 * 
 * @response {
 *   success: true,
 *   data: { message: string }
 * }
 * 
 * Importante: A exclusão só é possível se o plano não estiver sendo
 * utilizado por nenhum usuário.
 */
export const DELETE = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const planId = context.params.id;
    
    // Verificar se o plano existe
    const { data: plan, error: checkError } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('id', planId)
      .single();
      
    if (checkError || !plan) {
      return ApiErrors.NOT_FOUND('Plano de assinatura não encontrado');
    }
    
    // Verificar se o plano está em uso
    const { count: subscriptionCount, error: subscriptionError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', planId);
      
    if (subscriptionError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar assinaturas: ${subscriptionError.message}`);
    }
    
    if (subscriptionCount && subscriptionCount > 0) {
      return ApiErrors.VALIDATION_ERROR(
        `Não é possível excluir o plano pois está sendo usado por ${subscriptionCount} usuário(s)`
      );
    }
    
    // Remover o plano
    const { error: deleteError } = await supabaseAdmin
      .from('subscription_plans')
      .delete()
      .eq('id', planId);
      
    if (deleteError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao remover plano de assinatura: ${deleteError.message}`);
    }
    
    return successResponse({ 
      message: 'Plano de assinatura removido com sucesso',
      id: planId 
    });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 