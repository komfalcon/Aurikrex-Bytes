declare module "pdf-parse" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }
  interface Options {
    pagerender?: (pageData: any) => string | Promise<string>;
    max?: number;
    version?: string;
  }
  function PDFParse(dataBuffer: Buffer, options?: Options): Promise<PDFData>;
  export default PDFParse;
}
