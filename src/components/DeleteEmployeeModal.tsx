'use client';

import { useState } from 'react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';
import { EmployeeResponse } from '@/lib/services/employeeService';

interface DeleteEmployeeModalProps {
  open: boolean;
  employee: EmployeeResponse | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteEmployeeModal({ open, employee, onOpenChange, onConfirm }: DeleteEmployeeModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!employee) return;
    
    try {
      setIsDeleting(true);
      await onConfirm(employee.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao excluir colaborador:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(newOpen) => {
      if (isDeleting) return;
      onOpenChange(newOpen);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Colaborador</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o colaborador{' '}
            <span className="font-semibold">{employee?.name}</span>?
            <br /><br />
            Esta ação não pode ser desfeita e removerá todos os dados do colaborador, 
            incluindo seu acesso ao sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 