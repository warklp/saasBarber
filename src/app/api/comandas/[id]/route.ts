import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/comandas/:id
 * @description Busca detalhes de uma comanda específica
 * @access Privado - Requer autenticação
 * 
 * @response {
 *   success: true,
 *   data: Comanda
 * }
 * 
 * O acesso é controlado:
 * - Admin pode ver qualquer comanda
 * - Funcionário pode ver comandas dos seus próprios agendamentos
 * - Cliente pode ver apenas suas próprias comandas
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
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
    
    // Buscar a comanda com joins para informações relacionadas
    let query = supabaseAdmin
      .from('comandas')
      .select(`
        id,
        appointment_id,
        appointment:appointment_id (
          id, 
          employee_id,
          employee:employee_id (
            id, 
            name
          ),
          services:appointment_services (
            id,
            service_id,
            service:service_id (
              id, 
              name, 
              price, 
              duration_minutes
            ),
            quantity,
            unit_price
          )
        ),
        cashier_id,
        cashier:cashier_id (id, name),
        client_id,
        client:client_id (id, name, phone, email),
        total,
        discount,
        taxes,
        final_total,
        payment_method,
        status,
        created_at,
        updated_at,
        total_commission,
        total_services_commission,
        total_products_commission,
        items:comanda_items (
          id,
          comanda_id,
          service_id,
          service:service_id (
            id, 
            name, 
            price
          ),
          product_id,
          product:product_id (
            id, 
            name, 
            sale_price
          ),
          quantity,
          unit_price,
          total_price,
          created_at,
          updated_at
        )
      `)
      .eq('id', comandaId)
      .single();
    
    const { data: comanda, error } = await query;
    
    if (error) {
      if (error.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Comanda não encontrada');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar comanda: ${error.message}`);
    }
    
    // Verificar permissões
    if (userData.role === 'client' && comanda.client_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você não tem permissão para ver esta comanda');
    }
    
    if (userData.role === 'employee') {
      // Verificar se o funcionário está relacionado ao agendamento
      // Abordagem mais segura para tipos
      const appointment = comanda.appointment;
      let isRelated = false;
      
      // Verificar se o funcionário é o profissional do agendamento
      if (appointment) {
        // Buscar o employee_id diretamente do agendamento para garantir
        const { data: agendamento, error: agendamentoError } = await supabaseAdmin
          .from('appointments')
          .select('employee_id')
          .eq('id', comanda.appointment_id)
          .single();
          
        if (!agendamentoError && agendamento) {
          isRelated = agendamento.employee_id === user.id;
        }
      }
      
      if (!isRelated) {
        return ApiErrors.FORBIDDEN('Você não tem permissão para ver esta comanda');
      }
    }
    
    // Adicionar array vazio de comissões e dados de comissão diretamente ao objeto resposta
    const comandaWithCommissions = {
      ...comanda,
      commissions: [],
      commissions_status: {
        pending: 0,
        paid: 0,
        total: comanda.total_commission || 0
      }
    };
    
    // Calcular as porcentagens de comissão para itens individuais se não estiverem presentes
    if (comandaWithCommissions.items && comandaWithCommissions.items.length > 0) {
      const totalServicesPrice = comandaWithCommissions.items.reduce((sum, item) => 
        item.service_id ? sum + (item.total_price || 0) : sum, 0);
      
      const totalProductsPrice = comandaWithCommissions.items.reduce((sum, item) => 
        item.product_id ? sum + (item.total_price || 0) : sum, 0);
      
      comandaWithCommissions.items.forEach(item => {
        // Inicializar as propriedades se não existirem
        if (!item.hasOwnProperty('commission_value')) {
          (item as any).commission_value = 0;
        }
        if (!item.hasOwnProperty('commission_percentage')) {
          (item as any).commission_percentage = 0;
        }
        
        // Se não tiver valor de comissão, calcular baseado nos totais
        if (!(item as any).commission_value) {
          if (item.service_id && totalServicesPrice > 0 && comandaWithCommissions.total_services_commission) {
            // Proporção baseada no valor do item em relação ao total de serviços
            const proportion = item.total_price / totalServicesPrice;
            (item as any).commission_value = parseFloat((proportion * comandaWithCommissions.total_services_commission).toFixed(2));
            
            // Calcular a porcentagem baseada no valor da comissão em relação ao preço do item
            (item as any).commission_percentage = parseFloat(((item as any).commission_value / item.total_price * 100).toFixed(2));
          } 
          else if (item.product_id && totalProductsPrice > 0 && comandaWithCommissions.total_products_commission) {
            // Proporção baseada no valor do item em relação ao total de produtos
            const proportion = item.total_price / totalProductsPrice;
            (item as any).commission_value = parseFloat((proportion * comandaWithCommissions.total_products_commission).toFixed(2));
            
            // Calcular a porcentagem baseada no valor da comissão em relação ao preço do item
            (item as any).commission_percentage = parseFloat(((item as any).commission_value / item.total_price * 100).toFixed(2));
          }
        }
      });
    }
    
    return successResponse(comandaWithCommissions);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/comandas/:id
 * @description Atualiza uma comanda existente
 * @access Privado - Apenas admin e funcionários relacionados ao agendamento
 * 
 * @requestBody {
 *   discount?: number,
 *   taxes?: number,
 *   notes?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Comanda
 * }
 */
export const PATCH = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
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
    
    // Verificar se não é cliente (apenas admin e funcionários podem atualizar)
    if (userData.role === 'client') {
      return ApiErrors.FORBIDDEN('Clientes não podem atualizar comandas');
    }
    
    // Buscar a comanda atual
    const { data: currentComanda, error: comandaError } = await supabaseAdmin
      .from('comandas')
      .select(`
        id, 
        appointment_id,
        appointment:appointment_id (employee_id),
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
    
    // Verificar se a comanda está fechada
    if (currentComanda.status === 'closed') {
      return ApiErrors.VALIDATION_ERROR('Não é possível atualizar uma comanda fechada');
    }
    
    // Verificação de permissão para funcionários
    if (userData.role === 'employee') {
      // Verificar se o funcionário é o profissional do agendamento
      const { data: agendamento, error: agendamentoError } = await supabaseAdmin
        .from('appointments')
        .select('employee_id')
        .eq('id', currentComanda.appointment_id)
        .single();
        
      const isRelated = !agendamentoError && agendamento && agendamento.employee_id === user.id;
      
      if (!isRelated) {
        return ApiErrors.FORBIDDEN('Você não tem permissão para atualizar esta comanda');
      }
    }
    
    // Schema de validação
    const updateSchema = z.object({
      discount: z.number().min(0).optional(),
      taxes: z.number().min(0).optional(),
      notes: z.string().optional()
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = updateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const updates = validationResult.data;
    
    // Atualizar a comanda
    const { data: updatedComanda, error: updateError } = await supabaseAdmin
      .from('comandas')
      .update(updates)
      .eq('id', comandaId)
      .select()
      .single();
      
    if (updateError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar comanda: ${updateError.message}`);
    }
    
    return successResponse(updatedComanda);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 