'use client';

import { useState, useRef, useEffect, cloneElement } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, MoreVertical, Calendar, ShoppingBag, Scissors, Clock, Check, ChevronDown, AlertCircle, X, Search, ArrowRight, Receipt, User, CreditCard, ArrowLeft, Printer, Percent, Coins } from 'lucide-react';
import toast from 'react-hot-toast';
import { Appointment } from '@/lib/services/appointmentService';
import apiService from '@/lib/api/apiService';
import PaymentModal from './PaymentModal';
import appointmentService from '@/lib/services/appointmentService';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Remover a extensão da interface Appointment e criar uma interface local
interface ExtendedService {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category?: string;
  description?: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onCompleteCheckout: (appointmentId: string) => void;
  onStatusChange?: (appointmentId: string) => void;
}

type AppointmentStatus = 'Reservado' | 'Confirmado' | 'Aguardando' | 'Iniciado' | 'Ausência' | 'Cancelar';

// Adicionar os tipos de status do agendamento
type AppointmentCompletionStatus = 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'absent' | 'completed' | 'canceled';

interface StatusOption {
  value: AppointmentStatus;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  isDanger?: boolean;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category?: string;
  description?: string;
}

interface ServiceViewModel {
  id: string;
  name: string;
  duration: number;
  price: number;
  category?: string;
  description?: string;
  duration_minutes?: number;
  comanda_item_id?: string;
}

// Nova interface para produtos
interface Product {
  id: string;
  name: string;
  price?: number;
  sale_price?: number;
  cost_price?: number;
  description?: string;
  category?: string;
  quantity_in_stock?: number;
  min_stock_alert?: number;
  is_active?: boolean;
}

// ViewModel para produtos
interface ProductViewModel {
  id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  quantity_in_stock?: number;
  comanda_item_id?: string;
}

// Interface para Comanda
interface Comanda {
  id: string;
  appointment_id: string;
  cashier_id?: string;
  client_id: string;
  total: number;
  discount?: number;
  taxes?: number;
  final_total?: number;
  payment_method?: string;
  created_at: string;
  updated_at: string;
  status: 'aberta' | 'fechada' | 'cancelada';
  items?: ComandaItem[];
}

// Interface para ComandaItem
interface ComandaItem {
  id?: string;
  comanda_id?: string;
  service_id?: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  service?: Service;
  product?: Product;
  commission_percentage?: number;
  commission_value?: number;
}

// Componente de seletor de produtos em formato de modal
const ProductSelectorModal = ({ 
  isOpen, 
  onClose, 
  products, 
  isLoading, 
  searchQuery, 
  onSearchChange, 
  selectedProducts, 
  onSelectProduct 
}: {
  isOpen: boolean;
  onClose: () => void;
  products: ProductViewModel[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedProducts: ProductViewModel[];
  onSelectProduct: (product: ProductViewModel) => void;
}) => {
  // Agrupar produtos por categoria
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, ProductViewModel[]>);
  
  // Filtrar produtos pela busca
  const filteredProducts = searchQuery.trim() 
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : products;
    
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-30" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-medium">Selecionar Produto</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-200 bg-white sticky top-0">
          <div className="relative">
            <input
              className="w-full border border-gray-300 rounded-md py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        
        <div className="overflow-y-auto flex-grow p-4">
          {isLoading ? (
            <div className="p-4 text-center">
              <p>Carregando produtos...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Object.entries(groupedProducts).map(([category, categoryProducts]) => {
                // Filtrar produtos pela busca dentro da categoria
                const filteredCategoryProducts = categoryProducts.filter(product => 
                  !searchQuery.trim() || 
                  product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
                );
                
                // Não mostrar categorias vazias após filtragem
                if (filteredCategoryProducts.length === 0) return null;
                
                return (
                  <div key={category} className="py-2">
                    <h4 className="text-xs font-semibold uppercase text-gray-500 px-3 py-2">
                      {category} 
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        ({filteredCategoryProducts.length})
                      </span>
                    </h4>
                    
                    {filteredCategoryProducts.map(product => (
                      <button
                        key={product.id}
                        className={`flex justify-between items-center w-full px-3 py-2 hover:bg-gray-50 rounded-md ${
                          selectedProducts.some(p => p.id === product.id) ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                        onClick={() => onSelectProduct(product)}
                        disabled={selectedProducts.some(p => p.id === product.id)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-900">{product.name}</span>
                          {product.quantity_in_stock !== undefined && product.quantity_in_stock !== null && (
                            <span className="text-sm text-gray-500">
                              Estoque: {product.quantity_in_stock}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">
                            R$ {product.price.toFixed(2).replace('.', ',')}
                          </span>
                          <ArrowRight size={16} className="ml-2 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button 
            className="w-full bg-gray-900 hover:bg-black text-white py-3 px-4 rounded-md text-center transition-colors"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente de seletor de serviços em formato de modal
const ServiceSelectorModal = ({ 
  isOpen, 
  onClose, 
  services, 
  isLoading, 
  searchQuery, 
  onSearchChange, 
  selectedServices, 
  onSelectService 
}: {
  isOpen: boolean;
  onClose: () => void;
  services: ServiceViewModel[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedServices: ServiceViewModel[];
  onSelectService: (service: ServiceViewModel) => void;
}) => {
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
    
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-30" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-medium">Selecionar Serviço</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-200 bg-white sticky top-0">
          <div className="relative">
            <input
              className="w-full border border-gray-300 rounded-md py-2 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Buscar serviços..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        
        <div className="overflow-y-auto flex-grow p-4">
          {isLoading ? (
            <div className="p-4 text-center">
              <p>Carregando serviços...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>Nenhum serviço encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Object.entries(groupedServices).map(([category, categoryServices]) => {
                // Filtrar serviços pela busca dentro da categoria
                const filteredCategoryServices = categoryServices.filter(service => 
                  !searchQuery.trim() || 
                  service.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                // Não mostrar categorias vazias após filtragem
                if (filteredCategoryServices.length === 0) return null;
                
                return (
                  <div key={category} className="py-2">
                    <h4 className="text-xs font-semibold uppercase text-gray-500 px-3 py-2">
                      {category === 'Barbering' ? 'Serviços' : category} 
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        ({filteredCategoryServices.length})
                      </span>
                    </h4>
                    
                    {filteredCategoryServices.map(service => (
                      <button
                        key={service.id}
                        className={`flex justify-between items-center w-full px-3 py-2 hover:bg-gray-50 rounded-md ${
                          selectedServices.some(s => s.id === service.id) ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                        onClick={() => onSelectService(service)}
                        disabled={selectedServices.some(s => s.id === service.id)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-gray-900">{service.name}</span>
                          <span className="text-sm text-gray-500">{service.duration}min</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">
                            R$ {service.price.toFixed(2).replace('.', ',')}
                          </span>
                          <ArrowRight size={16} className="ml-2 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button 
            className="w-full bg-gray-900 hover:bg-black text-white py-3 px-4 rounded-md text-center transition-colors"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente de resumo do agendamento
const AppointmentSummary = ({
  isOpen,
  onClose,
  appointment,
  services,
  products,
  totalAmount
}: {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  services: ServiceViewModel[];
  products: ProductViewModel[];
  totalAmount: number;
}) => {
  if (!isOpen || !appointment) return null;

  const formattedDate = format(new Date(appointment.start_time), "d 'de' MMMM", { locale: ptBR });
  const formattedTime = format(new Date(appointment.start_time), "HH:mm", { locale: ptBR });
  const clientInitials = appointment.client?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2) || 'J';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden z-10">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="bg-[#f4f0ff] rounded-full w-12 h-12 flex items-center justify-center mr-4">
              <span className="text-[#7950ed] text-xl font-medium">{clientInitials}</span>
            </div>
            <div>
              <h2 className="text-xl font-medium">{appointment.client?.name}</h2>
              <div className="flex items-center text-gray-500 text-sm">
                <Calendar size={16} className="mr-1" />
                <span>{formattedDate} às {formattedTime}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          {/* Serviços */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Serviços realizados</h3>
            <div className="space-y-3">
              {services.map(service => (
                <div key={service.id} className="flex justify-between items-start border-b border-gray-100 pb-3">
                  <div>
                    <h4 className="font-medium">{service.name}</h4>
                    <span className="text-sm text-gray-500">{service.duration}min • {appointment.employee?.name || 'Profissional'}</span>
                  </div>
                  <span className="font-medium">R$ {service.price.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Produtos */}
          {products.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Produtos adquiridos</h3>
              <div className="space-y-3">
                {products.map(product => (
                  <div key={product.id} className="flex justify-between items-start border-b border-gray-100 pb-3">
                    <div>
                      <h4 className="font-medium">{product.name}</h4>
                      {product.description && (
                        <span className="text-sm text-gray-500">{product.description}</span>
                      )}
                    </div>
                    <span className="font-medium">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Total */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <h3 className="text-xl font-medium">Total pago</h3>
            <span className="text-xl font-medium">R$ {totalAmount.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onCompleteCheckout,
  onStatusChange
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus>('Reservado');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Estados para adicionar serviço
  const [isServicesListOpen, setIsServicesListOpen] = useState(false);
  const [services, setServices] = useState<ServiceViewModel[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServices, setSelectedServices] = useState<ServiceViewModel[]>([]);
  
  // Estados para adicionar produto
  const [isProductsListOpen, setIsProductsListOpen] = useState(false);
  const [products, setProducts] = useState<ProductViewModel[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<ProductViewModel[]>([]);
  
  // Estado para controlar a visibilidade do modal de pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Novo estado para gerenciar a comanda
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [comandaLoading, setComandaLoading] = useState(false);
  
  // Verificar se a comanda está fechada
  const isComandaFechada = comanda?.status === 'fechada';
  
  const statusOptions: StatusOption[] = [
    { value: 'Reservado', label: 'Reservado', icon: <Calendar size={16} /> },
    { value: 'Confirmado', label: 'Confirmado', icon: <Check size={16} /> },
    { value: 'Aguardando', label: 'Aguardando', icon: <Clock size={16} /> },
    { value: 'Iniciado', label: 'Iniciado', icon: <Scissors size={16} /> },
    { value: 'Ausência', label: 'Ausência', icon: <AlertCircle size={16} />, isDanger: true },
    { value: 'Cancelar', label: 'Cancelar', icon: <X size={16} />, isDanger: true }
  ];

  // Função para reabrir a comanda fechada
  const handleReopenComanda = async () => {
    if (!comanda?.id) return;
    
    try {
      setIsLoading(true);
      
      // Chamar API para reabrir a comanda
      const response = await apiService.patch<any>(`/api/comandas/${comanda.id}/reopen`, {});
      
      console.log('Resposta da reabertura da comanda:', response?.data);
      
      // Atualizar a comanda no estado local
      if (response?.data) {
        setComanda({
          ...comanda,
          status: 'aberta'
        });
        toast.success('Comanda reaberta com sucesso');
      } else {
        throw new Error('Falha ao reabrir comanda');
      }
    } catch (error) {
      console.error('Erro ao reabrir comanda:', error);
      toast.error('Não foi possível reabrir a comanda');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para buscar a comanda do agendamento
  const fetchComanda = async () => {
    if (!appointment?.id) return;
    
    try {
      console.log('Buscando comanda para o agendamento:', appointment.id);
      setComandaLoading(true);
      
      // Buscar comanda pelo appointment_id
      const response = await apiService.get<any>(`/api/comandas?appointment_id=${appointment.id}`);
      
      console.log('Resposta da API comandas:', response?.data);
      
      if (response?.data && response.data.length > 0) {
        // Comanda encontrada
        const comandaData = response.data[0];
        console.log('Comanda carregada:', comandaData);
        
        // Garantir que a comanda tenha a propriedade items
        if (!comandaData.items) {
          comandaData.items = [];
        }
        
        // Validar e garantir que cada item tenha um ID
        if (Array.isArray(comandaData.items)) {
          comandaData.items.forEach((item: any) => {
            if (!item.id) {
              console.warn('Item sem ID encontrado:', item);
            }
          });
        } else {
          console.warn('Items não é um array:', comandaData.items);
          comandaData.items = [];
        }
        
        setComanda(comandaData);
        
        // Processar items da comanda
        if (comandaData.items && Array.isArray(comandaData.items) && comandaData.items.length > 0) {
          const servicesFromComanda: ServiceViewModel[] = [];
          const productsFromComanda: ProductViewModel[] = [];
          
          console.log(`Encontrados ${comandaData.items.length} itens na comanda`);
          
          // Processar cada item da comanda
          comandaData.items.forEach((item: any) => {
            console.log('Processando item:', item);
            
            // Verificar se é um serviço (pelo item_type ou presence de service_id)
            if ((item.item_type === 'service' || item.service_id)) {
              if (item.service) {
                console.log('Adicionando serviço:', item.service.name, 'ID:', item.service.id, 'Item ID:', item.id);
                servicesFromComanda.push({
                  id: item.service.id,
                  name: item.service.name,
                  duration: item.service.duration_minutes || 30,
                  price: item.unit_price,
                  category: item.service.category || 'Outros',
                  description: item.service.description || '',
                  duration_minutes: item.service.duration_minutes || 30,
                  comanda_item_id: item.id // Armazenar o ID do item da comanda
                });
              } else {
                console.log('Serviço sem detalhes completos:', item);
                // Tenta adicionar mesmo sem detalhes completos
                if (item.service_id) {
                  servicesFromComanda.push({
                    id: item.service_id,
                    name: "Serviço",
                    duration: 30,
                    price: item.unit_price,
                    category: 'Outros',
                    description: '',
                    duration_minutes: 30,
                    comanda_item_id: item.id // Armazenar o ID do item da comanda
                  });
                }
              }
            } 
            // Verificar se é um produto (pelo item_type ou presence de product_id)
            else if ((item.item_type === 'product' || item.product_id)) {
              if (item.product) {
                console.log('Adicionando produto:', item.product.name, 'ID:', item.product.id, 'Item ID:', item.id);
                // Preservar o valor original do estoque sem substituir por 0
                const stockValue = item.product.quantity_in_stock !== undefined 
                  ? item.product.quantity_in_stock 
                  : null;
                
                productsFromComanda.push({
                  id: item.product.id,
                  name: item.product.name,
                  price: item.unit_price,
                  description: item.product.description || '',
                  category: item.product.category || 'Outros',
                  quantity_in_stock: stockValue,
                  comanda_item_id: item.id // Armazenar o ID do item da comanda
                });
              } else {
                console.log('Produto sem detalhes completos:', item);
                // Tenta adicionar mesmo sem detalhes completos
                if (item.product_id) {
                  productsFromComanda.push({
                    id: item.product_id,
                    name: "Produto",
                    price: item.unit_price,
                    description: '',
                    category: 'Outros',
                    comanda_item_id: item.id // Armazenar o ID do item da comanda
                  });
                }
              }
            } else {
              console.log('Item sem produto ou serviço detectável:', item);
            }
          });
          
          console.log('Serviços da comanda:', servicesFromComanda);
          console.log('Produtos da comanda:', productsFromComanda);
          
          // Atualizar o estado com os itens da comanda
          setSelectedServices(servicesFromComanda);
          setSelectedProducts(productsFromComanda);
        } else {
          console.log('Comanda sem itens ou items inválido:', comandaData.items);
          
          // Inicializar os itens selecionados a partir do agendamento, se disponível
          if (appointment?.service) {
            const service = appointment.service as unknown as ExtendedService;
            setSelectedServices([{
              id: service.id,
              name: service.name,
              duration: service.duration_minutes,
              price: service.price,
              category: service.category || 'Outros',
              description: service.description || '',
              duration_minutes: service.duration_minutes
            }]);
          }
          
          setSelectedProducts([]);
        }
      } else {
        console.log('Nenhuma comanda encontrada para o agendamento:', appointment.id);
        // Nenhuma comanda encontrada
        setComanda(null);
        
        // Inicializar os itens selecionados a partir do agendamento, se disponível
        if (appointment?.service) {
          const service = appointment.service as unknown as ExtendedService;
          setSelectedServices([{
            id: service.id,
            name: service.name,
            duration: service.duration_minutes,
            price: service.price,
            category: service.category || 'Outros',
            description: service.description || '',
            duration_minutes: service.duration_minutes
          }]);
        }
        
        setSelectedProducts([]);
      }
    } catch (error) {
      console.error('Erro ao buscar comanda:', error);
      toast.error('Não foi possível carregar a comanda do agendamento');
      setComanda(null);
    } finally {
      setComandaLoading(false);
    }
  };
  
  // Função para criar ou atualizar a comanda
  const saveComanda = async () => {
    if (!appointment?.id || !appointment.client?.id) return;
    
    try {
      setIsLoading(true);
      
      // Calcular o total da comanda
      const total = selectedServices.reduce((sum, service) => sum + service.price, 0) +
                    selectedProducts.reduce((sum, product) => sum + product.price, 0);
      
      let comandaId;
      let novaComanda = false;
      
      if (comanda) {
        // Usar comanda existente sem fazer PUT desnecessário
        comandaId = comanda.id;
      } else {
        // Criar nova comanda
        novaComanda = true;
        const response = await apiService.post<any>('/api/comandas', {
          appointment_id: appointment.id,
          client_id: appointment.client.id,
          professional_id: appointment.employee?.id || '',
          cashier_id: appointment.employee?.id || '',  // Usar o ID do profissional como cashier_id
          initial_total: total
        });
        
        if (response?.data) {
          comandaId = response.data.id;
          setComanda(response.data);
        } else {
          throw new Error('Não foi possível criar a comanda');
        }
      }
      
      // Adicionar serviços à comanda
      for (const service of selectedServices) {
        // Verificar se o serviço já existe na comanda
        // Se for uma comanda nova OU se o serviço não existe na comanda atual
        if (novaComanda || !comanda?.items?.some(item => item.service_id === service.id)) {
          console.log(`Adicionando serviço ${service.name} à comanda ${comandaId}`);
          await apiService.post<any>('/api/comanda-items', {
            comanda_id: comandaId,
            service_id: service.id,
            quantity: 1,
            unit_price: service.price
          });
        }
      }
      
      // Adicionar produtos à comanda
      for (const product of selectedProducts) {
        // Verificar se o produto já existe na comanda
        if (novaComanda || !comanda?.items?.some(item => item.product_id === product.id)) {
          console.log(`Adicionando produto ${product.name} à comanda ${comandaId}`);
          await apiService.post<any>('/api/comanda-items', {
            comanda_id: comandaId,
            product_id: product.id,
            quantity: 1,
            unit_price: product.price
          });
        }
      }
      
      // Atualizar a comanda após adicionar todos os itens
      await fetchComanda();
      toast.success('Comanda atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao salvar comanda:', error);
      toast.error('Não foi possível salvar os itens na comanda');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar comanda quando o modal abrir
  useEffect(() => {
    if (isOpen && appointment?.id) {
      fetchComanda();
      
      // Atualizar o status do dropdown com base no status atual do agendamento
      if (appointment.status === 'scheduled') {
        setSelectedStatus('Reservado');
      } else if (appointment.status === 'confirmed') {
        setSelectedStatus('Confirmado');
      } else if (appointment.status === 'waiting') {
        setSelectedStatus('Aguardando');
      } else if (appointment.status === 'in_progress') {
        setSelectedStatus('Iniciado');
      } else if (appointment.status === 'absent') {
        setSelectedStatus('Ausência');
      } else if (appointment.status === 'completed') {
        // Não fechamos mais o modal aqui, apenas definimos o status
        setSelectedStatus('Confirmado'); // Pode usar qualquer estado visual adequado para concluído
      } else if (appointment.status === 'canceled') {
        setSelectedStatus('Cancelar');
      }
    }
  }, [isOpen, appointment?.id, appointment?.status]);

  // Carregar serviços
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setServicesLoading(true);
        
        // Buscar serviços da API
        const response = await apiService.get<any>('/api/services?only_active=true');
        
        if (response && response.data) {
          // Adaptando o formato dos serviços
          const servicesData: ServiceViewModel[] = response.data.map((service: Service) => ({
            id: service.id,
            name: service.name,
            duration: service.duration_minutes,
            price: service.price,
            category: service.category || 'Serviços',
            description: service.description,
            duration_minutes: service.duration_minutes
          }));
          
          setServices(servicesData);
        } else {
          setServices([]);
          toast.error('Não foi possível obter serviços');
        }
      } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        toast.error('Não foi possível carregar a lista de serviços');
        setServices([]);
      } finally {
        setServicesLoading(false);
      }
    };
    
    if (isOpen && isServicesListOpen) {
      fetchServices();
    }
  }, [isOpen, isServicesListOpen]);
  
  // Carregar produtos
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        
        // Buscar produtos da API
        const response = await apiService.get<any>('/api/products?only_active=true');
        
        if (response && response.data) {
          // Adaptando a resposta da API para o formato esperado
          const productsData: ProductViewModel[] = response.data.map((product: Product) => ({
            id: product.id,
            name: product.name,
            price: product.sale_price || product.price || 0,
            description: product.description,
            category: product.category || 'Outros',
            quantity_in_stock: product.quantity_in_stock
          }));
          setProducts(productsData);
        } else {
          setProducts([]);
          toast.error('Não foi possível obter produtos');
        }
      } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        toast.error('Não foi possível carregar a lista de produtos');
        
        // Produtos de exemplo para desenvolvimento
        setProducts([
          { id: '1', name: 'Pomada Modeladora', price: 45.90, description: 'Pomada para modelagem de cabelo', category: 'Finalização', quantity_in_stock: 15 },
          { id: '2', name: 'Shampoo Premium', price: 59.90, description: 'Shampoo de alta qualidade', category: 'Cabelo', quantity_in_stock: 20 },
          { id: '3', name: 'Óleo para Barba', price: 38.50, description: 'Óleo hidratante para barba', category: 'Barba', quantity_in_stock: 8 },
          { id: '4', name: 'Kit Manutenção', price: 120.00, description: 'Kit completo para manutenção', category: 'Kits', quantity_in_stock: 5 },
          { id: '5', name: 'Pente Profissional', price: 22.90, description: 'Pente de alta durabilidade', category: 'Acessórios', quantity_in_stock: 30 },
        ]);
      } finally {
        setProductsLoading(false);
      }
    };
    
    if (isOpen && isProductsListOpen) {
      fetchProducts();
    }
  }, [isOpen, isProductsListOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Inicializar serviços selecionados com o serviço atual do agendamento
  useEffect(() => {
    if (appointment && appointment.service && selectedServices.length === 0) {
      const service = appointment.service as unknown as ExtendedService;
      const currentService: ServiceViewModel = {
        id: service.id,
        name: service.name,
        duration: service.duration_minutes,
        price: service.price,
        duration_minutes: service.duration_minutes
      };
      setSelectedServices([currentService]);
    }
  }, [appointment, selectedServices.length]);

  // Mover o cálculo do preço total para antes de ser usado
  const servicePrice = selectedServices.reduce((total, service) => total + service.price, 0);
  const productPrice = selectedProducts.reduce((total, product) => total + product.price, 0);
  const totalPrice = servicePrice + productPrice;

  // Verificar se o agendamento já foi finalizado (mantemos esta variável pois pode ser útil para condicionais na interface)
  const isAppointmentCompleted = appointment?.status === 'completed';

  if (!isOpen || !appointment) return null;

  // Função para selecionar um produto
  const handleSelectProduct = async (product: ProductViewModel) => {
    if (!selectedProducts.some(p => p.id === product.id)) {
      try {
        if (!appointment?.id) return;
        
        setIsLoading(true);
        
        // Armazenar a quantidade em estoque original do produto
        const originalStock = product.quantity_in_stock;
        
        // Se não tiver comanda, criar uma nova
        if (!comanda) {
          // Adicionar produto localmente temporariamente
          setSelectedProducts([...selectedProducts, {
            ...product,
            // Preservar o valor original de estoque
            quantity_in_stock: originalStock
          }]);
          
          // Criar a comanda com o produto incluído
          await saveComanda();
        } else {
          // Adicionar o produto diretamente na comanda existente
          const response = await apiService.post<any>('/api/comanda-items', {
            comanda_id: comanda.id,
            product_id: product.id,
            quantity: 1,
            unit_price: product.price
          });
          
          console.log('Resposta da adição de produto:', response?.data);
          
          // Adicionar produto localmente enquanto o fetchComanda() processa
          // Isso garante que o produto apareça imediatamente na interface
          const updatedProducts = [...selectedProducts, {
            ...product,
            // Preservar o valor original de estoque
            quantity_in_stock: originalStock
          }];
          setSelectedProducts(updatedProducts);
          
          // Atualizar a comanda para mostrar o novo item
          await fetchComanda();
        }
        
        toast.success(`Produto ${product.name} adicionado com sucesso`);
      } catch (error) {
        console.error('Erro ao adicionar produto na comanda:', error);
        toast.error('Não foi possível adicionar o produto na comanda');
      } finally {
        setIsLoading(false);
      }
    }
    setIsProductsListOpen(false);
    setProductSearchQuery('');
  };
  
  // Função para selecionar um serviço
  const handleSelectService = async (service: ServiceViewModel) => {
    if (!selectedServices.some(s => s.id === service.id)) {
      try {
        if (!appointment?.id) return;
        
        setIsLoading(true);
        
        // Se não tiver comanda, criar uma nova
        if (!comanda) {
          // Adicionar serviço localmente temporariamente
          setSelectedServices([...selectedServices, service]);
          
          // Criar a comanda com o serviço incluído
          await saveComanda();
        } else {
          // Adicionar o serviço diretamente na comanda existente
          const response = await apiService.post<any>('/api/comanda-items', {
            comanda_id: comanda.id,
            service_id: service.id,
            quantity: 1,
            unit_price: service.price
          });
          
          console.log('Resposta da adição de serviço:', response?.data);
          
          // Adicionar serviço localmente enquanto o fetchComanda() processa
          // Isso garante que o serviço apareça imediatamente na interface
          const updatedServices = [...selectedServices, service];
          setSelectedServices(updatedServices);
          
          // Atualizar a comanda para mostrar o novo item
          await fetchComanda();
        }
        
        toast.success(`Serviço ${service.name} adicionado com sucesso`);
      } catch (error) {
        console.error('Erro ao adicionar serviço na comanda:', error);
        toast.error('Não foi possível adicionar o serviço na comanda');
      } finally {
        setIsLoading(false);
      }
    }
    setIsServicesListOpen(false);
    setSearchQuery('');
  };

  // Função para remover um produto
  const handleRemoveProduct = async (productId: string, comanda_item_id?: string) => {
    try {
      console.log(`Iniciando remoção de produto ID: ${productId}`, comanda_item_id ? `(Item ID: ${comanda_item_id})` : '');
      
      if (!comanda) {
        console.log('Nenhuma comanda encontrada, não é possível remover o produto');
        return;
      }
      
      setIsLoading(true);
      
      // Se temos o ID do item diretamente, usamos ele sem precisar buscar
      if (comanda_item_id) {
        console.log(`Usando comanda_item_id direto: ${comanda_item_id}`);
        try {
          const response = await apiService.delete<any>(`/api/comanda-items/${comanda_item_id}`);
          console.log('Resposta da remoção:', response);
          
          // Remover o item localmente enquanto aguarda fetchComanda
          setSelectedProducts(prev => prev.filter(p => p.id !== productId));
          
          // Atualizar a comanda para mostrar as mudanças
          await fetchComanda();
          
          toast.success('Produto removido com sucesso');
          return;
        } catch (error: any) {
          console.error('Erro específico na chamada API:', error);
          toast.error(`Erro ao chamar API: ${error?.message || 'Erro desconhecido'}`);
          setIsLoading(false);
          return;
        }
      }
      
      console.log('Comanda atual:', comanda);
      console.log('Itens da comanda:', comanda.items);
      
      // Verificar se comanda.items existe
      if (!comanda.items || !Array.isArray(comanda.items)) {
        console.error('Comanda não possui lista de itens válida');
        toast.error('Erro: Comanda não possui itens');
        setIsLoading(false);
        return;
      }
      
      // Buscar o item da comanda referente ao produto
      // O item na comanda pode ter um product_id que corresponde ao ID do produto OU
      // pode ter um produto aninhado cujo ID corresponde ao ID do produto
      const productItem = comanda.items.find(item => 
        item.product_id === productId || 
        (item.product && item.product.id === productId)
      );
      
      console.log('Item de produto encontrado:', productItem);
      
      if (productItem && productItem.id) {
        console.log(`Removendo item ID: ${productItem.id} da comanda ID: ${comanda.id}`);
        try {
          const response = await apiService.delete<any>(`/api/comanda-items/${productItem.id}`);
          console.log('Resposta da remoção:', response);
          
          // Remover o item localmente enquanto aguarda fetchComanda
          setSelectedProducts(prev => prev.filter(p => p.id !== productId));
          
          // Atualizar a comanda para mostrar as mudanças
          await fetchComanda();
          
          toast.success('Produto removido com sucesso');
        } catch (error: any) {
          console.error('Erro específico na chamada API:', error);
          toast.error(`Erro ao chamar API: ${error?.message || 'Erro desconhecido'}`);
        }
      } else {
        console.log(`Nenhum item encontrado para o produto ID: ${productId}`);
        toast.error('Item de produto não encontrado na comanda');
      }
    } catch (error) {
      console.error('Erro ao remover produto da comanda:', error);
      toast.error('Não foi possível remover o produto da comanda');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para remover um serviço
  const handleRemoveService = async (serviceId: string, comanda_item_id?: string) => {
    try {
      console.log(`Iniciando remoção de serviço ID: ${serviceId}`, comanda_item_id ? `(Item ID: ${comanda_item_id})` : '');
      
      if (!comanda) {
        console.log('Nenhuma comanda encontrada, não é possível remover o serviço');
        return;
      }
      
      setIsLoading(true);
      
      // Se temos o ID do item diretamente, usamos ele sem precisar buscar
      if (comanda_item_id) {
        console.log(`Usando comanda_item_id direto: ${comanda_item_id}`);
        try {
          const response = await apiService.delete<any>(`/api/comanda-items/${comanda_item_id}`);
          console.log('Resposta da remoção:', response);
          
          // Remover o item localmente enquanto aguarda fetchComanda
          setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
          
          // Atualizar a comanda para mostrar as mudanças
          await fetchComanda();
          
          toast.success('Serviço removido com sucesso');
          return;
        } catch (error: any) {
          console.error('Erro específico na chamada API:', error);
          toast.error(`Erro ao chamar API: ${error?.message || 'Erro desconhecido'}`);
          setIsLoading(false);
          return;
        }
      }
      
      console.log('Comanda atual:', comanda);
      console.log('Itens da comanda:', comanda.items);
      
      // Verificar se comanda.items existe
      if (!comanda.items || !Array.isArray(comanda.items)) {
        console.error('Comanda não possui lista de itens válida');
        toast.error('Erro: Comanda não possui itens');
        setIsLoading(false);
        return;
      }
      
      // Buscar o item da comanda referente ao serviço
      // O item na comanda pode ter um service_id que corresponde ao ID do serviço OU
      // pode ter um serviço aninhado cujo ID corresponde ao ID do serviço
      const serviceItem = comanda.items.find(item => 
        item.service_id === serviceId || 
        (item.service && item.service.id === serviceId)
      );
      
      console.log('Item de serviço encontrado:', serviceItem);
      
      if (serviceItem && serviceItem.id) {
        console.log(`Removendo item ID: ${serviceItem.id} da comanda ID: ${comanda.id}`);
        try {
          const response = await apiService.delete<any>(`/api/comanda-items/${serviceItem.id}`);
          console.log('Resposta da remoção:', response);
          
          // Remover o item localmente enquanto aguarda fetchComanda
          setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
          
          // Atualizar a comanda para mostrar as mudanças
          await fetchComanda();
          
          toast.success('Serviço removido com sucesso');
        } catch (error: any) {
          console.error('Erro específico na chamada API:', error);
          toast.error(`Erro ao chamar API: ${error?.message || 'Erro desconhecido'}`);
        }
      } else {
        console.log(`Nenhum item encontrado para o serviço ID: ${serviceId}`);
        toast.error('Item de serviço não encontrado na comanda');
      }
    } catch (error) {
      console.error('Erro ao remover serviço da comanda:', error);
      toast.error('Não foi possível remover o serviço da comanda');
    } finally {
      setIsLoading(false);
    }
  };

  // Agrupar serviços por categoria
  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceViewModel[]>);
  
  // Agrupar produtos por categoria
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, ProductViewModel[]>);
  
  // Filtrar serviços pela busca
  const filteredServices = searchQuery.trim() 
    ? services.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : services;
  
  // Filtrar produtos pela busca
  const filteredProducts = productSearchQuery.trim() 
    ? products.filter(p => 
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(productSearchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(productSearchQuery.toLowerCase()))
      )
    : products;

  const formattedDate = format(new Date(appointment.start_time), "d 'de' MMMM", { locale: ptBR });
  const formattedTime = format(new Date(appointment.start_time), "HH:mm", { locale: ptBR });
  
  const clientStats = {
    createdAt: "10/01/2023",
    purchasedProducts: 8,
    completedServices: 12
  };
  
  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2) || 'J';
  };

  // Função para mapear os status da UI para os status da API
  const mapUIStatusToAPIStatus = (uiStatus: AppointmentStatus): AppointmentCompletionStatus => {
    switch (uiStatus) {
      case 'Reservado':
        return 'scheduled';
      case 'Confirmado':
        return 'confirmed';
      case 'Aguardando':
        return 'waiting';
      case 'Iniciado':
        return 'in_progress';
      case 'Ausência':
        return 'absent';
      case 'Cancelar':
        return 'canceled';
      default:
        return 'scheduled';
    }
  };

  const handleStatusChange = async (status: AppointmentStatus) => {
    if (!appointment?.id) return;
    
    // Obter o status atual do agendamento
    const currentApiStatus = appointment.status;
    
    // Mapear o novo status selecionado para o formato da API
    const newApiStatus = mapUIStatusToAPIStatus(status);

    // Se o status não mudar, apenas atualize o estado local e não chame a API
    if (currentApiStatus === newApiStatus) {
      setSelectedStatus(status);
      setIsStatusDropdownOpen(false);
      toast.success(`Status atual: ${status}`);
      return;
    }
    
    setIsLoading(true);
    setSelectedStatus(status);
    setIsStatusDropdownOpen(false);
    
    try {
      // Para status de cancelamento ou ausência, usamos a API específica
      if (newApiStatus === 'canceled' || newApiStatus === 'absent') {
        // Cancelar o agendamento
        await appointmentService.updateAppointment(appointment.id, {
          status: newApiStatus
        });
        toast.success(`Agendamento ${status === 'Ausência' ? 'marcado como ausente' : 'cancelado'} com sucesso`);
      } 
      else {
        // Para outros status, atualizamos o status diretamente
        await appointmentService.updateAppointment(appointment.id, {
          status: newApiStatus
        });
        
        // Mensagens específicas para cada status
        if (newApiStatus === 'in_progress') {
          toast.success(`Atendimento iniciado às ${new Date().toLocaleTimeString('pt-BR')}`);
        } else if (newApiStatus === 'waiting') {
          toast.success('Cliente marcado como aguardando');
        } else if (newApiStatus === 'confirmed') {
          toast.success('Agendamento confirmado com sucesso');
        } else {
          toast.success(`Status alterado para: ${status}`);
        }
      }
      
      // Atualizar o card do agendamento em tempo real
      // Isso depende de uma função de callback que deve ser passada do componente pai
      if (onStatusChange) {
        onStatusChange(appointment.id);
      }
      
    } catch (error) {
      console.error('Erro ao atualizar status do agendamento:', error);
      toast.error('Não foi possível atualizar o status do agendamento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = () => {
    // Em vez de processar o pagamento imediatamente, abrimos o modal de pagamento
    setIsPaymentModalOpen(true);
  };
  
  // Função para processar o pagamento final
  const handleFinalizePurchase = async (paymentMethod: string | number) => {
    try {
      setIsLoading(true);
      
      // Se existe comanda, finalizar com o método de pagamento escolhido
      if (comanda) {
        // Fechar a comanda apenas com o método de pagamento selecionado
        const response = await apiService.patch<any>(`/api/comandas/${comanda.id}/close`, {
          payment_method: paymentMethod
        });
        
        console.log('Resposta do fechamento da comanda:', response?.data);
        
        // Verificar se comissões foram calculadas
        if (response?.data?.total_commission > 0) {
          const servicosComissao = Number(response?.data?.total_services_commission) || 0;
          const produtosComissao = Number(response?.data?.total_products_commission) || 0;
          const totalComissao = Number(response?.data?.total_commission) || 0;
          
          toast.success(
            `Pagamento finalizado com sucesso! Comissões calculadas: R$ ${totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          );
        } else {
          // Tentar recalcular as comissões se estiverem zeradas
          try {
            const recalcResponse = await apiService.post<any>(`/api/comandas/${comanda.id}/recalculate-commission`);
            
            if (recalcResponse?.data?.total_commission > 0) {
              const novoTotalComissao = Number(recalcResponse?.data?.total_commission) || 0;
              
              toast.success(
                `Pagamento finalizado com sucesso! Comissões recalculadas: R$ ${novoTotalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              );
            } else {
              toast.success(`Pagamento finalizado com sucesso!`);
            }
          } catch (recalcError) {
            // Se não conseguir recalcular, apenas mostra a mensagem de sucesso
            toast.success(`Pagamento finalizado com sucesso!`);
          }
        }
      }
      
      // Marcar o agendamento como concluído
      await onCompleteCheckout(appointment!.id);
      
      // Fechar ambos os modais
      setIsPaymentModalOpen(false);
      onClose();
    } catch (error) {
      console.error('Erro ao processar o pagamento:', error);
      toast.error('Não foi possível processar o pagamento');
      setIsLoading(false);
    }
  };

  const clientInitials = getInitials(appointment.client?.name || 'Jack Doe');
  const clientName = appointment.client?.name || 'Jack Doe';
  const clientEmail = appointment.client?.email || 'jack@example.com';
  
  const getStatusButtonClass = () => {
    if (selectedStatus === 'Ausência' || selectedStatus === 'Cancelar') {
      return 'flex items-center justify-between px-4 py-2 bg-white text-red-600 border border-red-300 rounded-full min-w-32 hover:bg-red-50 transition-colors';
    }
    return 'flex items-center justify-between px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-full min-w-32 hover:bg-gray-50 transition-colors';
  };
  
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) {
      return 'R$ 0,00';
    }
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  const getPaymentMethodLabel = (method: string | undefined) => {
    if (!method) return '-';
    
    const methodsMap: { [key: string]: string } = {
      'credit_card': 'Cartão de Crédito',
      'debit_card': 'Cartão de Débito',
      'cash': 'Dinheiro',
      'pix': 'PIX',
      'bank_transfer': 'Transferência Bancária',
      'other': 'Outro'
    };
    
    return methodsMap[method] || method;
  };

  return (
    <>
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? 'visible' : 'invisible'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}></div>
        
        {/* Modo Detalhes da Comanda (quando comanda está fechada) */}
        {isComandaFechada ? (
          <div className="relative w-[95%] md:w-[80%] lg:w-[70%] max-w-4xl max-h-[95vh] md:max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
            {/* Cabeçalho com ID da comanda e data */}
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center">
                <button 
                  onClick={onClose}
                  className="mr-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div>
                  <div className="flex items-center">
                    <Receipt className="mr-2 text-gray-700" size={20} />
                    <h2 className="text-xl font-bold">Comanda #{comanda?.id?.substring(0, 8) || 'N/A'}</h2>
                    <div className="ml-3 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      Fechada
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {comanda?.created_at ? format(new Date(comanda.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => window.print()}
                className="bg-gray-100 hover:bg-gray-200 p-2 rounded-lg flex items-center text-sm font-medium transition-colors"
              >
                <Printer size={18} className="mr-1" />
                Imprimir
              </button>
            </div>
            
            {/* Corpo do modal com informações da comanda */}
            <div className="flex flex-col md:flex-row h-full overflow-hidden">
              {/* Coluna principal com detalhes e itens */}
              <div className="flex-grow p-5 overflow-y-auto">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Detalhes da Comanda</h3>
                  
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    {/* Total em destaque */}
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-gray-600">Total</span>
                      <span className="text-2xl font-bold">
                        R$ {comanda?.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {/* Informações do cliente e profissional */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <div className="flex items-center mb-1">
                          <User size={16} className="mr-2 text-gray-500" />
                          <span className="text-gray-600">Cliente</span>
                        </div>
                        <h4 className="font-medium text-lg">{appointment.client?.name || 'N/A'}</h4>
                        <p className="text-gray-500 text-sm">{appointment.client?.email || 'N/A'}</p>
                        <p className="text-gray-500 text-sm">{appointment.client?.phone || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <div className="flex items-center mb-1">
                          <Scissors size={16} className="mr-2 text-gray-500" />
                          <span className="text-gray-600">Profissional</span>
                        </div>
                        <h4 className="font-medium text-lg">{appointment.employee?.name || 'N/A'}</h4>
                      </div>
                    </div>
                    
                    {/* Data e forma de pagamento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center mb-1">
                          <Calendar size={16} className="mr-2 text-gray-500" />
                          <span className="text-gray-600">Data e horário</span>
                        </div>
                        <p className="font-medium">
                          {appointment.start_time 
                            ? format(new Date(appointment.start_time), 'dd/MM/yyyy HH:mm') 
                            : '-'}
                        </p>
                      </div>
                      
                      <div>
                        <div className="flex items-center mb-1">
                          <CreditCard size={16} className="mr-2 text-gray-500" />
                          <span className="text-gray-600">Forma de pagamento</span>
                        </div>
                        <p className="font-medium">
                          {getPaymentMethodLabel(comanda?.payment_method || '')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Abas para itens e comissões */}
                <Tabs defaultValue="items" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="items">Itens da comanda</TabsTrigger>
                    <TabsTrigger value="comissoes">Comissões</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="items" className="space-y-6">
                    {/* Serviços */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Serviços</h3>
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                              <th className="px-4 py-3 text-left">Serviço</th>
                              <th className="px-4 py-3 text-center">QTD</th>
                              <th className="px-4 py-3 text-right">Valor Unitário</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedServices.map((service, index) => (
                              <tr key={`service-${service.id || index}`} className="text-sm">
                                <td className="px-4 py-3">
                                  <span className="font-medium">{service.name}</span>
                                </td>
                                <td className="px-4 py-3 text-center">1</td>
                                <td className="px-4 py-3 text-right">
                                  R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                  R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-medium">
                              <td colSpan={3} className="px-4 py-3 text-right">Subtotal Serviços</td>
                              <td className="px-4 py-3 text-right">
                                R$ {servicePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Produtos */}
                    {selectedProducts.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Produtos</h3>
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                                <th className="px-4 py-3 text-left">Produto</th>
                                <th className="px-4 py-3 text-center">QTD</th>
                                <th className="px-4 py-3 text-right">Valor Unitário</th>
                                <th className="px-4 py-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {selectedProducts.map((product, index) => (
                                <tr key={`product-${product.id || index}`} className="text-sm">
                                  <td className="px-4 py-3">
                                    <span className="font-medium">{product.name}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">1</td>
                                  <td className="px-4 py-3 text-right">
                                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium">
                                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-medium">
                                <td colSpan={3} className="px-4 py-3 text-right">Subtotal Produtos</td>
                                <td className="px-4 py-3 text-right">
                                  R$ {productPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="comissoes">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Comissões</h3>
                      <div className="bg-white rounded-lg border border-gray-200 p-5">
                        <div className="flex items-center mb-4">
                          <div className="bg-green-100 p-2 rounded-full mr-3">
                            <Percent size={18} className="text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Total de comissões</h4>
                            <p className="text-green-600 font-medium text-xl">
                              R$ {(comanda?.total_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Comissão de serviços</p>
                            <p className="font-medium">
                              R$ {(comanda?.total_services_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Comissão de produtos</p>
                            <p className="font-medium">
                              R$ {(comanda?.total_products_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Coluna lateral com resumo */}
              <div className="hidden md:block w-[300px] border-l border-gray-200 bg-gray-50 p-5 overflow-y-auto">
                <div className="sticky top-0">
                  <h3 className="text-lg font-semibold mb-4">Resumo</h3>
                  
                  <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Subtotal Serviços</span>
                      <span className="font-medium">
                        R$ {servicePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    <div className="flex justify-between mb-4">
                      <span className="text-gray-600">Subtotal Produtos</span>
                      <span className="font-medium">
                        R$ {productPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-3 flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold">
                        R$ {comanda?.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <Coins size={16} className="text-green-500 mr-2" />
                      <span className="text-green-700 font-medium">Total de comissões</span>
                    </div>
                    <span className="text-green-600 font-bold text-xl block text-right">
                      R$ {(comanda?.total_commission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (

        <div className="relative w-[95%] md:w-[80%] lg:w-[70%] max-w-4xl max-h-[95vh] md:max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col">
          {/* Botão de fechar refinado */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X size={18} className="text-gray-600" />
          </button>

          {/* Cabeçalho redesenhado - perfeitamente organizado */}
          <div className="w-full bg-gradient-to-r from-gray-50 to-white p-5 border-b border-gray-200">
            <div className="flex flex-col items-center md:items-start">
              {/* Informações do cliente - centralizadas em mobile, à esquerda em desktop */}
              <div className="flex items-center justify-center md:justify-start w-full">
                <div className="bg-[#f0e7ff] rounded-full w-14 h-14 flex items-center justify-center shadow-sm border-2 border-[#e4d5ff]">
                  <span className="text-[#7950ed] text-lg font-semibold">{clientInitials}</span>
                </div>
                
                <div className="ml-3 flex flex-col items-center md:items-start">
                  <h2 className="text-xl font-bold text-gray-800">{clientName}</h2>
                  <p className="text-gray-500 text-sm">{clientEmail}</p>
                </div>
              </div>
              
              {/* Data, hora e status - perfeitamente centralizado */}
              <div className="flex items-center justify-center md:justify-start mt-4 space-x-3">
                <div className="flex items-center bg-gray-100 rounded-lg px-3 py-1.5">
                  <Calendar size={14} className="text-gray-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">{formattedDate}</span>
                </div>
                <div className="flex items-center bg-gray-100 rounded-lg px-3 py-1.5">
                  <Clock size={14} className="text-gray-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">{formattedTime}</span>
                </div>

                {/* Status com design aprimorado - apenas mostrar se comanda não estiver fechada */}
                {!isComandaFechada && (
                  <div className="relative status-dropdown inline-block" ref={dropdownRef}>
                    <button 
                      className={`${
                        selectedStatus === 'Ausência' || selectedStatus === 'Cancelar'
                          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                      } flex items-center justify-between py-1.5 px-3 border rounded-lg text-sm font-medium shadow-sm transition duration-200`}
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    >
                      <div className="flex items-center">
                        {statusOptions.find(opt => opt.value === selectedStatus)?.icon && 
                         cloneElement(statusOptions.find(opt => opt.value === selectedStatus)?.icon as React.ReactElement, { size: 14 })}
                        <span className="ml-1.5">{selectedStatus}</span>
                      </div>
                      <ChevronDown size={14} className={`ml-2 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isStatusDropdownOpen && (
                      <div className="status-dropdown-menu absolute right-0 md:left-0 w-[140px] mt-1 overflow-hidden rounded-lg shadow-xl border border-gray-200 bg-white z-10 animate-fadeIn">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            className={`flex items-center w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition duration-150
                              ${selectedStatus === option.value ? 'bg-gray-50 font-medium' : 'font-normal'}
                              ${option.isDanger ? 'text-red-600' : 'text-gray-700'}`}
                            onClick={() => handleStatusChange(option.value)}
                          >
                            {option.icon && cloneElement(option.icon as React.ReactElement, { size: 14 })}
                            <span className="ml-2">{option.label}</span>
                            {selectedStatus === option.value && (
                              <Check size={14} className="ml-auto text-green-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Indicador de comanda fechada */}
                {isComandaFechada && (
                  <div className="bg-blue-100 text-blue-600 py-1.5 px-3 rounded-lg flex items-center">
                    <Check size={14} className="mr-1" />
                    <span className="text-sm font-medium">Comanda Fechada</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Conteúdo principal reestruturado */}
          <div className="w-full flex-grow overflow-hidden flex flex-col md:flex-row">
            {/* Conteúdo principal com área de rolagem */}
            <div className="flex-grow overflow-y-auto p-5 md:p-6 md:pr-4">
              {/* Serviços */}
              <div className="mb-6 md:mb-8">
                <h3 className="text-xl md:text-2xl font-bold mb-4 flex items-center">
                  <Scissors className="mr-3 text-gray-700" size={24} />
                  Serviços
                </h3>
                
                {/* Lista de serviços selecionados - em cards */}
                <div className="space-y-3">
                  {selectedServices.map((service, index) => (
                    <div 
                      key={`service-${service.id || index}`} 
                      className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                      <div className="flex justify-between items-center p-3">
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="text-lg font-semibold text-gray-800">
                            {service.name}
                          </h4>
                          <div className="flex items-center text-gray-500 text-sm">
                            <Clock size={14} className="mr-1.5 flex-shrink-0" />
                            <span>{service.duration} min</span>
                            <span className="mx-2">•</span>
                            <span className="truncate">{appointment?.employee?.name || 'Profissional'}</span>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="text-lg font-bold text-gray-900 whitespace-nowrap">
                            R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          {selectedServices.length > 1 && !isComandaFechada && (
                            <button 
                              onClick={() => {
                                console.log("Clicou para remover serviço:", service);
                                handleRemoveService(service.id, service.comanda_item_id);
                              }}
                              className="ml-3 md:ml-4 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                              title="Remover serviço"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Indicador de serviço */}
                      <div className="h-1.5 w-full bg-gray-400"></div>
                    </div>
                  ))}
                </div>
                
                {/* Botão de adicionar serviço - apenas se comanda não estiver fechada */}
                {!isComandaFechada && (
                  <div className="mt-3">
                    <button 
                      className="flex items-center text-gray-700 bg-white border border-gray-300 rounded-full py-2 px-4 hover:bg-gray-50 hover:border-gray-400 transition-colors text-base shadow-sm"
                      onClick={() => setIsServicesListOpen(true)}
                    >
                      <Plus size={18} className="mr-2" />
                      <span>Adicionar serviço</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Produtos */}
              <div>
                <h3 className="text-xl md:text-2xl font-bold mb-4 flex items-center">
                  <ShoppingBag className="mr-3 text-gray-700" size={24} />
                  Produtos
                </h3>
                
                {/* Lista de produtos selecionados - em cards */}
                {selectedProducts.length === 0 ? (
                  <div className="bg-white border border-dashed border-gray-300 rounded-xl py-6 mb-3 flex flex-col items-center justify-center">
                    <ShoppingBag className="mb-2 text-gray-300" size={32} />
                    <p className="text-base text-gray-400 font-medium">Nenhum produto adicionado</p>
                    <p className="text-sm text-gray-400 mt-1">Adicione produtos para complementar o serviço</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-3">
                    {selectedProducts.map((product) => (
                      <div 
                        key={`product-${product.id || Math.random().toString()}`} 
                        className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                      >
                        <div className="flex justify-between items-center p-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <h4 className="text-lg font-semibold text-gray-800">
                              {product.name}
                            </h4>
                            {product.description && (
                              <div className="text-gray-500 text-sm line-clamp-1">
                                {product.description}
                              </div>
                            )}
                            {product.quantity_in_stock !== undefined && product.quantity_in_stock !== null && (
                              <div className="flex items-center">
                                <div className={`w-2 h-2 rounded-full mr-1.5 ${
                                  product.quantity_in_stock > 5 
                                    ? 'bg-green-500' 
                                    : product.quantity_in_stock > 0 
                                      ? 'bg-yellow-500' 
                                      : 'bg-red-500'
                                }`}></div>
                                <span className="text-xs text-gray-500">Estoque: {product.quantity_in_stock}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center">
                            <div className="text-lg font-bold text-gray-900 whitespace-nowrap">
                              R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {!isComandaFechada && (
                              <button 
                                onClick={() => {
                                  console.log("Clicou para remover produto:", product);
                                  handleRemoveProduct(product.id, product.comanda_item_id);
                                }}
                                className="ml-3 md:ml-4 text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                                title="Remover produto"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Indicador de produto */}
                        <div className="h-1.5 w-full bg-green-400"></div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Botão de adicionar produto - apenas se comanda não estiver fechada */}
                {!isComandaFechada && (
                  <div>
                    <button 
                      className="flex items-center text-gray-700 bg-white border border-gray-300 rounded-full py-2 px-4 hover:bg-gray-50 hover:border-gray-400 transition-colors text-base shadow-sm"
                      onClick={() => setIsProductsListOpen(true)}
                    >
                      <Plus size={18} className="mr-2" />
                      <span>Adicionar produto</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Resumo lateral (apenas em desktop) */}
            <div className="hidden md:block w-[350px] bg-gray-50 border-l border-gray-200 p-6 overflow-y-auto">
              <div className="sticky top-0">
                <h3 className="text-xl font-bold mb-4">Resumo do agendamento</h3>
                
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                  <div className="flex items-center mb-3">
                    <Calendar size={18} className="text-gray-500 mr-2" />
                    <span className="text-base font-medium">{formattedDate} às {formattedTime}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-[#f4f0ff] rounded-full flex items-center justify-center mr-2">
                      <span className="text-[#7950ed] text-sm font-medium">{clientInitials}</span>
                    </div>
                    <span className="text-base font-medium">{clientName}</span>
                  </div>
                  
                  {/* Status da comanda */}
                  {comanda && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <ShoppingBag size={16} className="text-blue-500 mr-2" />
                          <span className="text-sm font-medium">Comanda</span>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                          comanda.status === 'aberta' ? 'bg-green-100 text-green-600' :
                          comanda.status === 'fechada' ? 'bg-blue-100 text-blue-600' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {comanda.status}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Comanda #{comanda.id.split('-')[0]}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <h4 className="text-base font-semibold mb-2 text-gray-700">Itens</h4>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                    {selectedServices.map((service, index) => (
                      <div key={`service-summary-${service.id || `temp-${index}`}`} className="flex justify-between items-center p-3">
                        <div className="flex items-center">
                          <Scissors size={14} className="text-gray-400 mr-2" />
                          <span className="text-sm font-medium">{service.name}</span>
                        </div>
                        <span className="text-sm font-semibold">R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    
                    {selectedProducts.map((product, index) => (
                      <div key={`product-summary-${product.id || `temp-${index}`}`} className="flex justify-between items-center p-3">
                        <div className="flex items-center">
                          <ShoppingBag size={14} className="text-gray-400 mr-2" />
                          <span className="text-sm font-medium">{product.name}</span>
                        </div>
                        <span className="text-sm font-semibold">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                  {/* Subtotais e Total em uma estrutura mais robusta */}
                  <div className="space-y-2">
                    {/* Subtotal de serviços */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Subtotal serviços</span>
                      <span className="font-medium text-sm tabular-nums">
                        R$ {servicePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {/* Subtotal de produtos */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Subtotal produtos</span>
                      <span className="font-medium text-sm tabular-nums">
                        R$ {productPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {/* Desconto - apenas se presente na comanda */}
                    { (comanda?.discount ?? 0) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-green-600 text-sm">Desconto</span>
                        <span className="font-medium text-sm text-green-600 tabular-nums">
                          - R$ {(comanda?.discount ?? 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    ) }
                  </div>
                  
                  {/* Total em uma linha separada com borda superior */}
                  <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
                    <span className="text-gray-900 font-bold text-lg">Total</span>
                    <span className="text-gray-900 font-bold text-lg tabular-nums">
                      R$ {(comanda?.total || totalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                
                {/* Botão de checkout ou reabrir comanda */}
                {isComandaFechada ? (
                  <button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-5 rounded-xl text-center transition-colors text-base md:text-lg font-semibold shadow-md flex items-center justify-center"
                    onClick={handleReopenComanda}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span>Processando...</span>
                    ) : (
                      <span>Reabrir comanda</span>
                    )}
                  </button>
                ) : (
                  <button 
                    className="w-full bg-gray-900 hover:bg-black text-white py-3 px-5 rounded-xl text-center transition-colors text-base md:text-lg font-semibold shadow-md flex items-center justify-center"
                    onClick={handleCheckout}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span>Processando...</span>
                    ) : (
                      <>
                        <span>Continuar com checkout</span>
                        <ArrowRight size={20} className="ml-2" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Rodapé com total e botões de ação (visível apenas em mobile) */}
          <div className="md:hidden border-t border-gray-200 bg-white p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Total do carrinho</h3>
              <span className="text-xl font-bold">R$ {comanda?.total ? comanda.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : totalPrice.toFixed(2).replace('.', ',')}</span>
            </div>
            
            <div className="flex justify-between">
              {!isComandaFechada && (
                <button className="p-3 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors">
                  <MoreVertical size={20} />
                </button>
              )}
              
              {/* Botão de checkout ou reabrir comanda para mobile */}
              {isComandaFechada ? (
                <button 
                  className="flex-grow ml-3 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl text-center transition-colors text-base font-semibold shadow-md flex items-center justify-center"
                  onClick={handleReopenComanda}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processando...' : 'Reabrir comanda'}
                </button>
              ) : (
                <button 
                  className="flex-grow ml-3 bg-gray-900 hover:bg-black text-white py-3 px-4 rounded-xl text-center transition-colors text-base font-semibold shadow-md flex items-center justify-center"
                  onClick={handleCheckout}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processando...' : 'Continuar com checkout'}
                  <ArrowRight size={18} className="ml-2" />
                </button>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
      
      {/* Modais - apenas mostrar se comanda não estiver fechada */}
      {!isComandaFechada && (
        <>
          <PaymentModal 
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            services={selectedServices}
            totalServiceAmount={servicePrice}
            products={selectedProducts}
            totalProductAmount={productPrice}
            onFinalizePurchase={handleFinalizePurchase}
          />
          
          <ServiceSelectorModal 
            isOpen={isServicesListOpen}
            onClose={() => setIsServicesListOpen(false)}
            services={services}
            isLoading={servicesLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedServices={selectedServices}
            onSelectService={handleSelectService}
          />
          
          <ProductSelectorModal 
            isOpen={isProductsListOpen}
            onClose={() => setIsProductsListOpen(false)}
            products={products}
            isLoading={productsLoading}
            searchQuery={productSearchQuery}
            onSearchChange={setProductSearchQuery}
            selectedProducts={selectedProducts}
            onSelectProduct={handleSelectProduct}
          />
        </>
      )}
    </>
  );
};

export default CheckoutModal; 