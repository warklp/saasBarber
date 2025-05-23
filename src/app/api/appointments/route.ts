import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';
import comandaServiceServer from '@/lib/services/comandaService.server';

/**
 * @route GET /api/appointments
 * @description Lista agendamentos com filtros opcionais
 * @access Privado - Requer autenticação
 * 
 * @queryParams {
 *   start_date: string (ISO) - Data de início do intervalo
 *   end_date: string (ISO) - Data de fim do intervalo
 *   employee_id: string - ID do funcionário (opcional)
 *   client_id: string - ID do cliente (opcional)
 *   status: string - Status do agendamento (opcional)
 * }
 * 
 * @response {
 *   success: true,
 *   data: Array<Appointment>
 * }
 * 
 * O acesso aos agendamentos é controlado por RLS:
 * - Admin vê todos os agendamentos
 * - Funcionários veem apenas seus próprios agendamentos
 * - Clientes veem apenas seus próprios agendamentos
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const url = new URL(req.url);
    
    // Obter parâmetros de query
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const employeeId = url.searchParams.get('employee_id');
    const clientId = url.searchParams.get('client_id');
    const status = url.searchParams.get('status');
    
    // Verificar role do usuário para aplicar filtros de acesso
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
      .from('appointments')
      .select(`
        id, 
        client_id,
        client:client_id (id, name, phone, email),
        employee_id,
        employee:employee_id (id, name),
        start_time,
        end_time,
        status,
        notes,
        created_at,
        updated_at
      `);
    
    // Aplicar filtros baseados no papel do usuário
    if (userData.role === 'client') {
      query = query.eq('client_id', user.id);
    } else if (userData.role === 'employee') {
      query = query.eq('employee_id', user.id);
    }
    // Admin pode ver todos os agendamentos
    
    // Aplicar filtros de query string
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    
    if (endDate) {
      query = query.lte('end_time', endDate);
    }
    
    if (employeeId && userData.role === 'admin') {
      query = query.eq('employee_id', employeeId);
    }
    
    if (clientId && (userData.role === 'admin' || userData.role === 'employee')) {
      query = query.eq('client_id', clientId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Ordenar por data de início
    query = query.order('start_time');
    
    // Executar a consulta
    const { data: appointments, error } = await query;
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar agendamentos: ${error.message}`);
    }

    // Buscar os serviços para cada agendamento
    const appointmentsWithServices = await Promise.all(
      appointments.map(async (appointment) => {
        const { data: services, error: servicesError } = await supabaseAdmin
          .from('appointment_services')
          .select(`
            id,
            service_id,
            quantity,
            unit_price,
            service:service_id (id, name, duration_minutes, price)
          `)
          .eq('appointment_id', appointment.id);

        if (servicesError) {
          console.error(`Erro ao buscar serviços do agendamento ${appointment.id}:`, servicesError);
          return { ...appointment, services: [] };
        }

        return { ...appointment, services: services || [] };
      })
    );
    
    return successResponse(appointmentsWithServices);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/appointments
 * @description Cria um novo agendamento
 * @access Privado - Requer autenticação
 * 
 * @requestBody {
 *   client_id: string,
 *   employee_id: string,
 *   services: Array<{id: string, quantity?: number}>, // Lista de serviços
 *   start_time: string (ISO date),
 *   notes?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Appointment
 * }
 * 
 * O endpoint verifica:
 * 1. Sobreposição de horários do funcionário
 * 2. Validade dos serviços e suas durações
 * 3. Permissões do usuário para criar o agendamento
 */
export const POST = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    console.log('===== INÍCIO DA REQUISIÇÃO POST /api/appointments =====');
    console.log('Recebida requisição para criar agendamento');
    
    const user = (req as any).user;
    console.log('Usuário autenticado:', user?.id);
    
    // Tentar ler o corpo da requisição para debug
    try {
      const cloneReq = req.clone();
      const bodyText = await cloneReq.text();
      console.log('Corpo da requisição:', bodyText);
    } catch (bodyError) {
      console.error('Não foi possível ler o corpo da requisição:', bodyError);
    }
    
    // Buscar o papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      console.error('Erro ao verificar usuário:', userError.message);
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    console.log('Papel do usuário:', userData.role);
    
    // Schema de validação atualizado para suportar múltiplos serviços
    const appointmentSchema = z.object({
      client_id: z.string().uuid({ message: 'ID do cliente inválido' }),
      employee_id: z.string().uuid({ message: 'ID do funcionário inválido' }),
      services: z.array(z.object({
        id: z.string().uuid({ message: 'ID do serviço inválido' }),
        quantity: z.number().int().positive().default(1),
      })).min(1, { message: 'Pelo menos um serviço deve ser selecionado' }),
      start_time: z.string().refine(val => !isNaN(Date.parse(val)), { 
        message: 'Data e hora de início inválidas' 
      }),
      notes: z.string().optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = appointmentSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { client_id, employee_id, services, start_time, notes } = validationResult.data;
    
    // Verificar permissões para criar agendamento
    if (userData.role === 'client' && client_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você só pode criar agendamentos para você mesmo');
    }
    
    // Buscar informações de todos os serviços selecionados
    const serviceIds = services.map(s => s.id);
    const { data: servicesData, error: servicesError } = await supabaseAdmin
      .from('services')
      .select('id, name, duration_minutes, price, is_active')
      .in('id', serviceIds);
      
    if (servicesError || !servicesData || servicesData.length !== serviceIds.length) {
      return ApiErrors.VALIDATION_ERROR('Um ou mais serviços não foram encontrados ou são inválidos');
    }
    
    // Verificar se todos os serviços estão ativos
    const inactiveServices = servicesData.filter(s => !s.is_active);
    if (inactiveServices.length > 0) {
      return ApiErrors.VALIDATION_ERROR(
        `Os seguintes serviços não estão disponíveis para agendamento: ${inactiveServices.map(s => s.name).join(', ')}`
      );
    }
    
    // Verificar se o funcionário existe e tem papel correto
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', employee_id)
      .eq('role', 'employee')
      .single();
      
    if (employeeError || !employee) {
      return ApiErrors.VALIDATION_ERROR('Funcionário não encontrado ou inválido');
    }
    
    // Verificar se o cliente existe
    const { data: client, error: clientError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', client_id)
      .single();
          
    if (clientError || !client) {
      return ApiErrors.VALIDATION_ERROR('Cliente não encontrado ou inválido');
    }
    
    // Calcular a duração total somando a duração de todos os serviços
    const totalDurationMinutes = servicesData.reduce((total, service) => {
      const serviceItem = services.find(s => s.id === service.id);
      const quantity = serviceItem?.quantity || 1;
      return total + (service.duration_minutes * quantity);
    }, 0);
    
    // Calcular data de término baseada na duração total dos serviços
    const startDateTime = new Date(start_time);
    const endDateTime = new Date(startDateTime.getTime() + totalDurationMinutes * 60000);
    const end_time = endDateTime.toISOString();
    
    // Verificar sobreposição de horários para o funcionário
    const { data: overlappingAppointments, error: overlapError } = await supabaseAdmin
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('employee_id', employee_id)
      .not('status', 'in', '(canceled,completed)')
      .filter('start_time', 'lt', end_time)
      .filter('end_time', 'gt', start_time);
      
    if (overlapError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar disponibilidade: ${overlapError.message}`);
    }
    
    if (overlappingAppointments && overlappingAppointments.length > 0) {
      return ApiErrors.VALIDATION_ERROR(
        'Este horário não está disponível para o funcionário selecionado'
      );
    }
    
    // Iniciar uma transação para garantir que o agendamento e os serviços sejam criados juntos
    try {
      // Criar o agendamento
      const { data: appointment, error: createError } = await supabaseAdmin
        .from('appointments')
        .insert({
          client_id,
          employee_id,
          start_time,
          end_time,
          status: 'scheduled',
          notes
        })
        .select('*')
        .single();
          
      if (createError) {
        return ApiErrors.DATABASE_ERROR(`Erro ao criar agendamento: ${createError.message}`);
      }

      // Adicionar os serviços à tabela appointment_services
      const appointmentServicesData = services.map(service => {
        const serviceData = servicesData.find(s => s.id === service.id);
        return {
          appointment_id: appointment.id,
          service_id: service.id,
          quantity: service.quantity || 1,
          unit_price: serviceData?.price || 0
        };
      });

      const { error: servicesInsertError } = await supabaseAdmin
        .from('appointment_services')
        .insert(appointmentServicesData);

      if (servicesInsertError) {
        console.error('Erro ao adicionar serviços ao agendamento:', servicesInsertError);
        // Tentar reverter a criação do agendamento
        await supabaseAdmin.from('appointments').delete().eq('id', appointment.id);
        return ApiErrors.DATABASE_ERROR(`Erro ao adicionar serviços ao agendamento: ${servicesInsertError.message}`);
      }

      // Buscar o agendamento completo com os serviços
      const { data: appointmentWithServices, error: fetchError } = await supabaseAdmin
        .from('appointments')
        .select(`
          id, 
          client_id,
          client:client_id (id, name, phone, email),
          employee_id,
          employee:employee_id (id, name),
          start_time,
          end_time,
          status,
          notes,
          created_at,
          updated_at
        `)
        .eq('id', appointment.id)
        .single();

      if (fetchError) {
        return ApiErrors.DATABASE_ERROR(`Erro ao buscar o agendamento criado: ${fetchError.message}`);
      }

      // Buscar os serviços do agendamento
      const { data: appointmentServices, error: appointmentServicesError } = await supabaseAdmin
        .from('appointment_services')
        .select(`
          id,
          service_id,
          quantity,
          unit_price,
          service:service_id (id, name, duration_minutes, price)
        `)
        .eq('appointment_id', appointment.id);

      if (appointmentServicesError) {
        console.error('Erro ao buscar serviços do agendamento:', appointmentServicesError);
      }

      const finalAppointment = {
        ...appointmentWithServices,
        services: appointmentServices || []
      };

      // Criar comanda automaticamente para o agendamento criado
      try {
        console.log('Iniciando processo de criação automática de comanda para o agendamento:', appointment.id);
        
        // Preparar os serviços para a comanda
        const initialServices = appointmentServices?.map(item => ({
          id: item.service_id,
          quantity: item.quantity,
          price: item.unit_price
        })) || [];
        
        if (initialServices.length > 0) {
          // Criar comanda usando o serviço centralizado com a nova abordagem
          const comanda = await comandaServiceServer.createComanda({
            appointment_id: appointment.id,
            client_id: client_id,
            professional_id: employee_id,
            cashier_id: user.id,
            status: 'aberta',
            initial_services: initialServices
          });
          
          console.log('Comanda criada com sucesso:', comanda.id);
          console.log(`Comanda criada com ${initialServices.length} serviços iniciais e total de R$${comanda.total || 0}`);
        } else {
          console.log('Nenhum serviço disponível para adicionar à comanda');
        }
      } catch (comandaError: any) {
        // Não impedimos a criação do agendamento se a comanda falhar
        console.error('Erro ao criar comanda automaticamente:', comandaError.message);
        console.error('Detalhes do erro:', comandaError);
      }
      
      return successResponse(finalAppointment, { message: 'Agendamento criado com sucesso' }, 201);
    } catch (error: any) {
      console.error('Erro durante a transação:', error);
      return ApiErrors.SERVER_ERROR(`Erro ao criar agendamento: ${error.message}`);
    }
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 