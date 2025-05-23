import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdmin, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/employees
 * @description Lista todos os funcionários
 * @access Privado - Apenas admin ou employee
 * 
 * @response {
 *   success: true,
 *   data: Array<Employee>
 * }
 * 
 * O acesso é controlado por middleware que verifica se o usuário
 * tem role 'admin' ou 'employee' antes de permitir acesso aos dados.
 */
export const GET = withRole(['admin', 'employee'], async (req: NextRequest) => {
  try {
    // Busca todos os funcionários (somente alguns campos essenciais)
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        id, 
        name, 
        email, 
        phone, 
        role, 
        created_at,
        updated_at,
        image_profile
      `)
      .eq('role', 'employee');
      
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar funcionários: ${error.message}`);
    }
    
    return successResponse(data);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/employees
 * @description Cria um novo funcionário
 * @access Privado - Apenas admin
 * 
 * @requestBody {
 *   name: string,
 *   email: string,
 *   phone?: string,
 *   calendarColor?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Employee
 * }
 * 
 * Esta rota usa a service role key para criar um novo usuário 
 * na autenticação e na tabela users do Supabase.
 */
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    // Schema de validação
    const employeeSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }),
      email: z.string().email({ message: 'Email inválido' }),
      phone: z.string().min(8, { message: 'Telefone inválido' }).optional(),
      calendarColor: z.string().optional(),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = employeeSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { name, email, phone, calendarColor } = validationResult.data;

    // Gerar senha aleatória para o novo funcionário
    const tempPassword = Math.random().toString(36).slice(-10) + 
      Math.random().toString(36).toUpperCase().slice(-2) + '!1';
    
    // 1. Criar usuário na autenticação do Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'employee'
      }
    });

    if (authError || !authData.user) {
      return ApiErrors.DATABASE_ERROR(`Erro ao criar autenticação: ${authError?.message || 'Usuário não criado'}`);
    }

    // 2. Inserir dados na tabela users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        name,
        email,
        phone: phone || null,
        role: 'employee'
      })
      .select()
      .single();

    if (userError) {
      // Rollback: Se houve erro ao inserir na tabela users, remover o usuário criado na autenticação
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return ApiErrors.DATABASE_ERROR(`Erro ao inserir na tabela users: ${userError.message}`);
    }

    // 3. Se houver cor do calendário, inserir nos metadados
    if (calendarColor) {
      const { error: metadataError } = await supabaseAdmin
        .from('user_metadata')
        .insert({
          user_id: authData.user.id,
          metadata: {
            calendarColor,
          }
        });

      if (metadataError) {
        console.error('Erro ao salvar metadados do usuário:', metadataError);
        // Não interrompemos o fluxo para esse erro, pois metadados são secundários
      }
    }

    // 4. Enviar e-mail para o colaborador definir uma senha
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (resetError) {
      console.error('Erro ao enviar e-mail de redefinição de senha:', resetError);
      // Não interrompemos o fluxo para esse erro
    }

    // Retornar os dados do funcionário criado
    return successResponse({
      ...userData,
      metadata: {
        calendarColor,
      }
    }, { message: 'Funcionário criado com sucesso. Um e-mail foi enviado para definir a senha.' }, 201);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 