import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setUser(session?.user || null);
      } catch (error: any) {
        console.error('Erro ao buscar usuário:', error.message);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data?.user) {
        setUser(data.user);
        router.push('/');
        router.refresh();
        toast.success('Login realizado com sucesso!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      router.push('/login');
      toast.success('Logout realizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer logout');
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    signIn,
    signOut,
  };
} 