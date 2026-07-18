import { withPermission } from "@/lib/auth/route-helpers";
import { recordManualSpeedRegistryUpload } from "@/lib/speed-registry/sync-speed-device-registry";
import { rematchDevicesForSnapshot } from "@/lib/speed-registry/apply-registry-match";

/**
 * Fallback manuale del registro MIT (docs/SPEC-AUTOVELOX-DRAFT.md §7bis, Tappa 5): usato quando
 * il sync schedulato finisce in DEAD_LETTER (portale irraggiungibile o formato cambiato). Una o
 * più pagine HTML della tabella dispositivi, campo `file` ripetibile (`formData.getAll`), stesso
 * parsing/diff/persistenza del sync automatico — solo `fetchMethod: MANUAL_UPLOAD` e
 * `uploadedById` valorizzato. Nessuna verifica automatica di correttezza del contenuto oltre al
 * parsing di formato: la responsabilità resta dell'ADMIN che carica il file.
 */
export async function POST(request: Request) {
  return withPermission("enforcement:manage-registry-sync", async (user) => {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) {
      return Response.json({ error: "Nessun file caricato: allegare una o più pagine HTML della tabella nel campo 'file'." }, { status: 400 });
    }

    const pages = await Promise.all(files.map((file) => file.text()));

    try {
      const result = await recordManualSpeedRegistryUpload({ pages, uploadedById: user.id });
      if (result.snapshotId) {
        await rematchDevicesForSnapshot(result.snapshotId, user.id);
      }
      return Response.json({ result });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 422 });
    }
  });
}
