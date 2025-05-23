import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/commissions
 * @description Obtém uma lista de comissões com filtros
 * @access Privado - Apenas admin
 */
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as any).user;
    const searchParams = new URL(req.url).searchParams;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Parâmetros de filtro
    const employeeId = searchParams.get('employee_id');
    const paid = searchParams.get('paid');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const search = searchParams.get('search');
    
    // Usar função RPC para buscar comissões
    const { data: commissions, error } = await supabaseAdmin.rpc('buscar_comissoes', {
      p_user_id: user.id,
      p_user_role: userData.role,
      p_employee_id: employeeId,
      p_paid: paid === 'true' ? true : paid === 'false' ? false : null,
      p_start_date: startDate ? `${startDate}T00:00:00.000Z` : null,
      p_end_date: endDate ? `${endDate}T23:59:59.999Z` : null,
      p_search: search
    });
    
    if (error) {
      if (error.message.includes('permissão')) {
        return ApiErrors.FORBIDDEN('Você não tem permissão para acessar comissões');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar comissões: ${error.message}`);
    }
    
    return successResponse(commissions);
  } catch (error: any) {
    console.error('Erro ao buscar comissões:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 