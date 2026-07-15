import type { GeneratedDocumentService } from "@/lib/adapters/documents/types";
import { puppeteerDocumentService } from "@/lib/adapters/documents/puppeteer-document-service";

/** Un solo backend in questa fase (Puppeteer); la seam esiste per poterne aggiungere altri
 * senza toccare i chiamanti (stesso pattern delle altre factory di adapter). */
export function getDocumentService(): GeneratedDocumentService {
  return puppeteerDocumentService;
}
