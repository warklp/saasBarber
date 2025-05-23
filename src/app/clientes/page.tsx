'use client';

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CustomerModal } from "@/components/customers/CustomerModal";
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
import { Edit, Trash, Phone, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { customerService, type Customer } from '@/lib/api/customerService';

export default function ClientesPage() {
  // Estados
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [total, setTotal] = useState(0);
  
  // Buscar clientes
  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await customerService.list(search);
      setCustomers(response.data);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Carregar clientes quando a página carregar ou quando houver busca
  useEffect(() => {
    fetchCustomers();
  }, [search]);
  
  // Adicionar console log para debugar
  useEffect(() => {
    console.log('Estado atual de customers:', customers);
  }, [customers]);
  
  // Função para abrir modal de edição
  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };
  
  // Função para abrir modal de criação
  const handleCreate = () => {
    setSelectedCustomer(undefined);
    setIsModalOpen(true);
  };
  
  // Função para confirmar exclusão
  const handleConfirmDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };
  
  // Função para excluir cliente
  const handleDelete = async () => {
    if (!customerToDelete) return;
    
    setIsDeleting(true);
    try {
      await customerService.delete(customerToDelete.id);
      toast.success('Cliente removido com sucesso!');
      fetchCustomers();
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error);
      toast.error(error.message || 'Erro ao excluir cliente');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };
  
  return (
    <PageContainer>
      <div className="flex flex-col gap-6 min-h-screen bg-gray-50 p-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Lista de clientes</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie seus clientes</p>
          </div>
          <Button onClick={handleCreate} size="lg" className="md:w-auto w-full">
            Adicionar cliente
          </Button>
        </div>
        
        {/* Barra de busca */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xl"
          />
        </div>
        
        {/* Lista de clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            // Placeholders de carregamento
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="p-6 flex flex-col justify-between bg-white shadow-sm">
                <div className="space-y-3">
                  <div className="h-5 bg-gray-100 rounded-md w-3/4 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-md w-1/2 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-md w-2/3 animate-pulse" />
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <div className="h-8 w-8 bg-gray-100 rounded-md animate-pulse" />
                  <div className="h-8 w-8 bg-gray-100 rounded-md animate-pulse" />
                </div>
              </Card>
            ))
          ) : customers.length > 0 ? (
            customers.map((customer) => (
              <Card key={customer.id} className="p-6 flex flex-col justify-between bg-white shadow-sm hover:shadow-md transition-shadow">
                <div>
                  <h3 className="font-medium text-gray-900">{customer.name}</h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      {customer.phone}
                    </div>
                    {customer.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {customer.email}
                      </div>
                    )}
                  </div>
                  {!customer.is_active && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-full">
                      Inativo
                    </span>
                  )}
                </div>
                <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-100">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(customer)}
                    className="h-8 w-8"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleConfirmDelete(customer)}
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full p-12 text-center bg-white rounded-lg shadow-sm">
              <p className="text-gray-500">
                {search 
                  ? 'Nenhum cliente encontrado para esta busca'
                  : 'Nenhum cliente cadastrado. Adicione seu primeiro cliente!'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de adicionar/editar cliente */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={selectedCustomer}
        onSuccess={fetchCustomers}
      />
      
      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{customerToDelete?.name}"?
              <br /><br />
              <strong>Atenção:</strong> Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir cliente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}