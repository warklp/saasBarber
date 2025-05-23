import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import toast from "react-hot-toast";
import { customerService, type Customer, type CustomerInput } from "@/lib/api/customerService";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer;
  onSuccess: () => void;
}

export function CustomerModal({ isOpen, onClose, customer, onSuccess }: CustomerModalProps) {
  // Estado do formulário
  const [formData, setFormData] = useState<CustomerInput>({
    name: "",
    phone: "",
    email: "",
    notes: "",
    is_active: true
  });
  
  // Estado de loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        phone: formatPhoneNumber(customer.phone),
        email: customer.email || "",
        notes: customer.notes || "",
        is_active: customer.is_active
      });
    } else {
      // Resetar formulário quando for novo cliente
      setFormData({
        name: "",
        phone: "",
        email: "",
        notes: "",
        is_active: true
      });
    }
  }, [customer]);

  // Função para formatar número de telefone
  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não for número
    const numbers = value.replace(/\D/g, "");
    
    // Aplica a máscara conforme a quantidade de números
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{0,5})(\d{0,4})/, (_, ddd, first, second) => {
        if (second) return `(${ddd}) ${first}-${second}`;
        if (first) return `(${ddd}) ${first}`;
        if (ddd) return `(${ddd}`;
        return "";
      });
    }
    
    // Se tiver mais que 11 números, corta para 11
    return numbers.slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };
  
  // Função para lidar com mudanças nos campos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Aplicar máscara apenas no campo de telefone
    if (name === "phone") {
      setFormData(prev => ({
        ...prev,
        [name]: formatPhoneNumber(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Função para lidar com mudança no checkbox
  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      is_active: checked
    }));
  };
  
  // Função para enviar o formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Remover formatação do telefone antes de enviar
      const dataToSend = {
        ...formData,
        phone: formData.phone.replace(/\D/g, "")
      };
      
      if (customer) {
        // Atualizar cliente existente
        await customerService.update(customer.id, dataToSend);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        // Criar novo cliente
        await customerService.create(dataToSend);
        toast.success('Cliente adicionado com sucesso!');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      toast.error(error.message || 'Erro ao salvar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {customer ? 'Editar cliente' : 'Adicionar novo cliente'}
          </DialogTitle>
          <DialogDescription>
            {customer 
              ? 'Atualize os dados do cliente selecionado.'
              : 'Preencha os dados do novo cliente.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome*</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Nome do cliente"
                required
                minLength={3}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone*</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                required
                maxLength={15}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email || ""}
                onChange={handleChange}
                placeholder="email@exemplo.com"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes || ""}
                onChange={handleChange}
                placeholder="Observações sobre o cliente..."
                rows={3}
              />
            </div>
            
            {customer && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={handleCheckboxChange}
                />
                <Label htmlFor="is_active">Cliente ativo</Label>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting 
                ? 'Salvando...' 
                : customer 
                  ? 'Atualizar cliente' 
                  : 'Adicionar cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 