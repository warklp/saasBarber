import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/middlewares';
import { ApiErrors, successResponse } from '@/lib/http/response';
import { supabaseAdmin } from '@/lib/supabase/server';

// Valores aceitos para payment_method no banco de dados
const VALID_PAYMENT_METHODS = ['cash', 'credit_card', 'debit_card', 'pix'] as const;
type ValidPaymentMethod = typeof VALID_PAYMENT_METHODS[number];

// Função para mapear um valor de método de pagamento para o ENUM do banco
function mapToValidPaymentMethod(method: string | number): ValidPaymentMethod {
  // Se já for um método válido, retornar
  if (typeof method === 'string' && VALID_PAYMENT_METHODS.includes(method as ValidPaymentMethod)) {
    return method as ValidPaymentMethod;
  }

  // Caso contrário, tentar mapear
  const methodStr = String(method).toLowerCase();
  
  if (methodStr.includes('cash') || methodStr.includes('dinheiro')) {
    return 'cash';
  }
  if (methodStr.includes('credit') || methodStr.includes('crédito')) {
    return 'credit_card';
  }
  if (methodStr.includes('debit') || methodStr.includes('débito')) {
    return 'debit_card';
  }
  if (methodStr.includes('pix')) {
    return 'pix';
  }
  
  // Valor padrão
  return 'cash';
}

/**
 * @route PATCH /api/comandas/:id/close
 * @description Fecha uma comanda existente e calcula comissões
 * @access Privado - Apenas admin e funcionários relacionados ao agendamento
 * 
 * @requestBody {
 *   payment_method: string
 * }
 * 
 * @response {
 *   success: true,
 *   data: Comanda
 * }
 */
export const PATCH = withAuth(async (req: NextRequest, context: { params: Record<string, string> }) => {
  try {
    const user = (req as any).user;
    const comandaId = context.params.id;
    
    // Verificar papel do usuário
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (userError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao verificar usuário: ${userError.message}`);
    }
    
    // Verificar se não é cliente (apenas admin e funcionários podem fechar comandas)
    if (userData.role === 'client') {
      return ApiErrors.FORBIDDEN('Clientes não podem fechar comandas');
    }
    
    // Buscar a comanda atual com relacionamentos
    const comandaSelection = `
      id, 
      appointment_id,
      client_id,
      status,
      total,
      discount,
      taxes,
      comanda_items (
        id,
        service_id,
        product_id,
        quantity,
        unit_price,
        total_price
      )
    `;
    
    const { data: currentComanda, error: comandaError } = await supabaseAdmin
      .from('comandas')
      .select(comandaSelection)
      .eq('id', comandaId)
      .single();
    
    if (comandaError) {
      if (comandaError.code === 'PGRST116') {
        return ApiErrors.NOT_FOUND('Comanda não encontrada');
      }
      return ApiErrors.DATABASE_ERROR(`Erro ao buscar comanda: ${comandaError.message}`);
    }
    
    // Verificar se a comanda já está fechada
    if (currentComanda.status === 'fechada') {
      return ApiErrors.VALIDATION_ERROR('Esta comanda já está fechada');
    }
    
    // Se for funcionário, verificar se está relacionado ao agendamento
    if (userData.role === 'employee') {
      const { data: agendamento, error: agendamentoError } = await supabaseAdmin
        .from('appointments')
        .select('employee_id')
        .eq('id', currentComanda.appointment_id)
        .single();
        
      const isRelated = !agendamentoError && agendamento && agendamento.employee_id === user.id;
      
      if (!isRelated) {
        return ApiErrors.FORBIDDEN('Você não tem permissão para fechar esta comanda');
      }
    }
    
    // Schema de validação (permitindo qualquer string para facilitar o mapeamento)
    const closeSchema = z.object({
      final_total: z.string().or(z.number()).transform(v => 
        typeof v === 'string' ? parseFloat(v) : v
      ).optional(),
      payment_method: z.string().or(z.number())
    });
    
    // Validar dados
    const body = await req.json();
    const validationResult = closeSchema.safeParse(body);
    
    if (!validationResult.success) {
      return ApiErrors.VALIDATION_ERROR(
        validationResult.error.errors.map(e => e.message).join(', ')
      );
    }
    
    const { final_total, payment_method: rawPaymentMethod } = validationResult.data;
    
    // Mapear o método de pagamento para um valor válido
    const payment_method = mapToValidPaymentMethod(rawPaymentMethod);
    
    // Verificar se a comanda possui itens
    if (!currentComanda.comanda_items || currentComanda.comanda_items.length === 0) {
      return ApiErrors.VALIDATION_ERROR('A comanda não possui itens para ser fechada');
    }
    
    // Calcular o total final caso não seja fornecido
    let calculatedFinalTotal = currentComanda.total;
    
    // Aplicar desconto se existir
    if (currentComanda.discount) {
      calculatedFinalTotal -= currentComanda.discount;
    }
    
    // Aplicar taxas se existirem
    if (currentComanda.taxes) {
      calculatedFinalTotal -= currentComanda.taxes;
    }
    
    // Adicionar uma validação para verificar se o final_total informado corresponde ao calculado
    if (final_total !== undefined) {
      // Arredondar para 2 casas decimais para evitar problemas com números de ponto flutuante
      const roundedCalculated = Math.round(calculatedFinalTotal * 100) / 100;
      const roundedProvided = Math.round(final_total * 100) / 100;
      
      if (roundedProvided !== roundedCalculated) {
        return ApiErrors.VALIDATION_ERROR(`Erro ao fechar comanda: O total final não corresponde ao cálculo: total - desconto - taxas`);
      }
    }
    
    // Preparar dados para atualização
    const updateData = {
      status: 'fechada',
      payment_method,
      cashier_id: user.id,
      // O final_total e taxes serão calculados na função calculate_and_store_commission
      // baseados no método de pagamento
    };
    
    // Campos a retornar após a atualização
    const returnFields = `
      id, 
      appointment_id,
      client_id,
      status,
      total,
      discount,
      taxes,
      final_total,
      payment_method,
      cashier_id,
      closed_at,
      total_services_commission, 
      total_products_commission, 
      total_commission
    `;
    
    // Fechar a comanda
    const { data: closedComanda, error: closeError } = await supabaseAdmin
      .from('comandas')
      .update(updateData)
      .eq('id', comandaId)
      .select(returnFields)
      .single();
      
    if (closeError) {
      return ApiErrors.DATABASE_ERROR(`Erro ao fechar comanda: ${closeError.message}`);
    }
    
    // Adicionar um pequeno atraso para garantir que o trigger de cálculo de comissões tenha tempo de executar
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Buscar novamente a comanda para obter os valores de comissão atualizados
    const { data: updatedComanda, error: updateError } = await supabaseAdmin
      .from('comandas')
      .select(returnFields)
      .eq('id', comandaId)
      .single();
      
    // Usar os dados mais atualizados ou os dados originais se houver erro
    const comandaFinal = updateError ? closedComanda : updatedComanda;
    
    // Se os totais de comissão ainda estiverem zerados, executar o cálculo manualmente
    if (comandaFinal && (comandaFinal.total_commission === 0 || comandaFinal.total_commission === null)) {
      // Chamar a função de cálculo de comissões diretamente
      await supabaseAdmin.rpc('calculate_and_store_commission', { p_comanda_id: comandaId });
      
      // Buscar a comanda novamente após cálculo manual
      const { data: recalculatedComanda } = await supabaseAdmin
        .from('comandas')
        .select(returnFields)
        .eq('id', comandaId)
        .single();
        
      if (recalculatedComanda) {
        comandaFinal.total_services_commission = recalculatedComanda.total_services_commission;
        comandaFinal.total_products_commission = recalculatedComanda.total_products_commission;
        comandaFinal.total_commission = recalculatedComanda.total_commission;
      }
    }
    
    // Buscar detalhes das comissões calculadas
    const { data: commissionDetails, error: commissionError } = await supabaseAdmin
      .from('commission_details')
      .select('*')
      .eq('comanda_id', comandaId)
      .order('calculated_at', { ascending: false });
    
    // Incluir detalhes de comissão na resposta se estiverem disponíveis
    const responseData = {
      ...comandaFinal,
      commissions: commissionError ? [] : commissionDetails
    };
    
    return successResponse(responseData);
  } catch (error: any) {
    console.error('Erro ao fechar comanda:', error);
    return ApiErrors.SERVER_ERROR(error.message);
  }
});

// Adicionar handler PUT para compatibilidade com código existente
export const PUT = PATCH;