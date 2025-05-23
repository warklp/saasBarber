'use client';

import { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Edit, Trash, Search, Plus } from 'lucide-react';
import apiService from '@/lib/api';
import toast from 'react-hot-toast';
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

// Tipo de serviço
interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

interface ServiceListProps {
  onEditService: (service: Service) => void;
  onCreateService: () => void;
  onRefreshList: () => void;
}

export default function ServiceList({ onEditService, onCreateService, onRefreshList }: ServiceListProps) {
  // Estados
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Buscar serviços
  const fetchServices = async () => {
    try {
      setIsLoading(true);
      const result = await apiService.get<Service[]>(`/api/services?only_active=${showOnlyActive}`);
      setServices(result);
      applyFilters(result, searchQuery);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      toast.error('Não foi possível carregar a lista de serviços');
    } finally {
      setIsLoading(false);
    }
  };

  // Aplicar filtros
  const applyFilters = (serviceList: Service[], query: string) => {
    if (!query.trim()) {
      setFilteredServices(serviceList);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const filtered = serviceList.filter(service => 
      service.name.toLowerCase().includes(normalizedQuery) || 
      (service.description && service.description.toLowerCase().includes(normalizedQuery))
    );
    
    setFilteredServices(filtered);
  };

  // Carregar serviços quando o componente for montado ou os filtros alterados
  useEffect(() => {
    fetchServices();
  }, [showOnlyActive]);

  // Atualizar filtros quando a busca mudar
  useEffect(() => {
    applyFilters(services, searchQuery);
  }, [searchQuery, services]);

  // Lidar com a confirmação de exclusão
  const handleConfirmDelete = (service: Service) => {
    setServiceToDelete(service);
    setIsDeleteDialogOpen(true);
  };

  // Função para excluir o serviço
  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    
    setIsDeleting(true);
    try {
      await apiService.delete(`/api/services/${serviceToDelete.id}`, {
        showSuccessToast: true,
        successMessage: 'Serviço excluído com sucesso!',
      });
      
      await fetchServices();
      onRefreshList();
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      toast.error('Não foi possível excluir o serviço. Ele pode estar em uso em agendamentos ou comandas.');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  };

  // Formatação de preço
  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  return (
    <div className="w-full">
      {/* Filtros e ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="relative w-full md:w-1/2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder="Buscar por nome ou descrição"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="active-filter" 
              checked={showOnlyActive} 
              onCheckedChange={(checked) => setShowOnlyActive(checked as boolean)}
            />
            <Label htmlFor="active-filter">Mostrar apenas serviços ativos</Label>
          </div>
          
          <Button onClick={onCreateService} className="whitespace-nowrap">
            <Plus className="mr-2 h-4 w-4" /> Novo Serviço
          </Button>
        </div>
      </div>

      {/* Lista de serviços */}
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Carregando serviços...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center p-10 border rounded-lg bg-gray-50">
          <p className="text-lg text-gray-500">Nenhum serviço encontrado</p>
          <p className="text-sm text-gray-400 mt-2">
            {searchQuery ? `Não encontramos resultados para "${searchQuery}"` : 'Comece adicionando seu primeiro serviço'}
          </p>
          <Button onClick={onCreateService} variant="outline" className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Adicionar Serviço
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <Card key={service.id} className={`p-4 ${!service.is_active ? 'bg-gray-50 border-gray-200' : ''}`}>
              <div className="flex justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-lg">{service.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description || 'Sem descrição'}</p>
                </div>
                {!service.is_active && (
                  <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded inline-block ml-2">
                    Inativo
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center mt-4">
                <div>
                  <p className="text-sm text-gray-500">Duração: {service.duration_minutes} min</p>
                  <p className="font-semibold text-xl mt-1">{formatPrice(service.price)}</p>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditService(service)}
                    title="Editar"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfirmDelete(service)}
                    title="Excluir"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de confirmação para exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço "{serviceToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 