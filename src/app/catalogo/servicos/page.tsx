'use client';

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import apiService, { ApiError } from "@/lib/api";
import { Edit, Trash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const catalogMenuItems = [
  {
    label: "Serviços",
    description: "Gerencie seus serviços",
    href: "/catalogo/servicos"
  },
  {
    label: "Produtos",
    description: "Gerencie seus produtos",
    href: "/catalogo/produtos"
  }
];

// Definição do tipo de serviço
type Service = {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

export default function ServicosPage() {
  // Estado para controlar a abertura do modal
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Estado para armazenar os serviços
  const [services, setServices] = useState<Service[]>([]);
  // Estado para controlar o carregamento
  const [isLoading, setIsLoading] = useState(true);
  // Estado para o formulário
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    description: "",
    duration_minutes: 30,
    price: 0,
    is_active: true
  });
  // Estado para o envio do formulário
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Estado para armazenar o status da autenticação
  const [authStatus, setAuthStatus] = useState<any>(null);
  // Estado para controlar se estamos editando ou criando
  const [isEditing, setIsEditing] = useState(false);
  // Estado para controlar o diálogo de confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Estado para armazenar o serviço a ser excluído
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  // Estado para controlar o carregamento da exclusão
  const [isDeleting, setIsDeleting] = useState(false);

  // Verificar autenticação quando o componente montar
  useEffect(() => {
    const checkAuth = async () => {
      const status = await apiService.checkAuth();
      setAuthStatus(status);
      console.log('Status de autenticação:', status);
    };
    
    checkAuth();
  }, []);

  // Função para buscar os serviços da API
  const fetchServices = async () => {
    try {
      setIsLoading(true);
      
      // Usando o serviço centralizado de API
      const response = await apiService.get<any>('/api/services', {
        debug: true,
        redirectOnUnauthorized: false
      });
      
      // Acessar os serviços dentro de response.data
      const services = response.data || [];
      
      if (!Array.isArray(services)) {
        console.error('API retornou dados inválidos:', response);
        setServices([]);
        return;
      }
      
      setServices(services);
    } catch (error) {
      console.error("Erro ao buscar serviços:", error);
      setServices([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar serviços quando o componente montar
  useEffect(() => {
    fetchServices();
  }, []);

  // Função para lidar com mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "price" || name === "duration_minutes" 
        ? Number(value) 
        : value
    }));
  };

  // Função para lidar com a mudança no checkbox
  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      is_active: checked
    }));
  };

  // Função para abrir o modal de criação
  const handleOpenCreateModal = () => {
    setFormData({
      id: "",
      name: "",
      description: "",
      duration_minutes: 30,
      price: 0,
      is_active: true
    });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  // Função para abrir o modal de edição
  const handleOpenEditModal = (service: Service) => {
    setFormData({
      id: service.id,
      name: service.name,
      description: service.description || "",
      duration_minutes: service.duration_minutes,
      price: service.price,
      is_active: service.is_active
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Função para confirmar exclusão
  const handleConfirmDelete = (service: Service) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  // Função para excluir o serviço
  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    
    setIsDeleting(true);
    try {
      await apiService.delete(`/api/services/${serviceToDelete.id}`, {
        showSuccessToast: true,
        successMessage: 'Serviço excluído com sucesso!',
        debug: true
      });
      
      // Atualizar a lista de serviços
      fetchServices();
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      
      // Tentar extrair mais informações específicas para debug
      if (error instanceof ApiError) {
        console.error('Status do erro:', error.status);
        console.error('Código do erro:', error.code);
        console.error('Resposta original:', error.rawResponse);
        
        // Verificar se o erro informa que o serviço está em uso
        if (error.status === 400 && error.rawResponse?.error?.message?.includes('em uso')) {
          toast.error('Não é possível excluir este serviço pois ele está em uso em agendamentos ou comandas.');
        }
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  };

  // Função para enviar o formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Verificar o status da autenticação antes de enviar
      const authStatus = await apiService.checkAuth();
      console.log('Status de autenticação no momento do envio:', authStatus);
      
      if (isEditing) {
        // Atualizando um serviço existente
        const { id, ...updateData } = formData;
        await apiService.patch(`/api/services/${id}`, updateData, {
          showSuccessToast: true,
          successMessage: 'Serviço atualizado com sucesso!',
          debug: true
        });
      } else {
        // Criando um novo serviço
        const { id, ...createData } = formData;
        await apiService.post('/api/services', createData, {
          showSuccessToast: true,
          successMessage: 'Serviço adicionado com sucesso!',
          debug: true
        });
      }
      
      // Resetar o formulário
      setFormData({
        id: "",
        name: "",
        description: "",
        duration_minutes: 30,
        price: 0,
        is_active: true
      });
      
      // Fechar o modal
      setIsDialogOpen(false);
      
      // Atualizar a lista de serviços
      fetchServices();
    } catch (error) {
      console.error(isEditing ? "Erro ao atualizar serviço:" : "Erro ao adicionar serviço:", error);
      
      // Tentar extrair mais informações específicas para debug
      if (error instanceof ApiError) {
        console.error('Status do erro:', error.status);
        console.error('Código do erro:', error.code);
        console.error('Resposta original:', error.rawResponse);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer title="Catálogo" menuItems={catalogMenuItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Serviços</h1>
            <p className="text-sm text-gray-500">Gerencie os serviços oferecidos</p>
          </div>
          <Button onClick={handleOpenCreateModal}>Adicionar serviço</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Mostrar placeholders enquanto carrega
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="p-6 h-40 flex flex-col justify-between animate-pulse">
                <div className="h-4 bg-gray-100 rounded-md w-3/4" />
                <div className="h-3 bg-gray-100 rounded-md w-1/2" />
                <div className="h-5 bg-gray-100 rounded-md w-1/3" />
                <div className="flex justify-end space-x-2">
                  <div className="h-8 w-8 bg-gray-100 rounded-md" />
                  <div className="h-8 w-8 bg-gray-100 rounded-md" />
                </div>
              </Card>
            ))
          ) : services.length > 0 ? (
            // Mostrar serviços se houver
            services.map((service) => (
              <Card key={service.id} className="p-6 h-40 flex flex-col justify-between border-2">
                <div>
                  <h3 className="font-medium">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.duration_minutes} minutos</p>
                  <p className="text-lg font-semibold mt-2">R$ {service.price.toFixed(2).replace('.', ',')}</p>
                  {!service.is_active && (
                    <p className="text-xs text-red-500 mt-1">Inativo</p>
                  )}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleOpenEditModal(service)}
                    className="h-8 w-8"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleConfirmDelete(service)}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            // Mostrar mensagem se não houver serviços
            <div className="col-span-3 p-6 text-center">
              <p className="text-gray-500">Nenhum serviço encontrado. Adicione seu primeiro serviço!</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal para adicionar/editar serviço */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar serviço' : 'Adicionar novo serviço'}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Atualize os detalhes do serviço selecionado.'
                : 'Preencha os detalhes do serviço que deseja adicionar ao catálogo.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do serviço*</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: Corte de cabelo"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Descreva o serviço..."
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration_minutes">Duração (minutos)*</Label>
                  <Input
                    type="number"
                    id="duration_minutes"
                    name="duration_minutes"
                    min={1}
                    value={formData.duration_minutes}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="price">Preço (R$)*</Label>
                  <Input
                    type="number"
                    id="price"
                    name="price"
                    min={0}
                    step="0.01"
                    value={formData.price}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="is_active" 
                  checked={formData.is_active}
                  onCheckedChange={handleCheckboxChange}
                />
                <Label htmlFor="is_active">Serviço ativo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar serviço' : 'Salvar serviço'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço "{serviceToDelete?.name}"?
              <br /><br />
              <strong>Atenção:</strong> Esta ação não poderá ser desfeita. 
              <br />
              Serviços usados em agendamentos ou comandas não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteService}
              disabled={isDeleting}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir serviço'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
} 