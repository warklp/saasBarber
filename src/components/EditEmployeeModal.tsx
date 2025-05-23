'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { EmployeeData, EmployeeResponse } from '@/lib/services/employeeService';

// Schema de validação para edição (sem email obrigatório)
const editEmployeeFormSchema = z.object({
  name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }),
  phone: z.string().min(8, { message: 'Telefone inválido' }).optional(),
  dob: z.date().optional(),
  calendarColor: z.string().optional(),
});

type EditEmployeeFormValues = z.infer<typeof editEmployeeFormSchema>;

interface EditEmployeeModalProps {
  open: boolean;
  employee: EmployeeResponse | null; // Colaborador a ser editado
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: Partial<EmployeeData>) => Promise<void>;
}

const presetColors = [
  "#4ea8de", // Azul claro
  "#6c63ff", // Roxo
  "#9c59ff", // Lilás
  "#ff66c4", // Rosa
  "#ff7979", // Coral
  "#ff9f43", // Laranja
  "#ffcc5c", // Amarelo
  "#b8e994", // Verde claro
  "#1dd1a1", // Verde menta
  "#16c2d5", // Turquesa
];

export function EditEmployeeModal({ open, employee, onOpenChange, onSubmit }: EditEmployeeModalProps) {
  const form = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      dob: undefined,
    },
  });

  // Estado para cor selecionada
  const [selectedColor, setSelectedColor] = useState<string>(presetColors[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Atualizar o formulário quando o colaborador mudar
  useEffect(() => {
    if (employee) {
      form.reset({
        name: employee.name,
        phone: employee.phone || '',
        dob: employee.metadata?.dob ? new Date(employee.metadata.dob) : undefined,
      });
      
      // Definir a cor do calendário se existir
      if (employee.metadata?.calendarColor) {
        setSelectedColor(employee.metadata.calendarColor);
      } else {
        setSelectedColor(presetColors[0]);
      }
    }
  }, [employee, form]);

  const handleSubmit = async (values: EditEmployeeFormValues) => {
    if (!employee) return;
    
    try {
      setIsSubmitting(true);
      
      // Preparar os dados no formato esperado pelo serviço
      const employeeData: Partial<EmployeeData> = {
        name: values.name,
        phone: values.phone,
        dob: values.dob,
        calendarColor: selectedColor
      };
      
      // Chamar a função de callback para atualizar o colaborador
      await onSubmit(employee.id, employeeData);
      
      // Fechar o modal
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar colaborador:', error);
      // Não fechamos o modal para permitir que o usuário tente novamente
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Não fechar o modal durante o envio
      if (isSubmitting) return;
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Colaborador</DialogTitle>
          <DialogDescription>
            Atualize os dados do colaborador
          </DialogDescription>
        </DialogHeader>

        {employee && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome*</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do colaborador" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo de email somente leitura */}
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={employee.email} disabled />
                <p className="text-sm text-muted-foreground">O e-mail não pode ser alterado</p>
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <PhoneInput placeholder="(99) 99999-9999" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Nascimento</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isSubmitting}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || isSubmitting}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Cor no Calendário</Label>
                <div className="flex flex-wrap gap-2">
                  {presetColors.map((color) => (
                    <div
                      key={color}
                      className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                        selectedColor === color ? 'ring-2 ring-offset-2 ring-black' : ''
                      } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => !isSubmitting && setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
} 