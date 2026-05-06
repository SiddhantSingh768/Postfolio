const PDFDocument = require('pdfkit');
const { cloudinary } = require('../config/cloudinary');
const logger  = require('../config/logger');
const AppError = require('../utils/AppError');


const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });

const BLUE   = '#1A56DB';
const DARK   = '#111827';
const MID    = '#374151';
const MUTED  = '#6B7280';
const LIGHT  = '#EFF6FF';
const BORDER = '#E5E7EB';
const WHITE  = '#FFFFFF';
const GREEN  = '#059669';
const RED    = '#DC2626';

const STATUS_COLORS = {
  draft:          MUTED,
  sent:           BLUE,
  viewed:         '#7C3AED',
  paid:           GREEN,
  overdue:        RED,
  payment_failed: RED,
  cancelled:      '#9CA3AF',
};


const buildInvoicePDF = (invoice, freelancer, client) => {
  return new Promise((resolve, reject) => {
    try {
      const doc    = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks = [];

      doc.on('data',  chunk => chunks.push(chunk));
      doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
      doc.on('error', err   => reject(err));

      const W = 595 - 96;
      const L = 48;

      doc.rect(L, 48, W, 64).fill(BLUE);

      doc.fillColor(WHITE)
         .fontSize(18).font('Helvetica-Bold')
         .text(freelancer.name || 'Freelancer', L + 16, 64, { width: 250 });

      doc.fontSize(22).font('Helvetica-Bold')
         .text('INVOICE', L + 260, 58, { width: 223, align: 'right' });

      doc.fontSize(10).font('Helvetica')
         .text(invoice.invoiceNumber, L + 260, 84, { width: 223, align: 'right' });

      const badgeColor = STATUS_COLORS[invoice.status] || MUTED;
      const badgeLabel = invoice.status.replace('_', ' ').toUpperCase();
      const badgeW     = doc.widthOfString(badgeLabel) + 20;
      const badgeX     = L + W - badgeW;

      doc.rect(badgeX, 120, badgeW, 20).fill(badgeColor);
      doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold')
         .text(badgeLabel, badgeX, 126, { width: badgeW, align: 'center' });

      let y = 150;
      if (freelancer.profile?.gstin) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica')
           .text(`GSTIN: ${freelancer.profile.gstin}`, L, y);
        y += 14;
      }

      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(BORDER).lineWidth(1).stroke();
      y += 16;

      const col = W / 3;

      doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold')
         .text('BILLED TO', L, y);
      doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
         .text(client.name, L, y + 12);
      if (client.company) {
        doc.fillColor(MID).fontSize(9).font('Helvetica')
           .text(client.company, L, y + 26);
      }
      doc.fillColor(MID).fontSize(9).font('Helvetica')
         .text(client.email, L, y + (client.company ? 38 : 26));
      if (client.gstin) {
        doc.fillColor(MUTED).fontSize(8)
           .text(`GSTIN: ${client.gstin}`, L, y + (client.company ? 50 : 38));
      }

      const dateX = L + col;
      doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold')
         .text('INVOICE DATE', dateX, y);
      doc.fillColor(DARK).fontSize(10).font('Helvetica')
         .text(formatDate(invoice.issueDate), dateX, y + 12);

      doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold')
         .text('DUE DATE', dateX, y + 30);
      const dueDateColor = invoice.status === 'overdue' ? RED : DARK;
      doc.fillColor(dueDateColor).fontSize(10).font('Helvetica')
         .text(formatDate(invoice.dueDate), dateX, y + 42);

      if (invoice.project?.title) {
        const projX = L + col * 2;
        doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold')
           .text('PROJECT', projX, y);
        doc.fillColor(DARK).fontSize(9).font('Helvetica')
           .text(invoice.project.title, projX, y + 12, { width: col });
      }

      y += 80;

      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(BORDER).lineWidth(1).stroke();
      y += 14;

      doc.rect(L, y, W, 24).fill(BLUE);

      const cols = {
        desc:  { x: L + 8,       w: 190 },
        qty:   { x: L + 206,     w: 50  },
        price: { x: L + 264,     w: 90  },
        gst:   { x: L + 362,     w: 50  },
        total: { x: L + 420,     w: 75  },
      };

      doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold');
      doc.text('DESCRIPTION',  cols.desc.x,  y + 8);
      doc.text('QTY',          cols.qty.x,   y + 8, { width: cols.qty.w,   align: 'center' });
      doc.text('UNIT PRICE',   cols.price.x, y + 8, { width: cols.price.w, align: 'right'  });
      doc.text('GST',          cols.gst.x,   y + 8, { width: cols.gst.w,   align: 'center' });
      doc.text('AMOUNT',       cols.total.x, y + 8, { width: cols.total.w, align: 'right'  });

      y += 24;

      invoice.lineItems.forEach((item, idx) => {
        const rowH   = 28;
        const rowBg  = idx % 2 === 0 ? WHITE : '#F9FAFB';
        const lineTotal = item.amount * (1 + item.gstRate / 100);

        doc.rect(L, y, W, rowH).fill(rowBg);

        doc.fillColor(DARK).fontSize(9).font('Helvetica');
        doc.text(item.description,              cols.desc.x,  y + 9, { width: cols.desc.w  });
        doc.text(String(item.qty),              cols.qty.x,   y + 9, { width: cols.qty.w,   align: 'center' });
        doc.text(formatINR(item.unitPrice),     cols.price.x, y + 9, { width: cols.price.w, align: 'right'  });
        doc.text(`${item.gstRate}%`,            cols.gst.x,   y + 9, { width: cols.gst.w,   align: 'center' });
        doc.text(formatINR(lineTotal),          cols.total.x, y + 9, { width: cols.total.w, align: 'right'  });

        y += rowH;
      });

      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(BORDER).lineWidth(1).stroke();
      y += 16;

      const totalsX = L + W - 220;
      const totalsW = 220;

      const drawTotalRow = (label, value, isBold = false, color = MID) => {
        doc.fillColor(MUTED).fontSize(9)
           .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
           .text(label, totalsX, y, { width: 120 });
        doc.fillColor(color).fontSize(9)
           .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
           .text(value, totalsX + 120, y, { width: 100, align: 'right' });
        y += 16;
      };

      drawTotalRow('Subtotal', formatINR(invoice.subtotal));

      const gstByRate = invoice.lineItems.reduce((acc, item) => {
        const key = `${item.gstRate}%`;
        if (!acc[key]) acc[key] = 0;
        acc[key] += Math.round(item.amount * (item.gstRate / 100) * 100) / 100;
        return acc;
      }, {});

      Object.entries(gstByRate).forEach(([rate, amount]) => {
        if (amount > 0) drawTotalRow(`GST @ ${rate}`, formatINR(amount));
      });

      doc.moveTo(totalsX, y).lineTo(totalsX + totalsW, y)
         .strokeColor(BORDER).lineWidth(1).stroke();
      y += 8;

      drawTotalRow('TOTAL DUE', formatINR(invoice.grandTotal), true, BLUE);

      if (invoice.paidAmount) {
        drawTotalRow('Amount Paid', formatINR(invoice.paidAmount), false, GREEN);
      }

      y += 8;

      if (invoice.razorpayLinkUrl) {
        doc.rect(L, y, W, 36).fill(LIGHT);
        doc.fillColor(BLUE).fontSize(8).font('Helvetica-Bold')
           .text('PAY ONLINE:', L + 12, y + 8);
        doc.fillColor(BLUE).fontSize(8).font('Helvetica')
           .text(invoice.razorpayLinkUrl, L + 12, y + 20, { width: W - 24 });
        y += 48;
      }

      if (invoice.notes) {
        doc.rect(L, y, 3, 36).fill(BLUE);
        doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold')
           .text('NOTES', L + 12, y + 4);
        doc.fillColor(MID).fontSize(9).font('Helvetica')
           .text(invoice.notes, L + 12, y + 16, { width: W - 12 });
        y += 50;
      }

      doc.moveTo(L, 780).lineTo(L + W, 780).strokeColor(BORDER).lineWidth(1).stroke();
      doc.fillColor(MUTED).fontSize(8).font('Helvetica')
         .text(
           `Generated by Postfolio  ·  ${formatDate(new Date())}  ·  ${invoice.invoiceNumber}`,
           L, 788, { width: W, align: 'center' }
         );

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
};


const uploadPDFToCloudinary = (pdfBuffer, invoiceNumber, workspaceId) => {
  return new Promise((resolve, reject) => {
    const filename = `invoice_${invoiceNumber}_${Date.now()}`;
    const folder   = `postfolio/${workspaceId}/invoices`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder,
        public_id:     filename,
        type:          'upload',
        format:        'pdf',
      },
      (error, result) => {
        if (error) {
          logger.error({ error, invoiceNumber }, 'Cloudinary PDF upload failed');
          return reject(new AppError(500, 'PDF_UPLOAD_FAILED', 'Failed to upload PDF'));
        }
        logger.info({ publicId: result.public_id }, 'PDF uploaded to Cloudinary');
        resolve({ publicId: result.public_id, secureUrl: result.secure_url });
      }
    );

    uploadStream.end(pdfBuffer);
  });
};


const generateAndUploadPDF = async (invoice, freelancer, client) => {
  try {
    const pdfBuffer = await buildInvoicePDF(invoice, freelancer, client);
    logger.info({ invoiceId: invoice._id, size: pdfBuffer.length }, 'PDF generated');
    return uploadPDFToCloudinary(
      pdfBuffer,
      invoice.invoiceNumber,
      invoice.workspace.toString()
    );
  } catch (err) {
    logger.error({ err: err.message, invoiceId: invoice._id }, 'PDF generation failed');
    throw new AppError(500, 'PDF_GENERATION_FAILED', 'Failed to generate invoice PDF');
  }
};

module.exports = { generateAndUploadPDF };