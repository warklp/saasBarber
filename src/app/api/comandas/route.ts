import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';
import comandaServiceServer from '@/lib/services/comandaService.server';

/**
 * @route GET /api/comandas
 * @description Lista comandas com filtros opcionais
 * @access Privado - Requer autenticação
 * 
 * @queryParams {
 *   appointment_id: string - ID do agendamento relacionado (opcional)
 *   client_id: string - ID do cliente (opcional)
 *   status: string - Status da comanda (opcional)
 *   start_date: string (ISO) - Data de início do intervalo (opcional)
 *   end_date: string (ISO) - Data de fim do intervalo (opcional)
 * }
 * 
 * @response {
 *   success: true,
 *   data: Array<Comanda>
 * }
 * 
 * O acesso às comandas é controlado por RLS:
 * - Admin vê todas as comandas
 * - Funcionários veem comandas de seus próprios agendamentos
 * - Clientes veem apenas suas próprias comandas
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const url = new URL(req.url);
    
    // Obter parâmetros de query
    const appointmentId = url.searchParams.get('appointment_id');
    const clientId = url.searchParams.get('client_id');
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    // Verificar role do usuário para aplicar filtros de acesso
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Construir a query com a seleção completa 
    const comandaSelect = `
      id,
      appointment_id,
      appointment:appointment_id (
        id,
        employee_id,
        employee:employee_id (
          id,
          name
        )
      ),
      cashier_id,
      cashier:cashier_id (
        id,
        name
      ),
      client_id,
      client:client_id (
        id,
        name,
        email,
        phone
      ),
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
    `;
    
    // Iniciar a query
    let query = supabaseAdmin
      .from('comandas')
      .select(comandaSelect);
    
    // Aplicar filtros baseados no papel do usuário
    if (userData.role === 'client') {
      query = query.eq('client_id', user.id);
    } else if (userData.role === 'employee') {
      // Para funcionários, verificar se ele é o profissional do agendamento
      query = query.filter('appointment.employee_id', 'eq', user.id);
    }
    // Admin pode ver todas as comandas
    
    // Aplicar filtros de query string
    if (appointmentId) {
      query = query.eq('appointment_id', appointmentId);
    }
    
    if (clientId && (userData.role === 'admin' || userData.role === 'employee')) {
      query = query.eq('client_id', clientId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    // Ordenar por data de criação
    query = query.order('created_at', { ascending: false });
    
    // Executar a consulta
    const { data: comandas, error } = await query;
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar comandas: ${error.message}`);
    }
    
    // Adicionar array vazio de comissões a cada comanda
    if (comandas) {
      comandas.forEach(comanda => {
        // Adicionar lista vazia de comissões como propriedade extra
        (comanda as any).commissions = [];
        
        // Adicionar status das comissões baseado no total das comissões
        (comanda as any).commissions_status = {
          pending: 0,
          paid: 0,
          total: comanda.total_commission || 0
        };
        
        // Calcular as porcentagens de comissão para itens individuais se não estiverem presentes
        if (comanda.items && comanda.items.length > 0) {
          const totalServicesPrice = comanda.items.reduce((sum: number, item: any) => 
            item.service_id ? sum + (item.total_price || 0) : sum, 0);
          
          const totalProductsPrice = comanda.items.reduce((sum: number, item: any) => 
            item.product_id ? sum + (item.total_price || 0) : sum, 0);
          
          comanda.items.forEach((item: any) => {
            // Se não tiver valor de comissão, calcular baseado nos totais
            if (!item.commission_value) {
              if (item.service_id && totalServicesPrice > 0 && comanda.total_services_commission) {
                // Proporção baseada no valor do item em relação ao total de serviços
                const proportion = item.total_price / totalServicesPrice;
                item.commission_value = parseFloat((proportion * comanda.total_services_commission).toFixed(2));
                
                // Calcular a porcentagem baseada no valor da comissão em relação ao preço do item
                item.commission_percentage = parseFloat((item.commission_value / item.total_price * 100).toFixed(2));
              } 
              else if (item.product_id && totalProductsPrice > 0 && comanda.total_products_commission) {
                // Proporção baseada no valor do item em relação ao total de produtos
                const proportion = item.total_price / totalProductsPrice;
                item.commission_value = parseFloat((proportion * comanda.total_products_commission).toFixed(2));
                
                // Calcular a porcentagem baseada no valor da comissão em relação ao preço do item
                item.commission_percentage = parseFloat((item.commission_value / item.total_price * 100).toFixed(2));
              }
            }
          });
        }
      });
    }
    
    return successResponse(comandas);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/comandas
 * @description Cria uma nova comanda
 * @access Privado - Requer autenticação e permissão adequada
 * 
 * @requestBody {
 *   appointment_id: string,
 *   professional_id: string,
 *   client_id: string,
 *   services?: Array<{id: string, quantity: number, price: number}>,
 *   notes?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Comanda
 * }
 */
export const POST = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Apenas admin e funcionários podem criar comandas
    if (userData.role !== 'admin' && userData.role !== 'employee') {
      return ApiErrors.FORBIDDEN('Apenas administradores e funcionários podem criar comandas');
    }
    
    // Schema de validação
    const comandaSchema = z.object({
      appointment_id: z.string().uuid({ message: 'ID do agendamento inválido' }),
      professional_id: z.string().uuid({ message: 'ID do profissional inválido' }),
      client_id: z.string().uuid({ message: 'ID do cliente inválido' }),
      services: z.array(
        z.object({
          id: z.string().uuid({ message: 'ID do serviço inválido' }),
          quantity: z.number().min(1).default(1),
          price: z.number().min(0)
        })
      ).optional(),
      notes: z.string().optional(),
      cashier_id: z.string().uuid().optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = comandaSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { appointment_id, professional_id, client_id, services, notes, cashier_id } = validationResult.data;
    
    // Verificar se o agendamento existe
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select('id, employee_id, client_id, services')
      .eq('id', appointment_id)
      .single();
      
    if (appointmentError || !appointment) {
      return ApiErrors.VALIDATION_ERROR('Agendamento não encontrado');
    }
    
    // Verificar se o profissional está relacionado ao agendamento
    if (appointment.employee_id !== professional_id && userData.role !== 'admin') {
      return ApiErrors.FORBIDDEN('Este profissional não está associado ao agendamento');
    }
    
    try {
      // Se não foram fornecidos serviços, usar os serviços do agendamento
      let initialServices = services;
      
      if (!initialServices && appointment.services && appointment.services.length > 0) {
        // Buscar preços e detalhes dos serviços do agendamento
        const serviceIds = appointment.services.map((s: any) => s.service_id);
        
        const { data: serviceDetails } = await supabaseAdmin
          .from('services')
          .select('id, price')
          .in('id', serviceIds);
          
        if (serviceDetails && serviceDetails.length > 0) {
          initialServices = appointment.services.map((s: any) => {
            const serviceDetail = serviceDetails.find((sd: any) => sd.id === s.service_id);
            return {
              id: s.service_id,
              quantity: s.quantity || 1,
              price: serviceDetail?.price || 0
            };
          });
        }
      }
      
      // Usar o serviço centralizado para criar a comanda
      const newComanda = await comandaServiceServer.createComanda({
        appointment_id,
        client_id,
        professional_id,
        cashier_id: cashier_id || professional_id || user.id,
        status: 'aberta',
        initial_services: initialServices
      });
      
      return successResponse(newComanda);
    } catch (error: any) {
      if (error.message.includes('Já existe uma comanda')) {
        return ApiErrors.VALIDATION_ERROR('Já existe uma comanda para este agendamento');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao criar comanda: ${error.message}`);
    }
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 