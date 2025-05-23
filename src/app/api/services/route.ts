import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/services
 * @description Lista todos os serviços disponíveis
 * @access Público (com anon key)
 * 
 * @queryParams {
 *   only_active: string - Se "true", retorna apenas serviços ativos
 * }
 * 
 * @response {
 *   success: true,
 *   data: Array<Service>
 * }
 * 
 * Consumidores deste endpoint:
 * - Página de catálogo de serviços
 * - Seleção de serviços para agendamento
 * - Dashboard administrativo
 */
export const GET = async (req: NextRequest) => {
  try {
    // Verificar se deve retornar apenas serviços ativos
    const url = new URL(req.url);
    const onlyActive = url.searchParams.get('only_active') === 'true';
    
    // Construir a query
    let query = supabaseAdmin
      .from('services')
      .select('*')
      .order('name');
    
    // Filtrar por serviços ativos se solicitado
    if (onlyActive) {
      query = query.eq('is_active', true);
    }
    
    // Executar a consulta
    const { data, error } = await query;
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar serviços: ${error.message}`);
    }
    
    return successResponse(data);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
};

/**
 * @route POST /api/services
 * @description Cria um novo serviço
 * @access Privado - Apenas admin
 * 
 * @requestBody {
 *   name: string,
 *   description?: string,
 *   duration_minutes: number,
 *   price: number,
 *   is_active?: boolean
 * }
 * 
 * @response {
 *   success: true,
 *   data: Service
 * }
 */
export const POST = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    // Schema de validação
    const serviceSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }),
      description: z.string().optional(),
      duration_minutes: z.number().int().positive({ message: 'Duração deve ser um número positivo' }),
      price: z.number().positive({ message: 'Preço deve ser um valor positivo' }),
      is_active: z.boolean().default(true),
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = serviceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { name, description, duration_minutes, price, is_active } = validationResult.data;
    
    // Inserir o serviço no banco de dados
    const { data: service, error } = await supabaseAdmin
      .from('services')
      .insert({
        name,
        description,
        duration_minutes,
        price,
        is_active
      })
      .select()
      .single();
      
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao criar serviço: ${error.message}`);
    }
    
    return successResponse(service, { message: 'Serviço criado com sucesso' }, 201);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 