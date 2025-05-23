import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route POST /api/comandas/:id/recalculate-commission
 * @description Recalcula as comissões de uma comanda existente
 * @access Privado - Apenas admin
 * 
 * @response {
 *   success: true,
 *   data: {
 *     id: string,
 *     total_services_commission: number,
 *     total_products_commission: number,
 *     total_commission: number
 *   }
 * }
 */
export const POST = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const comandaId = context.params.id;
    
    // Verificar papel do usuário (apenas admin pode recalcular comissões)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    if (userData.role !== 'admin') {
      return ApiErrors.FORBIDDEN('Apenas administradores podem recalcular comissões');
    }
    
    // Recalcular comissões usando a função do banco de dados
    const { data, error } = await supabaseAdmin.rpc(
      'reset_and_recalculate_commission',
      { p_comanda_id: comandaId }
    );
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao recalcular comissões: ${error.message}`);
    }
    
    // Buscar detalhes das comissões recalculadas
    const { data: commissionDetails, error: commissionError } = await supabaseAdmin
      .from('commission_details')
      .select('*')
      .eq('comanda_id', comandaId)
      .order('calculated_at', { ascending: false });
    
    // Incluir detalhes de comissão na resposta
    const responseData = {
      ...data[0],
      commissions: commissionError ? [] : commissionDetails
    };
    
    return successResponse(responseData);
  } catch (error: any) {
    console.error('Erro ao recalcular comissões:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 