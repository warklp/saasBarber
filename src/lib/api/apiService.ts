/**
 * Serviço centralizado para chamadas à API
 * 
 * Este serviço centraliza todas as requisições à API interna do Next.js,
 * automatizando o envio do token de autenticação e o tratamento de erros.
 */

import toast from 'react-hot-toast';
import { createBrowserClient } from '@supabase/ssr';

// Inicializar o cliente Supabase para obter tokens de forma consistente
let supabaseClient: any = null;

// Inicializar o cliente Supabase (lazy loading)
function getSupabaseClient() {
  if (typeof window === 'undefined') return null;
  
  if (!supabaseClient) {
    // Criar cliente apenas no navegador e apenas uma vez
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  
  return supabaseClient;
}

// Tipos de resposta da API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

// Opções do serviço de API
interface ApiOptions extends RequestInit {
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
  redirectOnUnauthorized?: boolean;
  redirectPath?: string;
  debug?: boolean;
}

// Classe de erro da API
export class ApiError extends Error {
  public status: number;
  public code: string;
  public rawResponse?: any;
  
  constructor(message: string, status: number, code: string = 'ERROR', rawResponse?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.rawResponse = rawResponse;
  }
}

/**
 * Função para obter o token de autenticação atual usando o cliente Supabase
 * @returns O token de autenticação se disponível
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    // Server-side, não temos acesso ao cliente Supabase
    return null;
  }
  
  try {
    // Método principal: obter através da API oficial do Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        console.debug('Token obtido via Supabase client');
        return data.session.access_token;
      }
    }
    
    console.warn('Nenhum token de autorização encontrado via Supabase client');
    return null;
  } catch (e) {
    console.error('Erro ao obter token de autenticação:', e);
    return null;
  }
}

/**
 * Redirecionar para outra página
 */
const redirectToPath = (path: string) => {
  if (typeof window !== 'undefined') {
    window.location.href = path;
  }
};

/**
 * Chama a API interna do Next.js
 * 
 * @param endpoint Endpoint da API (ex: '/api/services')
 * @param options Opções da requisição
 * @returns Resposta da API
 */
export async function api<T = any>(
  endpoint: string, 
  options: ApiOptions = {}
): Promise<T> {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    redirectOnUnauthorized = false, // Desabilitado por padrão para facilitar o debug
    redirectPath = '/login',
    debug = true, // Habilitado por padrão para ajudar no debug
    ...fetchOptions
  } = options;
  
  // Configurações padrão
  const config: RequestInit = {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    credentials: 'include', // Mantém cookies para outras finalidades
  };
  
  // Adiciona o token de autenticação usando o método padronizado
  const authToken = await getAuthToken();
  if (authToken) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${authToken}`,
    };
    if (debug) {
      console.debug('Token de autorização adicionado ao cabeçalho:', `Bearer ${authToken.substring(0, 10)}...`);
    }
  } else if (debug) {
    console.warn('Nenhum token de autorização encontrado para enviar com a requisição');
  }
  
  if (debug) {
    console.debug(`Fazendo requisição ${fetchOptions.method || 'GET'} para ${endpoint}`, { 
      headers: config.headers,
      body: config.body
    });
  }
  
  try {
    const response = await fetch(endpoint, config);
    
    // Processar a resposta como JSON
    const data: ApiResponse<T> = await response.json();
    
    if (debug) {
      console.debug(`Resposta de ${endpoint}:`, { 
        status: response.status, 
        success: data.success,
        data: data.data,
        error: data.error
      });
    }
    
    // Verificar se a resposta foi bem-sucedida
    if (!response.ok) {
      // Lidar com erros específicos
      if (response.status === 401) {
        console.error('Erro 401 (Não autorizado):', data);
        
        if (redirectOnUnauthorized) {
          // Redirecionar para a página de login se não estiver autenticado
          redirectToPath(redirectPath);
          
          if (showErrorToast) {
            toast.error('Sessão expirada. Por favor, faça login novamente.');
          }
        } else if (showErrorToast) {
          toast.error('Erro de autenticação: ' + (data?.error?.message || 'Não autorizado'));
        }
      }
      
      // Mostrar mensagem de erro
      if (showErrorToast && response.status !== 401) { // Evita mostrar o erro 401 duas vezes
        const errorMessage = data?.error?.message || 'Ocorreu um erro na requisição.';
        toast.error(errorMessage);
      }
      
      throw new ApiError(
        data?.error?.message || 'Ocorreu um erro na requisição',
        response.status,
        data?.error?.code,
        data
      );
    }
    
    // Mostrar mensagem de sucesso, se configurado
    if (showSuccessToast && (successMessage || data.message)) {
      toast.success(successMessage || data.message || 'Operação realizada com sucesso!');
    }
    
    // Retornar a resposta completa em vez de apenas o data
    return data as unknown as T;
  } catch (error) {
    // Já tratamos os erros da API acima, aqui capturamos erros de rede
    if (!(error instanceof ApiError) && showErrorToast) {
      console.error('Erro de rede:', error);
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    }
    throw error;
  }
}

/**
 * Função auxiliar para verificar o estado de autenticação
 * Útil para debugging
 */
export async function checkAuthState() {
  if (typeof window === 'undefined') {
    return { status: 'server-side', message: 'Running on server side' };
  }
  
  try {
    const token = await getAuthToken();
    const supabase = getSupabaseClient();
    let sessionData = null;
    
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        sessionData = data;
      } catch (e) {
        console.error('Erro ao obter sessão:', e);
      }
    }
    
    return {
      status: token ? 'authenticated' : 'unauthenticated',
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 15) + '...' : null,
      sessionData: sessionData ? {
        hasSession: !!sessionData.session,
        expiresAt: sessionData.session?.expires_at,
        user: sessionData.session?.user ? {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email,
          role: sessionData.session.user.role
        } : null
      } : null
    };
  } catch (e: unknown) {
    const error = e as Error;
    return {
      status: 'error',
      message: error.message || 'Unknown error',
      error
    };
  }
}

/**
 * Métodos HTTP auxiliares para facilitar o uso
 */
export const apiService = {
  /**
   * Realiza uma requisição GET
   */
  get: <T = any>(endpoint: string, options?: ApiOptions) =>
    api<T>(endpoint, { method: 'GET', ...options }),
  
  /**
   * Realiza uma requisição POST
   */
  post: <T = any>(endpoint: string, data?: any, options?: ApiOptions) => {
    // Log especial para criação de agendamentos
    if (endpoint === '/api/appointments') {
      console.log('[API DEBUG] Iniciando chamada para criar agendamento:', data);
    }
    
    return api<T>(endpoint, { 
      method: 'POST', 
      body: data ? JSON.stringify(data) : undefined,
      debug: true, // Forçar debug para esta chamada
      ...options 
    }).then(response => {
      // Log de sucesso para agendamentos
      if (endpoint === '/api/appointments') {
        console.log('[API DEBUG] Resposta da criação de agendamento:', response);
      }
      return response;
    }).catch(error => {
      // Log de erro para agendamentos
      if (endpoint === '/api/appointments') {
        console.error('[API DEBUG] Erro na criação de agendamento:', error);
      }
      throw error;
    });
  },
  
  /**
   * Realiza uma requisição PUT
   */
  put: <T = any>(endpoint: string, data?: any, options?: ApiOptions) =>
    api<T>(endpoint, { 
      method: 'PUT', 
      body: data ? JSON.stringify(data) : undefined,
      ...options 
    }),
  
  /**
   * Realiza uma requisição PATCH
   */
  patch: <T = any>(endpoint: string, data?: any, options?: ApiOptions) =>
    api<T>(endpoint, { 
      method: 'PATCH', 
      body: data ? JSON.stringify(data) : undefined,
      ...options 
    }),
  
  /**
   * Realiza uma requisição DELETE
   */
  delete: <T = any>(endpoint: string, options?: ApiOptions) =>
    api<T>(endpoint, { method: 'DELETE', ...options }),
    
  /**
   * Verifica o estado de autenticação
   */
  checkAuth: checkAuthState
};

// Exporta como padrão para facilitar o uso
export default apiService; 