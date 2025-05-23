import { supabaseAdmin } from '@/lib/supabase/server';

// Interfaces compartilhadas
export interface Comanda {
  id: string;
  appointment_id: string;
  cashier_id?: string;
  client_id: string;
  total: number;
  discount?: number;
  taxes?: number;
  final_total?: number;
  payment_method?: string;
  created_at: string;
  updated_at: string;
  status: 'aberta' | 'fechada' | 'cancelada';
  items?: ComandaItem[];
}

export interface ComandaItem {
  id: string;
  comanda_id: string;
  service_id?: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

// Campos padrão para seleção da comanda
const COMANDA_SELECT = `
  id,
  appointment_id,
  cashier_id,
  client_id,
  total,
  discount,
  taxes,
  final_total,
  payment_method,
  status,
  created_at,
  updated_at
`;

// Funções diretas para backend para operações no banco de dados
const comandaServiceServer = {
  /**
   * Criar uma nova comanda diretamente no banco de dados
   * @param data Dados da comanda a ser criada
   */
  createComanda: async (data: {
    appointment_id: string;
    professional_id: string;
    client_id: string;
    status?: 'aberta' | 'fechada' | 'cancelada';
    cashier_id?: string;
    initial_services?: Array<{id: string, quantity: number, price: number}>;
  }): Promise<Comanda> => {
    try {
      // Verificar se já existe uma comanda para este agendamento
      const { data: existingComanda } = await supabaseAdmin
        .from('comandas')
        .select('id')
        .eq('appointment_id', data.appointment_id)
        .single();
        
      if (existingComanda) {
        throw new Error('Já existe uma comanda para este agendamento');
      }
      
      // Dados da comanda a ser criada - começamos com total 0
      const comandaData = {
        appointment_id: data.appointment_id,
        client_id: data.client_id,
        total: 0, // Inicialmente o total é zero
        status: data.status || 'aberta',
        cashier_id: data.cashier_id,
        final_total: 0 // Inicialmente o final_total é zero
      };
      
      // Criar a comanda
      const { data: newComanda, error: createError } = await supabaseAdmin
        .from('comandas')
        .insert(comandaData)
        .select(COMANDA_SELECT)
        .single();
        
      if (createError) {
        throw new Error(`Erro ao criar comanda: ${createError.message}`);
      }
      
      // Se existirem serviços iniciais, adicionar como itens da comanda
      if (data.initial_services && data.initial_services.length > 0) {
        for (const service of data.initial_services) {
          await comandaServiceServer.addComandaItem({
            comanda_id: newComanda.id,
            service_id: service.id,
            quantity: service.quantity || 1,
            unit_price: service.price
          });
        }
        
        // Buscar a comanda atualizada após adicionar os itens
        const { data: updatedComanda, error: updatedError } = await supabaseAdmin
          .from('comandas')
          .select(COMANDA_SELECT)
          .eq('id', newComanda.id)
          .single();
          
        if (!updatedError) {
          return updatedComanda;
        }
      }
      
      return newComanda;
    } catch (error: any) {
      console.error('Erro ao criar comanda no servidor:', error);
      throw error;
    }
  },
  
  /**
   * Adicionar um item à comanda diretamente no banco de dados
   * @param data Dados do item a ser adicionado
   */
  addComandaItem: async (data: {
    comanda_id: string;
    service_id?: string;
    product_id?: string;
    quantity: number;
    unit_price: number;
  }): Promise<ComandaItem> => {
    try {
      const totalPrice = data.quantity * data.unit_price;
      
      // Determinar o tipo de item baseado em qual ID foi fornecido
      let itemType: 'service' | 'product';
      if (data.service_id) {
        itemType = 'service';
      } else if (data.product_id) {
        itemType = 'product';
      } else {
        throw new Error('É necessário fornecer service_id ou product_id');
      }
      
      // Preparar dados para inserção
      const itemData = {
        comanda_id: data.comanda_id,
        service_id: data.service_id,
        product_id: data.product_id,
        quantity: data.quantity,
        unit_price: data.unit_price,
        total_price: totalPrice,
        item_type: itemType // Campo item_type
      };
      
      // Inserir item na comanda
      const { data: newItem, error } = await supabaseAdmin
        .from('comanda_items')
        .insert(itemData)
        .select('*')
        .single();
        
      if (error) {
        console.error('Erro na inserção:', error);
        throw new Error(`Erro ao adicionar item à comanda: ${error.message}`);
      }
      
      // Atualizar o total da comanda
      await supabaseAdmin.rpc('update_comanda_total', {
        comanda_id_param: data.comanda_id
      });
      
      return newItem;
    } catch (error: any) {
      console.error('Erro ao adicionar item à comanda no servidor:', error);
      throw error;
    }
  },
  
  /**
   * Obter uma comanda pelo ID do agendamento
   * @param appointmentId ID do agendamento
   */
  getComandaByAppointment: async (appointmentId: string): Promise<Comanda | null> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('comandas')
        .select(COMANDA_SELECT)
        .eq('appointment_id', appointmentId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Não encontrado
          return null;
        }
        throw new Error(`Erro ao buscar comanda: ${error.message}`);
      }
      
      return data;
    } catch (error: any) {
      console.error('Erro ao buscar comanda por agendamento:', error);
      throw error;
    }
  }
};

export default comandaServiceServer; 