import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

// Schema para validação dos dados de serviço de usuário
const userServiceSchema = z.object({
  user_id: z.string().uuid({ message: 'ID de usuário inválido' }),
  service_id: z.string().uuid({ message: 'ID de serviço inválido' }),
  custom_commission_percentage: z.number().min(0).max(100).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

/**
 * @route GET /api/user-services
 * @description Lista todos os serviços de usuários
 * @access Privado - Requer autenticação de admin ou manager
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const authUser = (req as any).user;
    
    // Verificar permissões de acesso
    const isAdmin = authUser.role === 'admin';
    const isManager = authUser.role === 'manager';
    const isServiceRole = req.headers.get('x-supabase-role') === 'service_role';
    
    if (!isAdmin && !isManager && !isServiceRole) {
      console.log('GET - Acesso negado - usuário não tem permissão', {
        isAdmin, isManager, isServiceRole
      });
      return ApiErrors.FORBIDDEN('Você não tem permissão para executar esta ação');
    }
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const serviceId = searchParams.get('service_id');
    
    let query = supabaseAdmin.from('user_services').select(`
      *,
      user:user_id (
        id,
        email
      ),
      service:service_id (
        id,
        name,
        price,
        duration_minutes,
        default_commission_percentage
      )
    `);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (serviceId) {
      query = query.eq('service_id', serviceId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar serviços de usuários:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar serviços de usuários: ${error.message}`);
    }
    
    return successResponse(data);
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/user-services
 * @description Adiciona um novo serviço para um usuário
 * @access Privado - Requer autenticação de admin ou manager
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const authUser = (req as any).user;
    
    // Verificar permissões de acesso
    const isAdmin = authUser.role === 'admin';
    const isManager = authUser.role === 'manager';
    const isServiceRole = req.headers.get('x-supabase-role') === 'service_role';
    
    if (!isAdmin && !isManager && !isServiceRole) {
      console.log('POST - Acesso negado - usuário não tem permissão', {
        isAdmin, isManager, isServiceRole, 
        headers: Object.fromEntries(req.headers.entries())
      });
      return ApiErrors.FORBIDDEN('Você não tem permissão para executar esta ação');
    }
    
    // Validar corpo da requisição
    const requestBody = await req.json();
    const validationResult = userServiceSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const userServiceData = validationResult.data;
    
    // Verificar se o usuário existe
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userServiceData.user_id)
      .single();
    
    if (userError || !user) {
      console.log('Erro ao verificar usuário:', { userError, userId: userServiceData.user_id });
      return ApiErrors.NOT_FOUND('Usuário não encontrado');
    }
    
    // Verificar se o serviço existe
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', userServiceData.service_id)
      .single();
    
    if (serviceError || !service) {
      return ApiErrors.NOT_FOUND('Serviço não encontrado');
    }
    
    // Verificar se a relação já existe
    const { data: existingUserService, error: existingError } = await supabaseAdmin
      .from('user_services')
      .select('id')
      .eq('user_id', userServiceData.user_id)
      .eq('service_id', userServiceData.service_id)
      .maybeSingle();
    
    if (existingUserService) {
      return ApiErrors.CONFLICT('Este serviço já está atribuído a este usuário');
    }
    
    // Inserir o novo serviço para o usuário
    const { data: newUserService, error } = await supabaseAdmin
      .from('user_services')
      .insert(userServiceData)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao adicionar serviço para o usuário:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao adicionar serviço para o usuário: ${error.message}`);
    }
    
    return successResponse(newUserService, {
      status: 201,
      message: 'Serviço atribuído ao usuário com sucesso'
    });
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 