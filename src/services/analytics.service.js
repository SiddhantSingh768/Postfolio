const Invoice   = require('../models/invoice.model');
const Project   = require('../models/project.model');
const Client    = require('../models/client.model');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');
const cache     = require('./cache.service');


const getDashboardStats = async (workspaceId) => {
  const cacheKey = cache.keys.dashboard(workspaceId);

  const cached = await cache.get(cacheKey);
  if (cached) {
    logger.info({ workspaceId }, 'Dashboard stats served from cache');
    return { ...cached, fromCache: true };
  }

  logger.info({ workspaceId }, 'Dashboard stats computed from DB');

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

  await cache.set(cacheKey, result, 300);

  return result;
};


const getRevenueStats = async (workspaceId) => {
  const now       = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

  const result = await Invoice.aggregate([
    {
      $match: {
        workspace: workspaceId,
        status:    'paid',
      }
    },
    {
      $facet: {
        allTime: [
          { $group: { _id: null, total: { $sum: '$paidAmount' }, count: { $sum: 1 } } }
        ],
        thisMonth: [
          { $match: { paidAt: { $gte: thisMonthStart } } },
          { $group: { _id: null, total: { $sum: '$paidAmount' }, count: { $sum: 1 } } }
        ],
        lastMonth: [
          { $match: { paidAt: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
          { $group: { _id: null, total: { $sum: '$paidAmount' }, count: { $sum: 1 } } }
        ],
      }
    }
  ]);

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

  return result.map(item => ({
    status:      item._id,
    count:       item.count,
    totalAmount: item.totalAmount,
  }));
};


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

  const filledData = fillMissingMonths(result, months);

  await cache.set(cacheKey, filledData, 300);

  return { data: filledData, fromCache: false };
};

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