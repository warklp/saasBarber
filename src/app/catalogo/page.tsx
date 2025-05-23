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
import { useRouter } from 'next/navigation';

const catalogMenuItems = [
  {
    label: "Serviços",
    description: "Gerencie seus serviços",
    href: "/catalogo"
  },
  {
    label: "Produtos",
    description: "Gerencie seus produtos",
    href: "/catalogo/produtos"
  },
  {
    label: "Categorias",
    description: "Organize seu catálogo",
    href: "/catalogo/categorias"
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

export default function CatalogoPage() {
  const router = useRouter();
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

  useEffect(() => {
    router.push('/catalogo/servicos');
  }, [router]);

  return null;
}