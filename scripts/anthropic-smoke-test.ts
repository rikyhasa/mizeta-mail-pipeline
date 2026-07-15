import "dotenv/config";
import { AnthropicLLMProvider } from "../src/lib/adapters/llm/anthropic-llm-provider";

/**
 * Smoke test manuale del provider Anthropic reale (SPEC.md §13): UNA chiamata di classificazione
 * su un'email di esempio, per verificare che lo Structured Output validi correttamente contro lo
 * schema Zod e che il modello risponda. Non fa parte di `npm test`/`npm run eval` (quelli restano
 * sempre a costo zero) — va eseguito manualmente con `npx tsx scripts/anthropic-smoke-test.ts`
 * dopo aver impostato ANTHROPIC_API_KEY in .env locale (mai committata, mai loggata qui).
 */
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY non impostata: imposta la variabile in .env locale prima di eseguire questo smoke test.");
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const provider = new AnthropicLLMProvider({ apiKey, model });

  console.log(`Provider: anthropic, modello: ${model}`);
  console.log("Health check...");
  const health = await provider.healthCheck();
  console.log(health);
  if (!health.ok) {
    throw new Error("Health check fallito: verifica la API key e il nome del modello.");
  }

  console.log("\nChiamata di classificazione su un'email di esempio...");
  const result = await provider.classify({
    emailMessageId: "smoke-test-1",
    emailSubject: "Richiesta preventivo trasporto Milano - Bari",
    emailBody:
      "Buongiorno,\n\nvorremmo un preventivo per un trasporto completo (FTL) da Milano a Bari.\n" +
      "Ritiro: 20/07/2026 mattina. Consegna: 22/07/2026.\n" +
      "Merce: componentistica industriale, 10 pallet, peso totale 3000 kg.\n" +
      "Serve sponda idraulica per lo scarico. Nessun ADR.\n\nGrazie, Giulia Rossi",
    attachments: [],
  });

  console.log("\nRisultato (già validato contro classificationResultSchema):");
  console.log(JSON.stringify(result.data, null, 2));
  console.log("\nUsage:", result.usage);
  console.log("Modello effettivo:", result.model);

  if (result.data.primary_category !== "QUOTE_REQUEST") {
    console.warn(`\nAttenzione: categoria attesa QUOTE_REQUEST, ricevuta ${result.data.primary_category}.`);
  } else {
    console.log("\nOK: categoria corretta (QUOTE_REQUEST).");
  }
}

main().catch((error) => {
  console.error("Smoke test fallito:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
