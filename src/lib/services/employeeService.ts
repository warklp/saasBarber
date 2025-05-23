// Adicionando import para Supabase
import { createBrowserClient } from '@supabase/ssr';

export interface EmployeeData {
  name: string;
  email: string;
  phone?: string;
  dob?: Date;
  calendarColor?: string;
}

export interface EmployeeResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'employee';
  created_at: string;
  updated_at: string;
  image_profile?: string | null;
  metadata?: {
    calendarColor?: string;
    dob?: string;
  };
}

// Criar o cliente Supabase para obter o token de autenticação
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const employeeService = {
  /**
   * Adiciona um novo colaborador ao banco de dados
   */
  async addEmployee(data: EmployeeData): Promise<EmployeeResponse> {
    try {
      // Obter a sessão do usuário para incluir o token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      // Chamar a API para adicionar colaborador
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Incluir token
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          calendarColor: data.calendarColor,
          // Converter Date para string para enviar no JSON
          dob: data.dob ? data.dob.toISOString() : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao adicionar colaborador');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Erro ao adicionar colaborador:', error);
      throw error;
    }
  },

  /**
   * Obtém a lista de colaboradores
   */
  async getEmployees(): Promise<EmployeeResponse[]> {
    try {
      // Obter a sessão do usuário para incluir o token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Usuário não autenticado');
      }
      
      const response = await fetch('/api/employees', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Incluir token
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao buscar colaboradores');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Erro ao buscar colaboradores:', error);
      throw error;
    }
  },

  /**
   * Atualiza os dados de um colaborador
   */
  async updateEmployee(id: string, data: Partial<EmployeeData>): Promise<EmployeeResponse> {
    try {
      console.log('employeeService.updateEmployee - Iniciando atualização:', { id, data });
      
      // Obter a sessão do usuário para incluir o token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      console.log('employeeService.updateEmployee - URL da requisição:', `/api/employees/${id}`);
      
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Incluir token
        },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          calendarColor: data.calendarColor,
          // Converter Date para string para enviar no JSON
          dob: data.dob ? data.dob.toISOString() : undefined
        }),
      });

      console.log('employeeService.updateEmployee - Status da resposta:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('employeeService.updateEmployee - Erro na resposta:', {
          status: response.status,
          error: errorData
        });
        throw new Error(errorData.message || 'Erro ao atualizar colaborador');
      }

      const result = await response.json();
      console.log('employeeService.updateEmployee - Resposta bem-sucedida:', result);
      return result.data;
    } catch (error) {
      console.error('employeeService.updateEmployee - Erro:', error);
      throw error;
    }
  },

  /**
   * Remove um colaborador
   */
  async deleteEmployee(id: string): Promise<{message: string, id: string}> {
    try {
      console.log('Excluindo colaborador com ID:', id);
      
      // Obter a sessão do usuário para incluir o token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Usuário não autenticado');
      }
      
      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // Incluir token
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao excluir colaborador:', {
          id,
          status: response.status,
          error: errorData
        });
        throw new Error(errorData.message || 'Erro ao excluir colaborador');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Erro ao excluir colaborador:', error);
      throw error;
    }
  }
};

export default employeeService; 