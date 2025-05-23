"use client";

import { 
  LayoutDashboard, 
  Calendar, 
  DollarSign,
  Users,
  Scissors,
  Globe,
  UserCog,
  BarChart,
  Settings
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const menuItems = [
  { icon: LayoutDashboard, label: "Início", href: "/" },
  { icon: Calendar, label: "Calendário", href: "/calendario" },
  { icon: DollarSign, label: "Vendas", href: "/vendas" },
  { icon: Users, label: "Clientes", href: "/clientes" },
  { icon: Scissors, label: "Catálogo", href: "/catalogo/servicos" },
  { icon: Globe, label: "Agendamento Online", href: "/agendamento" },
  { icon: UserCog, label: "Equipe", href: "/equipe" },
  { icon: BarChart, label: "Relatórios", href: "/relatorios" },
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
];

interface SidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isMobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  if (isMobile) {
    return (
      <nav className="flex-1">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === item.href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <aside className="hidden lg:fixed lg:flex left-0 h-screen w-16 bg-[#1C1C1C] z-40 flex-col items-center py-4">
      <div className="mb-8">
        <div className="w-8 h-8 bg-white rounded-full" />
      </div>
      
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1">
          <ul className="space-y-4">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                        pathname === item.href
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </nav>
      </TooltipProvider>
    </aside>
  );
}