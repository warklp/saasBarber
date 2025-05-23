'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { 
  Search, 
  Receipt, 
  Download, 
  Filter, 
  Calendar, 
  ChevronDown,
  ListFilter, 
  Loader2,
  ExternalLink
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import apiService from '@/lib/api/apiService';
import comandaService from '@/lib/services/comandaService';
import { Comanda } from '@/lib/services/comandaService';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from 'react-day-picker';

// Interface para os dados brutos da API
interface ComandaApiResponse {
  id: string;
  appointment_id: string;
  cashier_id?: string;
  client_id: string;
  total: number;
  discount?: number;
  taxes?: number;
  final_total?: number;
  payment_method?: string;
  created_at: string;
  updated_at: string;
  status: 'aberta' | 'fechada' | 'cancelada';
  total_commission?: number;
  total_services_commission?: number;
  total_products_commission?: number;
  items?: Array<{
    id: string;
    comanda_id: string;
    service_id?: string;
    product_id?: string;
    service?: { name: string };
    product?: { name: string };
    quantity: number;
    unit_price: number;
    total_price: number;
    created_at: string;
    updated_at: string;
  }>;
  client?: {
    name: string;
  };
  appointment?: {
    employee_id?: string;
    employee?: {
      name: string;
    };
  };
}

// Estender a interface Comanda para incluir os campos que estamos usando
interface ExtendedComanda extends Comanda {
  client?: {
    id: string;
    name: string;
    email?: string;
  };
  appointment?: {
    id: string;
    employee?: {
      id: string;
      name: string;
    };
  };
  total_commission?: number;
  total_services_commission?: number;
  total_products_commission?: number;
  items?: Array<ComandaItem>;
}

interface ComandaItem {
  id: string;
  comanda_id: string;
  service_id?: string;
  product_id?: string;
  service?: { name: string };
  product?: { name: string };
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  updated_at: string;
}

// Itens do menu de configurações
const configMenuItems = [
  {
    label: "Configurações gerais",
    description: "Preferências do sistema",
    href: "/configuracoes"
  },
  {
    label: "Presença online",
    description: "Configure sua presença web",
    href: "/configuracoes/presenca-online"
  },
  {
    label: "Marketing",
    description: "Configure suas campanhas",
    href: "/configuracoes/marketing"
  },
  {
    label: "Agendamento",
    description: "Defina suas disponibilidades",
    href: "/configuracoes/agendamento"
  }
];

// Interface para os filtros da página
interface FilterState {
  search: string;
  status: string;
  dateRange: DateRange;
  paymentMethod: string;
}

export default function ComandasPage() {
  const router = useRouter();
  // Estado para armazenar as comandas
  const [comandas, setComandas] = useState<ExtendedComanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Estado para os filtros
  const [filter, setFilter] = useState<FilterState>({
    search: '',
    status: 'fechada',
    dateRange: {
      from: new Date(new Date().setDate(new Date().getDate() - 30)),
      to: new Date()
    },
    paymentMethod: 'todos'
  });
  
  // Estado para estatísticas
  const [stats, setStats] = useState({
    totalComandas: 0,
    totalFaturamento: 0,
    mediaValor: 0,
    totalComissoes: 0
  });
  
  // Opções para métodos de pagamento
  const paymentMethods = [
    { value: 'todos', label: 'Todos' },
    { value: 'cash', label: 'Dinheiro' },
    { value: 'credit_card', label: 'Cartão de Crédito' },
    { value: 'debit_card', label: 'Cartão de Débito' },
    { value: 'pix', label: 'PIX' },
    { value: 'bank_transfer', label: 'Transferência Bancária' },
    { value: 'other', label: 'Outro' }
  ];
  
  // Carregar comandas fechadas
  useEffect(() => {
    loadComandas();
  }, [filter]);
  
  // Função para carregar as comandas
  const loadComandas = async () => {
    try {
      setLoading(true);
      
      // Preparar parâmetros para a API
      const params: any = {
        status: filter.status
      };
      
      // Adicionar datas se definidas
      if (filter.dateRange.from) {
        params.start_date = filter.dateRange.from.toISOString();
      }
      
      if (filter.dateRange.to) {
        // Ajustar para o final do dia
        const endDate = new Date(filter.dateRange.to);
        endDate.setHours(23, 59, 59, 999);
        params.end_date = endDate.toISOString();
      }
      
      // Carregar as comandas
      const data = await comandaService.getComandas(params);
      console.log('Dados da API de comandas:', data);
      
      // Filtrar por método de pagamento se não for "todos"
      let filteredData = data as ExtendedComanda[];
      if (filter.paymentMethod !== 'todos') {
        filteredData = filteredData.filter(comanda => comanda.payment_method === filter.paymentMethod);
      }
      
      // Filtrar por texto de busca
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filteredData = filteredData.filter(comanda => 
          // Buscar por ID da comanda
          comanda.id.toLowerCase().includes(searchLower) ||
          // Buscar por nome do cliente (se disponível)
          (comanda.client?.name && comanda.client.name.toLowerCase().includes(searchLower)) ||
          // Buscar por nome do profissional (se disponível)
          (comanda.appointment?.employee?.name && comanda.appointment.employee.name.toLowerCase().includes(searchLower))
        );
      }
      
      setComandas(filteredData);
      
      // Calcular estatísticas
      calculateStats(filteredData);
    } catch (error) {
      console.error('Erro ao carregar comandas:', error);
      toast.error('Não foi possível carregar as comandas');
    } finally {
      setLoading(false);
      setLoadingStats(false);
    }
  };
  
  // Calcular estatísticas das comandas
  const calculateStats = (comandasList: ExtendedComanda[]) => {
    if (comandasList.length === 0) {
      setStats({
        totalComandas: 0,
        totalFaturamento: 0,
        mediaValor: 0,
        totalComissoes: 0
      });
      return;
    }
    
    // Total de comandas
    const totalComandas = comandasList.length;
    
    // Total de faturamento (considerando final_total se existir, senão o total)
    const totalFaturamento = comandasList.reduce((acc, comanda) => {
      const valor = comanda.total || 0;
      return acc + valor;
    }, 0);
    
    // Média de valor por comanda
    const mediaValor = totalFaturamento / totalComandas;
    
    // Total de comissões
    const totalComissoes = comandasList.reduce((acc, comanda) => {
      return acc + (comanda.total_commission || 0);
    }, 0);
    
    setStats({
      totalComandas,
      totalFaturamento,
      mediaValor,
      totalComissoes
    });
  };
  
  // Função para exportar as comandas para CSV
  const exportToCsv = () => {
    try {
      if (comandas.length === 0) {
        toast.error('Não há dados para exportar');
        return;
      }
      
      // Cabeçalhos do CSV
      const headers = [
        'ID da Comanda',
        'Data',
        'Cliente',
        'Profissional',
        'Valor Total',
        'Desconto',
        'Forma de Pagamento',
        'Comissão'
      ].join(',');
      
      // Linhas de dados
      const rows = comandas.map(comanda => {
        const data = format(new Date(comanda.created_at || ''), 'dd/MM/yyyy', { locale: ptBR });
        const cliente = comanda.client?.name || '-';
        const profissional = comanda.appointment?.employee?.name || '-';
        const valorTotal = (comanda.total || 0).toFixed(2).replace('.', ',');
        const desconto = (comanda.discount || 0).toFixed(2).replace('.', ',');
        const formaPagamento = getPaymentMethodLabel(comanda.payment_method || '');
        const comissao = ((comanda.total_commission || 0)).toFixed(2).replace('.', ',');
        
        return [
          comanda.id.split('-')[0], // Usar apenas a primeira parte do UUID
          data,
          cliente,
          profissional,
          valorTotal,
          desconto,
          formaPagamento,
          comissao
        ].join(',');
      });
      
      // Montar o CSV completo
      const csv = [headers, ...rows].join('\n');
      
      // Criar blob e link para download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `comandas_${format(new Date(), 'dd-MM-yyyy')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      toast.error('Não foi possível exportar os dados');
    }
  };
  
  // Formatar valor monetário
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };
  
  // Formatar data
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };
  
  // Obter rótulo para método de pagamento
  const getPaymentMethodLabel = (method: string) => {
    if (!method) return '-';
    
    // Mapeamento de valores da API para rótulos formatados
    const methodsMap: { [key: string]: string } = {
      'credit_card': 'Cartão de Crédito',
      'debit_card': 'Cartão de Débito',
      'cash': 'Dinheiro',
      'pix': 'PIX',
      'bank_transfer': 'Transferência Bancária',
      'other': 'Outro'
    };
    
    return methodsMap[method] || method;
  };

  // Função para navegar até os detalhes da comanda
  const handleComandaClick = (comandaId: string) => {
    router.push(`/configuracoes/comandas/${comandaId}`);
  };

  // Função para renderizar o nome do cliente
  const renderClientName = (comanda: ExtendedComanda) => {
    if (comanda.client?.name) return comanda.client.name;
    
    // Se não tiver nome, mas tiver client_id, mostrar um placeholder
    if (comanda.client_id) return `Cliente ${comanda.client_id.substring(0, 8)}`;
    
    return '-';
  };
  
  // Função para renderizar o nome do profissional
  const renderProfessionalName = (comanda: ExtendedComanda) => {
    if (comanda.appointment?.employee?.name) 
      return comanda.appointment.employee.name;
      
    // Se não tiver nome de funcionário, mas tiver o appointment
    if (comanda.appointment?.employee?.id) 
      return `Profissional ${comanda.appointment.employee.id.substring(0, 8)}`;
    
    return '-';
  };

  return (
    <PageContainer title="Comandas" menuItems={configMenuItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Receipt className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Resumo de Comandas</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportToCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>
        
        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col">
            <span className="text-sm text-gray-500">Total de Comandas</span>
            {loadingStats ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xl font-semibold">Carregando...</span>
              </div>
            ) : (
              <span className="text-2xl font-semibold mt-1">{stats.totalComandas}</span>
            )}
          </Card>
          
          <Card className="p-4 flex flex-col">
            <span className="text-sm text-gray-500">Faturamento Total</span>
            {loadingStats ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xl font-semibold">Carregando...</span>
              </div>
            ) : (
              <span className="text-2xl font-semibold mt-1">{formatCurrency(stats.totalFaturamento)}</span>
            )}
          </Card>
          
          <Card className="p-4 flex flex-col">
            <span className="text-sm text-gray-500">Valor Médio por Comanda</span>
            {loadingStats ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xl font-semibold">Carregando...</span>
              </div>
            ) : (
              <span className="text-2xl font-semibold mt-1">{formatCurrency(stats.mediaValor)}</span>
            )}
          </Card>
          
          <Card className="p-4 flex flex-col">
            <span className="text-sm text-gray-500">Total de Comissões</span>
            {loadingStats ? (
              <div className="flex items-center mt-1">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xl font-semibold">Carregando...</span>
              </div>
            ) : (
              <span className="text-2xl font-semibold mt-1">{formatCurrency(stats.totalComissoes)}</span>
            )}
          </Card>
        </div>
        
        {/* Filtros e barra de pesquisa */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Busca
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por cliente, profissional..."
                  value={filter.search}
                  onChange={(e) => setFilter({...filter, search: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 pl-9"
                />
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              </div>
            </div>
            
            <div className="w-full md:w-[300px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Período
              </label>
              <DateRangePicker
                value={filter.dateRange}
                onChange={(range) => setFilter(prev => ({...prev, dateRange: range || prev.dateRange}))}
              />
            </div>
            
            <div className="w-full md:w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma de Pagamento
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-left text-sm">
                    {getPaymentMethodLabel(filter.paymentMethod)}
                    <ChevronDown size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {paymentMethods.map(method => (
                    <DropdownMenuItem
                      key={method.value}
                      onClick={() => setFilter({...filter, paymentMethod: method.value})}
                      className="cursor-pointer"
                    >
                      {method.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilter({
                  search: '',
                  status: 'fechada',
                  dateRange: {
                    from: new Date(new Date().setDate(new Date().getDate() - 30)),
                    to: new Date()
                  },
                  paymentMethod: 'todos'
                })}
                className="h-10"
              >
                <ListFilter size={16} className="mr-2" />
                Limpar filtros
              </Button>
            </div>
          </div>
        </Card>
        
        {/* Tabela de comandas */}
        <Card>
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Comandas Fechadas</h2>
            <p className="text-sm text-gray-500 mt-1">Clique em uma comanda para ver detalhes</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando comandas...</p>
            </div>
          ) : comandas.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">Nenhuma comanda encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comanda
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profissional
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pagamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Comissão
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comandas.map((comanda) => (
                    <tr 
                      key={comanda.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleComandaClick(comanda.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          #{comanda.id.split('-')[0]}
                          <ExternalLink className="ml-1 h-3 w-3 text-gray-400" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(comanda.created_at || '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {renderClientName(comanda)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {renderProfessionalName(comanda)}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(comanda.total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getPaymentMethodLabel(comanda.payment_method || '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(comanda.total_commission || 0)}
                        {(comanda.total_services_commission || 0) > 0 && (
                          <span className="text-xs text-blue-600 block">
                            Serviços: {formatCurrency(comanda.total_services_commission || 0)}
                          </span>
                        )}
                        {(comanda.total_products_commission || 0) > 0 && (
                          <span className="text-xs text-green-600 block">
                            Produtos: {formatCurrency(comanda.total_products_commission || 0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
} 