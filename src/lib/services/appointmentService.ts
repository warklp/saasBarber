import apiService, { ApiResponse } from '@/lib/api/apiService';

export interface Appointment {
  id: string;
  client_id: string;
  client: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  employee_id: string;
  employee: {
    id: string;
    name: string;
  };
  comanda_id?: string;
  // Suporte para formato antigo (service único)
  service?: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
    category?: string;
    description?: string;
  };
  // Suporte para formato novo (múltiplos serviços)
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
      category?: string;
      description?: string;
    }
  }>;
  comanda?: {
    id: string;
    appointment_id: string;
    client_id: string;
    total: number;
    status: string;
    items?: Array<{
      id: string;
      service_id?: string;
      product_id?: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      service?: any;
      product?: any;
    }>;
  };
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'absent' | 'completed' | 'canceled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentParams {
  start_date?: string;
  end_date?: string;
  employee_id?: string;
  client_id?: string;
  status?: string;
}

/**
 * Dados para criar um agendamento
 */
export interface CreateAppointmentData {
  client_id: string;
  employee_id: string;
  services: Array<{ id: string; quantity?: number; }>;
  start_time: string;
  notes?: string;
}

/**
 * Interface legada para criação de agendamentos com um único serviço
 * @deprecated Use CreateAppointmentData com array de services
 */
export interface LegacyCreateAppointmentData {
  client_id: string;
  employee_id: string;
  service_id: string;
  start_time: string;
  notes?: string;
}

export interface UpdateAppointmentData {
  client_id?: string;
  employee_id?: string;
  comanda_id?: string;
  start_time?: string;
  end_time?: string;
  status?: 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'absent' | 'completed' | 'canceled';
  notes?: string;
}

export const appointmentService = {
  /**
   * Listar todos os agendamentos com filtros opcionais
   * @param params Parâmetros de filtragem
   */
  getAppointments: async (params: AppointmentParams = {}): Promise<Appointment[]> => {
    try {
      // Construir a URL com query params
      const queryParams = new URLSearchParams();
      
      if (params.start_date) queryParams.append('start_date', params.start_date);
      if (params.end_date) queryParams.append('end_date', params.end_date);
      if (params.employee_id) queryParams.append('employee_id', params.employee_id);
      if (params.client_id) queryParams.append('client_id', params.client_id);
      if (params.status) queryParams.append('status', params.status);
      
      const url = `/api/appointments?${queryParams.toString()}`;
      
      const response = await apiService.get<ApiResponse<Appointment[]>>(url);
      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      throw error;
    }
  },
  
  /**
   * Obter um agendamento específico
   * @param id ID do agendamento
   */
  getAppointment: async (id: string): Promise<Appointment> => {
    try {
      const response = await apiService.get<ApiResponse<Appointment>>(`/api/appointments/${id}`);
      if (!response.data) {
        throw new Error('Agendamento não encontrado');
      }
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar agendamento ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Criar um novo agendamento
   * @param data Dados do agendamento
   */
  createAppointment: async (data: CreateAppointmentData | LegacyCreateAppointmentData): Promise<Appointment> => {
    try {
      // Converter dados legados (se necessário)
      let requestData: any = data;
      
      // Se tiver service_id e não tiver services, converter para o novo formato
      if ('service_id' in data && !('services' in data)) {
        requestData = {
          ...data,
          services: [{ id: data.service_id, quantity: 1 }]
        };
        // Remover service_id para evitar conflitos
        delete requestData.service_id;
      }
      
      const response = await apiService.post<ApiResponse<Appointment>>(
        '/api/appointments',
        requestData,
        { showSuccessToast: true, successMessage: 'Agendamento criado com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao criar agendamento');
      }
      
      return response.data;
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      throw error;
    }
  },
  
  /**
   * Atualizar um agendamento existente
   * @param id ID do agendamento
   * @param data Dados a serem atualizados
   */
  updateAppointment: async (id: string, data: UpdateAppointmentData): Promise<Appointment> => {
    try {
      const response = await apiService.patch<ApiResponse<Appointment>>(
        `/api/appointments/${id}`,
        data,
        { showSuccessToast: true, successMessage: 'Agendamento atualizado com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao atualizar agendamento');
      }
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao atualizar agendamento ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Cancelar um agendamento
   * @param id ID do agendamento
   */
  cancelAppointment: async (id: string): Promise<Appointment> => {
    try {
      const response = await apiService.patch<ApiResponse<Appointment>>(
        `/api/appointments/${id}/cancel`,
        {},
        { showSuccessToast: true, successMessage: 'Agendamento cancelado com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao cancelar agendamento');
      }
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao cancelar agendamento ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Marcar agendamento como concluído
   * @param id ID do agendamento
   */
  completeAppointment: async (id: string): Promise<Appointment> => {
    try {
      const response = await apiService.patch<ApiResponse<Appointment>>(
        `/api/appointments/${id}/complete`,
        {},
        { showSuccessToast: true, successMessage: 'Agendamento concluído com sucesso!' }
      );
      
      if (!response.data) {
        throw new Error('Erro ao marcar agendamento como concluído');
      }
      
      return response.data;
    } catch (error) {
      console.error(`Erro ao concluir agendamento ${id}:`, error);
      throw error;
    }
  }
};

export default appointmentService; 