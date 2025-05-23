import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/products
 * @description Lista todos os produtos disponíveis
 * @access Público (com anon key)
 * 
 * @queryParams {
 *   only_active: string - Se "true", retorna apenas produtos ativos
 *   low_stock: string - Se "true", retorna apenas produtos com estoque baixo
 *   category: string - Filtra por categoria
 * }
 * 
 * @response {
 *   success: true,
 *   data: Array<Product>
 * }
 * 
 * Consumidores deste endpoint:
 * - Página de catálogo de produtos
 * - Dashboard administrativo
 * - Tela de caixa/vendas
 */
export const GET = async (req: NextRequest) => {
  try {
    // Parâmetros de filtro
    const url = new URL(req.url);
    const onlyActive = url.searchParams.get('only_active') === 'true';
    const lowStock = url.searchParams.get('low_stock') === 'true';
    const category = url.searchParams.get('category');
    
    // Construir a query
    let query = supabaseAdmin
      .from('products')
      .select('*')
      .order('name');
    
    // Aplicar filtros
    if (onlyActive) {
      query = query.eq('is_active', true);
    }
    
    if (lowStock) {
      query = query.lt('quantity_in_stock', 'min_stock_alert');
    }
    
    if (category) {
      query = query.eq('category', category);
    }
    
    // Executar a consulta
    const { data, error } = await query;
    
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar produtos: ${error.message}`);
    }
    
    return successResponse(data);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
};

/**
 * @route POST /api/products
 * @description Cria um novo produto
 * @access Privado - Apenas admin
 * 
 * @requestBody {
 *   name: string,
 *   description?: string,
 *   sale_price: number,
 *   cost_price?: number,
 *   category?: string,
 *   sku?: string,
 *   barcode?: string,
 *   quantity_in_stock: number,
 *   min_stock_alert?: number,
 *   is_active?: boolean,
 *   image_url?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Product
 * }
 */
export const POST = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    // Schema de validação
    const productSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }),
      description: z.string().optional(),
      sale_price: z.number().positive({ message: 'Preço deve ser um valor positivo' }),
      cost_price: z.number().nonnegative({ message: 'Preço de custo deve ser um valor não negativo' }).optional(),
      category: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      quantity_in_stock: z.number().int().nonnegative({ message: 'Quantidade em estoque deve ser um número não negativo' }),
      min_stock_alert: z.number().int().nonnegative({ message: 'Estoque mínimo deve ser um número não negativo' }).optional(),
      is_active: z.boolean().default(true),
      image_url: z.string().url({ message: 'URL da imagem inválida' }).optional(),
    });
    
    // Validar dados
    const body = await req.json();
    console.log('Corpo da requisição recebido:', body);
    
    const validationResult = productSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Erro de validação:', validationResult.error.errors);
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const productData = validationResult.data;
    console.log('Dados validados para inserção:', productData);
    
    // Verificar se já existe um produto com o mesmo SKU ou código de barras
    if (productData.sku || productData.barcode) {
      let existingQuery = supabaseAdmin.from('products').select('id');
      
      if (productData.sku) {
        existingQuery = existingQuery.eq('sku', productData.sku);
      }
      
      if (productData.barcode) {
        existingQuery = existingQuery.eq('barcode', productData.barcode);
      }
      
      const { data: existingProduct, error: existingError } = await existingQuery;
      
      if (existingError) {
        return ApiErrors.DATABASE_ERROR(`Erro ao verificar produtos existentes: ${existingError.message}`);
      }
      
      if (existingProduct && existingProduct.length > 0) {
        return ApiErrors.VALIDATION_ERROR('Já existe um produto com o mesmo SKU ou código de barras');
      }
    }
    
    // Inserir o produto no banco de dados
    console.log('Tentando inserir produto no banco de dados:', productData);
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert(productData)
      .select()
      .single();
      
    if (error) {
      console.error('Erro ao inserir produto no banco de dados:', error);
      console.error('Estrutura de dados enviada:', productData);
      return ApiErrors.DATABASE_ERROR(`Erro ao criar produto: ${error.message}`);
    }
    
    console.log('Produto inserido com sucesso:', product);
    
    // Registrar a movimentação inicial de estoque
    if (productData.quantity_in_stock > 0) {
      const { error: stockError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: product.id,
          quantity: productData.quantity_in_stock,
          movement_type: 'initial',
          notes: 'Estoque inicial no cadastro do produto',
        });
        
      if (stockError) {
        console.error('Erro ao registrar movimentação de estoque inicial:', stockError);
        // Não interrompemos o fluxo para esse erro
      }
    }
    
    return successResponse(product, { message: 'Produto criado com sucesso' }, 201);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 