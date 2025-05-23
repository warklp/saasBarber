import { apiService } from './apiService';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  last_visit?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface CustomerResponse {
  data: Customer[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

export const customerService = {
  list: async (search?: string): Promise<CustomerResponse> => {
    const searchParams = new URLSearchParams();
    if (search) searchParams.append('search', search);
    searchParams.append('per_page', '100');
    
    try {
      // Voltar a usar apiService para manter a autenticação
      const response = await apiService.get<any>(`/api/customers?${searchParams.toString()}`);
      console.log('Resposta da API:', response);
      
      // Verificar se a resposta está no formato esperado
      if (!response || !response.success) {
        throw new Error('Erro na API: ' + (response?.error?.message || 'Resposta inválida'));
      }
      
      // Retornar os dados no formato esperado pelo frontend
      return {
        data: response.data || [],
        pagination: response.meta?.pagination || {
          total: 0,
          page: 1,
          per_page: 100,
          total_pages: 1
        }
      };
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      throw error;
    }
  },

  create: async (customer: CustomerInput): Promise<Customer> => {
    try {
      // Voltar a usar apiService para manter a autenticação
      const response = await apiService.post<any>('/api/customers', customer);
      
      if (!response || !response.success) {
        throw new Error('Erro ao criar cliente: ' + (response?.error?.message || 'Resposta inválida'));
      }
      
      return response.data;
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      throw error;
    }
  },

  update: async (id: string, customer: CustomerInput): Promise<Customer> => {
    try {
      // Voltar a usar apiService para manter a autenticação
      const response = await apiService.patch<any>(`/api/customers/${id}`, customer);
      
      if (!response || !response.success) {
        throw new Error('Erro ao atualizar cliente: ' + (response?.error?.message || 'Resposta inválida'));
      }
      
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      // Voltar a usar apiService para manter a autenticação
      const response = await apiService.delete<any>(`/api/customers/${id}`);
      
      if (!response || !response.success) {
        throw new Error('Erro ao excluir cliente: ' + (response?.error?.message || 'Resposta inválida'));
      }
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      throw error;
    }
  },
}; 