'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Calendar, CreditCard, Users, FileText, Globe, Wallet, Pencil, Trash2, Plus, Loader2, Star, Check, AlertCircle, ArrowLeft, Receipt } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { apiService } from '@/lib/api/apiService';
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

// Interface para os métodos de pagamento
interface PaymentMethod {
  id: string;
  name: string;
  fee_percentage: number;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  icon_name: string | null;
  created_at: string;
  updated_at: string | null;
}

// Interface para o formulário
interface PaymentMethodForm {
  name: string;
  fee_percentage: number;
  description: string;
  is_default: boolean;
  is_active: boolean;
  icon_name: string;
}

const defaultFormValues: PaymentMethodForm = {
  name: '',
  fee_percentage: 0,
  description: '',
  is_default: false,
  is_active: true,
  icon_name: 'credit-card',
};

// Ícones disponíveis para métodos de pagamento
const availableIcons = [
  { name: 'credit-card', label: 'Cartão de Crédito' },
  { name: 'card-account-details', label: 'Cartão de Débito' },
  { name: 'cash', label: 'Dinheiro' },
  { name: 'currency-dollar', label: 'Dinheiro (Dólar)' },
  { name: 'currency-brl', label: 'Dinheiro (Real)' },
  { name: 'qrcode', label: 'QR Code' },
  { name: 'barcode', label: 'Código de Barras' },
  { name: 'bank', label: 'Banco' },
  { name: 'wallet', label: 'Carteira' },
  { name: 'gift', label: 'Vale-Presente' },
];

const configMenuItems = [
  {
    label: "Configurações",
    description: "Configurações gerais",
    href: "/configuracoes"
  },
  {
    label: "Presença online",
    description: "Configure sua presença online",
    href: "/configuracoes/presenca"
  },
  {
    label: "Marketing",
    description: "Configure suas campanhas",
    href: "/configuracoes/marketing"
  }
];

const configSections = [
  {
    id: "empresa",
    icon: Building2,
    title: "Configuração da empresa",
    description: "Personalize os dados da empresa, gerencie unidades e fontes de indicação de clientes."
  },
  {
    id: "agendamento",
    icon: Calendar,
    title: "Agendamento",
    description: "Defina suas disponibilidades, gerencie recursos para reserva e preferências para agendamento online."
  },
  {
    id: "vendas",
    icon: CreditCard,
    title: "Vendas",
    description: "Configure formas de pagamento, impostos, recibos, taxas de serviço e vale-presente."
  },
  {
    id: "metodos-pagamento",
    icon: Wallet,
    title: "Métodos de Pagamento",
    description: "Gerencie os métodos de pagamento, taxas e definições padrão para recebimentos."
  },
  {
    id: "comandas",
    icon: Receipt,
    title: "Comandas",
    description: "Visualize o resumo de comandas, valores de comissões e formas de pagamento."
  },
  {
    id: "formularios",
    icon: FileText,
    title: "Formulários",
    description: "Configure os modelos para formulários do cliente."
  },
  {
    id: "presenca-online",
    icon: Globe,
    title: "Presença online",
    description: "Configure sua presença online e integrações com redes sociais."
  }
];

export default function ConfiguracoesPage() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const router = useRouter();

  // Estados para métodos de pagamento
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<PaymentMethodForm>(defaultFormValues);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar os métodos de pagamento quando necessário
  const fetchPaymentMethods = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.get('/api/payment-methods');
      if (response.success) {
        setPaymentMethods(response.data);
      } else {
        toast.error('Erro ao carregar métodos de pagamento: ' + response.error);
      }
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento:', error);
      toast.error('Erro ao carregar métodos de pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar métodos de pagamento quando a seção for selecionada
  useEffect(() => {
    if (selectedSection === 'metodos-pagamento') {
      fetchPaymentMethods();
    }
  }, [selectedSection]);

  // Filtrar métodos de pagamento pela busca
  const filteredMethods = paymentMethods.filter(method => 
    method.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (method.description && method.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Função para selecionar uma seção
  const handleSectionClick = (section: typeof configSections[0]) => {
    // Redirecionar para as páginas específicas em vez de apenas mudar o estado
    if (section.id === 'comandas') {
      router.push('/configuracoes/comandas');
    } else if (section.id === 'presenca-online') {
      router.push('/configuracoes/presenca-online');
    } else if (section.id === 'agendamento') {
      router.push('/configuracoes/agendamento');
    } else {
      // Para outras seções, continuamos usando o comportamento atual de mostrar na mesma página
      setSelectedSection(section.id);
    }
  };

  // Voltar à lista de seções
  const handleBackToSections = () => {
    setSelectedSection(null);
    setSearchTerm('');
  };

  // Abrir modal para adicionar novo método
  const handleAdd = () => {
    setFormData(defaultFormValues);
    setIsEditing(false);
    setCurrentId(null);
    setIsDialogOpen(true);
  };

  // Abrir modal para editar método
  const handleEdit = (method: PaymentMethod) => {
    setFormData({
      name: method.name,
      fee_percentage: method.fee_percentage,
      description: method.description || '',
      is_default: method.is_default,
      is_active: method.is_active,
      icon_name: method.icon_name || 'credit-card',
    });
    setIsEditing(true);
    setCurrentId(method.id);
    setIsDialogOpen(true);
  };

  // Abrir confirmação para excluir método
  const handleDeleteConfirm = (method: PaymentMethod) => {
    setMethodToDelete(method);
    setIsDeleteDialogOpen(true);
  };

  // Excluir método de pagamento
  const handleDelete = async () => {
    if (!methodToDelete) return;
    
    setIsSubmitting(true);
    try {
      const response = await apiService.delete(`/api/payment-methods/${methodToDelete.id}`);
      if (response.success) {
        toast.success('Método de pagamento excluído com sucesso');
        fetchPaymentMethods();
      } else {
        toast.error('Erro ao excluir método de pagamento: ' + response.error);
      }
    } catch (error) {
      console.error('Erro ao excluir método de pagamento:', error);
      toast.error('Erro ao excluir método de pagamento');
    } finally {
      setIsSubmitting(false);
      setIsDeleteDialogOpen(false);
      setMethodToDelete(null);
    }
  };

  // Lidar com mudanças no formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'fee_percentage') {
      // Limitar a 2 casas decimais e validar como número
      const numValue = parseFloat(parseFloat(value).toFixed(2));
      setFormData(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Lidar com mudanças em checkboxes e switches
  const handleBooleanChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let response;
      
      if (isEditing && currentId) {
        // Atualizar método existente
        response = await apiService.patch(`/api/payment-methods/${currentId}`, formData);
      } else {
        // Criar novo método
        response = await apiService.post('/api/payment-methods', formData);
      }

      if (response.success) {
        toast.success(
          isEditing 
            ? 'Método de pagamento atualizado com sucesso' 
            : 'Método de pagamento adicionado com sucesso'
        );
        fetchPaymentMethods();
        setIsDialogOpen(false);
      } else {
        toast.error(`Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar método de pagamento:', error);
      toast.error('Erro ao salvar método de pagamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Renderizar conteúdo dos métodos de pagamento
  const renderPaymentMethodsContent = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={handleBackToSections} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Métodos de Pagamento</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gerencie os métodos de pagamento aceitos e suas taxas
            </p>
          </div>
        </div>
        <Button onClick={handleAdd} className="md:w-auto w-full">
          <Plus className="mr-2 h-4 w-4" /> Adicionar método
        </Button>
      </div>

      <Card className="p-6">
        <div className="mb-6">
          <Input
            placeholder="Buscar método de pagamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-gray-500">Carregando métodos de pagamento...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Nome</TableHead>
                  <TableHead>Taxa (%)</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead className="w-[100px] text-center">Padrão</TableHead>
                  <TableHead className="w-[100px] text-center">Ativo</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMethods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm 
                        ? 'Nenhum método de pagamento encontrado para esta busca.' 
                        : 'Nenhum método de pagamento cadastrado.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMethods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">
                        {method.name}
                      </TableCell>
                      <TableCell>{method.fee_percentage.toFixed(2)}%</TableCell>
                      <TableCell className="hidden md:table-cell">{method.description || '-'}</TableCell>
                      <TableCell className="text-center">
                        {method.is_default ? (
                          <div className="flex justify-center">
                            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {method.is_active ? (
                          <div className="flex justify-center">
                            <Check className="h-5 w-5 text-green-500" />
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEdit(method)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteConfirm(method)}
                            disabled={method.is_default}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <PageContainer title="Configurações" menuItems={configMenuItems}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Configurações do ambiente de trabalho</h1>
            <p className="text-sm text-gray-500">Gerenciar configurações para Link.me</p>
          </div>
        </div>

        <Tabs defaultValue="configuracoes" className="space-y-6">
          <TabsList className="bg-white border-b border-gray-200 w-full justify-start rounded-none h-auto p-0 space-x-8">
            <TabsTrigger 
              value="configuracoes" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2"
            >
              Configurações
            </TabsTrigger>
            <TabsTrigger 
              value="presenca" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2"
            >
              Presença online
            </TabsTrigger>
            <TabsTrigger 
              value="marketing" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2"
            >
              Marketing
            </TabsTrigger>
            <TabsTrigger 
              value="outros" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2"
            >
              Outros
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configuracoes" className="mt-6">
            {selectedSection === 'metodos-pagamento' ? (
              renderPaymentMethodsContent()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {configSections.map((section) => (
                  <Card 
                    key={section.id} 
                    className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleSectionClick(section)}
                  >
                    <div className="space-y-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <section.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{section.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="presenca">
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-medium mb-4">Presença online</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium">Perfil no marketplace</h4>
                      <p className="text-sm text-gray-500 mt-1">Atraia novos clientes com agendamentos online.</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium">Reservar com o Google</h4>
                      <p className="text-sm text-gray-500 mt-1">Receba reservas online através da Pesquisa Google e no Google Maps.</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium">Reservar com o Facebook e Instagram</h4>
                      <p className="text-sm text-gray-500 mt-1">Receba reservas online através das suas redes sociais.</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="marketing">
            <Card className="p-6">
              <h3 className="text-lg font-medium">Marketing</h3>
              <p className="text-sm text-gray-500 mt-1">Configure suas campanhas de marketing.</p>
            </Card>
          </TabsContent>

          <TabsContent value="outros">
            <Card className="p-6">
              <h3 className="text-lg font-medium">Outras configurações</h3>
              <p className="text-sm text-gray-500 mt-1">Configurações adicionais do sistema.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal para adicionar/editar método de pagamento */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Método de Pagamento' : 'Novo Método de Pagamento'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                placeholder="Nome do método de pagamento"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fee_percentage">Taxa de serviço (%)</Label>
              <Input
                id="fee_percentage"
                name="fee_percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0.00"
                value={formData.fee_percentage}
                onChange={handleInputChange}
              />
              <p className="text-xs text-gray-500">
                Percentual cobrado pelo serviço de pagamento (ex: taxas de cartão)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                name="description"
                placeholder="Descrição (opcional)"
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="icon_name">Ícone</Label>
              <select
                id="icon_name"
                name="icon_name"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.icon_name}
                onChange={(e) => setFormData(prev => ({ ...prev, icon_name: e.target.value }))}
              >
                {availableIcons.map(icon => (
                  <option key={icon.name} value={icon.name}>
                    {icon.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleBooleanChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Ativo</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => handleBooleanChange('is_default', checked)}
              />
              <Label htmlFor="is_default">Método padrão</Label>
              <span className="inline-flex items-center relative group">
                <AlertCircle className="h-4 w-4 text-gray-400 cursor-help" />
                <span className="sr-only">Informação</span>
                <div className="absolute bottom-full mb-2 z-50 invisible group-hover:visible bg-black text-white text-xs rounded p-1 w-64">
                  Apenas um método pode ser definido como padrão. Ao marcar esta opção, qualquer outro método padrão será desmarcado.
                </div>
              </span>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir o método de pagamento "{methodToDelete?.name}"?
              <br /><br />
              Esta ação não poderá ser desfeita. Se este método estiver sendo usado em transações financeiras, a exclusão não será permitida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}