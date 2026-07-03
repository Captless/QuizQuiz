const JSZip = require('jszip');

async function extractTextFromPPTX(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PPTX buffer');
  }

  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter(p => p.startsWith('ppt/slides/slide') && p.endsWith('.xml'))
    .sort();

  if (slideFiles.length === 0) {
    throw new Error('No slides found in PPTX file');
  }

  let text = '';
  for (const file of slideFiles) {
    const content = await zip.file(file).async('string');
    const textMatches = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    for (const match of textMatches) {
      const innerText = match.replace(/<[^>]+>/g, '');
      if (innerText.trim()) {
        text += innerText.trim() + ' ';
      }
    }
  }

  text = text.trim();
  if (!text || text.length < 20) {
    throw new Error('Could not extract enough text from PPTX. It may contain only images or empty slides.');
  }
  return text;
}

module.exports = { extractTextFromPPTX };
