'use client';

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, BarChart2, LineChart, DollarSign } from "lucide-react";

const reportCategories = [
  { id: "todos", label: "Todos os relatórios" },
  { id: "vendas", label: "Vendas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "agendamentos", label: "Agendamentos" },
  { id: "equipe", label: "Equipe" },
  { id: "clientes", label: "Clientes" },
  { id: "inventario", label: "Inventário" },
];

const reports = [
  {
    id: "desempenho",
    icon: BarChart2,
    title: "Painel de desempenho",
    description: "Painel de desempenho de sua empresa.",
    category: "todos",
  },
  {
    id: "presenca-online",
    icon: LineChart,
    title: "Painel de presença online",
    description: "Vendas online e desempenho de cliente online",
    category: "vendas",
  },
  {
    id: "resumo-desempenho",
    icon: BarChart2,
    title: "Resumo de desempenho",
    description: "Resumo do desempenho de negócios por equipe ou unidade",
    category: "equipe",
    premium: true,
  },
  {
    id: "desempenho-tempo",
    icon: LineChart,
    title: "Desempenho ao longo do tempo",
    description: "Visualização das principais métricas empresariais por unidade ou colaborador ao longo do tempo",
    category: "equipe",
    premium: true,
  },
  {
    id: "resumo-vendas",
    icon: DollarSign,
    title: "Resumo de vendas",
    description: "Valor e quantidade de vendas, excluindo vendas de vales-presente",
    category: "vendas",
  },
];

export default function RelatoriosPage() {
  return (
    <div className="max-w-[1600px] w-full mx-auto px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios e análises</h1>
          <p className="text-sm text-gray-500">Acesse todos os seus relatórios. <button className="text-primary">Saiba mais</button></p>
        </div>
        <Button>Adicionar</Button>
      </div>

      <Card className="bg-primary text-white p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">Relatórios melhores, mais rápidos e mais inteligentes</h2>
        <p className="mb-4">Agora seus relatórios estão mais inteligentes e mais convenientes do que nunca, com todos os dados que você precisa para expandir seu negócio.</p>
        <Button variant="secondary" className="bg-white text-primary hover:bg-gray-100">
          Saiba mais
        </Button>
      </Card>

      <div className="flex items-center gap-4 mb-6">
        <Input 
          type="search" 
          placeholder="Pesquisar por nome do relatório ou descrição" 
          className="max-w-xl"
        />
        <Button variant="outline">Criado por</Button>
        <Button variant="outline">Categoria</Button>
      </div>

      <Tabs defaultValue="todos" className="mb-6">
        <TabsList className="bg-transparent border-b w-full justify-start rounded-none h-auto p-0">
          {reportCategories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-4"
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <report.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium">{report.title}</h3>
                <p className="text-sm text-gray-500">{report.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {report.premium && (
                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                  Premium
                </span>
              )}
              <Button variant="ghost" size="icon">
                <Star className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}