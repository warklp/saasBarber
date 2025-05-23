import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/subscription-plans
 * @description Lista todos os planos de assinatura disponíveis
 * @access Público (com anon key)
 * 
 * @queryParams {
 *   only_active: string - Se "true", retorna apenas planos ativos
 * }
 * 
 * @response {
 *   success: true,
 *   data: Array<SubscriptionPlan>
 * }
 * 
 * Consumidores deste endpoint:
 * - Página de contratação de planos
 * - Dashboard administrativo
 */
export const GET = async (req: NextRequest) => {
  try {
    // Verificar se deve retornar apenas planos ativos
    const url = new URL(req.url);
    const onlyActive = url.searchParams.get('only_active') === 'true';
    
    // Construir a query
    let query = supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('price');
    
    // Filtrar por planos ativos se solicitado
    if (onlyActive) {
      query = query.eq('is_active', true);
    }
    
    // Executar a consulta
    const { data, error } = await query;
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar planos de assinatura: ${error.message}`);
    }
    
    return successResponse(data);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
};

/**
 * @route POST /api/subscription-plans
 * @description Cria um novo plano de assinatura
 * @access Privado - Apenas admin
 * 
 * @requestBody {
 *   name: string,
 *   description?: string,
 *   price: number,
 *   duration_days: number,
 *   benefits: string[],
 *   is_active?: boolean
 * }
 * 
 * @response {
 *   success: true,
 *   data: SubscriptionPlan
 * }
 */
export const POST = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    // Schema de validação
    const planSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }),
      description: z.string().optional(),
      price: z.number().nonnegative({ message: 'Preço deve ser um valor não negativo' }),
      duration_days: z.number().int().positive({ message: 'Duração deve ser um número positivo de dias' }),
      benefits: z.array(z.string()).default([]),
      is_active: z.boolean().default(true),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = planSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { name, description, price, duration_days, benefits, is_active } = validationResult.data;
    
    // Inserir o plano no banco de dados
    const { data: plan, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert({
        name,
        description,
        price,
        duration_days,
        benefits,
        is_active
      })
      .select()
      .single();
      
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao criar plano de assinatura: ${error.message}`);
    }
    
    return successResponse(plan, { message: 'Plano de assinatura criado com sucesso' }, 201);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 