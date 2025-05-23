'use client';

import { Card } from "@/components/ui/card";

export default function ClientesLoading() {
  return (
    <div className="w-full animate-pulse space-y-6 p-6">
      {/* Título e controles */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-gray-200 rounded w-40 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-72"></div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="h-10 bg-gray-200 rounded w-28"></div>
          <div className="h-10 bg-gray-200 rounded w-28"></div>
        </div>
      </div>

      {/* Barra de pesquisa e filtros */}
      <div className="flex items-center gap-4">
        <div className="h-10 bg-gray-200 rounded w-full max-w-md"></div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>

      {/* Tabela de clientes */}
      <Card className="p-4">
        {/* Cabeçalho da tabela */}
        <div className="flex items-center border-b pb-4 mb-4">
          <div className="w-14 h-5 bg-gray-200 rounded"></div>
          <div className="flex-1 grid grid-cols-5 gap-4">
            <div className="h-5 bg-gray-200 rounded"></div>
            <div className="h-5 bg-gray-200 rounded"></div>
            <div className="h-5 bg-gray-200 rounded"></div>
            <div className="h-5 bg-gray-200 rounded"></div>
            <div className="h-5 bg-gray-200 rounded"></div>
          </div>
        </div>
        
        {/* Linhas da tabela */}
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center py-2">
              <div className="w-14 h-5 bg-gray-200 rounded-full"></div>
              <div className="flex-1 grid grid-cols-5 gap-4">
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded"></div>
                <div className="h-5 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Paginação */}
        <div className="flex justify-between items-center pt-4 mt-4 border-t">
          <div className="h-5 bg-gray-200 rounded w-40"></div>
          <div className="flex items-center gap-2">
            <div className="h-9 bg-gray-200 rounded-full w-9"></div>
            <div className="h-9 bg-gray-200 rounded-full w-9"></div>
            <div className="h-9 bg-gray-200 rounded-full w-9"></div>
            <div className="h-9 bg-gray-200 rounded-full w-9"></div>
          </div>
        </div>
      </Card>
    </div>
  );
} 