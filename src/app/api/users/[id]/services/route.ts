import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/users/:id/services
 * @description Lista todos os serviços associados a um usuário específico
 * @access Privado - Requer autenticação de admin, manager ou o próprio usuário
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const authUser = (req as any).user;
    const userId = context.params.id;
    
    console.log('GET /api/users/:id/services - Iniciando requisição', {
      authUser: { id: authUser.id, role: authUser.role },
      requestedUserId: userId
    });
    
    // Verificar permissões de acesso - permita acesso com a service_role_key
    const isAdmin = authUser.role === 'admin';
    const isManager = authUser.role === 'manager';
    const isOwner = userId === authUser.id;
    const isServiceRole = req.headers.get('x-supabase-role') === 'service_role';
    
    if (!isAdmin && !isManager && !isOwner && !isServiceRole) {
      console.log('Acesso negado - usuário não tem permissão', {
        isAdmin, isManager, isOwner, isServiceRole
      });
      return ApiErrors.FORBIDDEN('Você não tem permissão para acessar este recurso');
    }
    
    console.log('Permissão concedida, buscando serviços do usuário');
    
    // Buscar os serviços do usuário com informações relacionadas
    const { data, error } = await supabaseAdmin
      .from('user_services')
      .select(`
        *,
        service:service_id (
          id,
          name,
          price,
          duration_minutes,
          default_commission_percentage,
          description
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar serviços do usuário:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar serviços do usuário: ${error.message}`);
    }
    
    console.log(`Serviços encontrados: ${data?.length || 0}`);
    return successResponse(data);
  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 