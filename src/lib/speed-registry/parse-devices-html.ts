import type { ParseSpeedRegistryResult, SpeedRegistryDeviceRow } from "./types";

const COLUMN_COUNT = 13;

const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const codePoint = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Estrae il testo di una cella `<td>...</td>` grezza: rimuove tag interni, decodifica entità,
 * collassa spazi/a-capo. Stringa vuota → null (mai un dato mancante rappresentato come ""). */
function cellText(cellHtml: string): string | null {
  const withoutTags = cellHtml.replace(/<[^>]+>/g, " ");
  const decoded = decodeEntities(withoutTags);
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? collapsed : null;
}

/**
 * Parsing deterministico della tabella HTML del registro MIT (docs/SPEC-AUTOVELOX-DRAFT.md
 * §7bis) — MAI un modello LLM, solo pattern matching su una struttura di colonne nota. Una
 * singola riga con un numero di celle inatteso viene scartata e conteggiata (non blocca il
 * sync); se l'intera tabella non produce alcun dispositivo valido su nessuna pagina (tabella
 * assente o struttura radicalmente diversa), lancia un errore esplicito — il fallback manuale
 * (`recordManualSpeedRegistryUpload`) prende il sopravvento in quel caso.
 */
export function parseSpeedRegistryHtml(pages: string[]): ParseSpeedRegistryResult {
  const devices: SpeedRegistryDeviceRow[] = [];
  let malformedRowCount = 0;

  for (const page of pages) {
    const tableMatch = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(page);
    if (!tableMatch) continue;

    const rowMatches = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
    for (const rowHtml of rowMatches) {
      if (/<th[\s>]/i.test(rowHtml)) continue; // riga di intestazione

      const cellMatches = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? [];
      if (cellMatches.length !== COLUMN_COUNT) {
        malformedRowCount += 1;
        continue;
      }

      const values = cellMatches.map(cellText);
      devices.push({
        accertatoreCode: values[0],
        deviceName: values[1],
        cadastralCode: values[2],
        decreeNumber: values[3],
        decreeDate: values[4],
        deviceType: values[5],
        manufacturer: values[6],
        model: values[7],
        version: values[8],
        serialNumber: values[9],
        notes: values[10],
        lastCommunicationDate: values[11],
        firstRegisteredDate: values[12],
      });
    }
  }

  if (devices.length === 0) {
    throw new Error(
      "Nessun dispositivo valido trovato nel registro MIT: il formato della pagina è probabilmente cambiato " +
        "(tabella assente o struttura delle colonne diversa da quella attesa). Usare il caricamento manuale.",
    );
  }

  return { devices, malformedRowCount };
}
