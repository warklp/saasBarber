'use client';

import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const { signOut, loading } = useAuth();

  return (
    <header className="fixed top-0 right-0 left-0 ml-16 h-16 bg-white border-b border-gray-200 z-30">
      <div className="h-full flex items-center justify-between px-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Sistema de Gestão
        </h1>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <Bell className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="w-5 h-5" />
          </Button>
          <button
            onClick={signOut}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            {loading ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </div>
    </header>
  );
}