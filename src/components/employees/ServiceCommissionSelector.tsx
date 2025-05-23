'use client';

import { useState, useEffect } from 'react';
import { Switch, Checkbox, Slider } from '@/components/ui/form-elements';
import { Trash2, Edit, Save, X, Percent } from 'lucide-react';
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

interface ServiceCommissionSelectorProps {
  userId: string;
  onUpdate?: () => void;
}

const ServiceCommissionSelector: React.FC<ServiceCommissionSelectorProps> = ({ userId, onUpdate }) => {
  const [services, setServices] = useState<ServiceWithUserSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchServicesAndUserAssignments();
    }
  }, [userId]);

  const fetchServicesAndUserAssignments = async () => {
    try {
      setIsLoading(true);
      
      // Buscar todos os serviços
      const servicesResponse = await apiService.get('/api/services?only_active=true');
      
      if (!servicesResponse.success || !servicesResponse.data) {
        toast.error('Não foi possível carregar os serviços');
        return;
      }
      
      // Buscar serviços atribuídos ao funcionário com cabeçalho especial para admin
      const userServicesResponse = await apiService.get(`/api/users/${userId}/services`, {
        headers: {
          'x-admin-request': 'true',
          'x-supabase-role': 'service_role'
        }
      });
      
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
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    try {
      setIsSaving(true);
      
      if (assigned) {
        // Adicionar serviço para o funcionário
        const response = await apiService.post('/api/user-services', {
          user_id: userId,
          service_id: serviceId,
          is_active: true,
          custom_commission_percentage: null // Usar comissão padrão
        }, {
          headers: {
            'x-admin-request': 'true',
            'x-supabase-role': 'service_role'
          }
        });
        
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
        
        const response = await apiService.delete(`/api/user-services/${userServiceId}`, {
          headers: {
            'x-admin-request': 'true',
            'x-supabase-role': 'service_role'
          }
        });
        
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
      
      const response = await apiService.patch(`/api/user-services/${service.userServiceId}`, {
        custom_commission_percentage: useCustom ? service.default_commission_percentage : null
      }, {
        headers: {
          'x-admin-request': 'true',
          'x-supabase-role': 'service_role'
        }
      });
      
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Agrupar serviços por categoria (usando categoria padrão já que não existe na tabela)
  const groupedServices = services.reduce((acc, service) => {
    const category = 'Serviços';  // Categoria padrão para todos os serviços
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceWithUserSettings[]>);

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-5 border-b border-gray-200">
        <h3 className="text-lg font-medium">Serviços e Comissões</h3>
        <p className="text-sm text-gray-500">Selecione os serviços que este funcionário pode realizar e configure as comissões</p>
      </div>

      <div className="p-5 space-y-6">
        {Object.entries(groupedServices).map(([category, categoryServices]) => (
          <div key={category} className="space-y-3">
            <h4 className="text-sm font-semibold uppercase text-gray-500">{category}</h4>
            
            <div className="space-y-2 divide-y divide-gray-100">
              {categoryServices.map(service => (
                <div key={service.id} className="pt-3 pb-3 first:pt-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        checked={service.assigned}
                        onChange={() => handleToggleService(service.id, !service.assigned)}
                        disabled={isSaving}
                        label=""
                      />
                      
                      <div>
                        <h5 className={`font-medium ${service.assigned ? 'text-gray-900' : 'text-gray-500'}`}>
                          {service.name}
                        </h5>
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
                                ? `${service.customCommissionValue}%` 
                                : `${service.default_commission_percentage}% (padrão)`}
                            </span>
                            {service.customCommission && editingServiceId === service.id ? (
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleSaveCustomCommission(service.id)}
                                  className="p-1 text-blue-600 hover:text-blue-800"
                                  disabled={isSaving}
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingServiceId(null)}
                                  className="p-1 text-gray-500 hover:text-gray-700"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingServiceId(service.id)}
                                className={`p-1 ${service.customCommission ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-gray-600'}`}
                                disabled={!service.customCommission || isSaving}
                              >
                                <Edit size={16} />
                              </button>
                            )}
                          </div>
                          
                          <Switch 
                            checked={service.customCommission}
                            onChange={() => handleToggleCustomCommission(service.id, !service.customCommission)}
                            disabled={isSaving}
                            label=""
                          />
                        </>
                      )}
                    </div>
                  </div>
                  
                  {service.assigned && service.customCommission && editingServiceId === service.id && (
                    <div className="mt-3 pl-10 pr-4">
                      <div className="flex items-center space-x-4">
                        <Slider 
                          min={0}
                          max={100}
                          step={0.5}
                          value={service.customCommissionValue}
                          onChange={(value: number) => handleCommissionValueChange(service.id, value)}
                          disabled={isSaving}
                          className="flex-grow"
                        />
                        <div className="flex items-center space-x-1 min-w-[60px]">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={service.customCommissionValue}
                            onChange={(e) => handleCommissionValueChange(service.id, parseFloat(e.target.value) || 0)}
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServiceCommissionSelector; 