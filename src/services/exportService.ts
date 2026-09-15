import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  PageBreak, 
  Footer, 
  SectionType,
  PageNumber,
  ImageRun
} from "docx";
import JSZip from "jszip";

interface Chapter {
  id: string;
  title: string;
  content: string;
}

interface TrimDimensions {
  widthInInches: number;
  heightInInches: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
}

const FONT_SERIF = "Georgia";
const FONT_SANS = "Arial";

function base64ToUint8Array(base64: string) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Calculates page dimensions and margins based on chosen book trim size.
 * Supported KDP sizes: 5x8, 5.5x8.5, 6x9, 7x10, 8x10, 8.5x11
 */
function getTrimDimensions(trimSizeStr?: string): TrimDimensions {
  let width = 6;
  let height = 9;

  if (trimSizeStr) {
    const match = trimSizeStr.match(/([\d\.]+)\s*x\s*([\d\.]+)/i);
    if (match) {
      width = parseFloat(match[1]) || 6;
      height = parseFloat(match[2]) || 9;
    }
  }

  // Calculate industry standard KDP margins
  let marginLeft = 0.75;   // Inner gutter for binding
  let marginRight = 0.625; // Outer margin
  let marginTop = 0.75;
  let marginBottom = 0.75;

  if (width >= 8) {
    marginLeft = 0.875;
    marginRight = 0.75;
    marginTop = 0.875;
    marginBottom = 0.875;
  } else if (width <= 5.5) {
    marginLeft = 0.625;
    marginRight = 0.5;
    marginTop = 0.625;
    marginBottom = 0.625;
  }

  return {
    widthInInches: width,
    heightInInches: height,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom
  };
}

/**
 * Parses inline Markdown formatting (bold, italic, bold-italic, code) into Docx TextRun objects.
 */
function parseInlineFormatting(text: string, baseSize = 24): TextRun[] {
  if (!text) return [];

  const tokens = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
  const runs: TextRun[] = [];

  for (const token of tokens) {
    if (!token) continue;

    if (token.startsWith('***') && token.endsWith('***') && token.length > 6) {
      runs.push(new TextRun({
        text: token.slice(3, -3),
        font: FONT_SERIF,
        size: baseSize,
        bold: true,
        italics: true
      }));
    } else if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      runs.push(new TextRun({
        text: token.slice(2, -2),
        font: FONT_SERIF,
        size: baseSize,
        bold: true
      }));
    } else if ((token.startsWith('*') && token.endsWith('*') && token.length > 2) ||
               (token.startsWith('_') && token.endsWith('_') && token.length > 2)) {
      runs.push(new TextRun({
        text: token.slice(1, -1),
        font: FONT_SERIF,
        size: baseSize,
        italics: true
      }));
    } else if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      runs.push(new TextRun({
        text: token.slice(1, -1),
        font: FONT_SANS,
        size: baseSize - 2,
        color: "222222"
      }));
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const match = token.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        runs.push(new TextRun({
          text: match[1],
          font: FONT_SERIF,
          size: baseSize,
          underline: {},
          color: "1d4ed8"
        }));
      } else {
        runs.push(new TextRun({ text: token, font: FONT_SERIF, size: baseSize }));
      }
    } else {
      runs.push(new TextRun({
        text: token,
        font: FONT_SERIF,
        size: baseSize
      }));
    }
  }

  return runs;
}

/**
 * Resolves clean markdown asset references (`![alt](asset:id)`) into full base64 images
 * for DOCX, EPUB, and PDF exports. Also cleans up any unresolved placeholder tags.
 */
export function resolveMarkdownAssetImages(markdown: string, illustrations?: any[]): string {
  if (!markdown) return '';
  let resolved = markdown;

  if (illustrations && illustrations.length > 0) {
    const assetMap = new Map(illustrations.map((i: any) => [i.id, i.imageUrl]));
    resolved = resolved.replace(/!\[(.*?)\]\(asset:([^\s\)]+)\)/g, (match, alt, id) => {
      const imageUrl = assetMap.get(id);
      return imageUrl ? `![${alt}](${imageUrl})` : match;
    });
  }

  // Remove unresolved placeholder tags from final export so clean prose is published
  resolved = resolved.replace(/!\[(.*?)\]\((?:placeholder(?::[^\)\s]+)?|)\)\n*/g, '');
  resolved = resolved.replace(/\[(?:IMAGE|ILLUSTRATION|VISUAL|FIGURE):\s*([^\]]+)\]\n*/gi, '');

  return resolved;
}

/**
 * Converts chapter markdown content into properly formatted Docx Paragraph / Image items.
 */
function parseChapterMarkdownToDocx(markdown: string, maxImgWidthPx = 420): Paragraph[] {
  if (!markdown) return [];

  const rawBlocks = markdown.split(/\n\n+/);
  const paragraphs: Paragraph[] = [];
  let isFirstBodyParagraph = true;

  for (const block of rawBlocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    // 1. Check for Embedded Images in markdown: ![alt](data:image/png;base64,...)
    const imageMatch = trimmedBlock.match(/!\[(.*?)\]\((data:image\/[a-zA-Z]+;base64,[^\s\)]+)\)/);
    if (imageMatch) {
      const base64Data = imageMatch[2];
      try {
        const parts = base64Data.split(',');
        const mime = parts[0];
        const raw = parts[1];
        const imgType = mime.includes('png') ? "png" : "jpg";
        const bytes = base64ToUint8Array(raw);

        const targetWidth = Math.min(420, maxImgWidthPx);
        const targetHeight = Math.round(targetWidth * 0.65);

        paragraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: bytes,
                transformation: { width: targetWidth, height: targetHeight },
                type: imgType
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 }
          })
        );
        isFirstBodyParagraph = true;
        continue;
      } catch (err) {
        console.warn("Failed to parse embedded image in docx export:", err);
      }
    }

    // 2. Line by line processing within block
    const lines = trimmedBlock.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Heading 1 (# Heading)
      if (trimmedLine.startsWith('# ')) {
        const text = trimmedLine.replace(/^#\s+/, '');
        paragraphs.push(
          new Paragraph({
            children: parseInlineFormatting(text, 32),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            spacing: { before: 400, after: 200 }
          })
        );
        isFirstBodyParagraph = true;
      } 
      // Heading 2 (## Heading)
      else if (trimmedLine.startsWith('## ')) {
        const text = trimmedLine.replace(/^##\s+/, '');
        paragraphs.push(
          new Paragraph({
            children: parseInlineFormatting(text, 28),
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT,
            spacing: { before: 300, after: 150 }
          })
        );
        isFirstBodyParagraph = true;
      } 
      // Heading 3 (### Heading)
      else if (trimmedLine.startsWith('### ')) {
        const text = trimmedLine.replace(/^###\s+/, '');
        paragraphs.push(
          new Paragraph({
            children: parseInlineFormatting(text, 25),
            heading: HeadingLevel.HEADING_3,
            alignment: AlignmentType.LEFT,
            spacing: { before: 200, after: 100 }
          })
        );
        isFirstBodyParagraph = true;
      } 
      // Heading 4 (#### Heading)
      else if (trimmedLine.startsWith('#### ')) {
        const text = trimmedLine.replace(/^####\s+/, '');
        paragraphs.push(
          new Paragraph({
            children: parseInlineFormatting(text, 24),
            heading: HeadingLevel.HEADING_4,
            alignment: AlignmentType.LEFT,
            spacing: { before: 180, after: 90 }
          })
        );
        isFirstBodyParagraph = true;
      }
      // Blockquote (> text)
      else if (trimmedLine.startsWith('>')) {
        const text = trimmedLine.replace(/^>\s*/, '');
        paragraphs.push(
          new Paragraph({
            children: parseInlineFormatting(text, 23),
            indent: { left: 500, right: 300 },
            spacing: { before: 150, after: 150 },
            alignment: AlignmentType.LEFT
          })
        );
        isFirstBodyParagraph = true;
      }
      // Bullet list (- item or * item)
      else if (trimmedLine.match(/^[\*\-\+]\s+/)) {
        const text = trimmedLine.replace(/^[\*\-\+]\s+/, '');
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: "•  ", font: FONT_SERIF, size: 24, bold: true }),
              ...parseInlineFormatting(text, 24)
            ],
            indent: { left: 450 },
            spacing: { before: 60, after: 60 },
            alignment: AlignmentType.LEFT
          })
        );
        isFirstBodyParagraph = true;
      }
      // Numbered list (1. item)
      else if (trimmedLine.match(/^\d+\.\s+/)) {
        const match = trimmedLine.match(/^(\d+\.)\s+(.*)$/);
        const numPrefix = match ? match[1] + " " : "1. ";
        const text = match ? match[2] : trimmedLine;
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: numPrefix + " ", font: FONT_SERIF, size: 24, bold: true }),
              ...parseInlineFormatting(text, 24)
            ],
            indent: { left: 450 },
            spacing: { before: 60, after: 60 },
            alignment: AlignmentType.LEFT
          })
        );
        isFirstBodyParagraph = true;
      }
      // Horizontal Rule (--- or ***)
      else if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: "•  •  •", font: FONT_SERIF, size: 20, color: "888888" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 300 }
          })
        );
        isFirstBodyParagraph = true;
      }
      // Regular Paragraph
      else {
        paragraphs.push(
          new Paragraph({
            children: parseInlineFormatting(trimmedLine, 24),
            spacing: { line: 360, after: 120 }, // 1.5 line spacing
            alignment: AlignmentType.JUSTIFIED,
            indent: isFirstBodyParagraph ? { firstLine: 0 } : { firstLine: 360 } // Standard typography rule
          })
        );
        isFirstBodyParagraph = false;
      }
    }
  }

  return paragraphs;
}

export async function createDocxBlobAndTrim(bookDetails: any, chapters: Chapter[], coverUrl?: string | null) {
  const trim = getTrimDimensions(bookDetails?.trimSize);

  // Filter out meta-chapters like Table of Contents
  const filteredChapters = chapters.filter(ch => {
    const t = ch.title.toLowerCase().trim();
    return !t.includes('table of contents') && t !== 'contents';
  });

  // Load cover image bytes if coverUrl is present
  let coverBytes: Uint8Array | null = null;
  let coverImgType: "png" | "jpg" | "gif" | "bmp" = "jpg";

  if (coverUrl) {
    try {
      if (coverUrl.startsWith('data:image/')) {
        const parts = coverUrl.split(',');
        const mime = parts[0];
        coverImgType = mime.includes('png') ? "png" : mime.includes('gif') ? "gif" : "jpg";
        coverBytes = base64ToUint8Array(parts[1]);
      } else {
        const resp = await fetch(coverUrl);
        const buffer = await resp.arrayBuffer();
        coverBytes = new Uint8Array(buffer);
        if (coverUrl.includes('.png')) coverImgType = "png";
        else if (coverUrl.includes('.gif')) coverImgType = "gif";
      }
    } catch (e) {
      console.warn("Could not process coverUrl for docx export:", e);
    }
  }

  const printableWidthInches = trim.widthInInches - trim.marginLeft - trim.marginRight;
  const maxInlineImgWidthPx = Math.round(printableWidthInches * 96);

  const sections: any[] = [];

  // 1. FRONT COVER SECTION (Zero margins for exact full page cover fit)
  if (coverBytes) {
    sections.push({
      properties: {
        page: {
          size: {
            width: `${trim.widthInInches}in`,
            height: `${trim.heightInInches}in`,
          },
          margin: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          },
        },
      },
      children: [
        new Paragraph({
          children: [
            new ImageRun({
              data: coverBytes,
              transformation: {
                width: Math.round(trim.widthInInches * 96),
                height: Math.round(trim.heightInInches * 96)
              },
              type: coverImgType
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0, line: 20 }
        })
      ]
    });
  }

  // 2. FRONT MATTER SECTION (Title Page, Copyright, Contents)
  sections.push({
    properties: {
      page: {
        size: {
          width: `${trim.widthInInches}in`,
          height: `${trim.heightInInches}in`,
        },
        margin: {
          top: `${trim.marginTop}in`,
          bottom: `${trim.marginBottom}in`,
          left: `${trim.marginLeft}in`,
          right: `${trim.marginRight}in`,
        },
      },
    },
    children: [
      // Title Page
      new Paragraph({
        text: (bookDetails?.title || "Untitled").toUpperCase(),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 2000, after: 200 },
      }),
      ...(bookDetails?.subtitle ? [
        new Paragraph({
          text: (bookDetails.subtitle).toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: { after: 1200 },
        })
      ] : []),
      new Paragraph({
        text: `By ${bookDetails?.authorName || "Author"}`,
        alignment: AlignmentType.CENTER,
        spacing: { before: 1000 },
      }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // Copyright Page
      new Paragraph({
        text: `Copyright © ${new Date().getFullYear()} ${bookDetails?.authorName || "Author"}`,
        alignment: AlignmentType.CENTER,
        spacing: { before: 3000, after: 200 },
      }),
      new Paragraph({
        text: "All rights reserved.",
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: "No part of this book may be reproduced or transmitted in any form or by any means, electronic or mechanical, including photocopying, recording, or by any information storage and retrieval system, without permission in writing from the publisher.",
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
      }),
      ...(bookDetails?.isbn ? [
        new Paragraph({
          text: `ISBN: ${bookDetails.isbn}`,
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        })
      ] : []),
      
      new Paragraph({ children: [new PageBreak()] }),

      // Table of Contents
      new Paragraph({
        text: "Contents",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      ...chapters
        .filter(c => !c.title.toLowerCase().includes('table of contents') && !c.title.toLowerCase().includes('contents'))
        .map((chapter, idx) => {
          const isAuthor = chapter.title.toLowerCase().includes('about the author');
          const titleText = isAuthor ? "About the Author" : (chapter.title || `Chapter ${idx + 1}`);
          return new Paragraph({
            children: [
              new TextRun({
                text: titleText,
                font: FONT_SERIF,
                size: 24,
                bold: true
              })
            ],
            alignment: AlignmentType.LEFT,
            spacing: { before: 120, after: 120 },
          });
        }),
      
      new Paragraph({ children: [new PageBreak()] }),
    ],
  });

  // 3. MAIN MANUSCRIPT BODY SECTION (Chapters & About Author, with Footer page numbers)
  sections.push({
    properties: {
      page: {
        size: {
          width: `${trim.widthInInches}in`,
          height: `${trim.heightInInches}in`,
        },
        margin: {
          top: `${trim.marginTop}in`,
          bottom: `${trim.marginBottom}in`,
          left: `${trim.marginLeft}in`,
          right: `${trim.marginRight}in`,
        },
      },
      type: SectionType.NEXT_PAGE,
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                children: [PageNumber.CURRENT],
                font: FONT_SERIF,
                size: 20,
              }),
            ],
          }),
        ],
      }),
    },
    children: [
      ...(() => {
        const illustrationsList = bookDetails?.chapterIllustrations || (chapters as any).chapterIllustrations || [];
        return filteredChapters.filter(ch => !ch.title.toLowerCase().includes('about the author')).flatMap((chapter, idx) => {
          const chapterTitle = chapter.title || `Chapter ${idx + 1}`;
          const chapterContent = resolveMarkdownAssetImages(chapter.content || "", illustrationsList);
          const parsedDocxParagraphs = parseChapterMarkdownToDocx(chapterContent, maxInlineImgWidthPx);

          return [
            new Paragraph({
              text: chapterTitle.toUpperCase(),
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { before: 800, after: 800 },
              pageBreakBefore: idx > 0,
            }),
            ...parsedDocxParagraphs
          ];
        });
      })(),

      ...(() => {
        const authorChapter = filteredChapters.find(ch => ch.title.toLowerCase().includes('about the author'));
        const illustrationsList = bookDetails?.chapterIllustrations || (chapters as any).chapterIllustrations || [];
        const authorContent = resolveMarkdownAssetImages(bookDetails?.aboutAuthor || authorChapter?.content || "", illustrationsList);
        if (!authorContent) return [];

        return [
          new Paragraph({
            text: "ABOUT THE AUTHOR",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 800, after: 400 },
            pageBreakBefore: true,
          }),
          ...parseChapterMarkdownToDocx(authorContent, maxInlineImgWidthPx)
        ];
      })()
    ],
  });

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "normal",
          name: "Normal",
          run: {
            size: 24, // 12pt
            font: FONT_SERIF,
          },
          paragraph: {
            spacing: { line: 360 }, // 1.5 line spacing
            alignment: AlignmentType.JUSTIFIED,
          },
        },
      ],
    },
    sections,
  });

  const blob = await Packer.toBlob(doc);
  return { blob, trim };
}

export async function exportToDocx(bookDetails: any, chapters: Chapter[], coverUrl?: string | null) {
  const { blob, trim } = await createDocxBlobAndTrim(bookDetails, chapters, coverUrl);
  const safeTitle = (bookDetails?.title || "Untitled_Book").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${safeTitle}_KDP_${trim.widthInInches}x${trim.heightInInches}.docx`;
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function createEpubBlob(bookDetails: any, chapters: Chapter[], coverUrl?: string | null): Promise<Blob> {
  const zip = new JSZip();
  const bookTitle = bookDetails?.title || "Untitled Book";
  const authorName = bookDetails?.authorName || "Anonymous";
  const language = bookDetails?.language || "en";
  const bookId = `urn:uuid:${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;

  const validChapters = chapters.filter(ch => ch.title && (ch.content || "").trim());

  // 1. mimetype (MUST be first file, uncompressed)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file("META-INF/container.xml", containerXml);

  let hasCover = false;
  let coverDataBytes: Uint8Array | null = null;
  let coverMime = "image/jpeg";
  let coverExt = "jpg";

  if (coverUrl && coverUrl.startsWith("data:image/")) {
    try {
      const match = coverUrl.match(/^data:(image\/\w+);base64,/);
      if (match) {
        coverMime = match[1];
        if (coverMime.includes("png")) { coverExt = "png"; }
        const base64Data = coverUrl.replace(/^data:image\/\w+;base64,/, "");
        coverDataBytes = base64ToUint8Array(base64Data);
        hasCover = true;
      }
    } catch (e) {
      console.warn("Could not process cover image for EPUB:", e);
    }
  }

  // 3. Styles
  const cssContent = `
@page { margin: 5px; }
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  margin: 0;
  padding: 1em 1.5em;
  color: #111111;
  background-color: #ffffff;
}
h1 {
  font-size: 2em;
  text-align: center;
  margin-top: 2em;
  margin-bottom: 1em;
  font-weight: bold;
  page-break-before: always;
}
h2 {
  font-size: 1.5em;
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  text-align: center;
}
h3 {
  font-size: 1.2em;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
}
p {
  margin-top: 0;
  margin-bottom: 0.8em;
  text-indent: 1.25em;
  text-align: justify;
}
p.first-paragraph {
  text-indent: 0;
}
.cover-img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}
`;
  zip.file("OEBPS/styles.css", cssContent);

  if (hasCover && coverDataBytes) {
    zip.file(`OEBPS/cover.${coverExt}`, coverDataBytes);
    const coverXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
  <style>body { padding:0; margin:0; text-align:center; }</style>
</head>
<body>
  <div style="text-align:center; padding:0; margin:0;">
    <img src="cover.${coverExt}" alt="${escapeXml(bookTitle)}" class="cover-img"/>
  </div>
</body>
</html>`;
    zip.file("OEBPS/cover.xhtml", coverXhtml);
  }

  const chapterManifestItems: string[] = [];
  const chapterSpineItems: string[] = [];
  const illustrationsList = bookDetails?.chapterIllustrations || (chapters as any).chapterIllustrations || [];

  validChapters.forEach((ch, idx) => {
    const chNum = idx + 1;
    const fileId = `chapter_${chNum}`;
    const fileName = `chapter_${chNum}.xhtml`;

    chapterManifestItems.push(`<item id="${fileId}" href="${fileName}" media-type="application/xhtml+xml"/>`);
    chapterSpineItems.push(`<itemref idref="${fileId}"/>`);

    const resolvedChapterContent = resolveMarkdownAssetImages(ch.content || "", illustrationsList);
    const paragraphs = resolvedChapterContent
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(Boolean);

    let bodyHtml = `<h1>${escapeXml(ch.title)}</h1>\n`;
    paragraphs.forEach((p, pIdx) => {
      const imgMatch = p.match(/^!\[(.*?)\]\((data:image\/[a-zA-Z]+;base64,[^\s\)]+)\)$/);
      if (imgMatch) {
        bodyHtml += `<div class="chapter-illustration" style="text-align: center; margin: 2em 0;"><img src="${imgMatch[2]}" alt="${escapeXml(imgMatch[1])}" style="max-width: 100%; height: auto; border-radius: 8px;" /><p class="caption" style="font-size: 0.85em; color: #666; font-style: italic; margin-top: 0.5em;">${escapeXml(imgMatch[1])}</p></div>\n`;
      } else if (p.startsWith('# ')) {
        bodyHtml += `<h1>${escapeXml(p.replace(/^#\s+/, ''))}</h1>\n`;
      } else if (p.startsWith('## ')) {
        bodyHtml += `<h2>${escapeXml(p.replace(/^##\s+/, ''))}</h2>\n`;
      } else if (p.startsWith('### ')) {
        bodyHtml += `<h3>${escapeXml(p.replace(/^###\s+/, ''))}</h3>\n`;
      } else {
        const isFirst = pIdx === 0;
        bodyHtml += `<p class="${isFirst ? 'first-paragraph' : ''}">${escapeXml(p)}</p>\n`;
      }
    });

    const chXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>${escapeXml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
${bodyHtml}
</body>
</html>`;

    zip.file(`OEBPS/${fileName}`, chXhtml);
  });

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${validChapters.map((ch, idx) => `<li><a href="chapter_${idx + 1}.xhtml">${escapeXml(ch.title)}</a></li>`).join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
  zip.file("OEBPS/nav.xhtml", navXhtml);

  const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:creator>${escapeXml(authorName)}</dc:creator>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:publisher>Manus AI Studio</dc:publisher>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
    ${hasCover ? `<item id="cover-image" href="cover.${coverExt}" media-type="${coverMime}"/>` : ''}
    ${hasCover ? '<item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>' : ''}
    ${chapterManifestItems.join('\n    ')}
  </manifest>
  <spine>
    ${hasCover ? '<itemref idref="cover-page"/>' : ''}
    <itemref idref="nav"/>
    ${chapterSpineItems.join('\n    ')}
  </spine>
</package>`;
  zip.file("OEBPS/content.opf", opfContent);

  return await zip.generateAsync({ type: "blob" });
}

export async function exportEpubManuscript(bookDetails: any, chapters: Chapter[], coverUrl?: string | null) {
  const blob = await createEpubBlob(bookDetails, chapters, coverUrl);
  const safeTitle = (bookDetails?.title || "Untitled_Book").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${safeTitle}_Publishing_KDP.epub`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportPublishingZipBundle(bookDetails: any, chapters: Chapter[], assets: any) {
  const zip = new JSZip();
  const safeTitle = (bookDetails?.title || "Untitled_Book").replace(/[^a-zA-Z0-9_-]/g, "_");

  const filteredChapters = chapters.filter(ch => {
    const t = ch.title.toLowerCase().trim();
    return !t.includes('table of contents') && t !== 'contents';
  });

  // 0. Pre-formatted EPUB for Kindle & Apple Books
  try {
    const epubBlob = await createEpubBlob(bookDetails, filteredChapters, assets?.coverUrl);
    zip.file(`00_Manuscript_Format_EPUB.epub`, epubBlob);
  } catch (err) {
    console.warn("Could not add EPUB to bundle:", err);
  }

  // 1. Pre-formatted KDP DOCX
  try {
    const { blob, trim } = await createDocxBlobAndTrim(bookDetails, filteredChapters, assets?.coverUrl);
    zip.file(`01_Manuscript_Format_KDP_${trim.widthInInches}x${trim.heightInInches}.docx`, blob);
  } catch (err) {
    console.warn("Could not add DOCX to bundle:", err);
  }

  // 2. Raw Markdown Manuscript
  const authorSection = bookDetails?.aboutAuthor ? `\n\n---\n\n# About the Author\n\n${bookDetails.aboutAuthor}` : '';
  const mdContent = filteredChapters.map(c => `# ${c.title}\n\n${c.content}`).join('\n\n<div style="page-break-after: always;"></div>\n\n') + authorSection;
  zip.file(`02_Manuscript_Raw.md`, mdContent);

  // 3. Kindle HTML Manuscript
  const htmlAuthor = bookDetails?.aboutAuthor ? `<h1>About the Author</h1><div>${bookDetails.aboutAuthor.split('\n').map(p => `<p>${p}</p>`).join('')}</div>` : '';
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${bookDetails?.title || 'Book'}</title><style>body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2em; } h1 { page-break-before: always; text-align: center; margin-top: 2em; margin-bottom: 1.5em; } p { margin-bottom: 1em; text-indent: 1.5em; }</style></head><body>${filteredChapters.map(c => `<h1>${c.title}</h1>\n<div>${c.content.split('\n\n').map(p => p.startsWith('#') ? `<h3>${p.replace(/#/g, '').trim()}</h3>` : `<p>${p}</p>`).join('')}</div>`).join('')}${htmlAuthor}</body></html>`;
  zip.file(`03_Manuscript_Kindle.html`, htmlContent);

  // 4. Amazon KDP Store Metadata
  const metadataText = `=====================================================
AMAZON KDP & BOOKSTORE PUBLISHING METADATA
=====================================================

TITLE:
${bookDetails?.title || 'Untitled'}

SUBTITLE:
${bookDetails?.subtitle || 'N/A'}

AUTHOR NAME:
${bookDetails?.authorName || 'Anonymous'}

TARGET PRICING:
${bookDetails?.pricing || '$9.99 USD'}

TRIM SIZE & SPECS:
${bookDetails?.trimSize || '6x9'} - Premium Black & White / Color Interior, White Paper, No Bleed

PUBLISHING LANGUAGE:
${bookDetails?.language || 'English'}

-----------------------------------------------------
AMAZON BOOK DESCRIPTION (HTML FORMATTED):
-----------------------------------------------------
${bookDetails?.description || assets?.metadata?.description_html || 'N/A'}

-----------------------------------------------------
BACKEND SEARCH KEYWORDS (7 SLOTS):
-----------------------------------------------------
${(bookDetails?.keywords?.length > 0 ? bookDetails.keywords : assets?.metadata?.keywords || []).map((k: string, i: number) => `Slot ${i + 1}: ${k}`).join('\n')}

-----------------------------------------------------
BISAC CATEGORIES:
-----------------------------------------------------
${(bookDetails?.categories?.length > 0 ? bookDetails.categories : assets?.metadata?.categories || []).join('\n')}
`;
  zip.file(`04_Amazon_KDP_Store_Metadata.txt`, metadataText);

  // 5. Back Cover Blurb
  if (assets?.backCoverContent) {
    zip.file(`05_Back_Cover_Blurb.txt`, assets.backCoverContent);
  }

  // 6. Cover Image
  if (assets?.coverUrl && assets.coverUrl.startsWith('data:image/')) {
    try {
      const parts = assets.coverUrl.split(',');
      const binaryString = window.atob(parts[1]);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      zip.file(`06_Book_Cover.png`, bytes);
    } catch (e) {
      console.warn("Could not encode cover image for zip:", e);
    }
  }

  // 7. Publishing Instructions Guide
  const instructionsGuide = `=====================================================
STEP-BY-STEP KDP & BOOK PUBLISHING INSTRUCTIONS
=====================================================

Congratulations on completing your manuscript! Here is how to publish it on Amazon KDP, Apple Books, or IngramSpark in under 10 minutes:

STEP 1: Log in to Amazon KDP
-----------------------------------------------------
1. Go to https://kdp.amazon.com and log in with your Amazon account.
2. Click "+ Create" and select "Paperback" or "Kindle eBook".

STEP 2: Enter Book Details (Metadata)
-----------------------------------------------------
1. Open "04_Amazon_KDP_Store_Metadata.txt" from this zip folder.
2. Copy and paste Title, Subtitle, Author Name, Description HTML, Categories, and Keywords into KDP.

STEP 3: Upload Manuscript & Cover
-----------------------------------------------------
1. Under "Interior", upload "01_Manuscript_Format_KDP_*.docx".
2. Under "Book Cover", upload "06_Book_Cover.png" or use the KDP Cover Creator with "05_Back_Cover_Blurb.txt".
3. Select trim size matching your file (e.g. 6" x 9").

STEP 4: Preview & Publish
-----------------------------------------------------
1. Click "Launch Previewer" on KDP to verify margins and page count.
2. Set your list price and royalty rate (70% for Kindle eBook, 60% for Paperback).
3. Click "Publish Your Kindle eBook" or "Publish Your Paperback"!
`;
  zip.file(`07_Publishing_Instructions_Guide.txt`, instructionsGuide);

  const bundleBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(bundleBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}_Complete_KDP_Publishing_Package.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getLandingPageHtmlString(
  bookDetails: any, 
  landingCopy: any, 
  coverUrl?: string | null, 
  templateType: 'classic' | 'modern' | 'editorial' = 'classic'
): string {
  const safeTitle = (bookDetails?.title || "Book").replace(/[^a-zA-Z0-9_-]/g, "_");
  const coverImgSrc = coverUrl || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop";

  const takeaways = landingCopy?.keyTakeaways || [
    "Master essential principles and frameworks",
    "Actionable step-by-step strategies you can implement today",
    "Real-world case studies and practical insights",
    "Transformative lessons from industry experts"
  ];

  const testimonials = landingCopy?.testimonials || [
    { quote: "A masterpiece that completely changed my perspective. Highly recommended!", name: "Sarah Jenkins", title: "Bestselling Author & Book Critic" },
    { quote: "Incredible depth and clarity. Could not put it down once I started.", name: "Dr. Marcus Vance", title: "Literary Reviewer" }
  ];

  const faq = landingCopy?.faq || [
    { question: "Where can I buy this book?", answer: "Available on Amazon Kindle, Paperback, Hardcover, and major ebook retailers worldwide." },
    { question: "Is this suitable for beginners?", answer: "Yes! Designed to be accessible, engaging, and valuable for both newcomers and seasoned readers." }
  ];

  const socials = bookDetails?.socials || {};
  const socialLinksHtml = [
    socials.website ? `<a href="${socials.website}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors">🌐 Website</a>` : '',
    socials.twitter ? `<a href="${socials.twitter.startsWith('http') ? socials.twitter : 'https://x.com/' + socials.twitter.replace('@','')}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors">𝕏 Twitter</a>` : '',
    socials.instagram ? `<a href="${socials.instagram.startsWith('http') ? socials.instagram : 'https://instagram.com/' + socials.instagram.replace('@','')}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors">📸 Instagram</a>` : '',
    socials.linkedin ? `<a href="${socials.linkedin.startsWith('http') ? socials.linkedin : 'https://linkedin.com/in/' + socials.linkedin}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors">💼 LinkedIn</a>` : '',
    socials.newsletter ? `<a href="${socials.newsletter}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors">📬 Newsletter</a>` : '',
    socials.amazonAuthor ? `<a href="${socials.amazonAuthor}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors">🛒 Amazon Author Central</a>` : ''
  ].filter(Boolean).join(' ');

  // Template 2: Modern Tech & SaaS Minimal (Dark Theme with neon accents)
  if (templateType === 'modern') {
    const takeawaysModern = takeaways.map((item: string) => `
      <div class="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 flex items-start gap-3 hover:border-emerald-500/50 transition-colors">
        <div class="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 text-sm font-bold">✓</div>
        <p class="text-zinc-300 text-sm leading-relaxed">${item}</p>
      </div>
    `).join('');

    const testimonialsModern = testimonials.map((t: any) => `
      <div class="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 flex flex-col justify-between">
        <p class="text-zinc-300 text-sm italic mb-4 leading-relaxed">"${t.quote}"</p>
        <div class="flex items-center gap-3 pt-3 border-t border-zinc-800/80">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-xs font-extrabold text-black">
            ${t.name.charAt(0)}
          </div>
          <div>
            <h4 class="font-bold text-white text-sm">${t.name}</h4>
            <p class="text-xs text-emerald-400 font-mono">${t.title}</p>
          </div>
        </div>
      </div>
    `).join('');

    const faqModern = faq.map((f: any) => `
      <div class="bg-zinc-900/80 p-6 rounded-xl border border-zinc-800">
        <h3 class="font-bold text-white text-base mb-2 flex items-center gap-2">
          <span class="text-emerald-400 font-mono text-xs">//</span> ${f.question}
        </h3>
        <p class="text-zinc-400 text-sm leading-relaxed">${f.answer}</p>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bookDetails?.title || 'Book Launch'} - Official Release</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-black pb-24">

  <!-- Sticky Header -->
  <nav class="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 py-4 px-6 md:px-12 flex items-center justify-between">
    <div class="font-extrabold text-lg tracking-tight text-white flex items-center gap-2 font-mono">
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
      ${bookDetails?.title || 'Book Launch'}
    </div>
    <a href="#buy" class="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20">
      Get Access Now
    </a>
  </nav>

  <!-- Hero Section -->
  <header class="max-w-6xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
    <div class="md:col-span-7 space-y-6">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
        <span>🔥</span> NEW RELEASE // BY ${bookDetails?.authorName?.toUpperCase() || 'AUTHOR'}
      </div>
      <h1 class="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
        ${landingCopy?.heroHeadline || bookDetails?.title || 'Transformative Blueprint'}
      </h1>
      <p class="text-lg md:text-xl text-zinc-400 font-normal leading-relaxed">
        ${landingCopy?.heroSubheadline || bookDetails?.subtitle || bookDetails?.description?.slice(0, 180) || ''}
      </p>

      <!-- Stat Badges -->
      <div class="grid grid-cols-3 gap-4 pt-2 border-y border-zinc-800/80 py-4">
        <div>
          <div class="text-2xl font-black text-emerald-400">4.9 ★</div>
          <div class="text-xs text-zinc-500 font-mono">Reader Rating</div>
        </div>
        <div>
          <div class="text-2xl font-black text-white">100%</div>
          <div class="text-xs text-zinc-500 font-mono">Original Content</div>
        </div>
        <div>
          <div class="text-2xl font-black text-indigo-400">Instant</div>
          <div class="text-xs text-zinc-500 font-mono">Global Delivery</div>
        </div>
      </div>

      <div class="pt-4 flex flex-col sm:flex-row items-center gap-4" id="buy">
        <a href="#" class="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black text-center font-extrabold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-emerald-500/20">
          ${landingCopy?.heroCtaText || 'Claim Your Copy Now'}
        </a>
        <a href="#sample" class="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-center font-bold px-6 py-4 rounded-xl text-base transition-all">
          Preview Chapter
        </a>
      </div>
    </div>

    <div class="md:col-span-5 flex justify-center">
      <div class="relative">
        <div class="absolute -inset-1 bg-gradient-to-tr from-emerald-500 to-indigo-600 rounded-2xl blur-2xl opacity-40"></div>
        <img src="${coverImgSrc}" alt="Book Cover" class="relative rounded-2xl shadow-2xl w-64 md:w-80 object-cover border border-zinc-700/80" />
      </div>
    </div>
  </header>

  <!-- Key Takeaways -->
  <section class="max-w-6xl mx-auto px-6 py-16">
    <div class="text-center mb-12">
      <span class="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">// Core Value</span>
      <h2 class="text-3xl font-extrabold text-white mt-1">Key Frameworks & Insights</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${takeawaysModern}
    </div>
  </section>

  <!-- Praise & Reviews -->
  <section class="max-w-6xl mx-auto px-6 py-16 border-t border-zinc-900">
    <div class="text-center mb-12">
      <span class="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">// Early Praise</span>
      <h2 class="text-3xl font-extrabold text-white mt-1">What Industry Leaders Say</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${testimonialsModern}
    </div>
  </section>

  <!-- Author Spotlight -->
  <section class="max-w-4xl mx-auto px-6 py-16">
    <div class="bg-gradient-to-r from-zinc-900 to-zinc-900/60 p-8 sm:p-12 rounded-3xl border border-zinc-800 flex flex-col md:flex-row items-center gap-8">
      <div class="w-24 h-24 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-black text-3xl flex items-center justify-center shrink-0">
        ${(bookDetails?.authorName || 'A').charAt(0)}
      </div>
      <div class="space-y-3 text-center md:text-left">
        <h3 class="text-2xl font-bold text-white">About ${bookDetails?.authorName || 'The Author'}</h3>
        <p class="text-zinc-400 text-sm leading-relaxed">${landingCopy?.authorBio || bookDetails?.aboutAuthor || bookDetails?.description || ''}</p>
        ${socialLinksHtml ? `<div class="pt-2 flex flex-wrap gap-2 justify-center md:justify-start">${socialLinksHtml}</div>` : ''}
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="max-w-4xl mx-auto px-6 py-16 border-t border-zinc-900">
    <div class="text-center mb-12">
      <h2 class="text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
    </div>
    <div class="space-y-4">
      ${faqModern}
    </div>
  </section>

  <!-- Sticky Bottom Buy Bar -->
  <div class="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 px-6 py-3">
    <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
      <div class="hidden sm:flex items-center gap-3">
        <img src="${coverImgSrc}" class="w-10 h-12 object-cover rounded shadow border border-zinc-700" />
        <div>
          <div class="text-xs font-bold text-white truncate max-w-xs">${bookDetails?.title || 'Book Title'}</div>
          <div class="text-[10px] text-zinc-400">By ${bookDetails?.authorName || 'Author'}</div>
        </div>
      </div>
      <a href="#buy" class="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-6 py-3 rounded-xl text-xs transition-all text-center shadow-lg shadow-emerald-500/20">
        ${landingCopy?.heroCtaText || 'Get Your Copy Now'}
      </a>
    </div>
  </div>

</body>
</html>`;
  }

  // Template 3: High-Impact Author Brand & Editorial Magazine (Parchment/Warm Luxury Theme)
  if (templateType === 'editorial') {
    const takeawaysEditorial = takeaways.map((item: string) => `
      <li class="flex items-start gap-3 text-stone-800 py-3 border-b border-stone-200/80">
        <span class="text-amber-700 font-serif text-lg font-bold">✦</span>
        <span class="text-stone-700 text-base leading-relaxed font-serif">${item}</span>
      </li>
    `).join('');

    const testimonialsEditorial = testimonials.map((t: any) => `
      <div class="bg-white p-8 rounded-none border-l-4 border-amber-700 shadow-sm space-y-4">
        <p class="text-stone-800 font-serif italic text-base leading-relaxed">"${t.quote}"</p>
        <div class="pt-2">
          <div class="font-bold text-stone-900 text-sm tracking-wide font-sans uppercase">${t.name}</div>
          <div class="text-xs text-amber-800 font-serif">${t.title}</div>
        </div>
      </div>
    `).join('');

    const faqEditorial = faq.map((f: any) => `
      <div class="bg-white p-6 border border-stone-200">
        <h3 class="font-serif font-bold text-stone-900 text-lg mb-2">${f.question}</h3>
        <p class="text-stone-600 text-sm leading-relaxed">${f.answer}</p>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bookDetails?.title || 'Book Landing Page'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-serif { font-family: 'Lora', serif; }
  </style>
</head>
<body class="bg-[#fdfbf7] text-[#1c1917] antialiased selection:bg-amber-200 selection:text-amber-900">

  <!-- Editorial Top Bar -->
  <div class="bg-[#1c1917] text-stone-300 py-2.5 px-6 text-center text-xs font-serif tracking-widest uppercase border-b border-amber-700">
    OFFICIAL AUTHOR EDITION &bull; ${bookDetails?.authorName || 'AUTHOR'}
  </div>

  <!-- Hero Section -->
  <header class="max-w-5xl mx-auto px-6 py-16 md:py-20 text-center space-y-8">
    <div class="inline-block border-y border-amber-700/60 py-1 px-4 text-xs font-serif font-bold tracking-widest text-amber-900 uppercase">
      A NEW RELEASE IN ${bookDetails?.genre?.toUpperCase() || 'GENERAL NON-FICTION'}
    </div>

    <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-stone-900 leading-tight max-w-4xl mx-auto">
      ${landingCopy?.heroHeadline || bookDetails?.title || 'An Essential Masterpiece'}
    </h1>

    <p class="text-lg md:text-xl text-stone-600 font-serif italic max-w-2xl mx-auto leading-relaxed">
      ${landingCopy?.heroSubheadline || bookDetails?.subtitle || bookDetails?.description?.slice(0, 180) || ''}
    </p>

    <div class="pt-6 flex justify-center">
      <div class="relative p-3 bg-white border border-stone-300 shadow-2xl max-w-sm">
        <img src="${coverImgSrc}" alt="Book Cover" class="w-64 sm:w-72 object-cover" />
      </div>
    </div>

    <div class="pt-6 flex flex-col sm:flex-row justify-center items-center gap-4" id="buy">
      <a href="#" class="bg-[#1c1917] hover:bg-stone-800 text-amber-100 font-serif font-bold px-8 py-4 text-base transition-all shadow-md border border-amber-700/40">
        ${landingCopy?.heroCtaText || 'Order Hardcover & eBook'}
      </a>
    </div>
  </header>

  <!-- Author Letter / Note -->
  <section class="max-w-3xl mx-auto px-6 py-16 border-t border-stone-200">
    <div class="bg-white p-8 md:p-12 border border-stone-300 space-y-6 shadow-xs">
      <h2 class="font-serif text-2xl font-bold text-stone-900 border-b border-amber-700/30 pb-3">
        A Letter From ${bookDetails?.authorName || 'The Author'}
      </h2>
      <p class="font-serif text-stone-700 text-base leading-relaxed italic">
        "${landingCopy?.authorBio || bookDetails?.description || 'Thank you for embarking on this journey with me. This book encapsulates years of research, trial, and insight designed to offer you timeless clarity.'}"
      </p>
      <div class="pt-4 flex items-center justify-between text-xs font-serif text-stone-500 border-t border-stone-100">
        <span>Author & Scholar</span>
        <span class="font-bold text-stone-800">${bookDetails?.authorName || ''}</span>
      </div>
    </div>
  </section>

  <!-- Key Discoveries -->
  <section class="max-w-4xl mx-auto px-6 py-16">
    <h2 class="font-serif text-3xl font-bold text-stone-900 text-center mb-12">Inside This Volume</h2>
    <ul class="space-y-2">
      ${takeawaysEditorial}
    </ul>
  </section>

  <!-- Editorial Reviews -->
  <section class="max-w-5xl mx-auto px-6 py-16 border-t border-stone-200">
    <h2 class="font-serif text-3xl font-bold text-stone-900 text-center mb-12">Critical Acclaim</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      ${testimonialsEditorial}
    </div>
  </section>

  <!-- FAQ -->
  <section class="max-w-3xl mx-auto px-6 py-16 border-t border-stone-200">
    <h2 class="font-serif text-3xl font-bold text-stone-900 text-center mb-12">Reader Inquiries</h2>
    <div class="space-y-4">
      ${faqEditorial}
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-[#1c1917] text-stone-400 py-16 text-center px-6 border-t border-amber-700">
    <div class="max-w-2xl mx-auto space-y-6">
      <h2 class="font-serif text-3xl font-bold text-stone-100">Secure Your Collector's Edition</h2>
      <div>
        <a href="#buy" class="inline-block bg-amber-700 hover:bg-amber-600 text-stone-900 font-serif font-bold px-8 py-4 text-base transition-all">
          ${landingCopy?.heroCtaText || 'Order Your Copy'}
        </a>
      </div>
      ${socialLinksHtml ? `<div class="pt-4 flex flex-wrap gap-2 justify-center">${socialLinksHtml}</div>` : ''}
      <p class="text-xs text-stone-500 pt-8 font-serif">&copy; ${new Date().getFullYear()} ${bookDetails?.authorName || 'Author'}. Published Independently.</p>
    </div>
  </footer>

</body>
</html>`;
  }

  // Template 1: Classic Bestseller (Default)
  const takeawaysHtml = takeaways.map((item: string) => `
    <li class="flex items-start space-x-3 text-zinc-700">
      <svg class="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
      <span>${item}</span>
    </li>
  `).join('');

  const testimonialsHtml = testimonials.map((t: any) => `
    <div class="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
      <p class="text-zinc-600 italic mb-4">"${t.quote}"</p>
      <div>
        <h4 class="font-bold text-zinc-900">${t.name}</h4>
        <p class="text-xs text-indigo-600 font-medium">${t.title}</p>
      </div>
    </div>
  `).join('');

  const faqHtml = faq.map((f: any) => `
    <div class="bg-zinc-50 p-6 rounded-xl border border-zinc-200">
      <h3 class="font-semibold text-zinc-900 text-lg mb-2">${f.question}</h3>
      <p class="text-zinc-600 text-sm leading-relaxed">${f.answer}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bookDetails?.title || 'Book Landing Page'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .serif-title { font-family: 'Playfair Display', serif; }
  </style>
</head>
<body class="bg-zinc-50 text-zinc-900 antialiased selection:bg-indigo-500 selection:text-white">

  <!-- Navigation -->
  <nav class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200 py-4 px-6 md:px-12 flex items-center justify-between">
    <div class="font-bold text-xl tracking-tight text-zinc-900 flex items-center gap-2">
      <span class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-black">B</span>
      ${bookDetails?.title || 'Book Launch'}
    </div>
    <a href="#buy" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md hover:shadow-indigo-200">
      Get Your Copy
    </a>
  </nav>

  <!-- Hero Section -->
  <header class="max-w-6xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
    <div class="md:col-span-7 space-y-6 text-center md:text-left">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold tracking-wide uppercase">
        🔥 Official New Release by ${bookDetails?.authorName || 'Author'}
      </div>
      <h1 class="serif-title text-4xl sm:text-5xl md:text-6xl font-extrabold text-zinc-900 leading-tight">
        ${landingCopy?.heroHeadline || bookDetails?.title || 'Transform Your Mindset'}
      </h1>
      <p class="text-lg md:text-xl text-zinc-600 font-normal leading-relaxed">
        ${landingCopy?.heroSubheadline || bookDetails?.subtitle || bookDetails?.description?.slice(0, 180) || ''}
      </p>

      <div class="pt-4 flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4" id="buy">
        <a href="#" class="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-center font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-indigo-500/20">
          ${landingCopy?.heroCtaText || 'Buy Now on Amazon'}
        </a>
        <a href="#sample" class="w-full sm:w-auto bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 text-center font-semibold px-6 py-4 rounded-xl text-base transition-all">
          Read Free Sample
        </a>
      </div>

      <p class="text-xs text-zinc-400">Available in Paperback, Hardcover, & Kindle eBook formats.</p>
    </div>

    <div class="md:col-span-5 flex justify-center">
      <div class="relative group">
        <div class="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition duration-1000"></div>
        <img src="${coverImgSrc}" alt="Book Cover" class="relative rounded-2xl shadow-2xl w-64 md:w-80 object-cover border border-zinc-200 transition-transform duration-500 group-hover:scale-105" />
      </div>
    </div>
  </header>

  <!-- Key Takeaways -->
  <section class="bg-white py-20 border-y border-zinc-200">
    <div class="max-w-4xl mx-auto px-6">
      <div class="text-center mb-12">
        <h2 class="serif-title text-3xl font-bold text-zinc-900">What You Will Discover</h2>
        <p class="text-zinc-500 mt-2">Inside the pages of ${bookDetails?.title || 'this book'}</p>
      </div>

      <ul class="grid grid-cols-1 md:grid-cols-2 gap-6 text-base font-medium">
        ${takeawaysHtml}
      </ul>
    </div>
  </section>

  <!-- Testimonials -->
  <section class="py-20 max-w-6xl mx-auto px-6">
    <div class="text-center mb-12">
      <h2 class="serif-title text-3xl font-bold text-zinc-900">Early Praise & Reviews</h2>
      <p class="text-zinc-500 mt-2">What critics and readers are saying</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${testimonialsHtml}
    </div>
  </section>

  <!-- Author Bio -->
  <section class="bg-indigo-900 text-white py-20">
    <div class="max-w-4xl mx-auto px-6 text-center md:text-left flex flex-col md:flex-row items-center gap-8">
      <div class="w-24 h-24 rounded-full bg-indigo-700 border-2 border-indigo-400 flex items-center justify-center text-3xl font-bold shrink-0">
        ${(bookDetails?.authorName || 'A').charAt(0)}
      </div>
      <div class="space-y-3">
        <h3 class="serif-title text-2xl font-bold">About Author ${bookDetails?.authorName || ''}</h3>
        <p class="text-indigo-200 text-sm leading-relaxed">${landingCopy?.authorBio || bookDetails?.aboutAuthor || bookDetails?.description || ''}</p>
        ${socialLinksHtml ? `<div class="pt-2 flex flex-wrap gap-2 justify-center md:justify-start">${socialLinksHtml}</div>` : ''}
      </div>
    </div>
  </section>

  <!-- FAQ Section -->
  <section class="py-20 max-w-4xl mx-auto px-6">
    <div class="text-center mb-12">
      <h2 class="serif-title text-3xl font-bold text-zinc-900">Frequently Asked Questions</h2>
    </div>

    <div class="space-y-4">
      ${faqHtml}
    </div>
  </section>

  <!-- Final CTA -->
  <footer class="bg-zinc-900 text-white py-16 text-center px-6">
    <div class="max-w-2xl mx-auto space-y-6">
      <h2 class="serif-title text-3xl md:text-4xl font-bold">Ready to Begin Reading?</h2>
      <p class="text-zinc-400 text-sm">Grab your copy today and join thousands of readers worldwide.</p>
      <div>
        <a href="#buy" class="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg">
          ${landingCopy?.heroCtaText || 'Get Your Copy Now'}
        </a>
      </div>
      <p class="text-xs text-zinc-500 pt-8">&copy; ${new Date().getFullYear()} ${bookDetails?.authorName || 'Author'}. All rights reserved.</p>
    </div>
  </footer>

</body>
</html>`;
}

export function exportLandingPageHtml(
  bookDetails: any, 
  landingCopy: any, 
  coverUrl?: string | null, 
  templateType: 'classic' | 'modern' | 'editorial' = 'classic'
) {
  const safeTitle = (bookDetails?.title || "Book").replace(/[^a-zA-Z0-9_-]/g, "_");
  const htmlContent = getLandingPageHtmlString(bookDetails, landingCopy, coverUrl, templateType);

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}_Landing_Page_${templateType}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

