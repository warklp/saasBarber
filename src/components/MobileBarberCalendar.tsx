'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, setHours, setMinutes, isBefore, isAfter, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { employeeService } from '@/lib/services/employeeService';
import appointmentService, { Appointment } from '@/lib/services/appointmentService';
import toast from 'react-hot-toast';
import AppointmentModal from './appointments/AppointmentModal';
import CheckoutModal from './appointments/CheckoutModal';
import './MobileCalendar.css';
import { BUSINESS_HOURS } from './BarberCalendar';

interface Employee {
  id: string;
  name: string;
  imageUrl?: string;
}

// Componente do calendário móvel
const MobileBarberCalendar = () => {
  // Estados para o calendário
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<Date[]>([]);

  // Estados para modais
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    employeeId: string;
    employeeName: string;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  // Buscar funcionários ao carregar o componente
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await employeeService.getEmployees();
        setEmployees(data);
        
        // Selecionar o primeiro funcionário por padrão
        if (data.length > 0 && !selectedEmployee) {
          setSelectedEmployee(data[0]);
        }
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        toast.error('Não foi possível carregar a lista de funcionários');
      }
    };
    
    fetchEmployees();
  }, [selectedEmployee]);

  // Gerar time slots (de 30 em 30 minutos)
  useEffect(() => {
    const slots: Date[] = [];
    const startHour = BUSINESS_HOURS.OPEN_HOUR;  // Usando a constante global
    const endHour = BUSINESS_HOURS.CLOSE_HOUR;   // Usando a constante global
    
    for (let hour = startHour; hour < endHour; hour++) {
      // Adicionar slot na hora cheia
      slots.push(setHours(setMinutes(new Date(currentDate), 0), hour));
      // Adicionar slot na meia hora
      slots.push(setHours(setMinutes(new Date(currentDate), 30), hour));
    }
    
    setTimeSlots(slots);
  }, [currentDate]);

  // Buscar agendamentos para o funcionário e data selecionados
  const fetchAppointments = useCallback(async () => {
    if (!selectedEmployee) return;
    
    try {
      setLoading(true);
      
      const startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(currentDate);
      endDate.setHours(23, 59, 59, 999);
      
      const appointmentsData = await appointmentService.getAppointments({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        employee_id: selectedEmployee.id
      });
      
      setAppointments(appointmentsData);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast.error('Não foi possível carregar os agendamentos');
    } finally {
      setLoading(false);
    }
  }, [currentDate, selectedEmployee]);

  // Atualizar agendamentos quando o funcionário ou data mudar
  useEffect(() => {
    if (selectedEmployee) {
      fetchAppointments();
    }
  }, [selectedEmployee, currentDate, fetchAppointments]);

  // Verificar se um slot está ocupado por algum agendamento
  const getAppointmentForSlot = (slot: Date) => {
    const slotStart = new Date(slot);
    const slotEnd = new Date(slot);
    slotEnd.setMinutes(slotEnd.getMinutes() + 30);
    
    return appointments.find(appointment => {
      const appointmentStart = parseISO(appointment.start_time);
      const appointmentEnd = parseISO(appointment.end_time);
      
      // Verificar se o slot corresponde ao horário exato do agendamento
      // Slot e agendamento devem começar na mesma hora
      const startHour = appointmentStart.getHours();
      const startMinute = appointmentStart.getMinutes();
      
      return slotStart.getHours() === startHour && 
             slotStart.getMinutes() === startMinute;
    });
  };

  // Função para ir para o dia anterior
  const goToPreviousDay = () => {
    const newDate = addDays(currentDate, -1);
    setCurrentDate(newDate);
  };

  // Função para ir para o próximo dia
  const goToNextDay = () => {
    const newDate = addDays(currentDate, 1);
    setCurrentDate(newDate);
  };

  // Função para ir para hoje
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Função para manipular clique em um slot
  const handleSlotClick = (slot: Date) => {
    // Verificar se já existe um agendamento neste slot
    const existingAppointment = getAppointmentForSlot(slot);
    
    if (existingAppointment) {
      // Se já existe um agendamento, mostrar detalhes
      setSelectedAppointment(existingAppointment);
      setIsCheckoutModalOpen(true);
    } else if (selectedEmployee) {
      // Se não existe, abrir o modal para criar um novo
      const endTime = new Date(slot);
      endTime.setMinutes(endTime.getMinutes() + 30);
      
      setSelectedSlot({
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        startTime: slot,
        endTime: endTime
      });
      setIsAppointmentModalOpen(true);
    }
  };

  // Função para quando um checkout é completado
  const handleCheckoutCompleted = (appointmentId: string) => {
    fetchAppointments();
  };
  
  // Função para lidar com mudanças de status
  const handleStatusChange = (appointmentId: string) => {
    fetchAppointments();
    
    // Fechar o modal de checkout
    setIsCheckoutModalOpen(false);
    setSelectedAppointment(null);
  };

  // Formatação da data atual
  const formattedDate = format(currentDate, "EEEE d", { locale: ptBR });

  // Renderizar o componente
  return (
    <div className="mobile-calendar-container">
      {/* Barra superior com data */}
      <div className="mobile-calendar-date-bar">
        <div className="mobile-calendar-date-controls">
          <button className="mobile-calendar-today-button" onClick={goToToday}>
            Hoje
          </button>
          
          <div className="mobile-calendar-nav-buttons">
            <button className="mobile-calendar-arrow-button" onClick={goToPreviousDay}>
              <ChevronLeft size={16} />
            </button>
            <button className="mobile-calendar-arrow-button" onClick={goToNextDay}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        
        <div className="mobile-calendar-current-date">
          {formattedDate}
        </div>
      </div>
      
      {/* Seleção de profissionais */}
      <div className="mobile-calendar-professionals">
        <div className="mobile-calendar-professionals-list">
          {employees.map(employee => (
            <button
              key={employee.id}
              className={`mobile-calendar-professional-button ${selectedEmployee?.id === employee.id ? 'active' : ''}`}
              onClick={() => setSelectedEmployee(employee)}
            >
              <div className="mobile-calendar-professional-avatar">
                {employee.imageUrl ? (
                  <img 
                    src={employee.imageUrl} 
                    alt={employee.name} 
                    className="mobile-calendar-professional-image" 
                  />
                ) : (
                  <div className="mobile-calendar-professional-initials">
                    {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
              </div>
              <span className="mobile-calendar-professional-name">{employee.name}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Grade de horários */}
      <div className="mobile-calendar-timeslots">
        {loading ? (
          <div className="mobile-calendar-loading">Carregando...</div>
        ) : (
          <div className="mobile-calendar-slots-grid">
            <div className="mobile-calendar-time-column">
              {timeSlots.map((slot, index) => (
                <div key={index} className="mobile-calendar-time-cell">
                  {format(slot, 'HH:mm')}
                </div>
              ))}
            </div>
            
            <div className="mobile-calendar-events-column">
              {timeSlots.map((slot, index) => {
                const appointment = getAppointmentForSlot(slot);
                
                return (
                  <div 
                    key={index} 
                    className={`mobile-calendar-event-cell ${appointment ? 'has-appointment' : ''}`}
                    onClick={() => handleSlotClick(slot)}
                  >
                    {appointment && (
                      <div className={`mobile-calendar-appointment ${appointment.status || 'scheduled'}`}>
                        <div className="mobile-calendar-appointment-title">
                          {appointment.client?.name || 'Cliente'}
                        </div>
                        <div className="mobile-calendar-appointment-service">
                          {Array.isArray(appointment.services) && appointment.services.length > 0
                            ? appointment.services[0].service?.name
                            : appointment.service?.name || 'Serviço'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Modais */}
      {isAppointmentModalOpen && selectedSlot && (
        <AppointmentModal
          isOpen={isAppointmentModalOpen}
          onClose={() => setIsAppointmentModalOpen(false)}
          employeeId={selectedSlot.employeeId}
          employeeName={selectedSlot.employeeName}
          startTime={selectedSlot.startTime}
          endTime={selectedSlot.endTime}
          onSave={() => {
            setIsAppointmentModalOpen(false);
            fetchAppointments();
            toast.success('Agendamento criado com sucesso!');
          }}
        />
      )}
      
      {isCheckoutModalOpen && selectedAppointment && (
        <CheckoutModal
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          appointment={selectedAppointment}
          onCompleteCheckout={handleCheckoutCompleted}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

export default MobileBarberCalendar; 