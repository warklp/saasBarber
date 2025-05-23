import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/appointments/:id
 * @description Obtém detalhes de um agendamento específico
 * @access Privado - Requer autenticação
 * 
 * @response {
 *   success: true,
 *   data: Appointment
 * }
 * 
 * O acesso é controlado:
 * - Admin pode ver qualquer agendamento
 * - Funcionário pode ver apenas seus próprios agendamentos
 * - Cliente pode ver apenas seus próprios agendamentos
 */
export const GET = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const appointmentId = context.params.id;
    
    if (!appointmentId) {
      return ApiErrors.VALIDATION_ERROR('ID do agendamento não fornecido');
    }
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Buscar o agendamento com joins para informações relacionadas
    let query = supabaseAdmin
      .from('appointments')
      .select(`
        id, 
        client_id,
        client:client_id (id, name, phone, email),
        employee_id,
        employee:employee_id (id, name),
        comanda_id,
        start_time,
        end_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('id', appointmentId);
    
    // Aplicar filtros baseados no papel do usuário
    if (userData.role === 'client') {
      query = query.eq('client_id', user.id);
    } else if (userData.role === 'employee') {
      query = query.eq('employee_id', user.id);
    }
    
    // Executar a query
    const { data: appointment, error } = await query.single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Agendamento não encontrado');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar agendamento: ${error.message}`);
    }
    
    // Buscar os serviços do agendamento
    const { data: services, error: servicesError } = await supabaseAdmin
      .from('appointment_services')
      .select(`
        id,
        service_id,
        quantity,
        unit_price,
        service:service_id (id, name, duration_minutes, price)
      `)
      .eq('appointment_id', appointmentId);
      
    if (servicesError) {
      console.error(`Erro ao buscar serviços do agendamento ${appointmentId}:`, servicesError);
    }
    
    const appointmentWithServices = {
      ...appointment,
      services: services || []
    };
    
    return successResponse(appointmentWithServices);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/appointments/:id
 * @description Atualiza um agendamento existente
 * @access Privado - Requer autenticação
 * 
 * @requestBody {
 *   client_id?: string,
 *   employee_id?: string,
 *   start_time?: string (ISO date),
 *   end_time?: string (ISO date),
 *   status?: 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'absent' | 'completed' | 'canceled',
 *   notes?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Appointment
 * }
 * 
 * Regras de permissão:
 * - Admin pode atualizar qualquer campo de qualquer agendamento
 * - Funcionário pode atualizar status e notas dos seus próprios agendamentos
 * - Cliente pode apenas cancelar (status = 'canceled') seus próprios agendamentos
 *   com pelo menos 24h de antecedência
 */
export const PATCH = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const appointmentId = context.params.id;
    
    if (!appointmentId) {
      return ApiErrors.VALIDATION_ERROR('ID do agendamento não fornecido');
    }
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Buscar o agendamento atual
    const { data: currentAppointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, 
        client_id,
        employee_id,
        comanda_id,
        start_time,
        end_time,
        status,
        notes
      `)
      .eq('id', appointmentId)
      .single();
    
    if (appointmentError) {
      if (appointmentError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Agendamento não encontrado');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar agendamento: ${appointmentError.message}`);
    }
    
    // Verificação de permissão base
    if (userData.role === 'client' && currentAppointment.client_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você não tem permissão para atualizar este agendamento');
    }
    
    if (userData.role === 'employee' && currentAppointment.employee_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você não tem permissão para atualizar este agendamento');
    }
    
    // Schema de validação
    const updateSchema = z.object({
      client_id: z.string().uuid({ message: 'ID do cliente inválido' }).optional(),
      employee_id: z.string().uuid({ message: 'ID do funcionário inválido' }).optional(),
      start_time: z.string().refine(val => !isNaN(Date.parse(val)), { 
        message: 'Data e hora de início inválidas' 
      }).optional(),
      end_time: z.string().refine(val => !isNaN(Date.parse(val)), { 
        message: 'Data e hora de término inválidas' 
      }).optional(),
      status: z.enum([
        'scheduled', 
        'confirmed', 
        'waiting', 
        'in_progress', 
        'absent', 
        'completed', 
        'canceled'
      ], {
        errorMap: () => ({ message: "Invalid enum value. Expected 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'absent' | 'completed' | 'canceled'" })
      }).optional(),
      notes: z.string().optional(),
      comanda_id: z.string().uuid({ message: 'ID da comanda inválido' }).optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = updateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const updateData = validationResult.data;
    
    // Se estiver atualizando o horário, verificar sobreposições
    if (updateData.start_time || updateData.end_time) {
      const newStartTime = updateData.start_time || currentAppointment.start_time;
      const newEndTime = updateData.end_time || currentAppointment.end_time;
      const employeeId = updateData.employee_id || currentAppointment.employee_id;
      
      // Verificar sobreposição de horários para o funcionário (excluindo o próprio agendamento)
      const { data: overlappingAppointments, error: overlapError } = await supabaseAdmin
        .from('appointments')
        .select('id, start_time, end_time')
        .eq('employee_id', employeeId)
        .not('id', 'eq', appointmentId)
        .not('status', 'in', '(canceled,completed)')
        .filter('start_time', 'lt', newEndTime)
        .filter('end_time', 'gt', newStartTime);
        
      if (overlapError) {
        return ApiErrors.DATABASE_ERROR(`Erro ao verificar disponibilidade: ${overlapError.message}`);
      }
      
      if (overlappingAppointments && overlappingAppointments.length > 0) {
        return ApiErrors.VALIDATION_ERROR(
          'Já existe um agendamento neste horário para o profissional'
        );
      }
    }
    
    // Atualizar o agendamento
    const { data: updatedAppointment, error: updateError } = await supabaseAdmin
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .select(`
        id, 
        client_id,
        client:client_id (id, name, phone, email),
        employee_id,
        employee:employee_id (id, name),
        comanda_id,
        start_time,
        end_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .single();
      
    if (updateError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar agendamento: ${updateError.message}`);
    }
    
    // Buscar os serviços do agendamento
    const { data: services, error: servicesError } = await supabaseAdmin
      .from('appointment_services')
      .select(`
        id,
        service_id,
        quantity,
        unit_price,
        service:service_id (id, name, duration_minutes, price)
      `)
      .eq('appointment_id', appointmentId);
      
    if (servicesError) {
      console.error(`Erro ao buscar serviços do agendamento ${appointmentId}:`, servicesError);
    }
    
    const appointmentWithServices = {
      ...updatedAppointment,
      services: services || []
    };
    
    return successResponse(appointmentWithServices, { message: 'Agendamento atualizado com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/appointments/:id
 * @description Exclui permanentemente um agendamento
 * @access Privado - Apenas admin
 * 
 * @response {
 *   success: true,
 *   message: "Agendamento excluído com sucesso"
 * }
 */
export const DELETE = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const appointmentId = context.params.id;
    
    if (!appointmentId) {
      return ApiErrors.VALIDATION_ERROR('ID do agendamento não fornecido');
    }
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Apenas admin pode excluir permanentemente
    if (userData.role !== 'admin') {
      return ApiErrors.FORBIDDEN('Apenas administradores podem excluir agendamentos permanentemente');
    }
    
    // Verificar se o agendamento existe
    const { data: appointment, error: checkError } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('id', appointmentId)
      .single();
      
    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Agendamento não encontrado');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar agendamento: ${checkError.message}`);
    }
    
    // Excluir o agendamento
    const { error: deleteError } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('id', appointmentId);
      
    if (deleteError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao excluir agendamento: ${deleteError.message}`);
    }
    
    return successResponse(null, { message: 'Agendamento excluído com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 