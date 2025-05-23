import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Usando a service role key para ter permissões completas
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookies().set(name, value, options);
          },
          remove(name: string, options: any) {
            cookies().set(name, '', options);
          },
        },
      }
    );

    // Dados do administrador
    const adminData = {
      email: 'admin@barbershop.com',
      password: 'admin123',
      role: 'admin'
    };

    // Criar o usuário no Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminData.email,
      password: adminData.password,
      email_confirm: true, // Confirma o email automaticamente
    });

    if (authError) {
      throw authError;
    }

    // Inserir dados adicionais na tabela users
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: adminData.email,
        role: adminData.role,
        name: 'Administrador',
      });

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json({
      message: 'Administrador criado com sucesso',
      user: authUser.user
    });

  } catch (error: any) {
    console.error('Erro ao criar administrador:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar administrador' },
      { status: 500 }
    );
  }
} 