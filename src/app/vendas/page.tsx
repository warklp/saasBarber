'use client';

import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";

const salesMenuItems = [
  {
    label: "Vendas",
    description: "Resumo diário de vendas",
    href: "/vendas"
  },
  {
    label: "Agendamentos",
    href: "/vendas/agendamentos"
  },
  {
    label: "Vendas",
    href: "/vendas/lista"
  },
  {
    label: "Pagamentos",
    href: "/vendas/pagamentos"
  },
  {
    label: "Vales-presente vendidos",
    href: "/vendas/vales-presente"
  },
  {
    label: "Planos de assinatura vendidos",
    href: "/vendas/planos"
  }
];

const transactionTypes = [
  { name: 'Serviços', sales: 0, refunds: 0, total: 'R$ 0,00' },
  { name: 'Produtos', sales: 0, refunds: 0, total: 'R$ 0,00' },
  { name: 'Envio', sales: 0, refunds: 0, total: 'R$ 0,00' },
  { name: 'Vales-presente', sales: 0, refunds: 0, total: 'R$ 0,00' },
  { name: 'Planos de assinatura', sales: 0, refunds: 0, total: 'R$ 0,00' },
  { name: 'Taxas de cancelamento tardio', sales: 0, refunds: 0, total: 'R$ 0,00' },
  { name: 'Taxas de ausência', sales: 0, refunds: 0, total: 'R$ 0,00' },
  { name: 'Valor de reembolso', sales: 0, refunds: 0, total: 'R$ 0,00' },
];

const paymentSummary = [
  { type: 'Dinheiro', received: 'R$ 0,00', refunded: 'R$ 0,00' },
  { type: 'Outros', received: 'R$ 0,00', refunded: 'R$ 0,00' },
  { type: 'Resgates de vale-presente', received: 'R$ 0,00', refunded: 'R$ 0,00' },
  { type: 'Pagamentos recebidos', received: 'R$ 0,00', refunded: 'R$ 0,00' },
  { type: '(gorjetas)', received: 'R$ 0,00', refunded: 'R$ 0,00' },
];

export default function VendasPage() {
  const [date, setDate] = useState(new Date());

  return (
    <PageContainer title="Vendas" menuItems={salesMenuItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Vendas diárias</h1>
            <p className="text-sm text-gray-500">Visualize, filtre e exporte as transações e movimentações de caixa do dia</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline">Exportar</Button>
            <Button>Adicionar</Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline">Hoje</Button>
          <Button variant="outline">Quarta-feira 9 abr, 2025</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Resumo de transações</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Tipo de item</th>
                    <th className="text-right py-2">Qtd. de vendas</th>
                    <th className="text-right py-2">Qtd. de reembolso</th>
                    <th className="text-right py-2">Total bruto</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionTypes.map((type) => (
                    <tr key={type.name} className="border-b">
                      <td className="py-2">{type.name}</td>
                      <td className="text-right">{type.sales}</td>
                      <td className="text-right">{type.refunds}</td>
                      <td className="text-right">{type.total}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="py-2">Total de vendas</td>
                    <td className="text-right">0</td>
                    <td className="text-right">0</td>
                    <td className="text-right">R$ 0,00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Resumo do movimento de caixa</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Tipo de pagamento</th>
                    <th className="text-right py-2">Pagamentos recebidos</th>
                    <th className="text-right py-2">Reembolsos pagos</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentSummary.map((payment) => (
                    <tr key={payment.type} className="border-b">
                      <td className="py-2">{payment.type}</td>
                      <td className="text-right">{payment.received}</td>
                      <td className="text-right">{payment.refunded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}