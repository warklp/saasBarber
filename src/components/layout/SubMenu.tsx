'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SubMenuItem {
  label: string;
  description?: string;
  href: string;
}

interface SubMenuProps {
  title: string;
  items: SubMenuItem[];
}

export function SubMenu({ title, items }: SubMenuProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="relative">
      {/* Collapse button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute z-50 flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-md transition-all duration-300",
          isCollapsed 
            ? "-left-4 top-4" 
            : "-right-4 top-4"
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* Menu content */}
      <div
        className={cn(
          "h-[calc(100vh-4rem)] bg-white border-r transition-all duration-300",
          isCollapsed ? "w-0 overflow-hidden" : "w-64"
        )}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>

          <nav className="flex-1 space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === item.href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <div className="font-medium">{item.label}</div>
                {item.description && (
                  <div className="mt-0.5 text-xs text-gray-500">{item.description}</div>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}