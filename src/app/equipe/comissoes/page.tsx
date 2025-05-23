'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, UsersRound, Percent, User } from 'lucide-react';
import employeeService from "@/lib/services/employeeService";
import apiService from "@/lib/api/apiService";
import { EmployeeCommissionModal } from '@/components/employees/EmployeeCommissionModal';

const teamMenuItems = [
  {
    label: "Colaboradores",
    description: "Gerencie sua equipe",
    href: "/equipe"
  },
  {
    label: "Comissões",
    description: "Gerencie as comissões",
    href: "/equipe/comissoes"
  },
  {
    label: "Escalas",
    description: "Organize horários",
    href: "/equipe/escalas"
  }
];

// Interface para funcionário
interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  calendarColor?: string;
  imageUrl?: string;
}

// Interface para estatísticas de funcionário
interface EmployeeStats {
  [employeeId: string]: {
    servicesCount: number;
    averageCommission: number;
  };
}

export default function ComissoesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats>({});

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const employeeData = await employeeService.getEmployees();
      
      const formattedEmployees = employeeData.map(employee => ({
        id: employee.id.toString(),
        name: employee.name,
        email: employee.email,
        phone: employee.phone || "",
        calendarColor: employee.metadata?.calendarColor
      }));
      
      setEmployees(formattedEmployees);
      
      // Carregar estatísticas de cada funcionário
      for (const employee of formattedEmployees) {
        await loadEmployeeStats(employee);
      }
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
      toast({
        title: "Erro ao carregar equipe",
        description: "Não foi possível carregar os dados dos colaboradores.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployeeStats = async (employee: Employee) => {
    try {
      // Buscar serviços do funcionário
      const response = await apiService.get(`/api/users/${employee.id}/services`, {
        headers: {
          'x-admin-request': 'true',
          'x-supabase-role': 'service_role'
        }
      });
      
      if (response.success && response.data) {
        const userServices = response.data;
        const servicesCount = userServices.length;
        
        // Calcular comissão média
        let totalCommission = 0;
        let customCommissionCount = 0;
        
        userServices.forEach((service: any) => {
          if (service.custom_commission_percentage) {
            totalCommission += service.custom_commission_percentage;
            customCommissionCount++;
          } else if (service.service?.default_commission_percentage) {
            totalCommission += service.service.default_commission_percentage;
            customCommissionCount++;
          }
        });
        
        const averageCommission = customCommissionCount > 0 
          ? totalCommission / customCommissionCount 
          : 0;
        
        setEmployeeStats(prev => ({
          ...prev,
          [employee.id]: {
            servicesCount,
            averageCommission
          }
        }));
      }
    } catch (error) {
      console.error(`Erro ao carregar estatísticas para ${employee.name}:`, error);
    }
  };

  const handleOpenModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleCommissionUpdate = () => {
    if (selectedEmployee) {
      // Atualizar estatísticas do funcionário quando as comissões forem atualizadas
      loadEmployeeStats(selectedEmployee);
    }
    
    toast({
      title: "Comissões atualizadas",
      description: "As comissões foram atualizadas com sucesso."
    });
  };

  // Filtra os funcionários de acordo com a busca
  const filteredEmployees = searchTerm 
    ? employees.filter(employee => 
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (employee.email && employee.email.toLowerCase().includes(searchTerm.toLowerCase())))
    : employees;

  return (
    <PageContainer
      title="Comissões"
      menuItems={teamMenuItems}
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Comissões</h1>
            <p className="text-gray-500">Gerencie as comissões para cada funcionário nos serviços oferecidos</p>
          </div>

          <div className="w-full md:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Buscar funcionário..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-3 text-lg">Carregando funcionários...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20">
            <UsersRound size={48} className="text-gray-300 mb-4" />
            <p className="text-lg text-gray-500">Nenhum funcionário encontrado</p>
            {searchTerm && (
              <p className="text-sm text-gray-400 mt-2">
                Tente ajustar os termos da pesquisa
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((employee) => {
              // Obter estatísticas para este funcionário
              const stats = employeeStats[employee.id] || { servicesCount: 0, averageCommission: 0 };
              
              return (
                <Card 
                  key={employee.id} 
                  className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
                  onClick={() => handleOpenModal(employee)}
                >
                  <div className="flex items-center p-4 border-b border-gray-100">
                    <div 
                      className="w-12 h-12 rounded-full text-white flex items-center justify-center font-medium text-xl mr-3 shadow-sm"
                      style={{ backgroundColor: employee.calendarColor || '#4ea8de' }}
                    >
                      {employee.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium truncate">{employee.name}</h3>
                      {employee.email && (
                        <p className="text-sm text-gray-500 truncate">{employee.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-700">Estatísticas</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center justify-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm text-gray-500">Serviços</span>
                        <span className="text-lg font-semibold text-blue-600">
                          {stats.servicesCount > 0 ? stats.servicesCount : '--'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-3 bg-green-50 rounded-lg">
                        <span className="text-sm text-gray-500">Comissão média</span>
                        <span className="text-lg font-semibold text-green-600">
                          {stats.averageCommission > 0 
                            ? `${stats.averageCommission.toFixed(1)}%` 
                            : '--%'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center text-gray-600">
                      <Percent size={16} className="mr-2" />
                      <span className="text-sm">Configurar comissões</span>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    >
                      Editar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <EmployeeCommissionModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          employee={selectedEmployee}
          onUpdate={handleCommissionUpdate}
        />
      </div>
    </PageContainer>
  );
} 