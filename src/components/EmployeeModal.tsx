'use client';

import { useState } from 'react';
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
import { EmployeeData } from '@/lib/services/employeeService';

// Schema de validação
const employeeFormSchema = z.object({
  name: z.string().min(3, { message: 'Nome precisa ter pelo menos 3 caracteres' }),
  email: z.string().email({ message: 'Email inválido' }),
  phone: z.string().min(8, { message: 'Telefone inválido' }).optional(),
  dob: z.date().optional(),
  calendarColor: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

interface EmployeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EmployeeData) => Promise<void>;
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

export function EmployeeModal({ open, onOpenChange, onSubmit }: EmployeeModalProps) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      calendarColor: presetColors[0],
    },
  });

  const [selectedColor, setSelectedColor] = useState(presetColors[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: EmployeeFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Preparar os dados no formato esperado pelo serviço
      const employeeData: EmployeeData = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        dob: values.dob,
        calendarColor: selectedColor
      };
      
      // Chamar a função de callback para salvar o colaborador
      await onSubmit(employeeData);
      
      // Resetar o formulário e fechar o modal
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
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
      if (!newOpen) form.reset();
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Colaborador</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo colaborador
          </DialogDescription>
        </DialogHeader>

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

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail*</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    Adicionando...
                  </>
                ) : (
                  'Adicionar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 