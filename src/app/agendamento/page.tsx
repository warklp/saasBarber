'use client';

import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";

const schedulingMenuItems = [
  {
    label: "Link de agendamento",
    description: "Configure seu link de agendamento online",
    href: "/agendamento"
  },
  {
    label: "Configurações",
    description: "Defina as regras de agendamento",
    href: "/agendamento/configuracoes"
  }
];

export default function AgendamentoPage() {
  return (
    <PageContainer title="Agendamento Online" menuItems={schedulingMenuItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Agendamento Online</h1>
            <p className="text-sm text-gray-500">Configure seu sistema de agendamento online</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Link de agendamento</h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm">https://barbearia.com/agendar</p>
            </div>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Configurações</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p>Permitir agendamento online</p>
                <div className="w-10 h-6 bg-green-500 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <p>Confirmação automática</p>
                <div className="w-10 h-6 bg-gray-200 rounded-full" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}