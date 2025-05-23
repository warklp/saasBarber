'use client';

import apiService, { ApiResponse } from '@/lib/api/apiService';

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
  appointment?: {
    id: string;
    employee_id: string;
    employee?: {
      id: string;
      name: string;
      commission_settings?: {
        services?: Array<{
          id: string;
          type: 'percentage' | 'fixed';
          value: number;
        }>;
        products?: Array<{
          id: string;
          type: 'percentage' | 'fixed';
          value: number;
        }>;
        default_service?: {
          type: 'percentage' | 'fixed';
          value: number;
        };
        default_product?: {
          type: 'percentage' | 'fixed';
          value: number;
        };
      };
    };
    services?: Array<{
      id: string;
      service_id: string;
      quantity: number;
      unit_price: number;
      service: {
        id: string;
        name: string;
        price: number;
        duration_minutes: number;
        commission_settings?: {
          type: 'percentage' | 'fixed';
          value: number;
        };
      };
    }>;
  };
  cashier?: {
    id: string;
    name: string;
  };
  client?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  metadata?: {
    total_commission?: number;
    total_services_commission?: number;
    total_products_commission?: number;
    commissions_status?: {
      pending: number;
      paid: number;
      total: number;
    };
    payment_details?: {
      card_brand?: string;
      installments?: number;
      authorization_code?: string;
    };
    history?: Array<{
      timestamp: string;
      action: string;
      user: string;
    }>;
    [key: string]: any;
  };
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
  commission_percentage?: number;
  commission_value?: number;
  service?: {
    id: string;
    name: string;
    price: number;
    commission_settings?: {
      type: 'percentage' | 'fixed';
      value: number;
    };
  };
  product?: {
    id: string;
    name: string;
    sale_price: number;
    commission_settings?: {
      type: 'percentage' | 'fixed';
      value: number;
    };
  };
  commission_details?: {
    type: 'percentage' | 'fixed';
    value: number;
    calculated_value: number;
    employee_id: string;
    employee_name: string;
    status: 'pending' | 'paid';
    paid_at?: string;
  };
}

export interface ComandaParams {
  appointment_id?: string;
  client_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateComandaData {
  appointment_id: string;
  professional_id: string;
  client_id: string;
  initial_total: number;
  cashier_id?: string;
  notes?: string;
  status?: string;
}

export interface AddComandaItemData {
  comanda_id: string;
  service_id?: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
}

export interface UpdateComandaData {
  discount?: number;
  taxes?: number;
  notes?: string;
}

// Serviço para interface do cliente com a API
const comandaService = {
  /**
   * Listar todas as comandas com filtros opcionais
   * @param params Parâmetros de filtragem
   */
  getComandas: async (params: ComandaParams = {}): Promise<Comanda[]> => {
    try {
      // Construir a URL com query params
      const queryParams = new URLSearchParams();
      
      if (params.appointment_id) queryParams.append('appointment_id', params.appointment_id);
      if (params.client_id) queryParams.append('client_id', params.client_id);
      if (params.status) queryParams.append('status', params.status);
      if (params.start_date) queryParams.append('start_date', params.start_date);
      if (params.end_date) queryParams.append('end_date', params.end_date);
      
      const url = `/api/comandas?${queryParams.toString()}`;
      
      const response = await apiService.get<ApiResponse<Comanda[]>>(url);
      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar comandas:', error);
      throw error;
    }
  },
  
  /**
   * Obter uma comanda específica
   * @param id ID da comanda
   */
  getComanda: async (id: string): Promise<Comanda> => {
    try {
      const response = await apiService.get<ApiResponse<Comanda>>(`/api/comandas/${id}`);
      if (!response.data) {
        throw new Error('Comanda não encontrada');
      }
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar comanda ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Criar uma nova comanda
   * @param data Dados da comanda
   */
  createComanda: async (data: CreateComandaData): Promise<Comanda> => {
    try {
      const response = await apiService.post<ApiResponse<Comanda>>(
        '/api/comandas',
        data,
        { showSuccessToast: true, successMessage: 'Comanda criada com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao criar comanda');
      }
      
      return response.data;
    } catch (error) {
      console.error('Erro ao criar comanda:', error);
      throw error;
    }
  },
  
  /**
   * Adicionar um item à comanda
   * @param data Dados do item a ser adicionado
   */
  addComandaItem: async (data: AddComandaItemData): Promise<ComandaItem> => {
    try {
      const response = await apiService.post<ApiResponse<ComandaItem>>(
        `/api/comandas/${data.comanda_id}/items`,
        data,
        { showSuccessToast: true, successMessage: 'Item adicionado com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao adicionar item à comanda');
      }
      
      return response.data;
    } catch (error) {
      console.error('Erro ao adicionar item à comanda:', error);
      throw error;
    }
  },
  
  /**
   * Remover um item da comanda
   * @param comandaId ID da comanda
   * @param itemId ID do item
   */
  removeComandaItem: async (comandaId: string, itemId: string): Promise<void> => {
    try {
      await apiService.delete<ApiResponse<void>>(
        `/api/comandas/${comandaId}/items/${itemId}`,
        { showSuccessToast: true, successMessage: 'Item removido com sucesso!' }
      );
    } catch (error) {
      console.error(`Erro ao remover item ${itemId} da comanda ${comandaId}:`, error);
      throw error;
    }
  },
  
  /**
   * Atualizar uma comanda existente
   * @param id ID da comanda
   * @param data Dados a serem atualizados
   */
  updateComanda: async (id: string, data: UpdateComandaData): Promise<Comanda> => {
    try {
      const response = await apiService.patch<ApiResponse<Comanda>>(
        `/api/comandas/${id}`,
        data,
        { showSuccessToast: true, successMessage: 'Comanda atualizada com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao atualizar comanda');
      }
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao atualizar comanda ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Fechar uma comanda
   * @param id ID da comanda
   * @param finalTotal Total final da comanda
   */
  closeComanda: async (id: string, finalTotal: string): Promise<Comanda> => {
    try {
      const response = await apiService.patch<ApiResponse<Comanda>>(
        `/api/comandas/${id}/close`,
        { final_total: finalTotal },
        { showSuccessToast: true, successMessage: 'Comanda fechada com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao fechar comanda');
      }
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao fechar comanda ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Cancelar uma comanda
   * @param id ID da comanda
   */
  cancelComanda: async (id: string): Promise<Comanda> => {
    try {
      const response = await apiService.patch<ApiResponse<Comanda>>(
        `/api/comandas/${id}/cancel`,
        {},
        { showSuccessToast: true, successMessage: 'Comanda cancelada com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao cancelar comanda');
      }
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao cancelar comanda ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Obter a comanda associada a um agendamento
   * @param appointmentId ID do agendamento
   */
  getComandaByAppointment: async (appointmentId: string): Promise<Comanda> => {
    try {
      const response = await apiService.get<ApiResponse<Comanda>>(
        `/api/comandas/appointment/${appointmentId}`
      );
      
      if (!response.data) {
        throw new Error('Comanda não encontrada para este agendamento');
      }
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar comanda para o agendamento ${appointmentId}:`, error);
      throw error;
    }
  },
  
  /**
   * Calcula o total de uma comanda com base em seus itens
   * @param items Itens da comanda
   */
  calculateTotal: (items: ComandaItem[]): number => {
    return items.reduce((sum, item) => sum + item.total_price, 0);
  }
};

export default comandaService; 