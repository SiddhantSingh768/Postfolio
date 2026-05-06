import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/endpoints/invoices.api';

export const invoiceKeys = {
  all:    ['invoices'],
  list:   (params) => ['invoices', 'list', params],
  detail: (id)     => ['invoices', 'detail', id],
};

export const useInvoiceList = (params) =>
  useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn:  () => invoicesApi.list(params).then(r => r.data.data),
    keepPreviousData: true,
  });

export const useInvoice = (id) =>
  useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn:  () => invoicesApi.get(id).then(r => r.data.data.invoice),
    enabled:  !!id,
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => invoicesApi.create(data).then(r => r.data.data.invoice),
    onSuccess:  () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
};

export const useUpdateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => invoicesApi.update(id, data).then(r => r.data.data.invoice),
    onSuccess:  (_, { id }) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};

export const useSendInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => invoicesApi.send(id).then(r => r.data.data.invoice),
    onSuccess:  (_, id) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};

export const useGeneratePDF = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => invoicesApi.generatePDF(id).then(r => r.data.data),
    onSuccess:  (_, id) => qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) }),
  });
};

export const useCancelInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => invoicesApi.cancel(id).then(r => r.data.data.invoice),
    onSuccess:  (_, id) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};

export const useMarkPaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, razorpayPaymentId }) =>
      invoicesApi.markPaid(id, razorpayPaymentId).then(r => r.data.data.invoice),
    onSuccess:  (_, { id }) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};