'use client';

import dynamic from 'next/dynamic';
import styles from './styles.module.css';
import { useState, useEffect } from 'react';
import { BarberCalendar } from '@/components/BarberCalendar';

// Importar o calendário móvel usando dynamic import para carregamento preguiçoso
const MobileBarberCalendar = dynamic(() => import('@/components/MobileBarberCalendar'), { ssr: false });

const CalendarioPage = () => {
  // Estado para verificar se é um dispositivo móvel
  const [isMobile, setIsMobile] = useState(false);

  // Verificar o tamanho da tela no carregamento e quando houver redimensionamento
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Verificar no carregamento
    checkIfMobile();
    
    // Adicionar listener para mudanças de tamanho
    window.addEventListener('resize', checkIfMobile);
    
    // Limpar o listener ao desmontar
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  return (
    <div className={isMobile ? styles.fullScreenContainer : styles.container}>
      <main className={isMobile ? styles.fullScreenMain : styles.main}>
        {isMobile ? <MobileBarberCalendar /> : <BarberCalendar />}
      </main>
    </div>
  );
};

export default CalendarioPage;