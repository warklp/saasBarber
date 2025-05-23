import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route PATCH /api/appointments/:id/complete
 * @description Marca um agendamento como concluído
 * @access Privado - Requer autenticação (funcionário ou admin)
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
    
    // Apenas funcionários e admins podem marcar como concluído
    if (userData.role === 'client') {
      return ApiErrors.FORBIDDEN('Apenas funcionários e administradores podem marcar agendamentos como concluídos');
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
    
    // Verificar permissões para o funcionário
    if (userData.role === 'employee' && appointment.employee_id !== user.id) {
      return ApiErrors.FORBIDDEN('Você só pode concluir agendamentos atribuídos a você');
    }
    
    // Verificar se o agendamento já está cancelado ou concluído
    if (appointment.status === 'canceled') {
      return ApiErrors.VALIDATION_ERROR('Não é possível concluir um agendamento cancelado');
    }
    
    if (appointment.status === 'completed') {
      return ApiErrors.VALIDATION_ERROR('Este agendamento já está concluído');
    }
    
    // Atualizar o status do agendamento para concluído
    const { data: updatedAppointment, error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'completed' })
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
      return ApiErrors.DATABASE_ERROR(`Erro ao concluir agendamento: ${updateError.message}`);
    }

    // Verificar e fechar a comanda associada ao agendamento
    try {
      // Buscar a comanda do agendamento
      const { data: comanda, error: comandaError } = await supabaseAdmin
        .from('comandas')
        .select(`
          id,
          status,
          total,
          discount,
          taxes
        `)
        .eq('appointment_id', appointmentId)
        .eq('status', 'open')
        .single();
      
      if (comandaError) {
        console.error('Erro ao buscar comanda para fechamento automático:', comandaError.message);
      } else if (comanda) {
        // Calcular o valor final com base no total e possíveis descontos/taxas
        const discountValue = comanda.discount || 0;
        const taxesValue = comanda.taxes || 0;
        let finalTotal = (comanda.total || 0);
        
        // Aplicar desconto e taxas
        finalTotal = finalTotal - discountValue;
        finalTotal = finalTotal + taxesValue;
        
        // Arredondar para 2 casas decimais e garantir que não seja negativo
        finalTotal = Math.max(0, Math.round(finalTotal * 100) / 100);
        
        // Fechar a comanda
        const { error: closeError } = await supabaseAdmin
          .from('comandas')
          .update({ 
            status: 'closed',
            final_total: finalTotal,
            cashier_id: user.id
          })
          .eq('id', comanda.id);
          
        if (closeError) {
          console.error('Erro ao fechar comanda automaticamente:', closeError.message);
        }
      }
    } catch (comandaError) {
      console.error('Erro ao processar fechamento da comanda:', comandaError);
      // Não interrompemos o fluxo se falhar o fechamento da comanda
    }
    
    return successResponse(updatedAppointment, { message: 'Agendamento concluído com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 