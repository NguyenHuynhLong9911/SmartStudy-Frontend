import { PDFParse } from "pdf-parse";

import type {
  ExtractedPdfDocument,
  IPdfTextExtractor,
} from "../../modules/documents/pdf-processing.js";

interface PdfTextPageLike {
  readonly num: number;
  readonly text: string;
}

interface PdfTextResultLike {
  readonly pages: readonly PdfTextPageLike[];
  readonly total: number;
}

export interface PdfParserLike {
  destroy(): Promise<void>;
  getText(params?: {
    readonly lineEnforce?: boolean;
    readonly pageJoiner?: string;
  }): Promise<PdfTextResultLike>;
}

export type CreatePdfParser = (data: Uint8Array) => PdfParserLike;

export interface PdfParseTextExtractorDependencies {
  readonly createParser?: CreatePdfParser;
}

export class PdfParseTextExtractor implements IPdfTextExtractor {
  private readonly createParser: CreatePdfParser;

  constructor(dependencies: PdfParseTextExtractorDependencies = {}) {
    this.createParser =
      dependencies.createParser ??
      ((data) =>
        new PDFParse({
          data,
          disableFontFace: true,
        }));
  }

  async extract(pdf: Uint8Array): Promise<ExtractedPdfDocument> {
    const parser = this.createParser(pdf);

    try {
      const result = await parser.getText({
        lineEnforce: true,
        pageJoiner: "",
      });

      return {
        pageCount: result.total,
        pages: result.pages.map((page) => ({
          pageNumber: page.num,
          text: page.text,
        })),
      };
    } finally {
      await parser.destroy();
    }
  }
}
