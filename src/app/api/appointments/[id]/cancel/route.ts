import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route PATCH /api/appointments/:id/cancel
 * @description Cancela um agendamento existente
 * @access Privado - Requer autenticação
 * 
 * @response {
 *   success: true,
 *   data: Appointment
 * }
 */
export const PATCH = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const appointmentId = context.params.id;
    
    if (!appointmentId) {
      return ApiErrors.VALIDATION_ERROR('ID do agendamento não fornecido');
    }
    
    // Verificar role do usuário para controle de acesso
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Verificar se o agendamento existe
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select(`
        id, 
        client_id,
        employee_id,
        status
      `)
      .eq('id', appointmentId)
      .single();
      
    if (appointmentError || !appointment) {
      return ApiErrors.VALIDATION_ERROR('Agendamento não encontrado');
    }
    
    // Verificar permissões para cancelar o agendamento
    if (userData.role === 'client' && appointment.client_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você só pode cancelar seus próprios agendamentos');
    }
    
    if (userData.role === 'employee' && appointment.employee_id !== user.id && userData.role !== 'admin') {
      return ApiErrors.FORBIDDEN('Você só pode cancelar agendamentos atribuídos a você');
    }
    
    // Verificar se o agendamento já está cancelado ou concluído
    if (appointment.status === 'canceled') {
      return ApiErrors.VALIDATION_ERROR('Este agendamento já está cancelado');
    }
    
    if (appointment.status === 'completed') {
      return ApiErrors.VALIDATION_ERROR('Não é possível cancelar um agendamento já concluído');
    }
    
    // Atualizar o status do agendamento para cancelado
    const { data: updatedAppointment, error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'canceled' })
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
      return ApiErrors.DATABASE_ERROR(`Erro ao cancelar agendamento: ${updateError.message}`);
    }

    // Verificar e cancelar a comanda associada ao agendamento
    try {
      // Buscar a comanda do agendamento
      const { data: comanda, error: comandaError } = await supabaseAdmin
        .from('comandas')
        .select('id, status')
        .eq('appointment_id', appointmentId)
        .not('status', 'eq', 'closed') // Não cancelar comandas já fechadas
        .single();
      
      if (comandaError) {
        console.error('Erro ao buscar comanda para cancelamento automático:', comandaError.message);
      } else if (comanda) {
        // Cancelar a comanda
        const { error: cancelError } = await supabaseAdmin
          .from('comandas')
          .update({ status: 'canceled' })
          .eq('id', comanda.id);
          
        if (cancelError) {
          console.error('Erro ao cancelar comanda automaticamente:', cancelError.message);
        }
      }
    } catch (comandaError) {
      console.error('Erro ao processar cancelamento da comanda:', comandaError);
      // Não interrompemos o fluxo se falhar o cancelamento da comanda
    }
    
    return successResponse(updatedAppointment, { message: 'Agendamento cancelado com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 