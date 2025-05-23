'use client';

import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageContainer } from "@/components/layout/PageContainer";

const data = [
  { name: "Seg", vendas: 4000, agendamentos: 2400 },
  { name: "Ter", vendas: 3000, agendamentos: 1398 },
  { name: "Qua", vendas: 2000, agendamentos: 9800 },
  { name: "Qui", vendas: 2780, agendamentos: 3908 },
  { name: "Sex", vendas: 1890, agendamentos: 4800 },
  { name: "Sab", vendas: 2390, agendamentos: 3800 },
  { name: "Dom", vendas: 3490, agendamentos: 4300 },
];

const dashboardMenuItems = [
  {
    label: "Visão geral",
    description: "Resumo do seu negócio",
    href: "/"
  },
  {
    label: "Análise financeira",
    description: "Dados financeiros detalhados",
    href: "/dashboard/financeiro"
  },
  {
    label: "Métricas",
    description: "Indicadores de desempenho",
    href: "/dashboard/metricas"
  }
];

export default function Home() {
  return (
    <PageContainer title="Dashboard" menuItems={dashboardMenuItems}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total de Agendamentos</h3>
            <p className="text-3xl font-bold">128</p>
            <p className="text-sm text-green-600 mt-1">↑ 12% em relação ao mês anterior</p>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Faturamento</h3>
            <p className="text-3xl font-bold">R$ 8.942,00</p>
            <p className="text-sm text-green-600 mt-1">↑ 8% em relação ao mês anterior</p>
          </Card>
          
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Clientes Novos</h3>
            <p className="text-3xl font-bold">32</p>
            <p className="text-sm text-green-600 mt-1">↑ 5% em relação ao mês anterior</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Desempenho semanal</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="vendas" stroke="#8884d8" />
                  <Line type="monotone" dataKey="agendamentos" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Próximos agendamentos</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Cliente {i + 1}</p>
                    <p className="text-sm text-gray-500">Corte + Barba</p>
                  </div>
                  <p className="text-sm text-gray-500">14:00</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}