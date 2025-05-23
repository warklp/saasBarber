import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';
import comandaServiceServer from '@/lib/services/comandaService.server';

/**
 * @route POST /api/comandas/:id/items
 * @description Adiciona um item a uma comanda
 * @access Privado - Apenas admin e funcionários relacionados ao agendamento
 * 
 * @requestBody {
 *   service_id?: string,
 *   product_id?: string,
 *   quantity: number,
 *   unit_price: number
 * }
 * 
 * @response {
 *   success: true,
 *   data: ComandaItem
 * }
 */
export const POST = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const comandaId = context.params.id;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Verificar se não é cliente (apenas admin e funcionários podem adicionar itens)
    if (userData.role === 'client') {
      return ApiErrors.FORBIDDEN('Clientes não podem adicionar itens a comandas');
    }
    
    // Buscar a comanda atual
    const { data: currentComanda, error: comandaError } = await supabaseAdmin
      .from('comandas')
      .select(`
        id, 
        appointment_id,
        status,
        total
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
      return ApiErrors.VALIDATION_ERROR('Não é possível adicionar itens a uma comanda fechada');
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
        return ApiErrors.FORBIDDEN('Você não tem permissão para adicionar itens a esta comanda');
      }
    }
    
    // Schema de validação para adição de item
    const itemSchema = z.object({
      service_id: z.string().uuid({ message: 'ID do serviço inválido' }).optional(),
      product_id: z.string().uuid({ message: 'ID do produto inválido' }).optional(),
      quantity: z.number().positive({ message: 'A quantidade deve ser maior que zero' }),
      unit_price: z.number().min(0, { message: 'O preço unitário deve ser maior ou igual a zero' })
    }).refine(data => data.service_id || data.product_id, {
      message: 'É necessário fornecer service_id ou product_id',
      path: ['service_id']
    }).refine(data => !(data.service_id && data.product_id), {
      message: 'Não é possível fornecer service_id e product_id ao mesmo tempo',
      path: ['product_id']
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = itemSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { service_id, product_id, quantity, unit_price } = validationResult.data;
    
    // Calcular o preço total do item
    const total_price = quantity * unit_price;
    
    // Criar o item da comanda
    const { data: newItem, error: createError } = await supabaseAdmin
      .from('comanda_items')
      .insert({
        comanda_id: comandaId,
        service_id,
        product_id,
        quantity,
        unit_price,
        total_price
      })
      .select()
      .single();
      
    if (createError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao adicionar item à comanda: ${createError.message}`);
    }
    
    // Atualizar o total da comanda
    const { data: comandaItems, error: itemsError } = await supabaseAdmin
      .from('comanda_items')
      .select('total_price')
      .eq('comanda_id', comandaId);
      
    if (itemsError) {
      // Mesmo se falhar a atualização do total, o item já foi adicionado
      console.error(`Erro ao atualizar total da comanda: ${itemsError.message}`);
    } else {
      // Calcular novo total
      const newTotal = comandaItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
      
      // Atualizar comanda
      await supabaseAdmin
        .from('comandas')
        .update({ total: newTotal })
        .eq('id', comandaId);
    }
    
    return successResponse(newItem);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 