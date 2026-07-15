import "dotenv/config";
import { AnthropicLLMProvider } from "../src/lib/adapters/llm/anthropic-llm-provider";
import { isExtractableCategory } from "../src/lib/adapters/llm/schemas/extraction-index";
import { SEED_EMAILS } from "../prisma/seed-data/emails";

/**
 * Diagnostica mirata: chiama classify()+extractFields() reali SOLO sulle fixture indicate da
 * CLI, per capire QUALE categoria/schema causa un errore, a costo minimo (pochi centesimi)
 * invece di rieseguire l'intero dataset da 28 fixture. Va eseguito manualmente:
 * `npx tsx scripts/anthropic-diagnose-fixture.ts EML-018 EML-019 EML-001`.
 */
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY non impostata.");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const ids = process.argv.slice(2);
  if (ids.length === 0) throw new Error("Passa almeno un fixture id, es: EML-018");

  const provider = new AnthropicLLMProvider({ apiKey, model });

  for (const id of ids) {
    const fixture = SEED_EMAILS.find((f) => f.id === id);
    if (!fixture) {
      console.log(`${id}: NON TROVATA nel dataset`);
      continue;
    }
    try {
      const classification = await provider.classify({
        emailMessageId: fixture.id,
        emailSubject: fixture.subject,
        emailBody: fixture.bodyText,
        attachments: (fixture.attachments ?? []).map((a) => ({
          attachmentId: a.id,
          fileName: a.fileName,
          isReadable: a.isReadable,
          text: a.isReadable ? a.contentPreviewText : null,
        })),
      });
      const category = classification.data.primary_category;
      console.log(`${id}: classificata come ${category} (confidence ${classification.data.confidence})`);
      console.log(
        `${id}: needs_human_review=${classification.data.needs_human_review} security_flags=${JSON.stringify(classification.data.security_flags)}`,
      );

      if (!isExtractableCategory(category)) {
        console.log(`${id}: categoria non estraibile, nessuna chiamata extractFields.`);
        continue;
      }

      try {
        const extraction = await provider.extractFields({
          caseId: "diag",
          category,
          messages: [
            {
              emailMessageId: fixture.id,
              subject: fixture.subject,
              bodyText: fixture.bodyText,
              receivedAt: fixture.receivedAt,
              attachments: (fixture.attachments ?? []).map((a) => ({
                attachmentId: a.id,
                fileName: a.fileName,
                isReadable: a.isReadable,
                text: a.isReadable ? a.contentPreviewText : null,
              })),
            },
          ],
        });
        const fieldValues = Object.fromEntries(
          Object.entries(extraction.data as Record<string, unknown>)
            .map(([key, field]) => [key, (field as { value: unknown }).value])
            .filter(([, value]) => value !== null && value !== undefined),
        );
        console.log(`${id}: extractFields (${category}) OK — campi non nulli: ${JSON.stringify(fieldValues)}`);
      } catch (err) {
        console.log(`${id}: extractFields (${category}) FALLITA: ${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (err) {
      console.log(`${id}: classify FALLITA: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
