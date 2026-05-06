const analyticsService = require('../services/analytics.service');
const asyncHandler     = require('../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDashboardStats(req.workspaceId);
  res.status(200).json({ status: 'success', data });
});

const getRevenueTrend = asyncHandler(async (req, res) => {
  const months = Math.min(24, parseInt(req.query.months) || 12);
  const data   = await analyticsService.getMonthlyRevenue(req.workspaceId, months);
  res.status(200).json({ status: 'success', data });
});

module.exports = { getDashboard, getRevenueTrend };