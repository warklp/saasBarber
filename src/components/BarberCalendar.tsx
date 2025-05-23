'use client';

import { Calendar, dateFnsLocalizer, Views, stringOrDate, SlotInfo, View, type ResourceHeaderProps } from 'react-big-calendar';
import type { Event as CalendarEventType } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, setMinutes, setHours, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect, useRef, useCallback } from 'react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './BarberCalendar.css';
import './BarberModals.css';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { employeeService, EmployeeResponse } from '@/lib/services/employeeService';
import toast from 'react-hot-toast';
import { Calendar as CalendarIcon, Users, XCircle, Info, X, ShoppingCart, CheckCircle } from 'lucide-react';
import AppointmentModal from './appointments/AppointmentModal';
import appointmentService, { Appointment } from '@/lib/services/appointmentService';
import CheckoutModal from './appointments/CheckoutModal';
import apiService from '@/lib/api/apiService';
import comandaService from '@/lib/services/comandaService';

// Constantes globais para o horário de funcionamento do estabelecimento
export const BUSINESS_HOURS = {
  OPEN_HOUR: 9,    // 9:00 - Horário de abertura
  CLOSE_HOUR: 19   // 19:00 - Horário de fechamento
};

const locales = {
  'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Configuração dos horários de funcionamento
const minTime = new Date();
minTime.setHours(BUSINESS_HOURS.OPEN_HOUR, 0, 0);
const maxTime = new Date();
maxTime.setHours(BUSINESS_HOURS.CLOSE_HOUR, 0, 0);

interface Resource {
  id: string;
  title: string;
  imageUrl?: string;
}

interface CalendarEvent extends CalendarEventType {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  resourceId: string;
  client: string;
  service: string;
  isDraggable?: boolean;
  isBlocked?: boolean;
  status: string;
  appointmentData: Appointment;
}

// Mensagens em português
const messages = {
  today: 'Hoje',
  previous: 'Anterior',
  next: 'Próximo',
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  allDay: 'Dia inteiro',
  showMore: (total: number) => `+${total} mais`,
};

interface EventChangeArgs {
  event: CalendarEvent;
  start: stringOrDate;
  end: stringOrDate;
  resourceId?: string | number;
}

// Interface para o modal de ações
interface SlotModalProps {
  isVisible: boolean;
  position: { top: number; left: number };
  resourceId: string;
  start: Date;
  end: Date;
  onClose: () => void;
  onCreateAppointment: (resourceId: string, start: Date, end: Date) => void;
  onBlockTime: (resourceId: string, start: Date, end: Date) => void;
}

// Interface para o modal de detalhes do agendamento
interface AppointmentDetailsModalProps {
  isVisible: boolean;
  position: { top: number; left: number };
  appointment: Appointment | null;
  onClose: () => void;
  onCancelAppointment: (appointmentId: string) => void;
  onCompleteAppointment: (appointmentId: string) => void;
  onChangeStatus: (appointmentId: string, newStatus: 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'absent' | 'completed' | 'canceled') => void;
}

// Interface para o modal de checkout
interface CheckoutModalProps {
  isVisible: boolean;
  position: { top: number; left: number };
  appointment: Appointment | null;
  onClose: () => void;
  onCompleteCheckout: (appointmentId: string) => void;
}

// Componente do modal de ações
const SlotModal = ({ 
  isVisible, 
  position, 
  resourceId, 
  start, 
  end, 
  onClose,
  onCreateAppointment,
  onBlockTime
}: SlotModalProps) => {
  if (!isVisible) return null;

  return (
    <div 
      className="slot-modal" 
      style={{ 
        top: position.top, 
        left: position.left 
      }}
    >
      <div className="slot-modal-time">
        {format(start, 'HH:mm')}
      </div>
      
      <button 
        className="slot-modal-option"
        onClick={() => onCreateAppointment(resourceId, start, end)}
      >
        <CalendarIcon size={16} />
        <span>Adicionar agendamento</span>
      </button>
      
      <button 
        className="slot-modal-option"
        onClick={() => onBlockTime(resourceId, start, end)}
      >
        <XCircle size={16} />
        <span>Adicionar horário indisponível</span>
      </button>
      
      <button
        className="slot-modal-option"
        onClick={() => {
          // Aqui poderia adicionar a lógica para criar agendamento em grupo
          toast.success('Funcionalidade de grupo em desenvolvimento');
          onClose();
        }}
      >
        <Users size={16} />
        <span>Criar agendamento de grupo</span>
      </button>
      
      <div className="slot-modal-close-area" onClick={onClose} />
    </div>
  );
};

// Componente do modal de detalhes do agendamento
const AppointmentDetailsModal = ({
  isVisible,
  position,
  appointment,
  onClose,
  onCancelAppointment,
  onCompleteAppointment,
  onChangeStatus
}: AppointmentDetailsModalProps) => {
  if (!isVisible || !appointment) return null;

  // Formatar data e hora
  const formattedStartTime = format(new Date(appointment.start_time), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  const formattedEndTime = format(new Date(appointment.end_time), 'HH:mm', { locale: ptBR });
  
  // Obter status em português
  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado';
      case 'confirmed': return 'Confirmado';
      case 'waiting': return 'Aguardando';
      case 'in_progress': return 'Iniciado';
      case 'absent': return 'Ausência';
      case 'completed': return 'Concluído';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  };
  
  // Obter classe de cor para o status
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'waiting': return 'bg-orange-100 text-orange-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Determinar nome do serviço com base na nova estrutura de dados
  const getServiceName = () => {
    if (appointment && appointment.services && Array.isArray(appointment.services) && appointment.services.length > 0) {
      // Formato novo: primeiro serviço do array services
      return appointment.services[0].service.name;
    } else if (appointment && appointment.service) {
      // Formato antigo: objeto service direto
      return appointment.service.name;
    }
    return 'Serviço não especificado';
  };

  return (
    <div 
      className="appointment-details-modal"
      style={{ 
        top: position.top, 
        left: position.left 
      }}
    >
      <div className="appointment-details-modal-header">
        <h3>Detalhes do Agendamento</h3>
        <button onClick={onClose} className="close-button">
          <X size={16} />
        </button>
      </div>
      
      <div className="appointment-details-modal-content">
        <div className="info-group">
          <span className="info-label">Cliente:</span>
          <span className="info-value">{appointment.client?.name || 'Espontâneo'}</span>
        </div>
        
        <div className="info-group">
          <span className="info-label">Serviço:</span>
          <span className="info-value">{getServiceName()}</span>
        </div>
        
        <div className="info-group">
          <span className="info-label">Profissional:</span>
          <span className="info-value">{appointment.employee?.name}</span>
        </div>
        
        <div className="info-group">
          <span className="info-label">Horário:</span>
          <span className="info-value">{formattedStartTime} - {formattedEndTime}</span>
        </div>
        
        <div className="info-group">
          <span className="info-label">Status:</span>
          <span className={`status-badge ${getStatusClass(appointment.status)}`}>
            {getStatusText(appointment.status)}
          </span>
        </div>
        
        {appointment.notes && (
          <div className="info-group notes">
            <span className="info-label">Observações:</span>
            <span className="info-value">{appointment.notes}</span>
          </div>
        )}
      </div>
      
      <div className="appointment-details-modal-actions">
        {appointment.status !== 'completed' && appointment.status !== 'canceled' && (
          <div className="status-buttons">
            {appointment.status !== 'confirmed' && (
              <button
                className="action-button confirm"
                onClick={() => onChangeStatus(appointment.id, 'confirmed')}
              >
                Confirmar
              </button>
            )}
            
            {appointment.status !== 'waiting' && (
              <button
                className="action-button waiting"
                onClick={() => onChangeStatus(appointment.id, 'waiting')}
              >
                Aguardando
              </button>
            )}
            
            {appointment.status !== 'in_progress' && (
              <button
                className="action-button in-progress"
                onClick={() => onChangeStatus(appointment.id, 'in_progress')}
              >
                Iniciar
              </button>
            )}
            
            <button
              className="action-button complete"
              onClick={() => onCompleteAppointment(appointment.id)}
            >
              Concluir
            </button>
            
            <button
              className="action-button cancel"
              onClick={() => onCancelAppointment(appointment.id)}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
      
      <div className="appointment-details-modal-close-area" onClick={onClose} />
    </div>
  );
};

// Dentro do componente BarberCalendar
// Modifique a definição de CustomToolbar para receber acesso aos estados do componente pai
const CustomToolbar = (toolbarProps: any) => {
  const goToBack = () => {
    toolbarProps.onNavigate('PREV');
  };

  const goToNext = () => {
    toolbarProps.onNavigate('NEXT');
  };

  const goToCurrent = () => {
    toolbarProps.onNavigate('TODAY');
  };

  // Formatar a data atual do calendário no estilo "dom 13 abr"
  const formattedDate = format(toolbarProps.date, "EEEE d MMM", { locale: ptBR });

  return (
    <div className="rbc-toolbar">
      <div className="rbc-toolbar-navigation">
        <button 
          type="button" 
          className="hoje-btn" 
          onClick={goToCurrent}
        >
          Hoje
        </button>
        <div className="rbc-nav-buttons">
          <button type="button" className="nav-btn" onClick={goToBack}>
            &lt;
          </button>
          <button type="button" className="nav-btn" onClick={goToNext}>
            &gt;
          </button>
        </div>
      </div>
      <span className="rbc-toolbar-label">{formattedDate}</span>
      <div className="rbc-view-btn">
        <button
          type="button"
          className="view-day-btn rbc-active"
        >
          Dia
        </button>
      </div>
    </div>
  );
};

interface CustomHeaderProps extends ResourceHeaderProps<Resource> {}

const CustomHeader: React.FC<CustomHeaderProps> = ({ resource }) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2);
  };

  return (
    <div className="professional-header">
      <div className="professional-avatar">
        {resource.imageUrl ? (
          <img 
            src={resource.imageUrl} 
            alt={resource.title} 
            className="professional-image"
          />
        ) : (
          <div className="professional-avatar-placeholder">
            {getInitials(resource.title)}
          </div>
        )}
      </div>
      <span className="professional-name">{resource.title}</span>
    </div>
  );
};

// Componente principal do calendário
export const BarberCalendar = () => {
  // Estado para armazenar os funcionários
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para armazenar eventos
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  
  // Estado para controlar data atual do calendário
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<string>(Views.DAY);
  
  // Estados para o modal de ações
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [slotModalPosition, setSlotModalPosition] = useState({ top: 0, left: 0 });
  const [selectedSlot, setSelectedSlot] = useState<{
    resourceId: string;
    start: Date;
    end: Date;
  } | null>(null);
  
  // Estado para célula selecionada (para efeito visual)
  const [selectedCell, setSelectedCell] = useState<{
    resourceId: string;
    slotTime: Date;
  } | null>(null);
  
  // Referência para o calendário para calcular posições
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Adicione os novos estados para o modal de agendamento
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentData, setAppointmentData] = useState<{
    employeeId: string;
    employeeName: string;
    startTime: Date;
    endTime: Date;
  } | null>(null);
  
  // Estado para modal de detalhes do agendamento
  const [appointmentDetailsModalVisible, setAppointmentDetailsModalVisible] = useState(false);
  const [appointmentDetailsModalPosition, setAppointmentDetailsModalPosition] = useState({ top: 0, left: 0 });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  // Estado para modal de checkout
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutModalPosition, setCheckoutModalPosition] = useState({ top: 0, left: 0 });
  
  // Função para buscar funcionários
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const employees = await employeeService.getEmployees();
        
        // Mapear funcionários para o formato de recurso do calendário
        const mappedResources: Resource[] = employees.map(employee => ({
          id: employee.id,
          title: employee.name,
          imageUrl: employee.image_profile || undefined
        }));
        
        setResources(mappedResources);
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        toast.error('Não foi possível carregar a lista de funcionários');
        
        // Fallback para dados de exemplo em caso de erro
        setResources([
          { id: 'fallback1', title: 'João Silva' },
          { id: 'fallback2', title: 'Maria Santos' },
          { id: 'fallback3', title: 'Pedro Oliveira' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEmployees();
  }, []);
  
  // Função para buscar agendamentos da API
  const fetchAppointments = useCallback(async (date: Date, view: string) => {
    try {
      setLoading(true);
      
      // Definir intervalos de data com base na visualização
      let start_date: string, end_date: string;
      
      if (view === Views.DAY) {
        // Para visualização diária, buscar apenas agendamentos do dia
        start_date = startOfDay(date).toISOString();
        end_date = endOfDay(date).toISOString();
      } else if (view === Views.WEEK) {
        // Para visualização semanal, buscar agendamentos da semana
        const startDate = startOfWeek(date, { locale: ptBR });
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        
        start_date = startDate.toISOString();
        end_date = endDate.toISOString();
      } else {
        // Para visualização mensal ou padrão, buscar o mês inteiro
        start_date = startOfMonth(date).toISOString();
        end_date = endOfMonth(date).toISOString();
      }
      
      // Buscar agendamentos da API
      const appointments = await appointmentService.getAppointments({
        start_date,
        end_date,
      });
      
      // Converter agendamentos para o formato de evento do calendário
      const calendarEvents: CalendarEvent[] = appointments.map((appointment) => {
        // Verificar se temos serviços no formato de array
        const hasServicesArray = appointment.services && Array.isArray(appointment.services) && appointment.services.length > 0;
        
        // Obter informações do primeiro serviço se disponível no formato novo
        const firstServiceInfo = hasServicesArray && appointment.services 
          ? appointment.services[0].service 
          : appointment.service; // Compatibilidade com formato anterior
        
        // Nome do serviço (do primeiro serviço ou diretamente do service se no formato antigo)
        const serviceName = hasServicesArray && appointment.services
          ? appointment.services[0].service.name 
          : (appointment.service ? appointment.service.name : 'Serviço');
        
        return {
          id: appointment.id,
          title: `${appointment.client.name} - ${serviceName}`,
          start: new Date(appointment.start_time),
          end: new Date(appointment.end_time),
          resourceId: appointment.employee_id,
          client: appointment.client.name,
          service: serviceName,
          status: appointment.status,
          // Permitir arrasto apenas para agendamentos não concluídos
          isDraggable: appointment.status !== 'completed',
          // Dados adicionais para referência
          appointmentData: {
            ...appointment,
            // Garantir compatibilidade com o formato anterior
            service: firstServiceInfo || { name: serviceName, id: '', duration_minutes: 0, price: 0 }
          },
        };
      });
      
      console.log('Eventos carregados:', calendarEvents.map(e => ({ id: e.id, title: e.title })));
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast.error('Não foi possível carregar os agendamentos');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Efeito para buscar agendamentos quando a data ou visualização mudar
  useEffect(() => {
    if (resources.length > 0) {
      fetchAppointments(currentDate, currentView);
    }
  }, [currentDate, currentView, resources, fetchAppointments]);
  
  // Efeito adicional para forçar atualização do calendário após carregar eventos
  useEffect(() => {
    if (events.length > 0) {
      // Necessário para forçar um re-render que pode resolver problemas de visualização
      const timer = setTimeout(() => {
        // Força um recálculo do layout do calendário
        window.dispatchEvent(new CustomEvent('resize'));
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [events]);
  
  // Função para quando um slot é selecionado (clicado)
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    // Verificar se a seleção tem um recurso (funcionário)
    if (!slotInfo.resourceId) return;
    
    // Marcar a célula selecionada para destaque visual
    setSelectedCell({
      resourceId: slotInfo.resourceId as string,
      slotTime: slotInfo.start
    });
    
    // Calcular a posição do modal
    if (calendarRef.current) {
      const calendarRect = calendarRef.current.getBoundingClientRect();
      
      let top, left;
      
      // Se temos acesso ao evento nativo do mouse (clique direto)
      if ((slotInfo as any).nativeEvent) {
        const event = (slotInfo as any).nativeEvent;
        
        // Calcular posição relativa mantendo o scroll e ajustando mais para cima
        const relativeY = (event.pageY - calendarRect.top) - (window.scrollY * 2);
        const relativeX = event.pageX - calendarRect.left;
        
        const modalHeight = 140; // altura do modal
        const modalWidth = 220;  // largura do modal
        
        top = relativeY;
        
        // Calcular a posição horizontal baseada na coluna do recurso
        const calendarWidth = calendarRect.width;
        const columnWidth = calendarWidth / (resources.length + 1);
        const resourceIndex = resources.findIndex(r => r.id === slotInfo.resourceId);
        left = (resourceIndex + 1) * columnWidth;
        
        // Ajustar para que o modal fique dentro dos limites do calendário
        if (left + modalWidth > calendarWidth) {
          left = left - modalWidth - 10;
        } else {
          left = left + 10;
        }
        
        // Ajustar para que o modal não saia dos limites verticais
        if (top + modalHeight > calendarRect.height) {
          top = top - modalHeight;
        }
        
        // Garantir que o modal não fique com posição negativa
        top = Math.max(10, top);
        left = Math.max(10, left);
      }
      // Usar a posição da célula como fallback
      else if (slotInfo.box) {
        // Obter posição relativa mantendo o scroll e ajustando mais para cima
        top = (slotInfo.box.y - calendarRect.top) - (window.scrollY * 2);
        
        // Calcular a posição horizontal baseada na coluna
        const calendarWidth = calendarRect.width;
        const columnWidth = calendarWidth / (resources.length + 1);
        const resourceIndex = resources.findIndex(r => r.id === slotInfo.resourceId);
        left = (resourceIndex + 1) * columnWidth;
        
        // Ajustar para que o modal não saia da área visível
        const modalWidth = 220;
        if (left + modalWidth > calendarWidth) {
          left = left - modalWidth - 10;
        } else {
          left = left + 10;
        }
      } 
      // Fallback genérico se nenhuma das opções anteriores funcionar
      else {
        top = 100 - (window.scrollY * 2);
        left = calendarRect.width / 2;
      }
      
      setSlotModalPosition({ top, left });
    }
    
    // Armazenar informações do slot selecionado
    setSelectedSlot({
      resourceId: slotInfo.resourceId as string,
      start: slotInfo.start,
      end: slotInfo.end
    });
    
    // Mostrar o modal
    setSlotModalVisible(true);
  };
  
  // Função para lidar com cliques no modal
  const handleCloseModal = () => {
    setSlotModalVisible(false);
    setSelectedSlot(null);
    // Limpar a célula selecionada após um curto delay
    setTimeout(() => {
      setSelectedCell(null);
    }, 300);
  };
  
  const handleCreateAppointment = (resourceId: string, start: Date, end: Date) => {
    // Encontrar o nome do funcionário
    const employee = resources.find(res => res.id === resourceId);
    
    if (!employee) {
      toast.error('Funcionário não encontrado.');
      return;
    }
    
    // Armazenar os dados para o modal de agendamento
    setAppointmentData({
      employeeId: resourceId,
      employeeName: employee.title,
      startTime: start,
      endTime: end
    });
    
    // Abrir o modal de agendamento
    setIsAppointmentModalOpen(true);
    
    // Fechar o modal de slot
    handleCloseModal();
  };
  
  // Nova função para salvar o agendamento
  const handleSaveAppointment = async (appointmentData: any) => {
    try {
      console.log('[CALENDAR] Criando agendamento com dados:', appointmentData);
      
      // Serializar data corretamente
      const requestData = {
        client_id: appointmentData.clientId,
        employee_id: appointmentData.employeeId,
        services: appointmentData.services ? appointmentData.services.map((service: any) => ({
          id: service.id,
          quantity: 1
        })) : [{
          id: appointmentData.serviceId,
          quantity: 1
        }],
        start_time: appointmentData.startTime.toISOString(),
        notes: appointmentData.notes || ''
      };
      
      console.log('[CALENDAR] Dados formatados para API:', requestData);
      
      // Verificar token de autenticação antes
      try {
        console.log('[CALENDAR] Verificando token de autenticação...');
        const authState = await apiService.checkAuth();
        console.log('[CALENDAR] Estado de autenticação:', authState);
      } catch (authError) {
        console.error('[CALENDAR] Erro ao verificar autenticação:', authError);
      }
      
      // Criar o agendamento no backend
      const newAppointment = await appointmentService.createAppointment(requestData);
      console.log('[CALENDAR] Agendamento criado com sucesso:', newAppointment);
      
      // SOLUÇÃO TEMPORÁRIA: Criar comanda manualmente se o agendamento foi criado com sucesso
      // (Isso não deve mais ser necessário, pois a API já cria automaticamente)
      
      // Atualizar eventos do calendário
      fetchAppointments(currentDate, currentView);
      
      toast.success('Agendamento criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Não foi possível criar o agendamento');
    }
  };
  
  const handleBlockTime = (resourceId: string, start: Date, end: Date) => {
    // Criar um evento de bloqueio (horário indisponível)
    const blockEvent: CalendarEvent = {
      id: Date.now(), // Gerar ID baseado no timestamp atual
      title: 'Indisponível',
      start,
      end,
      resourceId,
      client: '',
      service: '',
      isBlocked: true, // Marcar como horário bloqueado
      isDraggable: true,
      status: 'completed',
      appointmentData: {} as Appointment,
    };
    
    // Adicionar o evento de bloqueio ao estado (essa atualização de estado é necessária
    // já que não estamos fazendo uma chamada à API para armazenar bloqueios)
    setEvents(prev => [...prev, blockEvent]);
    toast.success('Horário marcado como indisponível');
    handleCloseModal();
  };

  // Função de utilidade para validar duração mínima de agendamentos
  const validateAppointmentDuration = (startDate: Date, endDate: Date): Date => {
    // Calcular a diferença em minutos
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    
    // Se a duração for menor que 15 minutos, ajustar para 15 minutos
    if (durationMinutes < 15) {
      const newEndDate = new Date(startDate.getTime() + 15 * 60 * 1000);
      toast('A duração mínima do agendamento é de 15 minutos');
      return newEndDate;
    }
    
    return endDate;
  };

  const handleEventDrop = async ({
    event,
    start,
    end,
    resourceId,
  }: EventChangeArgs) => {
    // Para debugging detalhado
    console.log('Evento sendo arrastado:', { 
      id: event.id, 
      type: typeof event.id, 
      title: event.title, 
      appointmentId: event.appointmentData?.id 
    });
    console.log('Estado atual dos eventos:', events.map(e => ({ id: e.id, title: e.title })));
    
    // Ignorar se for um evento de bloqueio
    if (event.isBlocked) {
      // Atualizar o estado local para bloqueios
      setEvents((prev) => {
        // Identificar o evento pelo ID exato
        const filtered = prev.filter((ev) => ev.id !== event.id);
        console.log('Eventos após filtragem (bloqueio):', filtered.map(e => ({ id: e.id, title: e.title })));
        
        const updatedEvent = {
          ...event,
          start: new Date(start),
          end: new Date(end),
          resourceId: resourceId as string,
        };
        
        console.log('Evento atualizado (bloqueio):', { id: updatedEvent.id, title: updatedEvent.title });
        return [...filtered, updatedEvent];
      });
      return;
    }
    
    // Verificar conflitos manualmente antes de enviar para o servidor
    const startDate = new Date(start);
    let endDate = validateAppointmentDuration(startDate, new Date(end));
    const targetResourceId = resourceId as string;
    
    // Verificar se estamos alterando o profissional
    const isChangingEmployee = event.resourceId !== targetResourceId;
    console.log('Análise de mudança de profissional:', {
      profissionalOriginal: event.resourceId,
      profissionalNovo: targetResourceId,
      estaMudandoProfissional: isChangingEmployee
    });
    
    // Sempre usar o targetResourceId para finalidade de UI
    const finalResourceId = targetResourceId;
    
    try {
      // Converter as datas para o formato ISO
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      
      // Verificar previamente se existe conflito quando está mudando de profissional
      if (isChangingEmployee) {
        console.log('Verificando disponibilidade do horário para o novo profissional...');
        
        // Verifica se há conflitos manualmente examinando os eventos existentes
        const conflictingEvents = events.filter(existingEvent => {
          // Ignoramos o próprio evento sendo arrastado
          if (existingEvent.appointmentData?.id === event.appointmentData?.id) {
            return false;
          }
          
          // Verificamos apenas eventos do profissional de destino
          if (existingEvent.resourceId !== targetResourceId) {
            return false;
          }
          
          // Verificamos se o evento está concluído ou cancelado (não conta como conflito)
          if (existingEvent.status === 'completed' || existingEvent.status === 'canceled') {
            return false;
          }
          
          // Verificar sobreposição de horários
          const eventStart = existingEvent.start;
          const eventEnd = existingEvent.end;
          
          // Há conflito se:
          // 1. Início do novo evento está dentro do intervalo do evento existente
          // 2. Fim do novo evento está dentro do intervalo do evento existente 
          // 3. Novo evento engloba completamente o evento existente
          const hasOverlap = 
            (startDate >= eventStart && startDate < eventEnd) ||
            (endDate > eventStart && endDate <= eventEnd) ||
            (startDate <= eventStart && endDate >= eventEnd);
            
          return hasOverlap;
        });
        
        // Se encontrou algum conflito
        if (conflictingEvents.length > 0) {
          const conflictInfo = conflictingEvents.map(e => ({
            cliente: e.appointmentData?.client?.name || 'Cliente',
            horario: format(e.start, 'HH:mm') + ' - ' + format(e.end, 'HH:mm')
          }));
          
          console.error('Conflitos encontrados:', conflictInfo);
          
          // Exibir mensagem de erro com informações sobre o conflito
          if (conflictInfo.length === 1) {
            const conflict = conflictInfo[0];
            toast.error(`Já existe um agendamento de ${conflict.cliente} às ${conflict.horario} para este profissional. O agendamento não será movido.`);
          } else {
            toast.error(`Existem ${conflictInfo.length} agendamentos conflitantes neste horário para o profissional selecionado. O agendamento não será movido.`);
          }
          
          // Recarregar os agendamentos para restaurar o estado original
          fetchAppointments(currentDate, currentView);
          return; // Importante: interromper completamente a operação aqui
        }
        
        console.log('Horário disponível para o novo profissional!');
      }
      
      // Se chegou aqui, significa que podemos prosseguir com a atualização
      
      // Atualizar o estado local usando o appointmentData.id para garantir a identificação correta
      setEvents((prev) => {
        // Usar ID do appointmentData para identificação mais confiável
        const eventToUpdateId = event.appointmentData?.id;
        
        const filtered = prev.filter((ev) => {
          const shouldKeep = ev.appointmentData?.id !== eventToUpdateId;
          if (!shouldKeep) {
            console.log('Removendo evento:', { id: ev.id, appointmentId: ev.appointmentData?.id, title: ev.title });
          }
          return shouldKeep;
        });
        
        console.log('Eventos após filtragem:', filtered.map(e => ({ id: e.id, title: e.title })));
        
        const updatedEvent = {
          ...event,
          start: startDate,
          end: endDate,
          resourceId: finalResourceId,
          appointmentData: {
            ...event.appointmentData,
            start_time: startIso,
            end_time: endIso,
            employee_id: finalResourceId
          }
        };
        
        console.log('Evento atualizado:', { 
          id: updatedEvent.id, 
          appointmentId: updatedEvent.appointmentData?.id,
          title: updatedEvent.title,
          resourceId: updatedEvent.resourceId
        });
        
        return [...filtered, updatedEvent];
      });
      
      // Se estiver mudando o profissional, dividimos a operação em duas etapas
      if (isChangingEmployee) {
        // Nova abordagem: Enviar todos os dados em uma única requisição
        const updateAllData = {
          employee_id: targetResourceId,
          start_time: startIso,
          end_time: endIso
        };
        
        console.log('ATUALIZAÇÃO ÚNICA: Atualizando profissional e horários juntos:', updateAllData);
        await appointmentService.updateAppointment(event.appointmentData.id, updateAllData);
        
        toast.success('Agendamento movido para outro profissional com sucesso!');
      } else {
        // Se não estiver mudando de profissional, faz a atualização normal
        const updateData = {
          start_time: startIso,
          end_time: endIso,
          employee_id: event.resourceId, // Usa o mesmo profissional
        };
        
        console.log('Atualização normal (mesmo profissional):', updateData);
        await appointmentService.updateAppointment(event.appointmentData.id, updateData);
        
        toast.success('Horário do agendamento atualizado com sucesso!');
      }
    } catch (error: any) {
      // Log completo do erro para debug
      console.error('Erro ao atualizar agendamento:', error);
      
      // Verificar se é um erro de conflito de agendamento
      const errorMessage = error?.rawResponse?.error?.message || error?.message;
      
      if (errorMessage?.includes('existe um agendamento')) {
        // Mensagem mais informativa
        if (isChangingEmployee) {
          toast.error(`Já existe um agendamento neste horário para o profissional selecionado. Tente outro horário ou profissional.`);
        } else {
          toast.error(`Já existe um agendamento neste horário. Tente outro horário.`);
        }
      } else {
        // Mostrar mensagem genérica para outros erros
        toast.error('Não foi possível alterar o agendamento');
      }
      
      // Em caso de erro, recarregar agendamentos para garantir consistência
      fetchAppointments(currentDate, currentView);
    }
  };

  const handleEventResize = async ({
    event,
    start,
    end,
  }: EventChangeArgs) => {
    // Para debugging detalhado
    console.log('Evento sendo redimensionado:', { 
      id: event.id, 
      type: typeof event.id, 
      title: event.title, 
      appointmentId: event.appointmentData?.id 
    });
    
    // Ignorar se for um evento de bloqueio
    if (event.isBlocked) {
      // Atualizar o estado local para bloqueios
      setEvents((prev) => {
        // Identificar o evento pelo ID exato
        const filtered = prev.filter((ev) => ev.id !== event.id);
        
        const updatedEvent = {
          ...event,
          start: new Date(start),
          end: new Date(end)
        };
        
        return [...filtered, updatedEvent];
      });
      return;
    }
    
    try {
      // Verificar se o evento tem duração válida (pelo menos 15 minutos)
      const startDate = new Date(start);
      let endDate = validateAppointmentDuration(startDate, new Date(end));
      
      // Converter as datas para o formato ISO
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      
      // Atualizar o estado local usando o appointmentData.id para garantir a identificação correta
      setEvents((prev) => {
        // Usar ID do appointmentData para identificação mais confiável
        const eventToUpdateId = event.appointmentData?.id;
        
        const filtered = prev.filter((ev) => ev.appointmentData?.id !== eventToUpdateId);
        
        const updatedEvent = {
          ...event,
          start: startDate,
          end: endDate,
          appointmentData: {
            ...event.appointmentData,
            start_time: startIso,
            end_time: endIso
          }
        };
        
        return [...filtered, updatedEvent];
      });
      
      // Preparar dados para atualização no backend
      const updateData = {
        start_time: startIso,
        end_time: endIso,
      };
      
      // Chamar a API para atualizar o agendamento
      await appointmentService.updateAppointment(event.appointmentData.id, updateData);
      
      toast.success('Duração do agendamento atualizada com sucesso!');
    } catch (error: any) {
      // Log completo do erro para debug
      console.error('Erro ao atualizar duração do agendamento:', error);
      
      // Verificar se é um erro de conflito de agendamento
      const errorMessage = error?.rawResponse?.error?.message || error?.message;
      
      if (errorMessage?.includes('existe um agendamento')) {
        // Mensagem simples de conflito sem tentar localizar o evento específico
        toast.error('Já existe um agendamento neste horário para este profissional');
      } else {
        // Mostrar mensagem genérica para outros erros
        toast.error('Não foi possível alterar a duração do agendamento');
      }
      
      // Em caso de erro, recarregar agendamentos para garantir consistência
      fetchAppointments(currentDate, currentView);
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    // Encontrar a cor do funcionário associado ao evento
    const resource = resources.find(res => res.id === event.resourceId);
    const resourceColor = resource?.imageUrl ? '#3174ad' : '#3174ad';
    
    // Estilo diferente para horários bloqueados
    if (event.isBlocked) {
      return {
        style: {
          backgroundColor: '#f2f2f2',
          color: '#666',
          borderLeft: '4px solid #ccc',
          borderRadius: '4px',
          opacity: 0.9,
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
        }
      };
    }
    
    // Cores diferentes baseadas no status do agendamento
    let backgroundColor, textColor, borderColor;
    
    switch (event.status) {
      case 'completed':
        backgroundColor = '#66bb6a'; // Verde médio
        textColor = '#fff'; // Texto branco para contraste
        borderColor = '#388e3c'; // Verde escuro
        break;
      case 'confirmed':
        backgroundColor = '#42a5f5'; // Azul médio
        textColor = '#fff'; // Texto branco para contraste
        borderColor = '#1976d2'; // Azul escuro
        break;
      case 'waiting':
        backgroundColor = '#ffb74d'; // Laranja médio
        textColor = '#fff'; // Texto branco para contraste
        borderColor = '#f57c00'; // Laranja escuro
        break;
      case 'in_progress':
        backgroundColor = '#7e57c2'; // Roxo médio
        textColor = '#fff'; // Texto branco para contraste
        borderColor = '#5e35b1'; // Roxo escuro
        break;
      case 'absent':
        backgroundColor = '#ef9a9a'; // Vermelho claro
        textColor = '#fff'; // Texto branco para contraste
        borderColor = '#e53935'; // Vermelho médio
        break;
      case 'canceled':
        backgroundColor = '#ef5350'; // Vermelho médio
        textColor = '#fff'; // Texto branco para contraste
        borderColor = '#c62828'; // Vermelho escuro
        break;
      case 'scheduled':
      default:
        backgroundColor = '#90caf9'; // Azul claro
        textColor = '#fff'; // Texto branco para contraste
        borderColor = resourceColor; // Cor do funcionário
        break;
    }
    
    return {
      style: {
        backgroundColor: backgroundColor,
        color: textColor,
        borderLeft: `4px solid ${borderColor}`,
        cursor: 'pointer',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
      }
    };
  };

  const DnDCalendar = withDragAndDrop<CalendarEvent, Resource>(Calendar);

  // Função para estilizar as células do calendário
  const slotPropGetter = (date: Date, resourceId?: string | number) => {
    // Se não temos célula selecionada ou parâmetros inválidos, retornar estilo padrão
    if (!selectedCell || !resourceId) return {};
    
    // Convertemos o resourceId para string para garantir compatibilidade
    const resourceIdStr = String(resourceId);
    
    // Verificar se esta é a célula selecionada
    const isSelected = 
      resourceIdStr === selectedCell.resourceId && 
      date.getHours() === selectedCell.slotTime.getHours() && 
      date.getMinutes() === selectedCell.slotTime.getMinutes();
    
    if (isSelected) {
      return {
        className: 'selected-cell',
      };
    }
    
    return {};
  };

  // Função para lidar com mudanças na data ou visualização do calendário
  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };
  
  // Função para quando um evento existente é clicado (agora abre o modal de checkout)
  const handleSelectEvent = (event: CalendarEvent, e: React.SyntheticEvent) => {
    // Se o evento for um bloqueio de horário, não fazer nada
    if (event.isBlocked) return;
    
    // Verificar se temos os dados do agendamento
    if (!event.appointmentData) {
      toast.error('Não foi possível carregar os detalhes deste agendamento');
      return;
    }
    
    // Armazenar o agendamento selecionado e mostrar o modal de checkout
    setSelectedAppointment(event.appointmentData);
    setCheckoutModalVisible(true);
  };
  
  // Função para fechar o modal de checkout
  const handleCloseCheckoutModal = () => {
    setCheckoutModalVisible(false);
    setSelectedAppointment(null);
  };
  
  // Função para lidar com o checkout completo
  const handleCompleteCheckout = async (appointmentId: string) => {
    try {
      // Marcar o agendamento como concluído
      await appointmentService.completeAppointment(appointmentId);
      
      // Recarregar agendamentos para atualizar a visualização
      fetchAppointments(currentDate, currentView);
      
      // Fechar o modal de checkout
      setCheckoutModalVisible(false);
      setSelectedAppointment(null);
      
      toast.success('Agendamento finalizado com sucesso!');
    } catch (error) {
      console.error('Erro ao finalizar o agendamento:', error);
      toast.error('Não foi possível finalizar o agendamento');
    }
  };

  // Função para cancelar um agendamento
  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await appointmentService.cancelAppointment(appointmentId);
      toast.success('Agendamento cancelado com sucesso!');
      
      // Fechar o modal de detalhes
      setAppointmentDetailsModalVisible(false);
      setSelectedAppointment(null);
      
      // Atualizar eventos do calendário
      fetchAppointments(currentDate, currentView);
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      toast.error('Não foi possível cancelar o agendamento');
    }
  };
  
  // Função para marcar agendamento como concluído
  const handleCompleteAppointment = async (appointmentId: string) => {
    try {
      await appointmentService.completeAppointment(appointmentId);
      toast.success('Agendamento concluído com sucesso!');
      
      // Fechar o modal de detalhes
      setAppointmentDetailsModalVisible(false);
      setSelectedAppointment(null);
      
      // Atualizar eventos do calendário
      fetchAppointments(currentDate, currentView);
    } catch (error) {
      console.error('Erro ao concluir agendamento:', error);
      toast.error('Não foi possível concluir o agendamento');
    }
  };
  
  // Nova função para mudar o status do agendamento
  const handleChangeStatus = async (appointmentId: string, newStatus: 'scheduled' | 'confirmed' | 'waiting' | 'in_progress' | 'absent' | 'completed' | 'canceled') => {
    try {
      await appointmentService.updateAppointment(appointmentId, {
        status: newStatus
      });
      
      // Mensagens específicas para cada status
      const statusMessages: { [key: string]: string } = {
        'confirmed': 'Agendamento confirmado com sucesso!',
        'waiting': 'Cliente marcado como aguardando!',
        'in_progress': 'Atendimento iniciado com sucesso!',
        'absent': 'Cliente marcado como ausente!'
      };
      
      toast.success(statusMessages[newStatus] || 'Status atualizado com sucesso!');
      
      // Fechar o modal de detalhes
      setAppointmentDetailsModalVisible(false);
      setSelectedAppointment(null);
      
      // Atualizar eventos do calendário 
      fetchAppointments(currentDate, currentView);
    } catch (error) {
      console.error('Erro ao atualizar status do agendamento:', error);
      toast.error('Não foi possível atualizar o status do agendamento');
    }
  };

  // Função para lidar com mudanças de status
  const handleStatusChange = async (appointmentId: string) => {
    // Atualizar lista de agendamentos
    fetchAppointments(currentDate, currentView);
    
    // Fechar o modal de checkout e limpar o agendamento selecionado
    setCheckoutModalVisible(false);
    setSelectedAppointment(null);
  };

  // Se estiver carregando, mostrar mensagem de carregamento
  if (loading) {
    return <div className="calendar-loading">Carregando calendário...</div>;
  }

  const timeSlotWrapper: React.ComponentType<{ children?: React.ReactNode }> = ({ children }) => {
    return <div className="rbc-time-slot">{children}</div>;
  };

  return (
    <div className="calendar-container" ref={calendarRef}>
      <DnDCalendar
        localizer={localizer}
        events={events}
        view={currentView as View}
        onView={setCurrentView}
        date={currentDate}
        defaultView={Views.DAY}
        views={['day']}
        step={15}
        timeslots={2}
        min={minTime}
        max={maxTime}
        resources={resources}
        resourceIdAccessor="id"
        resourceTitleAccessor="title"
        rtl={false}
        className="barber-calendar"
        eventPropGetter={eventStyleGetter}
        selectable
        draggableAccessor={(event) => event.isDraggable !== false}
        resizable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        messages={messages}
        formats={{
          timeGutterFormat: (date) => format(date, 'HH:mm'),
          eventTimeRangeFormat: ({ start, end }) => 
            `${format(start, 'HH:mm')}`,
          dayRangeHeaderFormat: ({ start, end }) => 
            `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`,
          dayHeaderFormat: (date) => format(date, "EEE dd MMM", { locale: ptBR }),
        }}
        slotPropGetter={slotPropGetter}
        onNavigate={handleNavigate}
        components={{
          timeSlotWrapper: timeSlotWrapper,
          toolbar: CustomToolbar,
          resourceHeader: CustomHeader as React.ComponentType<ResourceHeaderProps<Resource>>,
        }}
        getNow={() => new Date()}
      />
      
      {/* Modal para ações no slot */}
      <SlotModal
        isVisible={slotModalVisible}
        position={slotModalPosition}
        resourceId={selectedSlot?.resourceId || ''}
        start={selectedSlot?.start || new Date()}
        end={selectedSlot?.end || new Date()}
        onClose={handleCloseModal}
        onCreateAppointment={handleCreateAppointment}
        onBlockTime={handleBlockTime}
      />
      
      {/* Modal de detalhes do agendamento */}
      <AppointmentDetailsModal
        isVisible={appointmentDetailsModalVisible}
        position={appointmentDetailsModalPosition}
        appointment={selectedAppointment}
        onClose={() => setAppointmentDetailsModalVisible(false)}
        onCancelAppointment={handleCancelAppointment}
        onCompleteAppointment={handleCompleteAppointment}
        onChangeStatus={handleChangeStatus}
      />
      
      {/* Modal de checkout - substituindo o antigo pelo novo */}
      <CheckoutModal
        isOpen={checkoutModalVisible}
        onClose={handleCloseCheckoutModal}
        appointment={selectedAppointment}
        onCompleteCheckout={handleCompleteCheckout}
        onStatusChange={handleStatusChange}
      />
      
      {/* Modal para criar agendamento */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        employeeId={appointmentData?.employeeId || ''}
        employeeName={appointmentData?.employeeName || ''}
        startTime={appointmentData?.startTime || new Date()}
        endTime={appointmentData?.endTime || new Date()}
        onSave={handleSaveAppointment}
      />
    </div>
  );
};

export default BarberCalendar; 