import { NextResponse } from 'next/server';

type ApiResponseData<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: Record<string, any>;
};

// Função para respostas de sucesso
export function successResponse<T>(data: T, meta?: Record<string, any>, status = 200) {
  const responseBody: ApiResponseData<T> = {
    success: true,
    data,
    ...(meta && { meta })
  };
  
  return NextResponse.json(responseBody, { status });
}

// Função para respostas de erro
export function errorResponse(message: string, code: string, status = 400) {
  const responseBody: ApiResponseData<null> = {
    success: false,
    error: {
      code,
      message
    }
  };
  
  return NextResponse.json(responseBody, { status });
}

// Erros comuns pré-configurados
export const ApiErrors = {
  UNAUTHORIZED: (message = 'Não autorizado') => 
    errorResponse(message, 'UNAUTHORIZED', 401),
  
  FORBIDDEN: (message = 'Acesso negado') => 
    errorResponse(message, 'FORBIDDEN', 403),
  
  NOT_FOUND: (message = 'Recurso não encontrado') => 
    errorResponse(message, 'NOT_FOUND', 404),
  
  CONFLICT: (message = 'Conflito com recurso existente') => 
    errorResponse(message, 'CONFLICT', 409),
  
  VALIDATION_ERROR: (message = 'Dados inválidos') => 
    errorResponse(message, 'VALIDATION_ERROR', 422),
  
  SERVER_ERROR: (message = 'Erro interno do servidor') => 
    errorResponse(message, 'SERVER_ERROR', 500),

  DATABASE_ERROR: (message: string) => 
    errorResponse(message, 'DATABASE_ERROR', 500)
}; 