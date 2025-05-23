'use client';

import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/card";

// Skeleton items para simular o menu lateral
const salesMenuItems = [
  { label: "Vendas", description: "Resumo diário de vendas", href: "/vendas" },
  { label: "Agendamentos", href: "/vendas/agendamentos" },
  { label: "Vendas", href: "/vendas/lista" },
  { label: "Pagamentos", href: "/vendas/pagamentos" },
  { label: "Vales-presente vendidos", href: "/vendas/vales-presente" },
  { label: "Planos de assinatura vendidos", href: "/vendas/planos" }
];

export default function VendasLoading() {
  return (
    <PageContainer title="Vendas" menuItems={salesMenuItems}>
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gray-200 rounded w-56 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-80"></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-10 bg-gray-200 rounded w-24"></div>
            <div className="h-10 bg-gray-200 rounded w-24"></div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-10 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded w-48"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded w-full"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="h-6 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded w-full"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
              <div className="h-10 bg-gray-200 rounded w-full"></div>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
} 