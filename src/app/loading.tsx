import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="w-full animate-pulse space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-gray-200 rounded w-56 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-72"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 bg-gray-200 rounded w-24"></div>
          <div className="h-10 bg-gray-200 rounded w-24"></div>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="h-5 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-20"></div>
          </Card>
        ))}
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded w-full"></div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded w-full"></div>
        </Card>
      </div>
    </div>
  );
} 