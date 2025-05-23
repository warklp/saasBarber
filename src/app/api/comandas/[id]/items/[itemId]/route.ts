import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route DELETE /api/comandas/:id/items/:itemId
 * @description Remove um item de uma comanda
 * @access Privado - Apenas admin e funcionários relacionados ao agendamento
 * 
 * @response {
 *   success: true,
 *   data: null
 * }
 */
export const DELETE = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const comandaId = context.params.id;
    const itemId = context.params.itemId;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Verificar se não é cliente (apenas admin e funcionários podem remover itens)
    if (userData.role === 'client') {
      return ApiErrors.FORBIDDEN('Clientes não podem remover itens de comandas');
    }
    
    // Buscar a comanda atual
    const { data: currentComanda, error: comandaError } = await supabaseAdmin
      .from('comandas')
      .select(`
        id, 
        appointment_id,
        status
      `)
      .eq('id', comandaId)
      .single();
    
    if (comandaError) {
      if (comandaError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Comanda não encontrada');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar comanda: ${comandaError.message}`);
    }
    
    // Verificar se a comanda já está fechada
    if (currentComanda.status === 'closed') {
      return ApiErrors.VALIDATION_ERROR('Não é possível remover itens de uma comanda fechada');
    }
    
    // Se for funcionário, verificar se está relacionado ao agendamento
    if (userData.role === 'employee') {
      const { data: agendamento, error: agendamentoError } = await supabaseAdmin
        .from('appointments')
        .select('employee_id')
        .eq('id', currentComanda.appointment_id)
        .single();
        
      const isRelated = !agendamentoError && agendamento && agendamento.employee_id === user.id;
      
      if (!isRelated) {
        return ApiErrors.FORBIDDEN('Você não tem permissão para remover itens desta comanda');
      }
    }
    
    // Verificar se o item pertence à comanda
    const { data: item, error: itemError } = await supabaseAdmin
      .from('comanda_items')
      .select('id, total_price')
      .eq('id', itemId)
      .eq('comanda_id', comandaId)
      .single();
      
    if (itemError) {
      if (itemError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Item não encontrado nesta comanda');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar item: ${itemError.message}`);
    }
    
    // Remover o item
    const { error: deleteError } = await supabaseAdmin
      .from('comanda_items')
      .delete()
      .eq('id', itemId);
      
    if (deleteError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao remover item: ${deleteError.message}`);
    }
    
    // Recalcular o total da comanda
    const { data: comandaItems, error: itemsError } = await supabaseAdmin
      .from('comanda_items')
      .select('total_price')
      .eq('comanda_id', comandaId);
      
    if (!itemsError) {
      // Calcular novo total
      const newTotal = comandaItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
      
      // Atualizar comanda
      await supabaseAdmin
        .from('comandas')
        .update({ total: newTotal })
        .eq('id', comandaId);
    }
    
    return successResponse(null);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 