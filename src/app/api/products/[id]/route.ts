import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, withAdmin, withRole } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * @route GET /api/products/:id
 * @description Recupera os detalhes de um produto específico
 * @access Público (com anon key)
 * 
 * @param id - ID do produto
 * 
 * @response {
 *   success: true,
 *   data: Product
 * }
 */
export const GET = async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const productId = context.params.id;
    
    // Buscar o produto no banco de dados
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
      
    if (error) {
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar produto: ${error.message}`);
    }
    
    if (!product) {
      return ApiErrors.NOT_FOUND('Produto não encontrado');
    }
    
    return successResponse(product);
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
};

/**
 * @route PATCH /api/products/:id
 * @description Atualiza os dados de um produto
 * @access Privado - Apenas admin
 * 
 * @param id - ID do produto
 * 
 * @requestBody {
 *   name?: string,
 *   description?: string,
 *   sale_price?: number,
 *   cost_price?: number,
 *   category?: string,
 *   quantity_in_stock?: number,
 *   min_stock_alert?: number,
 *   is_active?: boolean,
 *   image_url?: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Product
 * }
 * 
 * Obs: Para atualizar quantidade em estoque, use o endpoint /api/stock-movements
 */
export const PATCH = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const productId = context.params.id;
    
    // Schema de validação
    const updateSchema = z.object({
      name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }).optional(),
      description: z.string().optional().nullable(),
      sale_price: z.number().positive({ message: 'Preço deve ser um valor positivo' }).optional(),
      cost_price: z.number().nonnegative({ message: 'Preço de custo deve ser um valor não negativo' }).optional(),
      category: z.string().optional().nullable(),
      quantity_in_stock: z.number().int().nonnegative({ message: 'Quantidade em estoque deve ser um número não negativo' }).optional(),
      min_stock_alert: z.number().int().nonnegative({ message: 'Estoque mínimo deve ser um número não negativo' }).optional(),
      is_active: z.boolean().optional(),
      image_url: z.string().url({ message: 'URL da imagem inválida' }).optional().nullable(),
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
    
    // Verificar se o produto existe
    const { data: existingProduct, error: checkError } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', productId)
      .single();
      
    if (checkError) {
      console.error('Erro Supabase ao verificar produto:', {
        error: checkError,
        productId,
        message: checkError.message,
        details: checkError.details,
        hint: checkError.hint
      });
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar produto: ${checkError.message} | Details: ${JSON.stringify(checkError)}`);
    }
    
    if (!existingProduct) {
      console.error('Produto não encontrado:', {
        productId,
        queryResult: { data: existingProduct, error: checkError }
      });
      return ApiErrors.NOT_FOUND(`Produto não encontrado. ID: ${productId}`);
    }
    
    // Atualizar o produto
    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();
      
    if (updateError) {
      console.error('Erro Supabase ao atualizar produto:', {
        error: updateError,
        productId,
        updateData,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });
      return ApiErrors.DATABASE_ERROR(`Erro ao atualizar produto: ${updateError.message} | Details: ${JSON.stringify(updateError)}`);
    }
    
    // Verificar se o estoque está abaixo do mínimo após a atualização
    if (updatedProduct.quantity_in_stock < updatedProduct.min_stock_alert) {
      // Registrar em um log de auditoria
      const { error: auditError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          entity_type: 'product',
          entity_id: productId,
          action: 'low_stock_warning',
          details: {
            current_stock: updatedProduct.quantity_in_stock,
            minimum_stock: updatedProduct.min_stock_alert,
            product_name: updatedProduct.name
          }
        });
        
      if (auditError) {
        console.error('Erro ao registrar alerta de estoque baixo:', auditError);
      }
    }
    
    return successResponse(updatedProduct, { message: 'Produto atualizado com sucesso' });
  } catch (error: any) {
    console.error('Erro não tratado ao atualizar produto:', {
      error,
      message: error.message,
      stack: error.stack
    });
    return ApiErrors.SERVER_ERROR(`Erro ao processar requisição: ${error.message} | Stack: ${error.stack}`);
  }
});

/**
 * @route DELETE /api/products/:id
 * @description Remove um produto
 * @access Privado - Apenas admin
 * 
 * @param id - ID do produto
 * 
 * @response {
 *   success: true,
 *   data: { message: string }
 * }
 * 
 * Importante: A exclusão só é possível se o produto não estiver sendo
 * referenciado em comandas ou outras transações.
 */
export const DELETE = withAdmin(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const productId = context.params.id;
    
    // Verificar se o produto existe
    const { data: product, error: checkError } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('id', productId)
      .single();
      
    if (checkError || !product) {
      return ApiErrors.NOT_FOUND('Produto não encontrado');
    }
    
    // Verificar se o produto está em uso em comandas
    const { count: comandaItemCount, error: comandaItemError } = await supabaseAdmin
      .from('comanda_items')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
      
    if (comandaItemError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar itens de comanda: ${comandaItemError.message}`);
    }
    
    if (comandaItemCount && comandaItemCount > 0) {
      return ApiErrors.VALIDATION_ERROR(
        `Não é possível excluir o produto pois está sendo usado em ${comandaItemCount} item(ns) de comanda`
      );
    }
    
    // Registrar a exclusão em auditoria antes de remover
    const { error: auditError } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        entity_type: 'product',
        entity_id: productId,
        action: 'delete',
        details: {
          product_name: product.name
        }
      });
      
    if (auditError) {
      console.error('Erro ao registrar exclusão em auditoria:', auditError);
    }
    
    // Remover o produto
    const { error: deleteError } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);
      
    if (deleteError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao remover produto: ${deleteError.message}`);
    }
    
    return successResponse({ 
      message: 'Produto removido com sucesso',
      id: productId 
    });
  } catch (error: any) {
    return ApiErrors.SERVER_ERROR(error.message);
  }
}); 