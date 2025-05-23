import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/customers
 * @description Lista todos os clientes
 * @access Privado - Funcionários e admin
 * 
 * @queryParams {
 *   search?: string - Busca por nome, email ou telefone
 *   is_active?: boolean - Filtrar por status
 *   page?: number - Página atual (default: 1)
 *   per_page?: number - Itens por página (default: 10)
 * }
 * 
 * @response {
 *   success: true,
 *   data: Customer[],
 *   pagination: {
 *     total: number,
 *     page: number,
 *     per_page: number,
 *     total_pages: number
 *   }
 * }
 */
export const GET = withRole(['employee', 'admin'], async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const is_active = url.searchParams.get('is_active');
    const page = parseInt(url.searchParams.get('page') || '1');
    const per_page = parseInt(url.searchParams.get('per_page') || '10');
    
    // Calcular offset para paginação
    const offset = (page - 1) * per_page;
    
    // Iniciar query base
    let query = supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact' });
    
    // Aplicar filtros
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    
    if (is_active !== null) {
      query = query.eq('is_active', is_active === 'true');
    }
    
    // Aplicar paginação
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + per_page - 1);
    
    // Executar query
    const { data: customers, error, count } = await query;
    
    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar clientes: ${error.message}`);
    }
    
    // Calcular total de páginas
    const total = count || 0;
    const total_pages = Math.ceil(total / per_page);
    
    return successResponse(customers, {
      pagination: {
        total,
        page,
        per_page,
        total_pages
      }
    });
  } catch (error: any) {
    console.error('Erro não tratado ao buscar clientes:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

/**
 * @route POST /api/customers
 * @description Cria um novo cliente
 * @access Privado - Funcionários e admin
 * 
 * @requestBody {
 *   name: string,
 *   phone: string,
 *   email?: string,
 *   notes?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Customer
 * }
 */
export const POST = withRole(['employee', 'admin'], async (req: NextRequest) => {
  try {
    // Schema de validação
    const createSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }),
      phone: z.string().min(10, { message: 'Telefone inválido' }),
      email: z.string().email({ message: 'Email inválido' }).optional().nullable(),
      notes: z.string().optional().nullable()
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = createSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const customerData = validationResult.data;
    
    // Verificar se já existe cliente com o mesmo telefone
    const { data: existingCustomer, error: checkError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', customerData.phone)
      .single();
      
    if (checkError && checkError.code !== 'PGRST116') { // Ignorar erro de não encontrado
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar cliente existente: ${checkError.message}`);
    }
    
    if (existingCustomer) {
      return ApiErrors.VALIDATION_ERROR('Já existe um cliente cadastrado com este telefone');
    }
    
    // Criar cliente
    const { data: customer, error: createError } = await supabaseAdmin
      .from('customers')
      .insert(customerData)
      .select()
      .single();
      
    if (createError) {
      console.error('Erro ao criar cliente:', createError);
      return ApiErrors.DATABASE_ERROR(`Erro ao criar cliente: ${createError.message}`);
    }
    
    return successResponse(customer, { message: 'Cliente criado com sucesso' });
  } catch (error: any) {
    console.error('Erro não tratado ao criar cliente:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 