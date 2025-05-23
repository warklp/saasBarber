'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/form-elements';
import { Percent, Save, Edit, X, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/form-elements';
import apiService from '@/lib/api/apiService';
import toast from 'react-hot-toast';

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  default_commission_percentage: number;
  description?: string;
}

interface UserService {
  id: string;
  user_id: string;
  service_id: string;
  custom_commission_percentage: number | null;
  is_active: boolean;
}

interface ServiceWithUserSettings extends Service {
  assigned: boolean;
  customCommission: boolean;
  customCommissionValue: number;
  userServiceId?: string;
}

interface EmployeeCommissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    name: string;
  } | null;
  onUpdate?: () => void;
}

export function EmployeeCommissionModal({ 
  open, 
  onOpenChange, 
  employee, 
  onUpdate 
}: EmployeeCommissionModalProps) {
  const [services, setServices] = useState<ServiceWithUserSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open && employee?.id) {
      fetchServicesAndUserAssignments();
    }
  }, [open, employee]);

  const fetchServicesAndUserAssignments = async () => {
    if (!employee?.id) return;
    
    try {
      setIsLoading(true);
      
      // Definir headers para requisições administrativas
      const adminHeaders = {
        'x-admin-request': 'true',
        'x-supabase-role': 'service_role'
      };
      
      // Buscar todos os serviços
      const servicesResponse = await apiService.get('/api/services?only_active=true');
      
      if (!servicesResponse.success || !servicesResponse.data) {
        toast.error('Não foi possível carregar os serviços');
        return;
      }
      
      // Buscar serviços atribuídos ao funcionário com cabeçalho especial para admin
      const userServicesResponse = await apiService.get(
        `/api/users/${employee.id}/services`, 
        { headers: adminHeaders }
      );
      
      const userServices: UserService[] = userServicesResponse.success && userServicesResponse.data ? 
        userServicesResponse.data : [];
      
      // Combinar os dados
      let combinedServices: ServiceWithUserSettings[] = servicesResponse.data.map((service: Service) => {
        const userService = userServices.find(us => us.service_id === service.id);
        
        return {
          ...service,
          assigned: !!userService,
          customCommission: !!userService?.custom_commission_percentage,
          customCommissionValue: userService?.custom_commission_percentage || service.default_commission_percentage,
          userServiceId: userService?.id
        };
      });
      
      // Ordenar serviços por nome alfabeticamente
      combinedServices = combinedServices.sort((a, b) => a.name.localeCompare(b.name));
      
      setServices(combinedServices);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      toast.error('Erro ao carregar dados de serviços');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleService = async (serviceId: string, assigned: boolean) => {
    if (!employee?.id) return;
    
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    try {
      setIsSaving(true);
      
      // Definir headers para requisições administrativas
      const adminHeaders = {
        'x-admin-request': 'true',
        'x-supabase-role': 'service_role'
      };
      
      if (assigned) {
        // Adicionar serviço para o funcionário
        const response = await apiService.post(
          '/api/user-services', 
          {
            user_id: employee.id,
            service_id: serviceId,
            is_active: true,
            custom_commission_percentage: null // Usar comissão padrão
          }, 
          { headers: adminHeaders }
        );
        
        if (!response.success) {
          throw new Error(response.error || 'Erro ao atribuir serviço');
        }
        
        toast.success('Serviço adicionado ao funcionário');
        
        // Atualizar estado local
        setServices(services.map(s => {
          if (s.id === serviceId) {
            return {
              ...s,
              assigned: true,
              userServiceId: response.data.id
            };
          }
          return s;
        }));
      } else {
        // Remover serviço do funcionário
        const userServiceId = service.userServiceId;
        
        if (!userServiceId) {
          throw new Error('ID do serviço do usuário não encontrado');
        }
        
        const response = await apiService.delete(
          `/api/user-services/${userServiceId}`, 
          { headers: adminHeaders }
        );
        
        if (!response.success) {
          throw new Error(response.error || 'Erro ao remover serviço');
        }
        
        toast.success('Serviço removido do funcionário');
        
        // Atualizar estado local
        setServices(services.map(s => {
          if (s.id === serviceId) {
            return {
              ...s,
              assigned: false,
              customCommission: false,
              userServiceId: undefined
            };
          }
          return s;
        }));
      }
      
      // Notificar sobre a atualização
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Erro ao atualizar serviço:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar serviço');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCustomCommission = async (serviceId: string, useCustom: boolean) => {
    const service = services.find(s => s.id === serviceId);
    if (!service || !service.userServiceId) return;
    
    try {
      setIsSaving(true);
      
      // Definir headers para requisições administrativas
      const adminHeaders = {
        'x-admin-request': 'true',
        'x-supabase-role': 'service_role'
      };
      
      const response = await apiService.patch(
        `/api/user-services/${service.userServiceId}`, 
        {
          custom_commission_percentage: useCustom ? service.default_commission_percentage : null
        }, 
        { headers: adminHeaders }
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar comissão');
      }
      
      toast.success(useCustom ? 'Comissão personalizada ativada' : 'Usando comissão padrão');
      
      // Atualizar estado local
      setServices(services.map(s => {
        if (s.id === serviceId) {
          return {
            ...s,
            customCommission: useCustom,
            customCommissionValue: service.default_commission_percentage
          };
        }
        return s;
      }));
      
      // Notificar sobre a atualização
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Erro ao atualizar tipo de comissão:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar tipo de comissão');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommissionValueChange = (serviceId: string, value: number) => {
    setServices(services.map(s => {
      if (s.id === serviceId) {
        return {
          ...s,
          customCommissionValue: value
        };
      }
      return s;
    }));
  };

  const handleSaveCustomCommission = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service || !service.userServiceId) return;
    
    try {
      setIsSaving(true);
      
      const response = await apiService.patch(`/api/user-services/${service.userServiceId}`, {
        custom_commission_percentage: service.customCommissionValue
      }, {
        headers: {
          'x-admin-request': 'true',
          'x-supabase-role': 'service_role'
        }
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao salvar comissão personalizada');
      }
      
      toast.success('Comissão personalizada salva');
      setEditingServiceId(null);
      
      // Notificar sobre a atualização
      if (onUpdate) onUpdate();
    } catch (error: unknown) {
      console.error('Erro ao salvar comissão personalizada:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar comissão personalizada');
    } finally {
      setIsSaving(false);
    }
  };

  // Nova função para salvar todas as comissões pendentes
  const handleSaveAllPendingChanges = async () => {
    if (!editingServiceId) return true;
    
    try {
      setIsSaving(true);
      const serviceToSave = services.find(s => s.id === editingServiceId);
      
      if (serviceToSave && serviceToSave.userServiceId) {
        const response = await apiService.patch(`/api/user-services/${serviceToSave.userServiceId}`, {
          custom_commission_percentage: serviceToSave.customCommissionValue
        }, {
          headers: {
            'x-admin-request': 'true',
            'x-supabase-role': 'service_role'
          }
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Erro ao salvar comissão personalizada');
        }
        
        toast.success('Comissão personalizada salva');
        setEditingServiceId(null);
        return true;
      }
      return true;
    } catch (error: unknown) {
      console.error('Erro ao salvar comissão personalizada:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar comissão personalizada');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Filtra os serviços com base no termo de busca
  const filteredServices = searchTerm 
    ? services.filter(service => 
        service.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : services;

  const assignedServicesCount = services.filter(s => s.assigned).length;
  const totalServicesCount = services.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Comissões: {employee?.name}
          </DialogTitle>
          <DialogDescription>
            Configure os serviços e comissões para este funcionário.
            {assignedServicesCount > 0 && (
              <span className="text-sm font-medium text-gray-700 ml-2">
                ({assignedServicesCount} de {totalServicesCount} serviços atribuídos)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Buscar serviço..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <span className="ml-3">Carregando serviços...</span>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'Nenhum serviço encontrado com este termo' : 'Nenhum serviço disponível'}
            </div>
          ) : (
            <div className="space-y-2 divide-y divide-gray-100">
              {filteredServices.map(service => (
                <div key={service.id} className="pt-3 pb-3 first:pt-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        checked={service.assigned}
                        onCheckedChange={() => handleToggleService(service.id, !service.assigned)}
                        disabled={isSaving}
                        id={`service-${service.id}`}
                        className="mt-1"
                      />
                      
                      <div>
                        <label 
                          htmlFor={`service-${service.id}`}
                          className={`font-medium cursor-pointer ${service.assigned ? 'text-gray-900' : 'text-gray-500'}`}
                        >
                          {service.name}
                        </label>
                        <div className="text-sm text-gray-500 flex items-center space-x-2">
                          <span>{service.duration_minutes} min</span>
                          <span>•</span>
                          <span>R$ {service.price.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {service.assigned && (
                        <>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                              {service.customCommission 
                                ? `${Math.round(service.customCommissionValue)}%` 
                                : `${Math.round(service.default_commission_percentage)}% (padrão)`}
                            </span>
                            {service.customCommission && editingServiceId === service.id ? (
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSaveCustomCommission(service.id)}
                                  disabled={isSaving}
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                >
                                  <Save size={16} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingServiceId(null)}
                                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                                >
                                  <X size={16} />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingServiceId(service.id)}
                                disabled={!service.customCommission || isSaving}
                                className={`${service.customCommission ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                              >
                                <Edit size={16} />
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">Padrão</span>
                            <Switch 
                              checked={service.customCommission}
                              onChange={() => handleToggleCustomCommission(service.id, !service.customCommission)}
                              disabled={isSaving}
                              label=""
                            />
                            <span className="text-xs text-gray-500">Personalizada</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {service.assigned && service.customCommission && editingServiceId === service.id && (
                    <div className="mt-3 ml-10 mr-4">
                      <div className="flex items-center space-x-4 bg-gray-50 p-3 rounded-lg">
                        <Slider 
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(service.customCommissionValue)}
                          onChange={(value: number) => handleCommissionValueChange(service.id, Math.round(value))}
                          disabled={isSaving}
                          className="flex-grow"
                        />
                        <div className="flex items-center space-x-1 min-w-[60px]">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(service.customCommissionValue)}
                            onChange={(e) => handleCommissionValueChange(service.id, Math.round(parseFloat(e.target.value) || 0))}
                            className="w-12 h-8 border border-gray-300 rounded-md text-center text-sm"
                            disabled={isSaving}
                          />
                          <Percent size={14} className="text-gray-500" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button 
            variant="default"
            disabled={isSaving}
            onClick={async () => {
              // Primeiro salva quaisquer alterações pendentes
              const saveResult = await handleSaveAllPendingChanges();
              
              // Se o salvamento foi bem sucedido ou não havia nada para salvar
              if (saveResult) {
                // Notificar sobre a atualização
                if (onUpdate) onUpdate();
                
                // Fecha o modal
                onOpenChange(false);
              }
            }}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 