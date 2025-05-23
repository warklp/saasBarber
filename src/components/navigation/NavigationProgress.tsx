'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Configuração do NProgress
NProgress.configure({
  minimum: 0.3,
  easing: 'ease',
  speed: 400,
  showSpinner: false,
});

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Inicia o NProgress
    NProgress.start();

    // Finaliza o NProgress após um curto delay
    const timer = setTimeout(() => {
      NProgress.done();
    }, 300);

    return () => {
      clearTimeout(timer);
      NProgress.done();
    };
  }, [pathname, searchParams]);

  return null;
} 