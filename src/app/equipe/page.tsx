'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, ChevronDown, MoreVertical, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { EmployeeModal } from "@/components/EmployeeModal";
import { EditEmployeeModal } from "@/components/EditEmployeeModal";
import { DeleteEmployeeModal } from "@/components/DeleteEmployeeModal";
import { useToast } from "@/components/ui/use-toast";
import employeeService, { EmployeeData, EmployeeResponse } from "@/lib/services/employeeService";

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

// Interface para o tipo de colaborador exibido na UI
interface TeamMember {
  id: string; // Agora sempre será string
  name: string;
  email: string;
  phone: string;
  rating: string;
  avatar: string;
  calendarColor?: string;
}

export default function EquipePage() {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeResponse | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar os colaboradores ao iniciar a página
  useEffect(() => {
    loadEmployees();
  }, []);

  // Função para carregar os colaboradores do banco de dados
  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const employeeData = await employeeService.getEmployees();
      
      // Converter do formato da API para o formato da UI
      const formattedMembers = employeeData.map(employee => ({
        id: employee.id.toString(), // Garantir que é string
        name: employee.name,
        email: employee.email,
        phone: employee.phone || "",
        rating: "Nenhuma avaliação ainda",
        avatar: employee.name.charAt(0),
        calendarColor: employee.metadata?.calendarColor
      }));
      
      setMembers(formattedMembers);
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

  // Função para adicionar um novo colaborador
  const handleAddEmployee = async (data: EmployeeData) => {
    try {
      setIsLoading(true);
      // Chamar o serviço para adicionar o colaborador no banco de dados
      const newEmployee = await employeeService.addEmployee(data);
      
      // Adicionar o novo colaborador à lista local
      const newMember: TeamMember = {
        id: newEmployee.id.toString(), // Garantir que é string
        name: newEmployee.name,
        email: newEmployee.email,
        phone: newEmployee.phone || "",
        rating: "Nenhuma avaliação ainda",
        avatar: newEmployee.name.charAt(0),
        calendarColor: newEmployee.metadata?.calendarColor
      };
      
      setMembers(prev => [...prev, newMember]);
      
      toast({
        title: "Colaborador adicionado com sucesso",
        description: `${data.name} foi adicionado à sua equipe.`,
      });
    } catch (error) {
      console.error("Erro ao adicionar colaborador:", error);
      toast({
        title: "Erro ao adicionar colaborador",
        description: "Ocorreu um erro ao tentar adicionar o colaborador. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para editar um colaborador
  const handleEditEmployee = async (id: string, data: Partial<EmployeeData>) => {
    try {
      console.log('Editando colaborador:', { id, data }); // Log para debug
      setIsLoading(true);
      // Chamar o serviço para atualizar o colaborador no banco de dados
      const updatedEmployee = await employeeService.updateEmployee(id, data);
      
      // Atualizar o colaborador na lista local
      setMembers(prev => prev.map(member => 
        member.id === id 
          ? {
              ...member,
              name: updatedEmployee.name,
              phone: updatedEmployee.phone || "",
              calendarColor: updatedEmployee.metadata?.calendarColor
            }
          : member
      ));
      
      toast({
        title: "Colaborador atualizado com sucesso",
        description: `Os dados de ${updatedEmployee.name} foram atualizados.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar colaborador:", error);
      toast({
        title: "Erro ao atualizar colaborador",
        description: "Ocorreu um erro ao tentar atualizar o colaborador. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para excluir um colaborador
  const handleDeleteEmployee = async (id: string) => {
    try {
      setIsLoading(true);
      // Chamar o serviço para excluir o colaborador no banco de dados
      await employeeService.deleteEmployee(id);
      
      // Remover o colaborador da lista local
      setMembers(prev => prev.filter(member => member.id !== id));
      
      toast({
        title: "Colaborador excluído com sucesso",
        description: "O colaborador foi removido permanentemente.",
      });
    } catch (error) {
      console.error("Erro ao excluir colaborador:", error);
      toast({
        title: "Erro ao excluir colaborador",
        description: "Ocorreu um erro ao tentar excluir o colaborador. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Abrir modal de editar colaborador
  const openEditModal = async (id: string) => {
    try {
      console.log('Abrindo modal de edição:', { id }); // Log para debug
      // Usar o ID exato do colaborador da lista local
      const member = members.find(m => m.id === id);
      if (!member) {
        toast({
          title: "Erro ao editar colaborador",
          description: "Colaborador não encontrado na lista local.",
          variant: "destructive",
        });
        return;
      }

      // Converter o membro local para o formato EmployeeResponse
      const employee: EmployeeResponse = {
        id: member.id, // Já é string
        name: member.name,
        email: member.email,
        phone: member.phone || null,
        role: 'employee',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          calendarColor: member.calendarColor
        }
      };
      
      console.log('Dados do colaborador para edição:', employee); // Log para debug
      setSelectedEmployee(employee);
      setIsEditModalOpen(true);
    } catch (error) {
      console.error("Erro ao abrir modal de edição:", error);
      toast({
        title: "Erro ao editar colaborador",
        description: "Ocorreu um erro ao tentar abrir o formulário de edição.",
        variant: "destructive",
      });
    }
  };

  // Abrir modal de excluir colaborador
  const openDeleteModal = async (id: string) => {
    try {
      // Usar o ID exato do colaborador da lista local
      const member = members.find(m => m.id === id);
      if (!member) {
        toast({
          title: "Erro ao excluir colaborador",
          description: "Colaborador não encontrado na lista local.",
          variant: "destructive",
        });
        return;
      }

      // Converter o membro local para o formato EmployeeResponse
      const employee: EmployeeResponse = {
        id: member.id.toString(),
        name: member.name,
        email: member.email,
        phone: member.phone || null,
        role: 'employee',
        created_at: new Date().toISOString(), // Não é crítico para exclusão
        updated_at: new Date().toISOString(), // Não é crítico para exclusão
        metadata: {
          calendarColor: member.calendarColor
        }
      };
      
      setSelectedEmployee(employee);
      setIsDeleteModalOpen(true);
    } catch (error) {
      console.error("Erro ao abrir modal de exclusão:", error);
      toast({
        title: "Erro ao excluir colaborador",
        description: "Ocorreu um erro ao tentar abrir o diálogo de confirmação.",
        variant: "destructive",
      });
    }
  };

  // Filtrar colaboradores de acordo com a busca
  const filteredMembers = searchTerm 
    ? members.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        member.email.toLowerCase().includes(searchTerm.toLowerCase()))
    : members;

  return (
    <PageContainer title="Equipe" menuItems={teamMenuItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Colaboradores</h1>
            <span className="bg-gray-100 px-2 py-1 rounded-full text-sm">{members.length}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline">Opções</Button>
            <Button 
              onClick={() => setIsAddModalOpen(true)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Pesquisar colaboradores" 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            Ordem definida
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>

        <Card className="p-0">
          {isLoading && members.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Carregando colaboradores...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-20">
              <p className="text-lg text-gray-500">Nenhum colaborador encontrado</p>
              {searchTerm && (
                <p className="text-sm text-gray-400 mt-2">
                  Tente ajustar os termos da pesquisa
                </p>
              )}
              {!searchTerm && members.length === 0 && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  Adicionar primeiro colaborador
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="w-12 p-4">
                      <Checkbox />
                    </th>
                    <th className="text-left p-4 font-medium">
                      <Button variant="ghost" className="font-medium flex items-center gap-2">
                        Nome
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </th>
                    <th className="text-left p-4 font-medium">Contato</th>
                    <th className="text-left p-4 font-medium">
                      <Button variant="ghost" className="font-medium flex items-center gap-2">
                        Nota
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </th>
                    <th className="w-20 p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="p-4">
                        <Checkbox />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {typeof member.avatar === 'string' && member.avatar.length === 1 ? (
                            <div 
                              className="w-10 h-10 rounded-full text-white flex items-center justify-center font-medium"
                              style={{ backgroundColor: member.calendarColor || '#4ea8de' }}
                            >
                              {member.avatar}
                            </div>
                          ) : (
                            <img 
                              src={member.avatar as string} 
                              alt={member.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          )}
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className="text-primary">{member.email}</p>
                          {member.phone && (
                            <p className="text-gray-500">{member.phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-gray-500">{member.rating}</span>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(member.id)}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-500"
                              onClick={() => openDeleteModal(member.id)}
                            >
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modal para adicionar colaborador */}
      <EmployeeModal 
        open={isAddModalOpen} 
        onOpenChange={setIsAddModalOpen} 
        onSubmit={handleAddEmployee} 
      />

      {/* Modal para editar colaborador */}
      <EditEmployeeModal 
        open={isEditModalOpen}
        employee={selectedEmployee}
        onOpenChange={setIsEditModalOpen}
        onSubmit={handleEditEmployee}
      />

      {/* Modal para excluir colaborador */}
      <DeleteEmployeeModal
        open={isDeleteModalOpen}
        employee={selectedEmployee}
        onOpenChange={setIsDeleteModalOpen}
        onConfirm={handleDeleteEmployee}
      />
    </PageContainer>
  );
}