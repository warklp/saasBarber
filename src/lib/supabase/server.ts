import { createClient } from '@supabase/supabase-js';

// Criação do cliente Supabase para uso no servidor (API Routes)
// Utiliza a service role key para operações privilegiadas
// ATENÇÃO: Este cliente NUNCA deve ser exposto no frontend

// Verificar variáveis de ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // Em vez de lançar um erro imediatamente, registre o erro
  console.error('Variáveis de ambiente para Supabase não configuradas corretamente:');
  if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL não definido');
  if (!supabaseServiceRoleKey) console.error('- SUPABASE_SERVICE_ROLE_KEY não definido');
}

// Função para obter um cliente Supabase Admin
const createSupabaseAdmin = () => {
  // Verificar variáveis no momento da criação
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Variáveis de ambiente para Supabase não configuradas corretamente.');
  }

  // Este cliente tem acesso privilegiado ao banco de dados, ignorando as políticas RLS
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Exportar o cliente, mas só criá-lo quando for realmente necessário
// Isso evita erros durante a hidratação de componentes no lado do cliente
export const supabaseAdmin = {
  get client() {
    return createSupabaseAdmin();
  },
  
  // Métodos de conveniência para operações comuns
  from(table: string) {
    return this.client.from(table);
  },
  
  rpc(fn: string, params?: any) {
    return this.client.rpc(fn, params);
  },
  
  auth: {
    getUser(token: string) {
      return createSupabaseAdmin().auth.getUser(token);
    }
  }
};

// Esta função verifica se o usuário está autenticado na requisição
export async function getAuthenticatedUser(headers: Headers) {
  const authHeader = headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !data.user) {
      return null;
    }
    
    return data.user;
  } catch (error) {
    console.error('Erro ao autenticar usuário:', error);
    return null;
  }
}

// Esta função verifica se o usuário tem o papel (role) necessário
export async function validateUserRole(userId: string, requiredRoles: string[]) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      return false;
    }
    
    return requiredRoles.includes(data.role);
  } catch (error) {
    console.error('Erro ao validar papel do usuário:', error);
    return false;
  }
} 