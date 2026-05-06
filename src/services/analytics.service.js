const Invoice   = require('../models/invoice.model');
const Project   = require('../models/project.model');
const Client    = require('../models/client.model');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');
const cache     = require('./cache.service');

// ─── Dashboard analytics ──────────────────────────────────────────────────────
//
// Runs 4 MongoDB aggregation pipelines and returns combined results.
// Results are cached in Redis for 5 minutes.
// Cache is invalidated whenever an invoice is created, updated, or paid.

const getDashboardStats = async (workspaceId) => {
  const cacheKey = cache.keys.dashboard(workspaceId);

  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    logger.info({ workspaceId }, 'Dashboard stats served from cache');
    return { ...cached, fromCache: true };
  }

  logger.info({ workspaceId }, 'Dashboard stats computed from DB');

  // Run all pipelines concurrently using Promise.all
  const [
    revenueStats,
    projectStats,
    invoiceBreakdown,
    topClients,
  ] = await Promise.all([
    getRevenueStats(workspaceId),
    getProjectStats(workspaceId),
    getInvoiceBreakdown(workspaceId),
    getTopClients(workspaceId),
  ]);

  const result = {
    revenue:          revenueStats,
    projects:         projectStats,
    invoiceBreakdown,
    topClients,
    computedAt:       new Date(),
    fromCache:        false,
  };

  // Store in cache — 5 minute TTL
  await cache.set(cacheKey, result, 300);

  return result;
};

// ─── Revenue stats pipeline ───────────────────────────────────────────────────

const getRevenueStats = async (workspaceId) => {
  const now       = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

  const result = await Invoice.aggregate([
    // Only look at this workspace's paid invoices
    {
      $match: {
        workspace: workspaceId,
        status:    'paid',
      }
    },
    // Use $facet to run multiple sub-pipelines in one query
    {
      $facet: {
        // All time total
        allTime: [
          { $group: { _id: null, total: { $sum: '$paidAmount' }, count: { $sum: 1 } } }
        ],
        // This month
        thisMonth: [
          { $match: { paidAt: { $gte: thisMonthStart } } },
          { $group: { _id: null, total: { $sum: '$paidAmount' }, count: { $sum: 1 } } }
        ],
        // Last month
        lastMonth: [
          { $match: { paidAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
          { $group: { _id: null, total: { $sum: '$paidAmount' }, count: { $sum: 1 } } }
        ],
      }
    }
  ]);

  // Outstanding amount — sum of all sent/viewed/overdue invoices
  const outstanding = await Invoice.aggregate([
    {
      $match: {
        workspace: workspaceId,
        status:    { $in: ['sent', 'viewed', 'overdue'] }
      }
    },
    {
      $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } }
    }
  ]);

  const facet = result[0];

  return {
    allTime:     facet.allTime[0]     || { total: 0, count: 0 },
    thisMonth:   facet.thisMonth[0]   || { total: 0, count: 0 },
    lastMonth:   facet.lastMonth[0]   || { total: 0, count: 0 },
    outstanding: outstanding[0]       || { total: 0, count: 0 },
  };
};

// ─── Project stats pipeline ───────────────────────────────────────────────────

const getProjectStats = async (workspaceId) => {
  const now            = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await Project.aggregate([
    { $match: { workspace: workspaceId, isDeleted: false } },
    {
      $facet: {
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        completedThisMonth: [
          {
            $match: {
              status:    'completed',
              updatedAt: { $gte: thisMonthStart }
            }
          },
          { $count: 'count' }
        ]
      }
    }
  ]);

  const facet    = result[0];
  const byStatus = facet.byStatus.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    active:             byStatus.active     || 0,
    draft:              byStatus.draft       || 0,
    completed:          byStatus.completed   || 0,
    on_hold:            byStatus.on_hold     || 0,
    cancelled:          byStatus.cancelled   || 0,
    completedThisMonth: facet.completedThisMonth[0]?.count || 0,
  };
};

// ─── Invoice status breakdown ─────────────────────────────────────────────────

const getInvoiceBreakdown = async (workspaceId) => {
  const result = await Invoice.aggregate([
    { $match: { workspace: workspaceId } },
    {
      $group: {
        _id:          '$status',
        count:        { $sum: 1 },
        totalAmount:  { $sum: '$grandTotal' },
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Transform into a more usable format
  return result.map(item => ({
    status:      item._id,
    count:       item.count,
    totalAmount: item.totalAmount,
  }));
};

// ─── Top clients by revenue ───────────────────────────────────────────────────

const getTopClients = async (workspaceId) => {
  const result = await Invoice.aggregate([
    {
      $match: {
        workspace: workspaceId,
        status:    'paid'
      }
    },
    {
      $group: {
        _id:      '$client',
        revenue:  { $sum: '$paidAmount' },
        invoices: { $sum: 1 },
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
    // Join with clients collection to get client name
    {
      $lookup: {
        from:         'clients',
        localField:   '_id',
        foreignField: '_id',
        as:           'clientInfo'
      }
    },
    { $unwind: { path: '$clientInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id:         0,
        clientId:    '$_id',
        clientName:  '$clientInfo.name',
        company:     '$clientInfo.company',
        revenue:     1,
        invoices:    1,
      }
    }
  ]);

  return result;
};

// ─── Monthly revenue trend ────────────────────────────────────────────────────
//
// Returns revenue per month for the last N months.
// Used for the line chart on the dashboard.

const getMonthlyRevenue = async (workspaceId, months = 12) => {
  const cacheKey = cache.keys.revenue(workspaceId, months);

  const cached = await cache.get(cacheKey);
  if (cached) return { data: cached, fromCache: true };

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const result = await Invoice.aggregate([
    {
      $match: {
        workspace: workspaceId,
        status:    'paid',
        paidAt:    { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year:  { $year:  '$paidAt' },
          month: { $month: '$paidAt' },
        },
        revenue: { $sum: '$paidAmount' },
        count:   { $sum: 1 },
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    {
      $project: {
        _id:     0,
        year:    '$_id.year',
        month:   '$_id.month',
        revenue: 1,
        count:   1,
        // Create a label like "Jan 2026"
        label: {
          $concat: [
            { $arrayElemAt: [
              ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
              '$_id.month'
            ]},
            ' ',
            { $toString: '$_id.year' }
          ]
        }
      }
    }
  ]);

  // Fill in months with 0 revenue so charts don't have gaps
  const filledData = fillMissingMonths(result, months);

  await cache.set(cacheKey, filledData, 300);

  return { data: filledData, fromCache: false };
};

// Helper: fills in months with no revenue as 0
// so the line chart always shows a continuous 12-month view
const fillMissingMonths = (data, months) => {
  const result = [];
  const now    = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year  = date.getFullYear();
    const month = date.getMonth() + 1; // JS months are 0-indexed

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const existing = data.find(d => d.year === year && d.month === month);

    result.push({
      year,
      month,
      label:   `${monthNames[month]} ${year}`,
      revenue: existing?.revenue || 0,
      count:   existing?.count   || 0,
    });
  }

  return result;
};

// ─── Invalidate dashboard cache ───────────────────────────────────────────────
//
// Called from invoice.service.js whenever an invoice is
// created, updated, sent, or paid.

const invalidateDashboardCache = async (workspaceId) => {
  await cache.del(cache.keys.dashboard(workspaceId));
  await cache.delPattern(`revenue:${workspaceId}:*`);
  logger.info({ workspaceId }, 'Dashboard cache invalidated');
};

module.exports = {
  getDashboardStats,
  getMonthlyRevenue,
  invalidateDashboardCache,
};