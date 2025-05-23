import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

// Schema para validação dos dados de atualização de serviço de usuário
const updateUserServiceSchema = z.object({
  custom_commission_percentage: z.number().min(0).max(100).nullable().optional(),
  is_active: z.boolean().optional(),
});

/**
 * @route GET /api/user-services/:id
 * @description Busca um serviço de usuário específico
 * @access Privado - Requer autenticação de admin, manager ou o próprio usuário
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const userServiceId = context.params.id;
    const isServiceRole = req.headers.get('x-supabase-role') === 'service_role';
    
    // Buscar o serviço do usuário com informações relacionadas
    const { data: userService, error } = await supabaseAdmin
      .from('user_services')
      .select(`
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
      `)
      .eq('id', userServiceId)
      .single();
    
    if (error) {
      console.error('Erro ao buscar serviço de usuário:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar serviço de usuário: ${error.message}`);
    }
    
    if (!userService) {
      return ApiErrors.NOT_FOUND('Serviço de usuário não encontrado');
    }
    
    // Verificar permissões de acesso
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isOwner = userService.user_id === user.id;
    
    if (!isAdmin && !isManager && !isOwner && !isServiceRole) {
      return ApiErrors.FORBIDDEN('Você não tem permissão para acessar este recurso');
    }
    
    return successResponse(userService);
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/user-services/:id
 * @description Atualiza um serviço de usuário específico
 * @access Privado - Requer autenticação de admin ou manager
 */
export const PATCH = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const authUser = (req as any).user;
    const userServiceId = context.params.id;
    
    // Verificar permissões de acesso
    const isAdmin = authUser.role === 'admin';
    const isManager = authUser.role === 'manager';
    const isServiceRole = req.headers.get('x-supabase-role') === 'service_role';
    
    if (!isAdmin && !isManager && !isServiceRole) {
      console.log('PATCH - Acesso negado - usuário não tem permissão', {
        isAdmin, isManager, isServiceRole, 
        headers: Object.fromEntries(req.headers.entries())
      });
      return ApiErrors.FORBIDDEN('Você não tem permissão para executar esta ação');
    }
    
    // Validar corpo da requisição
    const requestBody = await req.json();
    const validationResult = updateUserServiceSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const updateData = validationResult.data;
    
    // Verificar se o serviço de usuário existe
    const { data: existingUserService, error: checkError } = await supabaseAdmin
      .from('user_services')
      .select('id')
      .eq('id', userServiceId)
      .maybeSingle();
    
    if (!existingUserService) {
      return ApiErrors.NOT_FOUND('Serviço de usuário não encontrado');
    }
    
    // Atualizar o serviço de usuário
    const { data: updatedUserService, error } = await supabaseAdmin
      .from('user_services')
      .update(updateData)
      .eq('id', userServiceId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar serviço de usuário:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar serviço de usuário: ${error.message}`);
    }
    
    return successResponse(updatedUserService, {
      message: 'Serviço de usuário atualizado com sucesso'
    });
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/user-services/:id
 * @description Remove um serviço de usuário específico
 * @access Privado - Requer autenticação de admin ou manager
 */
export const DELETE = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const authUser = (req as any).user;
    const userServiceId = context.params.id;
    
    // Verificar permissões de acesso
    const isAdmin = authUser.role === 'admin';
    const isManager = authUser.role === 'manager';
    const isServiceRole = req.headers.get('x-supabase-role') === 'service_role';
    
    if (!isAdmin && !isManager && !isServiceRole) {
      console.log('DELETE - Acesso negado - usuário não tem permissão', {
        isAdmin, isManager, isServiceRole, 
        headers: Object.fromEntries(req.headers.entries())
      });
      return ApiErrors.FORBIDDEN('Você não tem permissão para executar esta ação');
    }
    
    // Verificar se o serviço de usuário existe
    const { data: existingUserService, error: checkError } = await supabaseAdmin
      .from('user_services')
      .select('id')
      .eq('id', userServiceId)
      .maybeSingle();
    
    if (!existingUserService) {
      return ApiErrors.NOT_FOUND('Serviço de usuário não encontrado');
    }
    
    // Excluir o serviço de usuário
    const { error } = await supabaseAdmin
      .from('user_services')
      .delete()
      .eq('id', userServiceId);
    
    if (error) {
      console.error('Erro ao excluir serviço de usuário:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao excluir serviço de usuário: ${error.message}`);
    }
    
    return successResponse(null, {
      message: 'Serviço de usuário removido com sucesso'
    });
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 