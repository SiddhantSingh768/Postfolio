import portalClient from '../portalClient';

export const portalApi = {
  getProject: (projectId) =>
    portalClient.get(`/portal/${projectId}`),
    
  viewInvoice: (projectId, invoiceId) =>
    portalClient.get(`/portal/${projectId}/invoice/${invoiceId}/view`),
    
  approveMilestone: (projectId, milestoneId, comment) =>
    portalClient.post(`/portal/${projectId}/milestones/${milestoneId}/approve`, { comment }),
};
