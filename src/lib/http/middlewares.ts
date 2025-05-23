import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, validateUserRole } from '../supabase/server';
import { ApiErrors } from './response';

type ApiHandlerFn = (
  req: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>;

// Middleware para verificar autenticação
export function withAuth(handler: ApiHandlerFn): ApiHandlerFn {
  return async (req: NextRequest, context: { params: Record<string, string> }) => {
    console.log('withAuth - Parâmetros recebidos:', { 
      context,
      url: req.url,
      nextUrl: req.nextUrl.toString(),
      pathname: req.nextUrl.pathname
    });
    
    try {
      const user = await getAuthenticatedUser(req.headers);
      
      if (!user) {
        return ApiErrors.UNAUTHORIZED('Usuário não autenticado');
      }
      
      // Adiciona o usuário ao request para uso posterior
      (req as any).user = user;
      
      return handler(req, context);
    } catch (error: any) {
      console.error('withAuth - Erro:', error);
      return ApiErrors.UNAUTHORIZED(error.message);
    }
  };
}

// Middleware para verificar se o usuário é admin
export function withAdmin(handler: ApiHandlerFn): ApiHandlerFn {
  return async (req: NextRequest, context: { params: Record<string, string> }) => {
    console.log('withAdmin - Parâmetros recebidos:', { context });
    
    // Primeiro, verifica autenticação
    const authMiddleware = withAuth(async (req, context) => {
      const user = (req as any).user;
      console.log('withAdmin - Verificando permissões:', { userId: user.id, context });
      
      // Depois, verifica papel (role)
      const hasRole = await validateUserRole(user.id, ['admin']);
      console.log('withAdmin - Resultado da verificação:', { userId: user.id, hasRole, context });
      
      if (!hasRole) {
        console.log('withAdmin - Acesso negado:', { userId: user.id });
        return ApiErrors.FORBIDDEN('Você não tem permissão para executar esta ação');
      }
      
      return handler(req, context);
    });
    
    return authMiddleware(req, context);
  };
}

// Middleware para verificar papéis específicos
export function withRole(roles: string[], handler: ApiHandlerFn): ApiHandlerFn {
  return async (req: NextRequest, context: { params: Record<string, string> }) => {
    // Primeiro, verifica autenticação
    const authMiddleware = withAuth(async (req, context) => {
      const user = (req as any).user;
      
      // Depois, verifica papel (role)
      const hasRole = await validateUserRole(user.id, roles);
      
      if (!hasRole) {
        return ApiErrors.FORBIDDEN('Você não tem permissão para executar esta ação');
      }
      
      return handler(req, context);
    });
    
    return authMiddleware(req, context);
  };
}

// Middleware para validar que o usuário só acessa seus próprios recursos
export function withSelfOrAdmin(idParam: string, handler: ApiHandlerFn): ApiHandlerFn {
  return async (req: NextRequest, context: { params: Record<string, string> }) => {
    // Primeiro, verifica autenticação
    const authMiddleware = withAuth(async (req, context) => {
      const user = (req as any).user;
      const resourceId = context.params[idParam];
      
      // Se o id for do próprio usuário ou se for admin, permite
      const hasPermission = 
        user.id === resourceId || 
        await validateUserRole(user.id, ['admin']);
      
      if (!hasPermission) {
        return ApiErrors.FORBIDDEN('Você não tem permissão para acessar este recurso');
      }
      
      return handler(req, context);
    });
    
    return authMiddleware(req, context);
  };
} 