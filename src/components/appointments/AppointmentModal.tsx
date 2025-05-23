'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Search, User, Check, Plus, MoreVertical, UserPlus, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import apiService from '@/lib/api/apiService'; // Atualizando o import do apiService

// Tipos para os dados
interface Service {
  id: string;
  name: string;
  duration_minutes: number; // Alterado para corresponder ao formato da API
  price: number;
  category?: string;
  description?: string;
  is_active?: boolean;
}

// Adaptando o tipo de serviço da API para o formato usado no componente
interface ServiceViewModel {
  id: string;
  name: string;
  duration: number;
  price: number;
  category?: string;
  description?: string;
}

interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  startTime: Date;
  endTime: Date;
  onSave: (appointmentData: any) => void;
}

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
}

// Componente principal do modal de agendamento
const AppointmentModal = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  startTime,
  endTime,
  onSave
}: AppointmentModalProps) => {
  // Estados para os dados do agendamento
  const [selectedServices, setSelectedServices] = useState<ServiceViewModel[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [services, setServices] = useState<ServiceViewModel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientSectionExpanded, setIsClientSectionExpanded] = useState(false);
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [isClientFormVisible, setIsClientFormVisible] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [clientFormData, setClientFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: ''
  });
  
  const router = useRouter();
  
  // Carregar serviços
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setServicesLoading(true);
        
        // Buscar serviços reais da API
        const response = await apiService.get<any>('/api/services?only_active=true');
        
        if (response && response.data) {
          // Adaptando o formato dos serviços da API para o formato usado no componente
          const servicesData: ServiceViewModel[] = response.data.map((service: Service) => ({
            id: service.id,
            name: service.name,
            duration: service.duration_minutes, // Convertendo para o formato esperado
            price: service.price,
            category: service.category || 'Serviços', // Categoria padrão alterada para Serviços
            description: service.description
          }));
          
          setServices(servicesData);
        } else {
          // Se não houver dados, inicializar com array vazio
          setServices([]);
          toast.error('Não foi possível obter serviços da API');
        }
      } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        toast.error('Não foi possível carregar a lista de serviços');
        setServices([]);
      } finally {
        setServicesLoading(false);
      }
    };
    
    if (isOpen) {
      fetchServices();
    }
  }, [isOpen]);
  
  // Carregar clientes quando a seção estiver expandida
  useEffect(() => {
    const fetchClients = async () => {
      if (!isClientSectionExpanded) return;
      
      try {
        setClientsLoading(true);
        const response = await apiService.get<any>('/api/customers');
        
        if (response && response.data) {
          setClients(response.data);
        } else {
          setClients([]);
          toast.error('Não foi possível obter clientes da API');
        }
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        toast.error('Não foi possível carregar a lista de clientes');
        setClients([]);
      } finally {
        setClientsLoading(false);
      }
    };
    
    fetchClients();
  }, [isClientSectionExpanded]);
  
  // Função para selecionar um serviço
  const handleSelectService = (service: ServiceViewModel) => {
    setSelectedServices([...selectedServices, service]);
    setIsAddServiceModalOpen(false);
  };
  
  // Função para toggle da seção de cliente
  const handleClientSectionToggle = () => {
    setIsClientSectionExpanded(!isClientSectionExpanded);
  };
  
  // Função para selecionar um cliente
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setIsClientSectionExpanded(false);
    setClientSearchQuery('');
  };
  
  // Função para selecionar um cliente espontâneo
  const handleSelectSpontaneousClient = () => {
    setSelectedClient({
      id: 'spontaneous',
      name: 'Espontâneo',
    });
    setIsClientSectionExpanded(false);
    setClientSearchQuery('');
  };
  
  // Função para abrir o modal de adicionar serviço
  const handleAddService = () => {
    setIsAddServiceModalOpen(true);
  };
  
  // Remover um serviço da lista
  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(service => service.id !== serviceId));
  };
  
  // Função para finalizar o agendamento
  const handleSaveAppointment = async () => {
    if (selectedServices.length === 0) {
      toast.error('Selecione pelo menos um serviço para continuar');
      return;
    }

    if (!selectedClient) {
      toast.error('Selecione um cliente para continuar');
      return;
    }

    try {
      // Calcular a duração total somando todos os serviços
      const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration, 0);
      
      // Calcular o horário de término com base na duração total
      const calculatedEndTime = new Date(startTime.getTime() + (totalDuration * 60000));
      
      // Preparar os dados do agendamento para o callback (sem incluir service_id)
      const appointmentData = {
        clientId: selectedClient.id === 'spontaneous' ? null : selectedClient.id,
        clientName: selectedClient.name,
        employeeId: employeeId,
        employeeName: employeeName,
        startTime: startTime,
        endTime: calculatedEndTime,
        notes: '',
        // Incluímos a lista completa de serviços para salvar depois
        services: selectedServices.map(service => ({
          id: service.id,
          name: service.name,
          price: service.price,
          duration: service.duration
        }))
      };

      // Chamar o callback de salvamento
      onSave(appointmentData);
      
      // Fechar o modal e reiniciar os dados
      onClose();
      resetModalData();
    } catch (error: any) {
      console.error('Erro ao salvar agendamento:', error);
      toast.error('Não foi possível criar o agendamento');
    }
  };

  // Função para ir para o checkout
  const handleCheckout = () => {
    // TODO: Implementar checkout ou navegar para página de checkout
    toast.success('Redirecionando para checkout...');
  };
  
  // Calcular o valor total
  const totalPrice = selectedServices.reduce((total, service) => total + service.price, 0);
  
  // Agrupar serviços por categoria
  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceViewModel[]>);
  
  // Filtrar serviços pela busca
  const filteredServices = searchQuery.trim() 
    ? services.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : services;
  
  // Filtrar clientes pela busca
  const filteredClients = clientSearchQuery.trim()
    ? clients.filter(c => 
        c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(clientSearchQuery.toLowerCase())) ||
        (c.phone && c.phone.includes(clientSearchQuery))
      )
    : clients;
  
  // Função para obter as iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 1);
  };
  
  // Função para formatar número de telefone
  const formatPhoneNumber = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numericValue = value.replace(/\D/g, '');
    
    // Aplica a máscara (XX) XXXXX-XXXX
    if (numericValue.length <= 11) {
      return numericValue
        .replace(/^(\d{2})/, '($1) ')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    
    return numericValue.substring(0, 11);
  };
  
  // Handler para alterações nos campos do formulário
  const handleClientFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      // Aplicar formatação para o telefone
      setClientFormData({
        ...clientFormData,
        [name]: formatPhoneNumber(value)
      });
    } else {
      setClientFormData({
        ...clientFormData,
        [name]: value
      });
    }
  };
  
  // Função para abrir o formulário de cliente
  const handleShowClientForm = () => {
    setIsClientFormVisible(true);
    setClientFormData({
      name: '',
      email: '',
      phone: ''
    });
  };
  
  // Função para voltar do formulário para a lista
  const handleBackToClientList = () => {
    setIsClientFormVisible(false);
  };
  
  // Função para salvar um novo cliente
  const handleClientSave = async () => {
    // Validação dos campos
    if (!clientFormData.name.trim()) {
      toast.error('O nome do cliente é obrigatório');
      return;
    }
    
    try {
      setClientSaving(true);
      
      // Limpar a formatação do telefone antes de enviar
      const cleanPhone = clientFormData.phone.replace(/\D/g, '');
      
      // Enviar dados para a API
      const response = await apiService.post<any>('/api/customers', {
        name: clientFormData.name.trim(),
        email: clientFormData.email.trim() || null,
        phone: cleanPhone || null
      });
      
      if (response && response.data) {
        // Adicionar o novo cliente à lista
        const newClient = response.data;
        setClients([newClient, ...clients]);
        
        // Selecionar o cliente recém-criado
        setSelectedClient(newClient);
        
        // Fechar o formulário e a seção expandida
        setIsClientFormVisible(false);
        setIsClientSectionExpanded(false);
        
        toast.success('Cliente cadastrado com sucesso!');
      } else {
        toast.error('Erro ao cadastrar cliente. Tente novamente.');
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar cliente:', error);
      
      // Exibir mensagem de erro mais específica se disponível
      if (error.message) {
        toast.error(`Erro: ${error.message}`);
      } else {
        toast.error('Não foi possível cadastrar o cliente');
      }
    } finally {
      setClientSaving(false);
    }
  };
  
  // Função para limpar todos os dados do modal
  const resetModalData = () => {
    setSelectedServices([]);
    setSelectedClient(null);
    setSearchQuery('');
    setClientSearchQuery('');
    setIsClientSectionExpanded(false);
    setIsAddServiceModalOpen(false);
    setIsClientFormVisible(false);
    setClientFormData({ name: '', email: '', phone: '' });
  };

  // Função para lidar com o fechamento do modal
  const handleCloseModal = () => {
    if (selectedServices.length > 0 || selectedClient) {
      setShowUnsavedChangesModal(true);
    } else {
      resetModalData();
      onClose();
    }
  };

  // Função para confirmar o fechamento do modal
  const handleConfirmClose = () => {
    resetModalData();
    setShowUnsavedChangesModal(false);
    onClose();
  };
  
  if (!isOpen) return null;
  
  // Modal de confirmação de fechamento
  if (showUnsavedChangesModal) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white rounded-lg p-6 w-[400px] shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Há alterações não salvas</h2>
          <p className="text-gray-600 mb-6">Se você fechar o agendamento agora, as alterações serão perdidas. Deseja sair?</p>
          <div className="flex justify-end space-x-4">
            <button
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              onClick={() => setShowUnsavedChangesModal(false)}
            >
              Voltar
            </button>
            <button
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
              onClick={handleConfirmClose}
            >
              Sim, sair
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Renderizar o modal de serviços quando não há serviços selecionados ou quando adicionar serviço
  if (selectedServices.length === 0 || isAddServiceModalOpen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white rounded-lg w-full max-w-3xl h-[650px] overflow-hidden flex shadow-lg">
          {/* Área de seleção de cliente (lateral esquerda) */}
          <div 
            className={`${isClientSectionExpanded ? 'w-1/3' : 'w-1/5'} h-full flex flex-col bg-white border-r border-gray-200 transition-all duration-300`}
          >
            {isClientSectionExpanded ? (
              // Conteúdo expandido para seleção de cliente
              <div className="flex flex-col h-full">
                <div className="px-4 py-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold">
                    {isClientFormVisible ? 'Cadastrar cliente' : 'Selecionar cliente'}
                  </h2>
                </div>
                
                {isClientFormVisible ? (
                  // Formulário de cadastro de cliente
                  <div className="p-4 flex flex-col h-full">
                    <button 
                      className="flex items-center text-blue-600 mb-4"
                      onClick={handleBackToClientList}
                    >
                      <ArrowLeft size={16} className="mr-1" />
                      <span>Voltar</span>
                    </button>
                    
                    <div className="space-y-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nome <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          placeholder="Nome completo"
                          className="w-full p-3 border rounded-md"
                          value={clientFormData.name}
                          onChange={handleClientFormChange}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          name="email"
                          placeholder="email@exemplo.com"
                          className="w-full p-3 border rounded-md"
                          value={clientFormData.email}
                          onChange={handleClientFormChange}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Telefone
                        </label>
                        <input
                          type="text"
                          name="phone"
                          placeholder="(00) 00000-0000"
                          className="w-full p-3 border rounded-md"
                          value={clientFormData.phone}
                          onChange={handleClientFormChange}
                          maxLength={15}
                        />
                      </div>
                    </div>
                    
                    <button
                      className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mt-auto disabled:bg-blue-300 disabled:cursor-not-allowed"
                      onClick={handleClientSave}
                      disabled={clientSaving || !clientFormData.name.trim()}
                    >
                      {clientSaving ? 'Salvando...' : 'Salvar cliente'}
                    </button>
                  </div>
                ) : (
                  // Lista de clientes
                  <>
                    {/* Barra de busca de clientes */}
                    <div className="p-4">
                      <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Pesquisar cliente ou deixar vazio"
                          className="w-full pl-10 pr-4 py-3 border rounded-md"
                          value={clientSearchQuery}
                          onChange={(e) => setClientSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {/* Lista de clientes */}
                    <div className="flex-1 overflow-y-auto">
                      {/* Opções especiais */}
                      <div 
                        className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b"
                        onClick={handleShowClientForm}
                      >
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <UserPlus size={20} className="text-blue-500" />
                        </div>
                        <span className="font-medium">Cadastrar cliente</span>
                      </div>
                      
                      <div 
                        className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b"
                        onClick={handleSelectSpontaneousClient}
                      >
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <User size={20} className="text-purple-500" />
                        </div>
                        <span className="font-medium">Espontâneo</span>
                      </div>
                      
                      {clientsLoading ? (
                        <div className="flex justify-center items-center p-8">
                          <p>Carregando clientes...</p>
                        </div>
                      ) : filteredClients.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          Nenhum cliente encontrado
                        </div>
                      ) : (
                        filteredClients.map(client => (
                          <div 
                            key={client.id}
                            className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b"
                            onClick={() => handleSelectClient(client)}
                          >
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-blue-800 font-medium">{getInitials(client.name)}</span>
                            </div>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              {client.email && <p className="text-sm text-gray-500">{client.email}</p>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              // Visualização compacta do cliente (área clicável)
              <div 
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer bg-gray-50"
                onClick={handleClientSectionToggle}
              >
                <div className="flex flex-col items-center py-8 px-4 text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <User size={32} className="text-blue-500" />
                  </div>
                  <p className="font-medium mb-1">
                    {selectedClient ? selectedClient.name : 'Adicionar cliente'}
                  </p>
                  {!selectedClient && (
                    <p className="text-sm text-gray-500 px-2">
                      Ou deixe vazio se não há cadastro
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Área de serviços (direita) */}
          <div className={`${isClientSectionExpanded ? 'w-2/3' : 'flex-1'} flex flex-col h-full transition-all duration-300`}>
            {/* Header do Modal */}
            <div className="flex justify-between items-center px-6 py-5">
              <div className="flex-1"></div> {/* Espaçador à esquerda */}
              <h2 className="text-xl font-semibold flex-1 text-center whitespace-nowrap">Selecionar um serviço</h2>
              <div className="flex-1 flex justify-end"> {/* Botão de fechar alinhado à direita */}
                <button 
                  className="text-gray-500 hover:text-gray-700"
                  onClick={handleCloseModal}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Linha horizontal após o título */}
            <div className="h-px bg-gray-200 w-full"></div>
            
            {/* Conteúdo de serviços */}
            <div className="flex flex-col h-full">
              {/* Barra de busca */}
              <div className="p-5">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar serviço por nome"
                    className="w-full pl-10 pr-4 py-3 border rounded-md"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Lista de serviços - altura fixa para mostrar ~4 serviços */}
              <div className="px-5 overflow-y-auto h-[400px]">
                {servicesLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <p>Carregando serviços...</p>
                  </div>
                ) : searchQuery.trim() ? (
                  /* Lista filtrada pela busca */
                  <div>
                    {filteredServices.length === 0 ? (
                      <p className="text-center text-gray-500 my-8">
                        Nenhum serviço encontrado para "{searchQuery}"
                      </p>
                    ) : (
                      filteredServices.map(service => (
                        <div 
                          key={service.id}
                          className="flex justify-between items-center p-4 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors mb-3"
                          onClick={() => handleSelectService(service)}
                        >
                          <div>
                            <h3 className="font-medium text-base">{service.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">{service.duration}min</p>
                          </div>
                          <p className="font-medium text-lg">R$ {service.price}</p>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* Lista agrupada por categoria */
                  Object.entries(groupedServices).map(([category, categoryServices]) => (
                    <div key={category} className="mb-6">
                      <h3 className="text-lg font-medium mb-3 flex items-center">
                        {category === 'Barbering' ? 'Serviços' : category} <span className="ml-3 text-sm text-gray-500 font-normal">{categoryServices.length}</span>
                      </h3>
                      <div className="space-y-3">
                        {categoryServices.map(service => (
                          <div 
                            key={service.id}
                            className="flex justify-between items-center p-4 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => handleSelectService(service)}
                          >
                            <div>
                              <h3 className="font-medium text-base">{service.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{service.duration}min</p>
                            </div>
                            <p className="font-medium text-lg">R$ {service.price}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Renderizar a tela de confirmação quando há serviços selecionados
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[600px] overflow-hidden flex shadow-lg">
        {/* Coluna esquerda - Cliente */}
        <div 
          className={`${isClientSectionExpanded ? 'w-2/5' : 'w-1/5'} h-full flex flex-col border-r border-gray-200 transition-all duration-300`}
        >
          {isClientSectionExpanded ? (
            // Conteúdo expandido para seleção de cliente
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold">
                  {isClientFormVisible ? 'Cadastrar cliente' : 'Selecionar cliente'}
                </h2>
              </div>
              
              {isClientFormVisible ? (
                // Formulário de cadastro de cliente
                <div className="p-4 flex flex-col h-full overflow-auto">
                  <button 
                    className="flex items-center text-blue-600 mb-4"
                    onClick={handleBackToClientList}
                  >
                    <ArrowLeft size={16} className="mr-1" />
                    <span>Voltar</span>
                  </button>
                  
                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        placeholder="Nome completo"
                        className="w-full p-3 border rounded-md"
                        value={clientFormData.name}
                        onChange={handleClientFormChange}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-mail
                      </label>
                      <input
                        type="email"
                        name="email"
                        placeholder="email@exemplo.com"
                        className="w-full p-3 border rounded-md"
                        value={clientFormData.email}
                        onChange={handleClientFormChange}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="text"
                        name="phone"
                        placeholder="(00) 00000-0000"
                        className="w-full p-3 border rounded-md"
                        value={clientFormData.phone}
                        onChange={handleClientFormChange}
                        maxLength={15}
                      />
                    </div>
                  </div>
                  
                  <button
                    className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mt-auto disabled:bg-blue-300 disabled:cursor-not-allowed"
                    onClick={handleClientSave}
                    disabled={clientSaving || !clientFormData.name.trim()}
                  >
                    {clientSaving ? 'Salvando...' : 'Salvar cliente'}
                  </button>
                </div>
              ) : (
                // Lista de clientes
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Barra de busca de clientes */}
                  <div className="p-4">
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Pesquisar cliente ou deixar vazio"
                        className="w-full pl-10 pr-4 py-3 border rounded-md"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* Lista de clientes */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Opções especiais */}
                    <div 
                      className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b"
                      onClick={handleShowClientForm}
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <UserPlus size={20} className="text-blue-500" />
                      </div>
                      <span className="font-medium">Cadastrar cliente</span>
                    </div>
                    
                    <div 
                      className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b"
                      onClick={handleSelectSpontaneousClient}
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                        <User size={20} className="text-purple-500" />
                      </div>
                      <span className="font-medium">Espontâneo</span>
                    </div>
                    
                    {clientsLoading ? (
                      <div className="flex justify-center items-center p-8">
                        <p>Carregando clientes...</p>
                      </div>
                    ) : filteredClients.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Nenhum cliente encontrado
                      </div>
                    ) : (
                      filteredClients.map(client => (
                        <div 
                          key={client.id}
                          className="flex items-center p-4 hover:bg-gray-50 cursor-pointer border-b"
                          onClick={() => handleSelectClient(client)}
                        >
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-800 font-medium">{getInitials(client.name)}</span>
                          </div>
                          <div className="truncate">
                            <p className="font-medium truncate">{client.name}</p>
                            {client.email && <p className="text-sm text-gray-500 truncate">{client.email}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Visualização compacta do cliente (área clicável)
            <div 
              className="w-full h-full flex flex-col items-center justify-center cursor-pointer bg-gray-50"
              onClick={handleClientSectionToggle}
            >
              <div className="flex flex-col items-center py-8 px-4 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <User size={32} className="text-blue-500" />
                </div>
                <p className="font-medium mb-1">
                  {selectedClient ? selectedClient.name : 'Adicionar cliente'}
                </p>
                {!selectedClient && (
                  <p className="text-sm text-gray-500 px-2">
                    Ou deixe vazio se não há cadastro
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Coluna direita - Todo o conteúdo relacionado a serviços */}
        <div className={`${isClientSectionExpanded ? 'w-3/5' : 'flex-1'} flex flex-col h-full transition-all duration-300`}>
          {/* Header com a data/hora - Centralizado na parte direita */}
          <div className="flex justify-between items-center px-6 py-5">
            <div className="flex-1"></div> {/* Espaçador à esquerda */}
            <div className="flex-1 text-center">
              <h2 className="text-xl font-semibold whitespace-nowrap">
                {format(startTime, "EEE d MMM", { locale: ptBR })}
                <span className="text-gray-500 ml-2"> ↓ </span>
              </h2>
              <p className="text-gray-600 mt-1">{format(startTime, "HH:mm", { locale: ptBR })} · Não se repete</p>
            </div>
            <div className="flex-1 flex justify-end"> {/* Botão de fechar alinhado à direita */}
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={handleCloseModal}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Linha horizontal após o título */}
          <div className="h-px bg-gray-200 w-full"></div>
          
          {/* Área de serviços - com altura fixa */}
          <div className="p-6 overflow-y-auto h-[350px]">
            <h3 className="text-xl font-medium mb-5">Serviços</h3>
            
            {/* Lista de serviços selecionados */}
            <div className="space-y-4">
              {selectedServices.map((service, index) => (
                <div 
                  key={index} 
                  className="flex justify-between items-center pb-4 border-b"
                >
                  <div className="flex items-start">
                    <div className="w-1.5 h-14 bg-blue-400 rounded-full mr-4"></div>
                    <div>
                      <h4 className="font-medium text-base">{service.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {format(startTime, "HH:mm")} · {service.duration}min · 
                        <span 
                          className="text-blue-600 cursor-pointer hover:underline"
                          onClick={() => toast.success(`Profissional: ${employeeName}`)}
                        >
                          {employeeName}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-4 font-medium text-lg">R$ {service.price}</span>
                    <button 
                      onClick={() => handleRemoveService(service.id)} 
                      className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Botão para adicionar serviço */}
            <button 
              className="flex items-center text-blue-600 hover:bg-blue-50 p-3 rounded-md mt-4 w-full justify-center transition-colors"
              onClick={handleAddService}
            >
              <Plus size={20} className="mr-2" />
              <span className="font-medium">Adicionar serviço</span>
            </button>
          </div>
          
          {/* Footer com total e botões de ação */}
          <div className="px-6 py-5 mt-auto border-t flex justify-between items-center">
            <div className="flex-1">
              <h3 className="font-medium text-gray-600">Total</h3>
              <p className="text-xl font-semibold mt-1">R$ {totalPrice}</p>
            </div>
            <div className="flex items-center">
              <button
                className="bg-white border border-gray-300 text-gray-600 rounded-full p-2.5 mr-4 hover:bg-gray-100 transition-colors"
                onClick={() => toast.success('Mais opções')}
              >
                <MoreVertical size={18} />
              </button>
              <button
                className="px-6 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors"
                onClick={handleSaveAppointment}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentModal; 