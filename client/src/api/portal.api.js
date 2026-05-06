import portalClient from '../portalClient';

export const portalApi = {
  // Full project view — milestones, deliverables, invoices
  getProject: (projectId) =>
    portalClient.get(`/portal/${projectId}`),

  // Mark invoice as viewed + get PDF URL
  viewInvoice: (projectId, invoiceId) =>
    portalClient.get(`/portal/${projectId}/invoice/${invoiceId}/view`),

  // Submit approval comment on a milestone
  approveMilestone: (projectId, milestoneId, comment) =>
    portalClient.post(
      `/portal/${projectId}/milestones/${milestoneId}/approve`,
      { comment }
    ),
};