'use client';

import { ReactNode } from 'react';
import { SubMenu } from './SubMenu';

interface PageContainerProps {
  children: ReactNode;
  title?: string;
  menuItems?: Array<{
    label: string;
    description?: string;
    href: string;
  }>;
}

export function PageContainer({ children, title, menuItems }: PageContainerProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] -ml-16">
      {menuItems && (
        <div className="hidden md:block ml-16">
          <SubMenu 
            title={title || ''} 
            items={menuItems}
          />
        </div>
      )}
      <div className="flex-1">
        <div className="max-w-[1600px] w-full mx-auto px-4 md:px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}