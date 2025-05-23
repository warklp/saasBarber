import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/user-subscriptions/:id
 * @description Recupera os detalhes de uma assinatura específica
 * @access Privado - Requer autenticação
 * 
 * @param id - ID da assinatura
 * 
 * @response {
 *   success: true,
 *   data: UserSubscription
 * }
 * 
 * O acesso é controlado:
 * - Admin e funcionários podem ver qualquer assinatura
 * - Cliente pode ver apenas suas próprias assinaturas
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const subscriptionId = context.params.id;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Buscar dados da assinatura
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        id,
        user_id,
        user:user_id (id, name, email),
        plan_id,
        plan:plan_id (id, name, price, duration_days, benefits),
        start_date,
        end_date,
        status,
        payment_method,
        payment_details,
        created_at,
        updated_at
      `)
      .eq('id', subscriptionId)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Assinatura não encontrada');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar assinatura: ${error.message}`);
    }
    
    // Verificar permissões
    if (userData.role === 'client' && subscription.user_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você não tem permissão para ver esta assinatura');
    }
    
    return successResponse(subscription);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/user-subscriptions/:id
 * @description Atualiza uma assinatura existente
 * @access Privado - Apenas admin ou usuário dono da assinatura (com limitações)
 * 
 * @param id - ID da assinatura
 * 
 * @requestBody {
 *   status?: 'active' | 'canceled' | 'expired',
 *   payment_method?: string,
 *   payment_details?: object,
 *   end_date?: string (ISO date) - Apenas admin pode alterar
 * }
 * 
 * @response {
 *   success: true,
 *   data: UserSubscription
 * }
 * 
 * Clientes só podem cancelar suas assinaturas, não podem alterar outros dados.
 * Admins podem modificar qualquer dado da assinatura.
 */
export const PATCH = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const subscriptionId = context.params.id;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Buscar assinatura atual
    const { data: currentSubscription, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, status')
      .eq('id', subscriptionId)
      .single();
      
    if (subError) {
      if (subError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Assinatura não encontrada');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar assinatura: ${subError.message}`);
    }
    
    // Verificar permissões
    const isAdmin = userData.role === 'admin';
    const isOwner = currentSubscription.user_id === user.id;
    
    if (!isAdmin && !isOwner) {
      return ApiErrors.FORBIDDEN('Você não tem permissão para modificar esta assinatura');
    }
    
    // Schema de validação diferente para admin e cliente
    let updateSchema;
    
    if (isAdmin) {
      // Admin pode atualizar todos os campos
      updateSchema = z.object({
        status: z.enum(['active', 'canceled', 'expired']).optional(),
        payment_method: z.string().optional(),
        payment_details: z.record(z.any()).optional(),
        end_date: z.string().refine(val => !isNaN(Date.parse(val)), {
          message: 'Data de término inválida'
        }).optional(),
      });
    } else {
      // Cliente só pode cancelar
      updateSchema = z.object({
        status: z.literal('canceled')
      });
    }
    
    // Validar dados
    const body = await req.json();
    const validationResult = updateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    // Atualizar a assinatura
    const { data: updatedSubscription, error: updateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update(validationResult.data)
      .eq('id', subscriptionId)
      .select(`
        id,
        user_id,
        user:user_id (id, name, email),
        plan_id,
        plan:plan_id (id, name, price, duration_days, benefits),
        start_date,
        end_date,
        status,
        payment_method,
        payment_details,
        created_at,
        updated_at
      `)
      .single();
      
    if (updateError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar assinatura: ${updateError.message}`);
    }
    
    return successResponse(updatedSubscription, { message: 'Assinatura atualizada com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/user-subscriptions/:id
 * @description Remove uma assinatura permanentemente
 * @access Privado - Apenas admin
 * 
 * @param id - ID da assinatura
 * 
 * @response {
 *   success: true,
 *   data: { message: string }
 * }
 * 
 * Em vez de excluir, considere atualizar o status para 'canceled' ou 'expired'.
 * A exclusão permanente é recomendada apenas para casos especiais (erros, testes, etc).
 */
export const DELETE = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const subscriptionId = context.params.id;
    
    // Verificar se a assinatura existe
    const { data: subscription, error: checkError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id')
      .eq('id', subscriptionId)
      .single();
      
    if (checkError || !subscription) {
      return ApiErrors.NOT_FOUND('Assinatura não encontrada');
    }
    
    // Remover a assinatura
    const { error: deleteError } = await supabaseAdmin
      .from('user_subscriptions')
      .delete()
      .eq('id', subscriptionId);
      
    if (deleteError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao remover assinatura: ${deleteError.message}`);
    }
    
    return successResponse({ 
      message: 'Assinatura removida com sucesso',
      id: subscriptionId 
    });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 