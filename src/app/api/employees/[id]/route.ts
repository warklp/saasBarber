import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/employees/:id
 * @description Recupera os detalhes de um funcionário específico
 * @access Privado - Apenas admin ou o próprio funcionário
 * 
 * @param id - ID do funcionário
 * 
 * @response {
 *   success: true,
 *   data: Employee
 * }
 */
export const GET = withRole(['admin', 'employee'], async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const userId = (req as any).user.id;
    const employeeId = context.params.id;
    
    // Verificar se é admin ou o próprio funcionário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Se não for admin e não for o próprio funcionário, negar acesso
    if (userData.role !== 'admin' && userId !== employeeId) {
      return ApiErrors.FORBIDDEN('Você não tem permissão para acessar os dados deste funcionário');
    }
    
    // Buscar dados do funcionário
    const { data: employee, error } = await supabaseAdmin
      .from('users')
      .select(`
        id, 
        name, 
        email, 
        phone, 
        role, 
        created_at,
        updated_at,
        user_metadata (
          metadata
        )
      `)
      .eq('id', employeeId)
      .eq('role', 'employee')
      .single();
      
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar funcionário: ${error.message}`);
    }
    
    if (!employee) {
      return ApiErrors.NOT_FOUND('Funcionário não encontrado');
    }
    
    // Formatar a resposta
    const formattedEmployee = {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
      metadata: employee.user_metadata?.[0]?.metadata || {}
    };
    
    return successResponse(formattedEmployee);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route PATCH /api/employees/:id
 * @description Atualiza os dados de um funcionário
 * @access Privado - Apenas admin
 * 
 * @param id - ID do funcionário
 * 
 * @requestBody {
 *   name?: string,
 *   phone?: string,
 *   calendarColor?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Employee
 * }
 */
export const PATCH = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    console.log('PATCH /api/employees/[id] - Parâmetros recebidos:', { 
      context,
      url: req.url,
      nextUrl: req.nextUrl
    });

    const employeeId = context.params.id;
    console.log('PATCH /api/employees/[id] - ID extraído:', { employeeId });
    
    if (!employeeId) {
      return ApiErrors.VALIDATION_ERROR('ID do funcionário não fornecido');
    }
    
    // Schema de validação
    const updateSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }).optional(),
      phone: z.string().min(8, { message: 'Telefone inválido' }).optional().nullable(),
      calendarColor: z.string().optional(),
    });
    
    // Validar dados
    const body = await req.json();
    console.log('PATCH /api/employees/[id] - Dados recebidos:', body);
    
    const validationResult = updateSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.log('PATCH /api/employees/[id] - Erro de validação:', validationResult.error);
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { name, phone, calendarColor } = validationResult.data;
    
    // Verificar se o funcionário existe
    console.log('PATCH /api/employees/[id] - Verificando existência do funcionário:', { employeeId });
    const { data: existingEmployee, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, role, name')
      .eq('id', employeeId)
      .single();
      
    console.log('PATCH /api/employees/[id] - Resultado da verificação completo:', { 
      existingEmployee, 
      error: checkError?.message,
      query: `SELECT id, role, name FROM users WHERE id = '${employeeId}'`
    });
    
    if (checkError) {
      console.log('PATCH /api/employees/[id] - Erro na verificação:', checkError);
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar funcionário: ${checkError.message}`);
    }
    
    if (!existingEmployee) {
      console.log('PATCH /api/employees/[id] - Funcionário não encontrado');
      return ApiErrors.NOT_FOUND('Funcionário não encontrado');
    }

    // Verificar se é um funcionário
    console.log('PATCH /api/employees/[id] - Verificando role:', existingEmployee.role);
    if (!existingEmployee.role || existingEmployee.role !== 'employee') {
      console.log('PATCH /api/employees/[id] - Role inválida:', existingEmployee.role);
      return ApiErrors.VALIDATION_ERROR('O usuário não é um funcionário');
    }
    
    // Atualizar dados básicos do funcionário
    const updates: Record<string, any> = {};
    
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    
    let updatedEmployee = null;
    
    // Só fazer update se houver campos para atualizar
    if (Object.keys(updates).length > 0) {
      console.log('PATCH /api/employees/[id] - Atualizando dados:', updates);
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', employeeId)
        .select()
        .single();
        
      if (updateError) {
        console.error('PATCH /api/employees/[id] - Erro ao atualizar:', updateError);
        return ApiErrors.DATABASE_ERROR(`Erro ao atualizar funcionário: ${updateError.message}`);
      }
      
      updatedEmployee = updated;
    } else {
      // Se não houver campos básicos para atualizar, buscar os dados atuais
      console.log('PATCH /api/employees/[id] - Buscando dados atuais (sem updates)');
      const { data: current, error: getError } = await supabaseAdmin
        .from('users')
        .select()
        .eq('id', employeeId)
        .single();
        
      if (getError) {
        console.error('PATCH /api/employees/[id] - Erro ao buscar dados:', getError);
        return ApiErrors.DATABASE_ERROR(`Erro ao buscar funcionário: ${getError.message}`);
      }
      
      updatedEmployee = current;
    }
    
    // Atualizar metadados se necessário
    if (calendarColor !== undefined) {
      console.log('PATCH /api/employees/[id] - Atualizando cor do calendário:', calendarColor);
      // Verificar se já existe um registro de metadados
      const { data: existingMetadata, error: metaCheckError } = await supabaseAdmin
        .from('user_metadata')
        .select('id, metadata')
        .eq('user_id', employeeId)
        .maybeSingle();
        
      if (metaCheckError) {
        return ApiErrors.DATABASE_ERROR(`Erro ao verificar metadados: ${metaCheckError.message}`);
      }
      
      if (existingMetadata) {
        // Atualizar metadados existentes
        const updatedMetadata = {
          ...existingMetadata.metadata,
          calendarColor
        };
        
        const { error: metaUpdateError } = await supabaseAdmin
          .from('user_metadata')
          .update({ metadata: updatedMetadata })
          .eq('id', existingMetadata.id);
          
        if (metaUpdateError) {
          console.error('Erro ao atualizar metadados:', metaUpdateError);
          // Não interrompemos por erro nos metadados
        }
      } else {
        // Criar novo registro de metadados
        const { error: metaInsertError } = await supabaseAdmin
          .from('user_metadata')
          .insert({
            user_id: employeeId,
            metadata: { calendarColor }
          });
          
        if (metaInsertError) {
          console.error('Erro ao inserir metadados:', metaInsertError);
          // Não interrompemos por erro nos metadados
        }
      }
    }
    
    // Buscar os metadados atualizados
    const { data: metadata, error: metadataError } = await supabaseAdmin
      .from('user_metadata')
      .select('metadata')
      .eq('user_id', employeeId)
      .maybeSingle();
      
    // Montar resposta
    const response = {
      ...updatedEmployee,
      metadata: metadata?.metadata || {}
    };
    
    console.log('PATCH /api/employees/[id] - Atualização concluída com sucesso:', response);
    return successResponse(response, { message: 'Funcionário atualizado com sucesso' });
  } catch (error: any) {
    console.error('PATCH /api/employees/[id] - Erro não tratado:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route DELETE /api/employees/:id
 * @description Remove um funcionário
 * @access Privado - Apenas admin
 * 
 * @param id - ID do funcionário
 * 
 * @response {
 *   success: true,
 *   data: { message: string }
 * }
 */
export const DELETE = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const employeeId = context.params.id;
    
    // Verificar se o funcionário existe
    const { data: employee, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', employeeId)
      .eq('role', 'employee')
      .single();
      
    if (checkError || !employee) {
      return ApiErrors.NOT_FOUND('Funcionário não encontrado');
    }
    
    // Remover da tabela users primeiro (a foreign key vai remover os metadados em cascata)
    const { error: deleteUserError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', employeeId);
      
    if (deleteUserError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao remover funcionário: ${deleteUserError.message}`);
    }
    
    // Remover da autenticação
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(employeeId);
    
    if (deleteAuthError) {
      console.error('Erro ao remover usuário da autenticação:', deleteAuthError);
      // Continuamos mesmo com erro aqui, já que os dados da tabela foram removidos
    }
    
    return successResponse({ 
      message: 'Funcionário removido com sucesso',
      id: employeeId 
    });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 