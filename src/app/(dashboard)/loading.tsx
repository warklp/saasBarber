import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="w-full animate-pulse space-y-6 p-6">
      {/* Título da página */}
      <div>
        <div className="h-8 bg-gray-200 rounded w-56 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="h-5 bg-gray-200 rounded w-36 mb-2"></div>
            <div className="h-9 bg-gray-200 rounded w-24"></div>
          </Card>
        ))}
      </div>

      {/* Gráfico semanal */}
      <Card className="p-6">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="h-80 bg-gray-200 rounded w-full"></div>
      </Card>

      {/* Próximos agendamentos */}
      <Card className="p-6">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center border-b pb-4">
              <div>
                <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-48"></div>
              </div>
              <div className="h-5 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
} 