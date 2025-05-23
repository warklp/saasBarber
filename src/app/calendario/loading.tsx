'use client';

import { Card } from "@/components/ui/card";

export default function CalendarioLoading() {
  return (
    <div className="w-full animate-pulse space-y-6 p-6">
      {/* Título e controles */}
      <div className="flex items-center justify-between">
        <div className="h-8 bg-gray-200 rounded w-40"></div>
        <div className="flex items-center gap-4">
          <div className="h-10 bg-gray-200 rounded w-28"></div>
          <div className="h-10 bg-gray-200 rounded w-28"></div>
          <div className="h-10 bg-gray-200 rounded w-28"></div>
        </div>
      </div>

      {/* Navegação do calendário */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 bg-gray-200 rounded-full w-9"></div>
          <div className="h-9 bg-gray-200 rounded-full w-9"></div>
          <div className="h-6 bg-gray-200 rounded w-36"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 bg-gray-200 rounded w-20"></div>
          <div className="h-9 bg-gray-200 rounded w-20"></div>
          <div className="h-9 bg-gray-200 rounded w-20"></div>
        </div>
      </div>

      {/* Calendário */}
      <Card className="p-4">
        {/* Cabeçalho de dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 rounded"></div>
          ))}
        </div>
        
        {/* Células do calendário */}
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </Card>
    </div>
  );
} 