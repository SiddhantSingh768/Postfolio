
const VALID_GST_RATES = [0, 5, 12, 18, 28];

export const isValidGstRate = (rate) =>
  VALID_GST_RATES.includes(Number(rate));

export const computeTotals = (lineItems) => {
  let subtotal = 0;
  let totalGst = 0;

  const computed = lineItems.map(item => {
    const qty       = parseFloat(item.qty)       || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const gstRate   = parseFloat(item.gstRate)   || 0;

    const amount    = Math.round(qty * unitPrice * 100) / 100;
    const itemGst   = Math.round(amount * (gstRate / 100) * 100) / 100;

    subtotal += amount;
    totalGst += itemGst;

    return { ...item, amount };
  });

  subtotal   = Math.round(subtotal * 100) / 100;
  totalGst   = Math.round(totalGst * 100) / 100;
  const grandTotal = Math.round((subtotal + totalGst) * 100) / 100;

  return { computed, subtotal, totalGst, grandTotal };
};

export const getGstBreakdown = (lineItems) => {
  const breakdown = {};
  lineItems.forEach(item => {
    const rate   = parseFloat(item.gstRate) || 0;
    const amount = parseFloat(item.amount)  || 0;
    const gst    = Math.round(amount * (rate / 100) * 100) / 100;
    if (gst > 0) {
      const key = `${rate}%`;
      breakdown[key] = (breakdown[key] || 0) + gst;
    }
  });
  return breakdown;
};

export const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n || 0);

export const EMPTY_LINE_ITEM = {
  description: '',
  qty:         1,
  unitPrice:   '',
  gstRate:     18,
  amount:      0,
};