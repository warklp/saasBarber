import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/services/:id
 * @description Recupera os detalhes de um serviço específico
 * @access Público (com anon key)
 * 
 * @param id - ID do serviço
 * 
 * @response {
 *   success: true,
 *   data: Service
 * }
 */
export const GET = async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const serviceId = context.params.id;
    
    // Buscar o serviço no banco de dados
    const { data: service, error } = await supabaseAdmin
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();
      
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar serviço: ${error.message}`);
    }
    
    if (!service) {
      return ApiErrors.NOT_FOUND('Serviço não encontrado');
    }
    
    return successResponse(service);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
};

/**
 * @route PATCH /api/services/:id
 * @description Atualiza os dados de um serviço
 * @access Privado - Apenas admin
 * 
 * @param id - ID do serviço
 * 
 * @requestBody {
 *   name?: string,
 *   description?: string,
 *   duration_minutes?: number,
 *   price?: number,
 *   is_active?: boolean
 * }
 * 
 * @response {
 *   success: true,
 *   data: Service
 * }
 */
export const PATCH = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const serviceId = context.params.id;
    
    // Schema de validação
    const updateSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }).optional(),
      description: z.string().optional().nullable(),
      duration_minutes: z.number().int().positive({ message: 'Duração deve ser um número positivo' }).optional(),
      price: z.number().positive({ message: 'Preço deve ser um valor positivo' }).optional(),
      is_active: z.boolean().optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = updateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    // Verificar se o serviço existe
    const { data: existingService, error: checkError } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .single();
      
    if (checkError || !existingService) {
      return ApiErrors.NOT_FOUND('Serviço não encontrado');
    }
    
    // Atualizar o serviço
    const { data: updatedService, error: updateError } = await supabaseAdmin
      .from('services')
      .update(validationResult.data)
      .eq('id', serviceId)
      .select()
      .single();
      
    if (updateError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar serviço: ${updateError.message}`);
    }
    
    return successResponse(updatedService, { message: 'Serviço atualizado com sucesso' });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/services/:id
 * @description Remove um serviço
 * @access Privado - Apenas admin
 * 
 * @param id - ID do serviço
 * 
 * @response {
 *   success: true,
 *   data: { message: string }
 * }
 * 
 * Importante: A exclusão só é possível se o serviço não estiver sendo
 * referenciado em agendamentos ou comandas existentes.
 */
export const DELETE = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const serviceId = context.params.id;
    
    // Verificar se o serviço existe
    const { data: service, error: checkError } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .single();
      
    if (checkError || !service) {
      return ApiErrors.NOT_FOUND('Serviço não encontrado');
    }
    
    // Verificar se o serviço está em uso em agendamentos
    const { count: appointmentCount, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', serviceId);
      
    if (appointmentError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar agendamentos: ${appointmentError.message}`);
    }
    
    if (appointmentCount && appointmentCount > 0) {
      return ApiErrors.VALIDATION_ERROR(
        `Não é possível excluir o serviço pois está sendo usado em ${appointmentCount} agendamento(s)`
      );
    }
    
    // Verificar se o serviço está em uso em itens de comanda
    const { count: comandaItemCount, error: comandaItemError } = await supabaseAdmin
      .from('comanda_items')
      .select('id', { count: 'exact', head: true })
      .eq('service_id', serviceId);
      
    if (comandaItemError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar itens de comanda: ${comandaItemError.message}`);
    }
    
    if (comandaItemCount && comandaItemCount > 0) {
      return ApiErrors.VALIDATION_ERROR(
        `Não é possível excluir o serviço pois está sendo usado em ${comandaItemCount} item(ns) de comanda`
      );
    }
    
    // Remover o serviço
    const { error: deleteError } = await supabaseAdmin
      .from('services')
      .delete()
      .eq('id', serviceId);
      
    if (deleteError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao remover serviço: ${deleteError.message}`);
    }
    
    return successResponse({ 
      message: 'Serviço removido com sucesso',
      id: serviceId 
    });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 