'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, DollarSign, Download, Filter, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DashboardHeader from '@/components/layout/DashboardHeader';
import apiService from '@/lib/api/apiService';

interface CommissionDetail {
  id: string;
  comanda_id: string;
  comanda_item_id: string;
  employee_id: string;
  commission_value: number;
  commission_percentage: number;
  commission_type: 'service' | 'product';
  calculated_at: string;
  paid: boolean;
  payment_date: string | null;
  employee?: {
    id: string;
    name: string;
    email: string;
  };
  comanda?: {
    id: string;
    appointment_id: string;
    client_id: string;
    cashier_id?: string;
    total: number;
    discount?: number;
    taxes?: number;
    final_total?: number;
    payment_method?: string;
    status: 'aberta' | 'fechada' | 'cancelada';
    created_at: string;
    updated_at: string;
    items?: Array<{
      id: string;
      comanda_id: string;
      service_id?: string;
      product_id?: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      created_at: string;
      updated_at: string;
    }>;
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
  };
}

interface CommissionSummary {
  employee_id: string;
  employee_name: string;
  total_commission: number;
  service_commission: number;
  product_commission: number;
  paid_commission: number;
  unpaid_commission: number;
  commission_count: number;
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionDetail[]>([]);
  const [summaries, setSummaries] = useState<CommissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    paid: 'all', // 'all', 'paid', 'unpaid'
    employeeId: '',
    search: ''
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'calculated_at',
    direction: 'desc'
  });
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  // Função para buscar comissões
  const fetchCommissions = async () => {
    try {
      setLoading(true);
      
      // Criar os parâmetros de consulta
      const params = new URLSearchParams();
      params.append('start_date', filter.startDate);
      params.append('end_date', filter.endDate);
      
      if (filter.paid !== 'all') {
        params.append('paid', filter.paid === 'paid' ? 'true' : 'false');
      }
      
      if (filter.employeeId) {
        params.append('employee_id', filter.employeeId);
      }
      
      if (filter.search) {
        params.append('search', filter.search);
      }
      
      // Fazer requisição para a API
      const response = await apiService.get<any>(`/api/commissions?${params.toString()}`);
      
      if (response?.data) {
        setCommissions(response.data);
        
        // Agrupar comissões por funcionário para criar sumários
        const employeeSummaries: Record<string, CommissionSummary> = {};
        
        response.data.forEach((commission: CommissionDetail) => {
          const employeeId = commission.employee_id;
          const employeeName = commission.employee?.name || 'Funcionário';
          
          if (!employeeSummaries[employeeId]) {
            employeeSummaries[employeeId] = {
              employee_id: employeeId,
              employee_name: employeeName,
              total_commission: 0,
              service_commission: 0,
              product_commission: 0,
              paid_commission: 0,
              unpaid_commission: 0,
              commission_count: 0
            };
          }
          
          const summary = employeeSummaries[employeeId];
          const value = Number(commission.commission_value) || 0;
          
          summary.total_commission += value;
          summary.commission_count += 1;
          
          if (commission.commission_type === 'service') {
            summary.service_commission += value;
          } else {
            summary.product_commission += value;
          }
          
          if (commission.paid) {
            summary.paid_commission += value;
          } else {
            summary.unpaid_commission += value;
          }
        });
        
        setSummaries(Object.values(employeeSummaries));
      } else {
        setCommissions([]);
        setSummaries([]);
      }
    } catch (error) {
      console.error('Erro ao buscar comissões:', error);
      toast.error('Não foi possível carregar as comissões');
    } finally {
      setLoading(false);
    }
  };
  
  // Ordenar comissões
  const sortedCommissions = [...commissions].sort((a, b) => {
    const key = sortConfig.key as keyof CommissionDetail;
    
    if (key === 'commission_value' || key === 'commission_percentage') {
      return sortConfig.direction === 'asc' 
        ? Number(a[key]) - Number(b[key])
        : Number(b[key]) - Number(a[key]);
    }
    
    if (typeof a[key] === 'string' && typeof b[key] === 'string') {
      return sortConfig.direction === 'asc'
        ? (a[key] as string).localeCompare(b[key] as string)
        : (b[key] as string).localeCompare(a[key] as string);
    }
    
    return 0;
  });
  
  // Formatar data de uma forma legível
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch (e) {
      return dateString;
    }
  };
  
  // Função para marcar comissão como paga
  const markAsPaid = async (id: string) => {
    try {
      const response = await apiService.put<any>(`/api/commissions/${id}/pay`, {
        payment_date: new Date().toISOString()
      });
      
      if (response?.data) {
        toast.success('Comissão marcada como paga com sucesso!');
        fetchCommissions(); // Recarregar dados
      }
    } catch (error) {
      console.error('Erro ao marcar comissão como paga:', error);
      toast.error('Não foi possível atualizar o status da comissão');
    }
  };
  
  // Função para exportar dados
  const exportToCSV = () => {
    if (commissions.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }
    
    const headers = [
      'ID', 'Funcionário', 'Tipo', 'Valor', 'Porcentagem', 
      'Data Cálculo', 'Pago', 'Data Pagamento', 'Comanda', 'Valor Total Comanda'
    ];
    
    const rows = commissions.map(c => [
      c.id,
      c.employee?.name || 'Desconhecido',
      c.commission_type === 'service' ? 'Serviço' : 'Produto',
      c.commission_value.toString().replace('.', ','),
      c.commission_percentage.toString().replace('.', ',') + '%',
      formatDate(c.calculated_at),
      c.paid ? 'Sim' : 'Não',
      c.payment_date ? formatDate(c.payment_date) : '-',
      c.comanda_id,
      c.comanda?.final_total?.toString().replace('.', ',') || '0,00'
    ]);
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `comissoes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Carregar comissões ao iniciar ou ao mudar filtros
  useEffect(() => {
    fetchCommissions();
  }, [filter]);
  
  // Expandir/colapsar detalhes do funcionário
  const toggleEmployeeExpand = (employeeId: string) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <DashboardHeader 
        title="Comissões" 
        subtitle="Gerencie e acompanhe as comissões dos funcionários"
      />
      
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => setFilter({...filter, startDate: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => setFilter({...filter, endDate: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filter.paid}
              onChange={(e) => setFilter({...filter, paid: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">Todos</option>
              <option value="paid">Pagos</option>
              <option value="unpaid">Não Pagos</option>
            </select>
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Busca
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nome, comanda..."
                value={filter.search}
                onChange={(e) => setFilter({...filter, search: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 pl-9"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            </div>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-green-700"
            >
              <Download size={16} className="mr-2" />
              Exportar
            </button>
          </div>
        </div>
      </div>
      
      {/* Sumário por funcionário */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Resumo por Funcionário</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando comissões...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Nenhuma comissão encontrada para o período selecionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Funcionário
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serviços
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produtos
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    A Receber
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    # Comissões
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summaries.map((summary) => (
                  <tr key={summary.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{summary.employee_name}</div>
                          <div className="text-sm text-gray-500">{summary.employee_id.substring(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        R$ {summary.total_commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        R$ {summary.service_commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        R$ {summary.product_commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-600">
                        R$ {summary.unpaid_commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{summary.commission_count}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleEmployeeExpand(summary.employee_id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {expandedEmployees[summary.employee_id] ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Lista detalhada de comissões */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Detalhes das Comissões</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando comissões...</p>
          </div>
        ) : sortedCommissions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Nenhuma comissão encontrada para o período selecionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Funcionário
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    %
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedCommissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {commission.employee?.name || 'Desconhecido'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        commission.commission_type === 'service' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {commission.commission_type === 'service' ? 'Serviço' : 'Produto'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        R$ {Number(commission.commission_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {commission.commission_percentage}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(commission.calculated_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        commission.paid 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {commission.paid ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {!commission.paid && (
                        <button
                          onClick={() => markAsPaid(commission.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Marcar como pago"
                        >
                          <DollarSign size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 