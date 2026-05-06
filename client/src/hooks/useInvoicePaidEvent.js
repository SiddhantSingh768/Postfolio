import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../context/SocketContext';
import { dashboardKeys } from './useDashboard';
import { invoiceKeys }   from './useInvoices';

export const useInvoicePaidEvent = () => {
  const { socket }  = useSocket();
  const qc          = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleInvoicePaid = (data) => {
      console.log('Real-time: invoice paid', data);

      qc.invalidateQueries({ queryKey: dashboardKeys.stats });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });

      if (data?.invoiceId) {
        qc.invalidateQueries({
          queryKey: invoiceKeys.detail(data.invoiceId),
        });
      }
    };

    socket.on('invoice:paid', handleInvoicePaid);

    return () => {
      socket.off('invoice:paid', handleInvoicePaid);
    };
  }, [socket, qc]);
};