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

// Definição do tipo de produto
type Product = {
  id: string;
  name: string;
  description?: string;
  sale_price: number;
  cost_price: number;
  quantity_in_stock: number;
  min_stock_alert?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export default function ProdutosPage() {
  // Estado para controlar a abertura do modal
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // Estado para armazenar os produtos
  const [products, setProducts] = useState<Product[]>([]);
  // Estado para controlar o carregamento
  const [isLoading, setIsLoading] = useState(true);
  // Estado para o formulário
  const [formData, setFormData] = useState<Partial<Product>>({
    name: "",
    description: "",
    sale_price: 0,
    cost_price: 0,
    quantity_in_stock: 0,
    min_stock_alert: 5,
    is_active: true
  });
  // Estado para o envio do formulário
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Estado para controlar se estamos editando ou criando
  const [isEditing, setIsEditing] = useState(false);
  // Estado para controlar o diálogo de confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Estado para armazenar o produto a ser excluído
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  // Estado para controlar o carregamento da exclusão
  const [isDeleting, setIsDeleting] = useState(false);

  // Função para buscar os produtos da API
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      
      // Usando o serviço centralizado de API
      const response = await apiService.get<any>('/api/products', {
        debug: true,
        redirectOnUnauthorized: false
      });
      
      console.log('Produtos recebidos da API:', response);
      
      // Correção: Acessar os produtos dentro de response.data
      const apiProducts = response.data || [];
      
      if (!Array.isArray(apiProducts)) {
        console.error('API retornou dados inválidos:', response);
        setProducts([]);
        return;
      }
      
      // Mapear os produtos da API para o formato usado na interface
      const mappedProducts: Product[] = [];
      
      for (const product of apiProducts) {
        if (!product) continue;
        
        console.log('Mapeando produto da API:', product);
        
        mappedProducts.push({
          id: product.id || '',
          name: product.name || '',
          description: product.description || '',
          sale_price: typeof product.sale_price === 'number' ? product.sale_price : 0,
          cost_price: typeof product.cost_price === 'number' ? product.cost_price : 0,
          quantity_in_stock: typeof product.quantity_in_stock === 'number' ? product.quantity_in_stock : 0,
          min_stock_alert: typeof product.min_stock_alert === 'number' ? product.min_stock_alert : 0,
          is_active: !!product.is_active,
          created_at: product.created_at || '',
          updated_at: product.updated_at || ''
        });
      }
      
      console.log('Produtos mapeados:', mappedProducts);
      
      setProducts(mappedProducts);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar produtos quando o componente montar
  useEffect(() => {
    fetchProducts();
  }, []);

  // Função para lidar com mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "sale_price" || name === "cost_price" || name === "quantity_in_stock" || name === "min_stock_alert"
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
      name: "",
      description: "",
      sale_price: 0,
      cost_price: 0,
      quantity_in_stock: 0,
      min_stock_alert: 5,
      is_active: true
    });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  // Função para abrir o modal de edição
  const handleOpenEditModal = (product: Product) => {
    setFormData({
      id: product.id,
      name: product.name,
      description: product.description || "",
      sale_price: product.sale_price,
      cost_price: product.cost_price,
      quantity_in_stock: product.quantity_in_stock,
      min_stock_alert: product.min_stock_alert || 5,
      is_active: product.is_active
    });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Função para confirmar exclusão
  const handleConfirmDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  // Função para excluir o produto
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    
    setIsDeleting(true);
    try {
      await apiService.delete(`/api/products/${productToDelete.id}`, {
        showSuccessToast: true,
        successMessage: 'Produto excluído com sucesso!',
        debug: true
      });
      
      // Atualizar a lista de produtos
      fetchProducts();
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      
      // Tentar extrair mais informações específicas para debug
      if (error instanceof ApiError) {
        console.error('Status do erro:', error.status);
        console.error('Código do erro:', error.code);
        console.error('Resposta original:', error.rawResponse);
        
        // Verificar se o erro informa que o produto está em uso
        if (error.status === 400 && error.rawResponse?.error?.message?.includes('em uso')) {
          toast.error('Não é possível excluir este produto pois ele está em uso em vendas ou estoque.');
        }
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  // Função para enviar o formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Mapear os campos do formulário para o formato correto do banco de dados
      const apiData = {
        name: formData.name,
        description: formData.description,
        sale_price: formData.sale_price,
        cost_price: formData.cost_price,
        quantity_in_stock: formData.quantity_in_stock,
        min_stock_alert: formData.min_stock_alert,
        is_active: formData.is_active
      };

      console.log('Enviando dados para API:', apiData);

      if (isEditing) {
        // Atualizando um produto existente
        const { id } = formData as Product;
        await apiService.patch(`/api/products/${id}`, apiData, {
          showSuccessToast: true,
          successMessage: 'Produto atualizado com sucesso!',
          debug: true
        });
      } else {
        // Criando um novo produto
        await apiService.post('/api/products', apiData, {
          showSuccessToast: true,
          successMessage: 'Produto adicionado com sucesso!',
          debug: true
        });
      }
      
      // Resetar o formulário
      setFormData({
        name: "",
        description: "",
        sale_price: 0,
        cost_price: 0,
        quantity_in_stock: 0,
        min_stock_alert: 5,
        is_active: true
      });
      
      // Fechar o modal
      setIsDialogOpen(false);
      
      // Atualizar a lista de produtos
      fetchProducts();
    } catch (error) {
      console.error("Erro ao salvar produto:", error);

      if (error instanceof ApiError) {
        console.error('Status do erro:', error.status);
        console.error('Código do erro:', error.code);
        console.error('Resposta original:', error.rawResponse);
        
        // Verificar mensagens específicas de erro
        if (error.status === 400 && error.rawResponse?.error?.message) {
          toast.error(error.rawResponse.error.message);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="Produtos"
      menuItems={catalogMenuItems}
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-gray-500">Gerencie seus produtos oferecidos</p>
        </div>
        <Button onClick={handleOpenCreateModal}>
          Adicionar produto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <p>Carregando produtos...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex justify-center items-center h-40">
          <p>Nenhum produto cadastrado. Clique em "Adicionar produto" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenEditModal(product)}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleConfirmDelete(product)}
                      className="p-1 hover:bg-gray-100 rounded-full text-red-500"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
                
                {product.description && (
                  <p className="text-sm text-gray-500 mb-2">{product.description}</p>
                )}
                
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <span className="font-medium">Preço:</span> 
                      <span className="ml-1">R$ {(product.sale_price || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="font-medium">Custo:</span>
                      <span className="ml-1">R$ {(product.cost_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Estoque:</span>
                      <span className="ml-1">{product.quantity_in_stock || 0}</span>
                    </div>
                    <div>
                      <span className="font-medium">Mínimo:</span>
                      <span className="ml-1">{product.min_stock_alert || 0}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${product.is_active ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                    <span className="text-sm">
                      {product.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal para adicionar/editar produto */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar produto' : 'Adicionar produto'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Faça as alterações necessárias no produto e salve ao finalizar.'
                : 'Preencha os campos abaixo para adicionar um novo produto ao catálogo.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nome*
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="col-span-3"
                  placeholder="Ex: Shampoo Premium"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Descrição
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="col-span-3"
                  placeholder="Descreva o produto brevemente"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sale_price" className="text-right">
                  Preço de venda*
                </Label>
                <Input
                  id="sale_price"
                  name="sale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sale_price}
                  onChange={handleChange}
                  className="col-span-3"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cost_price" className="text-right">
                  Preço de custo*
                </Label>
                <Input
                  id="cost_price"
                  name="cost_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price}
                  onChange={handleChange}
                  className="col-span-3"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quantity_in_stock" className="text-right">
                  Quantidade em estoque*
                </Label>
                <Input
                  id="quantity_in_stock"
                  name="quantity_in_stock"
                  type="number"
                  min="0"
                  value={formData.quantity_in_stock}
                  onChange={handleChange}
                  className="col-span-3"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="min_stock_alert" className="text-right">
                  Alerta de estoque mínimo
                </Label>
                <Input
                  id="min_stock_alert"
                  name="min_stock_alert"
                  type="number"
                  min="0"
                  value={formData.min_stock_alert}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="is_active" className="text-right">
                  Ativo
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Checkbox 
                    id="is_active" 
                    checked={formData.is_active} 
                    onCheckedChange={handleCheckboxChange}
                  />
                  <label 
                    htmlFor="is_active" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Produto ativo no catálogo
                  </label>
                </div>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? 'Salvando...' 
                  : isEditing ? 'Salvar alterações' : 'Adicionar produto'
                }
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
              Tem certeza que deseja excluir o produto {productToDelete?.name}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
} 