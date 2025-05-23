import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/customers/:id
 * @description Recupera os detalhes de um cliente específico
 * @access Privado - Funcionários e admin
 * 
 * @param id - ID do cliente
 * 
 * @response {
 *   success: true,
 *   data: Customer
 * }
 */
export const GET = withRole(['employee', 'admin'], async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const customerId = context.params.id;
    
    // Buscar o cliente no banco de dados
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
      
    if (error) {
      console.error('Erro ao buscar cliente:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar cliente: ${error.message}`);
    }
    
    if (!customer) {
      return ApiErrors.NOT_FOUND('Cliente não encontrado');
    }
    
    return successResponse(customer);
  } catch (error: any) {
    console.error('Erro não tratado ao buscar cliente:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/customers/:id
 * @description Atualiza os dados de um cliente
 * @access Privado - Funcionários e admin
 * 
 * @param id - ID do cliente
 * 
 * @requestBody {
 *   name?: string,
 *   phone?: string,
 *   email?: string,
 *   notes?: string,
 *   is_active?: boolean
 * }
 * 
 * @response {
 *   success: true,
 *   data: Customer
 * }
 */
export const PATCH = withRole(['employee', 'admin'], async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const customerId = context.params.id;
    
    // Schema de validação
    const updateSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }).optional(),
      phone: z.string().min(10, { message: 'Telefone inválido' }).optional(),
      email: z.string().email({ message: 'Email inválido' }).optional().nullable(),
      notes: z.string().optional().nullable(),
      is_active: z.boolean().optional()
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
    
    // Verificar se o cliente existe
    const { data: existingCustomer, error: checkError } = await supabaseAdmin
      .from('customers')
      .select('id, phone')
      .eq('id', customerId)
      .single();
      
    if (checkError) {
      console.error('Erro ao verificar cliente:', checkError);
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar cliente: ${checkError.message}`);
    }
    
    if (!existingCustomer) {
      return ApiErrors.NOT_FOUND('Cliente não encontrado');
    }
    
    // Se estiver atualizando o telefone, verificar se já existe outro cliente com o mesmo
    if (updateData.phone && updateData.phone !== existingCustomer.phone) {
      const { data: duplicatePhone, error: dupeError } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('phone', updateData.phone)
        .neq('id', customerId)
        .single();
        
      if (dupeError && dupeError.code !== 'PGRST116') { // Ignorar erro de não encontrado
        return ApiErrors.DATABASE_ERROR(`Erro ao verificar telefone duplicado: ${dupeError.message}`);
      }
      
      if (duplicatePhone) {
        return ApiErrors.VALIDATION_ERROR('Já existe outro cliente cadastrado com este telefone');
      }
    }
    
    // Atualizar o cliente
    const { data: updatedCustomer, error: updateError } = await supabaseAdmin
      .from('customers')
      .update(updateData)
      .eq('id', customerId)
      .select()
      .single();
      
    if (updateError) {
      console.error('Erro ao atualizar cliente:', updateError);
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar cliente: ${updateError.message}`);
    }
    
    return successResponse(updatedCustomer, { message: 'Cliente atualizado com sucesso' });
  } catch (error: any) {
    console.error('Erro não tratado ao atualizar cliente:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/customers/:id
 * @description Remove um cliente
 * @access Privado - Apenas admin
 * 
 * @param id - ID do cliente
 * 
 * @response {
 *   success: true,
 *   data: { message: string }
 * }
 */
export const DELETE = withRole(['admin'], async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const customerId = context.params.id;
    
    // Verificar se o cliente existe
    const { data: customer, error: checkError } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .single();
      
    if (checkError) {
      console.error('Erro ao verificar cliente:', checkError);
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar cliente: ${checkError.message}`);
    }
    
    if (!customer) {
      return ApiErrors.NOT_FOUND('Cliente não encontrado');
    }
    
    // Verificar se o cliente tem agendamentos ou comandas
    // TODO: Implementar verificação quando essas tabelas estiverem relacionadas
    
    // Registrar a exclusão em auditoria
    const { error: auditError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        entity_type: 'customer',
        entity_id: customerId,
        action: 'delete',
        details: {
          customer_name: customer.name
        }
      });
      
    if (auditError) {
      console.error('Erro ao registrar exclusão em auditoria:', auditError);
    }
    
    // Remover o cliente
    const { error: deleteError } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('id', customerId);
      
    if (deleteError) {
      console.error('Erro ao remover cliente:', deleteError);
      return ApiErrors.DATABASE_ERROR(`Erro ao remover cliente: ${deleteError.message}`);
    }
    
    return successResponse({ 
      message: 'Cliente removido com sucesso',
      id: customerId 
    });
  } catch (error: any) {
    console.error('Erro não tratado ao remover cliente:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 