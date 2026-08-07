import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker from CDN for reliable browser compatibility
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker initialization notice:', e);
}

/**
 * Parses text content from a PDF file ArrayBuffer.
 */
export async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageItems = textContent.items as any[];
      const pageText = pageItems
        .map((item) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ');

      if (pageText.trim()) {
        fullText += `\n\n# Page ${pageNum}\n\n` + pageText;
      }
    }

    if (!fullText.trim()) {
      return 'Notice: The PDF appears to contain scanned images or empty pages. If this is a scanned PDF, OCR or direct text input may be required.';
    }

    return fullText.trim();
  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to parse PDF document (${error.message || 'Unknown error'}). Please ensure the file is not password-protected.`);
  }
}

/**
 * Parses text content from a DOCX file ArrayBuffer.
 */
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = await zip.file('word/document.xml')?.async('text');
    if (!docXml) {
      throw new Error('Invalid DOCX structure (word/document.xml not found)');
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, 'text/xml');
    
    // Extract paragraph breaks and text runs
    const paragraphs = xmlDoc.getElementsByTagName('w:p');
    const paragraphTexts: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const textNodes = p.getElementsByTagName('w:t');
      let pText = '';
      for (let j = 0; j < textNodes.length; j++) {
        pText += textNodes[j].textContent || '';
      }
      if (pText.trim()) {
        paragraphTexts.push(pText.trim());
      }
    }

    if (paragraphTexts.length > 0) {
      return paragraphTexts.join('\n\n');
    }

    // Fallback: extract all w:t nodes
    const textNodes = xmlDoc.getElementsByTagName('w:t');
    let text = '';
    for (let i = 0; i < textNodes.length; i++) {
      text += (textNodes[i].textContent || '') + ' ';
    }
    return text.replace(/\s+/g, ' ').trim();
  } catch (error: any) {
    console.error('Error parsing DOCX file:', error);
    throw new Error(`Failed to parse DOCX document (${error.message || 'Unknown error'}).`);
  }
}

/**
 * Parses text content from an EPUB file ArrayBuffer.
 */
export async function extractTextFromEpub(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    let fullText = '';
    const fileNames = Object.keys(zip.files);
    const htmlFiles = fileNames
      .filter((f) => f.endsWith('.xhtml') || f.endsWith('.html') || f.endsWith('.htm'))
      .sort();

    for (const fileName of htmlFiles) {
      const content = await zip.file(fileName)?.async('text');
      if (content) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const text = doc.body?.textContent || '';
        if (text.trim()) {
          fullText += text.trim() + '\n\n';
        }
      }
    }

    return fullText.trim() || 'Notice: EPUB contains no readable text files.';
  } catch (error: any) {
    console.error('Error parsing EPUB file:', error);
    throw new Error(`Failed to parse EPUB document (${error.message || 'Unknown error'}).`);
  }
}

/**
 * Reads a text file using FileReader as string.
 */
export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = (e) => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

/**
 * Universal text extractor for all supported file formats:
 * PDF (.pdf), DOCX (.docx), EPUB (.epub), Markdown (.md), Plain Text (.txt), CSV (.csv), JSON (.json), etc.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    return await extractTextFromPDF(buffer);
  }

  if (
    fileName.endsWith('.docx') ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const buffer = await file.arrayBuffer();
    return await extractTextFromDocx(buffer);
  }

  if (fileName.endsWith('.epub') || fileType === 'application/epub+zip') {
    const buffer = await file.arrayBuffer();
    return await extractTextFromEpub(buffer);
  }

  // Fallback to text reading for .txt, .md, .markdown, .csv, .json, .rtf, .html, .xml, .log, etc.
  try {
    const text = await readAsText(file);
    if (text && text.trim()) {
      return text;
    }
  } catch (e) {
    console.warn('readAsText failed, attempting arrayBuffer fallback:', e);
  }

  // Final fallback: arrayBuffer as UTF-8 text string
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(buffer);
}
