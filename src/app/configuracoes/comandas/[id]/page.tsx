'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { 
  ArrowLeft, 
  Receipt, 
  Download, 
  User, 
  Calendar, 
  DollarSign, 
  Scissors, 
  ShoppingBag,
  Tag,
  CreditCard,
  Printer,
  Clock,
  ChevronLeft,
  UserCircle,
  Percent,
  Landmark,
  HistoryIcon,
  Coins
} from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import comandaService from '@/lib/services/comandaService';
import { Comanda, ComandaItem } from '@/lib/services/comandaService';
import apiService from '@/lib/api/apiService';

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

const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null) {
    return 'R$ 0,00';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

const getPaymentMethodLabel = (method: string) => {
  const methods = {
    "cash": "Dinheiro",
    "dinheiro": "Dinheiro",
    "cartao_credito": "Cartão de Crédito", 
    "credit_card": "Cartão de Crédito",
    "cartao_debito": "Cartão de Débito",
    "debit_card": "Cartão de Débito",
    "pix": "PIX",
    "transferencia_bancaria": "Transferência",
    "outro": "Outro"
  };
  
  return methods[method as keyof typeof methods] || method;
};

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    "aberta": { label: "Aberta", className: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
    "fechada": { label: "Fechada", className: "bg-green-100 text-green-800 hover:bg-green-200" },
    "cancelada": { label: "Cancelada", className: "bg-red-100 text-red-800 hover:bg-red-200" }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || { 
    label: status, 
    className: "bg-gray-100 text-gray-800 hover:bg-gray-200" 
  };
  
  return (
    <Badge className={config.className} variant="outline">
      {config.label}
    </Badge>
  );
};

// Estendendo a interface ComandaItem para incluir os campos necessários
interface ExtendedComandaItem extends ComandaItem {
  service?: {
    id: string;
    name: string;
    price: number;
    commission_settings?: {
      type: 'fixed' | 'percentage';
      value: number;
    };
  };
  product?: {
    id: string;
    name: string;
    sale_price: number;
    commission_settings?: {
      type: 'percentage' | 'fixed';
      value: number;
    };
  };
  tipo?: string;
  nome?: string;
  type?: 'service' | 'product';
  name?: string;
  commission_percentage?: number;
  commission_value?: number;
}

// Interface estendida para adicionar campos adicionais
interface ExtendedComanda extends Comanda {
  items: ExtendedComandaItem[];
  client?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  appointment?: {
    id: string;
    employee_id: string;
    start_time?: string;
    end_time?: string;
    employee?: {
      id: string;
      name: string;
      role?: string;
    };
  };
  total_commission?: number;
  total_services_commission?: number;
  total_products_commission?: number;
  metadata?: {
    total_commission?: number;
    total_services_commission?: number;
    total_products_commission?: number;
    payment_details?: {
      card_brand?: string;
      installments?: number;
      authorization_code?: string;
    };
    history?: Array<{
      timestamp: string;
      action: string;
      user: string;
    }>;
    [key: string]: any;
  };
}

interface ComandaItemWithMetadata extends ComandaItem {
  tipo?: 'service' | 'product';
  nome?: string;
  type?: 'service' | 'product';
  name?: string;
  commission_percentage?: number;
  commission_value?: number;
}

export default function ComandaDetailPage() {
  const router = useRouter();
  const params = useParams();
  const comandaId = params?.id as string;
  const [comanda, setComanda] = useState<ExtendedComanda | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Buscar dados reais da comanda
  useEffect(() => {
    if (!comandaId) return;
    
    const fetchComanda = async () => {
      setLoading(true);
      try {
        // Usar o serviço para buscar a comanda pelo ID
        const result = await comandaService.getComanda(comandaId);
        console.log('Dados da comanda carregados:', result);
        
        // Converter dados da API para o formato esperado
        const formattedResult: ExtendedComanda = {
          ...result,
          items: Array.isArray(result.items) ? result.items.map(item => ({
            ...item,
            // Garantir que campos obrigatórios estejam presentes
            type: item.service_id ? 'service' : item.product_id ? 'product' : undefined,
            name: (item as any).service?.name || (item as any).product?.name || 'Item sem nome',
            commission_percentage: (item as any).commission_percentage || 0,
            commission_value: (item as any).commission_value || 0
          })) : [],
          metadata: {
            ...(result.metadata || {}),
            total_commission: (result as any).total_commission || 0,
            total_services_commission: (result as any).total_services_commission || 0,
            total_products_commission: (result as any).total_products_commission || 0
          }
        };
        
        setComanda(formattedResult);
      } catch (error: any) {
        console.error('Erro ao carregar a comanda:', error);
        toast.error(`Erro ao carregar comanda: ${error.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchComanda();
  }, [comandaId]);
  
  // Função para voltar à listagem
  const handleBack = () => {
    router.push('/configuracoes/comandas');
  };
  
  // Função para imprimir a comanda
  const handlePrint = () => {
    toast.success('Enviando comanda para impressão...');
  };

  // Renderizar loader enquanto carrega os dados
  if (loading) {
    return (
      <PageContainer title="Detalhes da Comanda" menuItems={configMenuItems}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            <p className="text-gray-600">Carregando detalhes da comanda...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Renderizar mensagem de erro se a comanda não for encontrada
  if (!comanda) {
    return (
      <PageContainer title="Detalhes da Comanda" menuItems={configMenuItems}>
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Comanda não encontrada</h2>
          <p className="text-gray-600 mb-4">Não foi possível encontrar a comanda solicitada.</p>
          <Button onClick={handleBack}>Voltar para lista de comandas</Button>
        </Card>
      </PageContainer>
    );
  }

  // Esta função renderiza tabela de serviços
  const renderServicesTable = () => {
    if (!comanda?.items || !Array.isArray(comanda.items) || comanda.items.length === 0) {
      return <p className="text-center text-gray-500 my-4">Nenhum serviço ou produto adicionado</p>;
    }
    
    // Filtrar apenas os itens que são serviços
    const serviceItems = comanda.items.filter((item: ExtendedComandaItem) => 
      item.service_id || (item.service && item.service.id) || item.type === 'service'
    );
    
    if (serviceItems.length === 0) {
      return <p className="text-center text-gray-500 my-4">Nenhum serviço adicionado</p>;
    }
    
    return (
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serviço</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">QTD</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Unitário</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {serviceItems.map((item: ExtendedComandaItem) => (
            <tr key={item.id}>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                {item.service?.name || 'Serviço não especificado'}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                {item.quantity}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                {formatCurrency(item.unit_price)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                {formatCurrency(item.total_price)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300">
            <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-600">
              Subtotal Serviços
            </td>
            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
              {formatCurrency(serviceItems.reduce((acc: number, item: ExtendedComandaItem) => acc + (item.total_price || 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    );
  };
  
  // Esta função renderiza tabela de produtos
  const renderProductsTable = () => {
    if (!comanda?.items || !Array.isArray(comanda.items)) {
      return null;
    }
    
    // Filtrar apenas os itens que são produtos
    const productItems = comanda.items.filter((item: ExtendedComandaItem) => 
      item.product_id || (item.product && item.product.id) || item.type === 'product'
    );
    
    if (productItems.length === 0) {
      return null;
    }
    
    return (
      <>
        <h3 className="text-lg font-medium mt-8 mb-4">Produtos</h3>
        
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">QTD</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Unitário</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {productItems.map((item: ExtendedComandaItem) => (
              <tr key={item.id}>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.product?.name || 'Produto não especificado'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                  {item.quantity}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatCurrency(item.total_price)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300">
              <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                Subtotal Produtos
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                {formatCurrency(productItems.reduce((acc: number, item: ExtendedComandaItem) => acc + (item.total_price || 0), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </>
    );
  };

  return (
    <PageContainer title="Detalhes da Comanda" menuItems={configMenuItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                <h1 className="text-2xl font-semibold">Comanda #{comanda.id.split('-')[0]}</h1>
                <StatusBadge status={comanda.status} />
              </div>
              <p className="text-sm text-gray-500">
                {formatDate(comanda.created_at)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da esquerda - Informações principais */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-lg font-semibold">Detalhes da Comanda</h2>
                <div className="text-right">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="text-3xl font-bold">{formatCurrency(comanda.total || 0)}</span>
                    {comanda.discount !== undefined && comanda.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="text-sm">Desconto</span>
                        <span className="font-medium">- {formatCurrency(comanda.discount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-10">
                {/* Cliente */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <User className="h-4 w-4" />
                    <span>Cliente</span>
                  </div>
                  <div>
                    <div className="font-medium">{comanda.client?.name}</div>
                    <div className="text-sm text-gray-500">{comanda.client?.email}</div>
                    <div className="text-sm text-gray-500">{comanda.client?.phone}</div>
                  </div>
                </div>
                
                {/* Profissional */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Scissors className="h-4 w-4" />
                    <span>Profissional</span>
                  </div>
                  <div>
                    <div className="font-medium">{comanda.appointment?.employee?.name}</div>
                    <div className="text-sm text-gray-500">{comanda.appointment?.employee?.role}</div>
                  </div>
                </div>
                
                {/* Data e horário */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Calendar className="h-4 w-4" />
                    <span>Data e horário</span>
                  </div>
                  <div>
                    <div className="font-medium">
                      {comanda.appointment?.start_time ? formatDate(comanda.appointment.start_time) : '-'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {comanda.appointment?.start_time && comanda.appointment?.end_time ? (
                        <>
                          Duração: {format(new Date(comanda.appointment.start_time), 'HH:mm', { locale: ptBR })} - {' '}
                          {format(new Date(comanda.appointment.end_time), 'HH:mm', { locale: ptBR })}
                        </>
                      ) : '-'}
                    </div>
                  </div>
                </div>
                
                {/* Pagamento */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <CreditCard className="h-4 w-4" />
                    <span>Forma de pagamento</span>
                  </div>
                  <div>
                    <div className="font-medium">{getPaymentMethodLabel(comanda.payment_method || '')}</div>
                    {comanda.metadata?.payment_details?.card_brand && (
                      <div className="text-sm text-gray-500">
                        {comanda.metadata.payment_details.card_brand}
                        {comanda.metadata.payment_details.installments && comanda.metadata.payment_details.installments > 1
                          ? ` - ${comanda.metadata.payment_details.installments}x`
                          : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <Tabs defaultValue="itens">
                <TabsList className="mb-6 bg-gray-100">
                  <TabsTrigger value="itens">Itens da comanda</TabsTrigger>
                  <TabsTrigger value="comissoes">Comissões</TabsTrigger>
                </TabsList>
                
                <TabsContent value="itens" className="space-y-6">
                  {/* Serviços */}
                  <div>
                    <h3 className="text-lg font-medium mb-4">Serviços</h3>
                    {renderServicesTable()}
                  </div>
                  
                  {/* Produtos */}
                  {comanda.items.some(item => item.type === 'product') && (
                    <div>
                      {renderProductsTable()}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="comissoes" className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Detalhes das comissões</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Item
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Valor total
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              % Comissão
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Valor comissão
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {comanda.items.map((item: ExtendedComandaItem) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.name}
                                <span className="ml-2 text-xs text-gray-500">
                                  ({item.type === 'service' ? 'Serviço' : 'Produto'})
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                                {formatCurrency(item.total_price)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                                {item.commission_percentage || 0}%
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                {formatCurrency(item.commission_value)}
                              </td>
                            </tr>
                          ))}
                          
                          <tr className="bg-gray-50 font-bold">
                            <td colSpan={3} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              Total de comissões
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatCurrency(comanda.metadata?.total_commission)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4 bg-blue-50">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Comissão de Serviços</h4>
                      <p className="text-2xl font-bold text-blue-900">
                        {formatCurrency(comanda.metadata?.total_services_commission)}
                      </p>
                    </Card>
                    
                    <Card className="p-4 bg-green-50">
                      <h4 className="text-sm font-medium text-green-800 mb-2">Comissão de Produtos</h4>
                      <p className="text-2xl font-bold text-green-900">
                        {formatCurrency(comanda.metadata?.total_products_commission)}
                      </p>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
          
          {/* Coluna da direita - Resumo */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Resumo</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Subtotal Serviços</span>
                  <span className="font-medium">
                    {formatCurrency(
                      comanda.items
                        .filter((item: ExtendedComandaItem) => item.type === 'service')
                        .reduce((acc, item) => acc + item.total_price, 0)
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Subtotal Produtos</span>
                  <span className="font-medium">
                    {formatCurrency(
                      comanda.items
                        .filter((item: ExtendedComandaItem) => item.type === 'product')
                        .reduce((acc, item) => acc + item.total_price, 0)
                    )}
                  </span>
                </div>
                
                {comanda.discount !== undefined && comanda.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="text-sm">Desconto</span>
                    <span className="font-medium">- {formatCurrency(comanda.discount)}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(comanda.total)}</span>
                </div>
                
                <div className="bg-green-50 p-3 rounded-md">
                  <div className="flex items-center justify-between text-green-800">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">Total de comissões</span>
                    </div>
                    <span className="font-bold">{formatCurrency(comanda.metadata?.total_commission)}</span>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Histórico da Comanda</h2>
              
              <div className="space-y-4">
                <div className="relative pl-6 pb-4 border-l-2 border-gray-200">
                  <div className="absolute -left-1.5 top-0 w-4 h-4 rounded-full bg-blue-500"></div>
                  <p className="text-sm font-medium">Comanda criada</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(comanda.created_at)}
                  </p>
                </div>
                
                <div className="relative pl-6 pb-4 border-l-2 border-gray-200">
                  <div className="absolute -left-1.5 top-0 w-4 h-4 rounded-full bg-green-500"></div>
                  <p className="text-sm font-medium">Pagamento processado</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(comanda.updated_at || '')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getPaymentMethodLabel(comanda.payment_method || '')}
                  </p>
                </div>
                
                <div className="relative pl-6">
                  <div className="absolute -left-1.5 top-0 w-4 h-4 rounded-full bg-green-700"></div>
                  <p className="text-sm font-medium">Comanda fechada</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(comanda.updated_at)}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 