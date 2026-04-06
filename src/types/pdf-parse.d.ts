declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number;
    numrender?: number;
    text: string;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  }

  function pdfParse(data: Buffer | Uint8Array): Promise<PdfParseResult>;
  export = pdfParse;
}
