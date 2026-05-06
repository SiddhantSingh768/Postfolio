import { useQuery, useQueryClient } from '@tanstack/react-query';
import axiosClient from '../api/axiosClient';

export const dashboardKeys = {
  stats:   ['dashboard', 'stats'],
  revenue: (months) => ['dashboard', 'revenue', months],
};

export const useDashboardStats = () =>
  useQuery({
    queryKey: dashboardKeys.stats,
    queryFn:  () => axiosClient.get('/analytics/dashboard').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

export const useRevenueTrend = (months = 12) =>
  useQuery({
    queryKey: dashboardKeys.revenue(months),
    queryFn:  () =>
      axiosClient
        .get(`/analytics/revenue?months=${months}`)
        .then(r => r.data.data.data),
    staleTime: 5 * 60 * 1000,
  });

export const useOnboardingStatus = () =>
  useQuery({
    queryKey: ['onboarding'],
    queryFn:  () =>
      axiosClient.get('/onboarding/status').then(r => r.data.data),
  });

export const useInvalidateDashboard = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: dashboardKeys.stats });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
};