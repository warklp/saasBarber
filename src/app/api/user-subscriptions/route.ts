import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/user-subscriptions
 * @description Lista assinaturas de usuários com filtros opcionais
 * @access Privado - Requer autenticação
 * 
 * @queryParams {
 *   user_id: string - ID do usuário (opcional)
 *   status: string - Status da assinatura (opcional)
 *   active_only: string - Se "true", retorna apenas assinaturas ativas
 * }
 * 
 * @response {
 *   success: true,
 *   data: Array<UserSubscription>
 * }
 * 
 * O acesso é controlado por RLS e middleware:
 * - Admin e funcionários podem ver todas as assinaturas ou filtrar por usuário
 * - Clientes podem ver apenas suas próprias assinaturas
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const url = new URL(req.url);
    
    // Obter parâmetros de query
    const queryUserId = url.searchParams.get('user_id');
    const status = url.searchParams.get('status');
    const activeOnly = url.searchParams.get('active_only') === 'true';
    
    // Verificar role do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Construir a query base
    let query = supabaseAdmin
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
      `);
    
    // Aplicar filtros baseados no papel do usuário
    if (userData.role === 'client') {
      // Clientes só podem ver suas próprias assinaturas
      query = query.eq('user_id', user.id);
    } else if ((userData.role === 'admin' || userData.role === 'employee') && queryUserId) {
      // Admin e funcionários podem filtrar por usuário específico
      query = query.eq('user_id', queryUserId);
    }
    
    // Filtrar por status se especificado
    if (status) {
      query = query.eq('status', status);
    }
    
    // Filtrar apenas assinaturas ativas se solicitado
    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      query = query
        .eq('status', 'active')
        .gte('end_date', today);
    }
    
    // Ordenar por data de início (mais recente primeiro)
    query = query.order('start_date', { ascending: false });
    
    // Executar a consulta
    const { data: subscriptions, error } = await query;
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar assinaturas: ${error.message}`);
    }
    
    return successResponse(subscriptions);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/user-subscriptions
 * @description Cria uma nova assinatura para um usuário
 * @access Privado - Admin pode criar para qualquer usuário, cliente apenas para si mesmo
 * 
 * @requestBody {
 *   user_id: string,
 *   plan_id: string,
 *   payment_method: string,
 *   payment_details?: object
 * }
 * 
 * @response {
 *   success: true,
 *   data: UserSubscription
 * }
 * 
 * O endpoint:
 * 1. Verifica permissões do usuário
 * 2. Valida o plano selecionado
 * 3. Calcula data de início e fim baseado na duração do plano
 * 4. Cria a assinatura com status 'active'
 */
export const POST = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    
    // Schema de validação
    const subscriptionSchema = z.object({
      user_id: z.string().uuid({ message: 'ID do usuário inválido' }),
      plan_id: z.string().uuid({ message: 'ID do plano inválido' }),
      payment_method: z.string().min(1, { message: 'Método de pagamento é obrigatório' }),
      payment_details: z.record(z.any()).optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = subscriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { user_id, plan_id, payment_method, payment_details } = validationResult.data;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Verificar permissões
    if (userData.role === 'client' && user_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você só pode criar assinaturas para você mesmo');
    }
    
    // Verificar se o usuário da assinatura existe e é um cliente
    const { data: subscriptionUser, error: subUserError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', user_id)
      .single();
      
    if (subUserError || !subscriptionUser) {
      return ApiErrors.VALIDATION_ERROR('Usuário não encontrado');
    }
    
    if (subscriptionUser.role !== 'client') {
      return ApiErrors.VALIDATION_ERROR('Apenas clientes podem ter assinaturas');
    }
    
    // Buscar informações do plano para calcular data de término
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('duration_days, is_active')
      .eq('id', plan_id)
      .single();
      
    if (planError || !plan) {
      return ApiErrors.VALIDATION_ERROR('Plano não encontrado ou inválido');
    }
    
    if (!plan.is_active) {
      return ApiErrors.VALIDATION_ERROR('Este plano não está disponível para assinatura');
    }
    
    // Calcular datas de início e fim
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration_days);
    
    // Formatar datas como strings ISO (apenas data)
    const start_date = startDate.toISOString().split('T')[0];
    const end_date = endDate.toISOString().split('T')[0];
    
    // Criar a assinatura
    const { data: subscription, error: createError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id,
        plan_id,
        start_date,
        end_date,
        status: 'active',
        payment_method,
        payment_details: payment_details || {}
      })
      .select(`
        id,
        user_id,
        user:user_id (id, name, email),
        plan_id,
        plan:plan_id (id, name, price, duration_days),
        start_date,
        end_date,
        status,
        payment_method,
        payment_details,
        created_at,
        updated_at
      `)
      .single();
      
    if (createError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao criar assinatura: ${createError.message}`);
    }
    
    return successResponse(subscription, { message: 'Assinatura criada com sucesso' }, 201);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 