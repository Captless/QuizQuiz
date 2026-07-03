const pdfParse = require('pdf-parse');

async function extractTextFromPDF(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PDF buffer');
  }
  const data = await pdfParse(buffer);
  const text = (data.text || '').trim();
  if (!text || text.length < 20) {
    throw new Error('Could not extract enough text from PDF. It may be image-only or scanned.');
  }
  return text;
}

module.exports = { extractTextFromPDF };
