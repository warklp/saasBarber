'use client';

import { createClient } from '@supabase/supabase-js';

// Criação do cliente Supabase para uso no lado do cliente
// Utiliza a anon key que é segura para expor no frontend
// As políticas RLS do Supabase controlam o acesso aos dados

// Variáveis de ambiente para o Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Função para verificar e alertar sobre problemas com as variáveis de ambiente
function checkEnvVariables() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Variáveis de ambiente Supabase não configuradas:');
    if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL não definido');
    if (!supabaseAnonKey) console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY não definido');
    return false;
  }
  return true;
}

// Função para criar o cliente Supabase
function createSupabaseClient() {
  if (!checkEnvVariables()) {
    // Retornar um objeto mock que registrará erros em vez de quebrar
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: null, unsubscribe: () => {} }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ data: null, error: new Error('Supabase não inicializado') }),
        }),
      }),
    };
  }

  // Criar o cliente real se as variáveis estiverem disponíveis
  return createClient(supabaseUrl!, supabaseAnonKey!);
}

// Criar o cliente Supabase
export const supabaseClient = createSupabaseClient(); 