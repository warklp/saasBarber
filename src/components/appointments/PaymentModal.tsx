'use client';

import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  QrCode, 
  Wallet, 
  Banknote, 
  X, 
  Coins,
  Gift,
  SplitSquareVertical,
  DollarSign,
  ArrowLeft,
  CircleOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '@/lib/api/apiService';

// Interface para o método de pagamento vindo da API
interface PaymentMethodType {
  id: string | number;
  name: string;
  fee_percentage: number;
  description?: string;
  is_default?: boolean;
  is_active: boolean;
  icon_name?: string;
  type?: string; // Tipo do método de pagamento conforme ENUM do banco
  created_at?: string;
  updated_at?: string;
  created_by?: string | number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: any[];
  totalServiceAmount: number;
  products?: any[];
  totalProductAmount?: number;
  onFinalizePurchase: (paymentMethod: string | number) => Promise<void>;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  services,
  totalServiceAmount,
  products = [],
  totalProductAmount = 0,
  onFinalizePurchase
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  
  // Total geral (serviços + produtos)
  const totalAmount = totalServiceAmount + totalProductAmount;

  // Buscar métodos de pagamento da API
  useEffect(() => {
    if (isOpen) {
      fetchPaymentMethods();
    }
  }, [isOpen]);

  // Função para mapear o método de pagamento para o tipo esperado pelo banco
  const mapPaymentMethodToEnum = (method: PaymentMethodType) => {
    // Se o método já tem um 'type' definido, usar ele
    if (method.type && ['cash', 'credit_card', 'debit_card', 'pix'].includes(method.type)) {
      return method.type;
    }
    
    // Fazer o mapeamento baseado no nome ou ícone do método
    const nameOrIcon = (method.name || method.icon_name || '').toLowerCase();
    
    if (nameOrIcon.includes('cash') || nameOrIcon.includes('dinheiro')) {
      return 'cash';
    }
    if (nameOrIcon.includes('credit') || nameOrIcon.includes('crédito')) {
      return 'credit_card';
    }
    if (nameOrIcon.includes('debit') || nameOrIcon.includes('débito')) {
      return 'debit_card';
    }
    if (nameOrIcon.includes('pix')) {
      return 'pix';
    }
    
    // Valor padrão para caso não consiga identificar
    return 'cash';
  };

  const fetchPaymentMethods = async () => {
    try {
      setIsLoadingMethods(true);
      const response = await apiService.get('/api/payment-methods');
      if (response.success && response.data) {
        // Adicionar o campo type mapeado
        const methodsWithTypes = response.data
          .filter((method: PaymentMethodType) => method.is_active)
          .map((method: PaymentMethodType) => ({
            ...method,
            type: mapPaymentMethodToEnum(method)
          }));
        
        setPaymentMethods(methodsWithTypes);
        
        // Se houver um método padrão, selecione-o automaticamente
        const defaultMethod = methodsWithTypes.find((method: PaymentMethodType) => method.is_default);
        if (defaultMethod) {
          setSelectedPaymentMethod(defaultMethod);
        }
      } else {
        console.error('Falha ao buscar métodos de pagamento:', response.error);
        toast.error('Não foi possível carregar os métodos de pagamento');
      }
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento:', error);
      toast.error('Erro ao carregar métodos de pagamento');
    } finally {
      setIsLoadingMethods(false);
    }
  };

  const handleFinalizePurchase = async () => {
    if (!selectedPaymentMethod) {
      toast.error('Selecione um método de pagamento');
      return;
    }

    try {
      setIsLoading(true);
      // Usar o type (valor do ENUM) em vez do ID
      await onFinalizePurchase(selectedPaymentMethod.type || 'cash');
      toast.success('Pagamento finalizado com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao finalizar compra:', error);
      toast.error('Não foi possível processar o pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para obter o ícone adequado com base no nome do ícone
  const getIconForPaymentMethod = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'credit':
      case 'creditcard':
        return <CreditCard size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
      case 'pix':
      case 'qrcode':
        return <QrCode size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
      case 'cash':
      case 'money':
      case 'dinheiro':
        return <DollarSign size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
      case 'gift':
      case 'present':
        return <Gift size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
      case 'split':
        return <SplitSquareVertical size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
      case 'wallet':
      case 'carteira':
        return <Wallet size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
      case 'debit':
      case 'bank':
        return <Banknote size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
      default:
        return <Coins size={20} className="mb-1 md:mb-2 text-gray-700 md:h-6 md:w-6" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal container - responsivo para mobile e desktop */}
      <div className="relative w-[95%] md:w-[80%] lg:w-[70%] max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden z-10 flex flex-col">
        {/* Botão de fechar */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1 md:p-1.5 bg-white rounded-full hover:bg-gray-50 transition-colors"
          aria-label="Fechar"
        >
          <X size={16} className="text-gray-500 md:h-5 md:w-5" />
        </button>
        
        {/* Cabeçalho */}
        <div className="p-4 md:p-5 border-b border-gray-200">
          <h2 className="text-lg md:text-xl font-medium">Selecione o pagamento</h2>
        </div>
        
        {/* Conteúdo principal - layout flexível para desktop */}
        <div className="flex-grow overflow-auto flex flex-col md:flex-row">
          {/* Métodos de pagamento */}
          <div className="md:w-1/2 p-3 md:p-5 md:border-r border-gray-200">
            {isLoadingMethods ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : paymentMethods.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-3">
                {paymentMethods.map((method) => (
                  <button 
                    key={method.id}
                    className={`flex flex-col items-center justify-center p-3 md:p-4 border rounded-lg ${
                      selectedPaymentMethod?.id === method.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPaymentMethod(method)}
                  >
                    {getIconForPaymentMethod(method.icon_name)}
                    <span className="text-xs md:text-sm font-medium text-center truncate w-full">{method.name}</span>
                    {method.fee_percentage > 0 && (
                      <span className="text-xs text-gray-500 mt-1">+{method.fee_percentage}%</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                <CircleOff size={28} className="mb-2" />
                <p>Nenhum método de pagamento disponível</p>
              </div>
            )}
          </div>
          
          {/* Resumo - layout adaptável */}
          <div className="md:w-1/2 p-3 md:p-5 border-t md:border-t-0 border-gray-200 md:bg-gray-50">
            <h3 className="text-base md:text-lg font-medium mb-3 md:mb-4">Resumo</h3>
            
            {/* Serviços */}
            {services.length > 0 && (
              <div className="mb-3 md:mb-4">
                <h4 className="text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2 flex justify-between items-center">
                  <span>Serviços</span>
                  <span className="text-xs text-gray-500">{services.length} item(s)</span>
                </h4>
                
                <div className="bg-white md:p-3 md:rounded-lg md:border border-gray-100">
                  {services.map((service, index) => (
                    <div key={index} className="flex justify-between items-center py-1 md:py-1.5 text-sm md:text-base">
                      <span className="truncate max-w-[180px] md:max-w-[250px]">{service.name || 'Serviço'}</span>
                      <span className="font-medium">R$ {(service.price || 0).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                  
                  <div className="flex justify-between items-center pt-1 md:pt-2 md:mt-2 text-sm md:text-base font-medium md:border-t border-gray-100">
                    <span>Total serviços</span>
                    <span>R$ {totalServiceAmount.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Produtos */}
            {products.length > 0 && (
              <div className="mb-3 md:mb-4">
                <h4 className="text-sm md:text-base font-medium text-gray-700 mb-1 md:mb-2 flex justify-between items-center">
                  <span>Produtos</span>
                  <span className="text-xs text-gray-500">{products.length} item(s)</span>
                </h4>
                
                <div className="bg-white md:p-3 md:rounded-lg md:border border-gray-100">
                  {products.map((product, index) => (
                    <div key={index} className="flex justify-between items-center py-1 md:py-1.5 text-sm md:text-base">
                      <span className="truncate max-w-[180px] md:max-w-[250px]">{product.name}</span>
                      <span className="font-medium">R$ {((product.sale_price || product.price || 0)).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                  
                  <div className="flex justify-between items-center pt-1 md:pt-2 md:mt-2 text-sm md:text-base font-medium md:border-t border-gray-100">
                    <span>Total produtos</span>
                    <span>R$ {totalProductAmount.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Total geral */}
            <div className="pt-2 border-t border-gray-200 md:bg-white md:p-3 md:rounded-lg md:border md:mt-2">
              <div className="flex justify-between items-center py-1 md:py-1.5 text-sm md:text-base">
                <span className="text-gray-600">Subtotal</span>
                <span>R$ {totalAmount.toFixed(2).replace('.', ',')}</span>
              </div>
              
              <div className="flex justify-between items-center pt-1 md:pt-2 font-medium md:mt-1 md:border-t border-gray-100">
                <span className="md:text-lg">Total a pagar</span>
                <span className="text-lg md:text-xl">
                  R$ {totalAmount.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Rodapé com botões */}
        <div className="p-3 md:p-5 border-t border-gray-200 flex items-center justify-between md:justify-end space-x-3 md:space-x-4">
          <button 
            className="flex-1 md:flex-initial py-2.5 md:py-3 md:px-6 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm md:text-base"
            onClick={onClose}
          >
            Voltar
          </button>
          
          <button
            className="flex-1 md:flex-initial py-2.5 md:py-3 md:px-6 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed text-sm md:text-base"
            onClick={handleFinalizePurchase}
            disabled={isLoading || !selectedPaymentMethod}
          >
            {isLoading ? 'Processando...' : 'Pagar agora'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal; 