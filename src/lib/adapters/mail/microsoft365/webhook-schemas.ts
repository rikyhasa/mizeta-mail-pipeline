import { z } from "zod";

/**
 * Envelope delle change notification di Graph (SPEC.md §3). CLAUDE.md invariante 1 si applica
 * anche qui: questo payload è dato esterno non affidabile. `resourceData` viene validato solo
 * per forma (mai usato per decidere COSA leggere — l'handler usa sempre e solo il cursore
 * salvato sulla mailbox via `listChanges`, mai i campi della notifica).
 */
export const graphChangeNotificationSchema = z.object({
  subscriptionId: z.string(),
  clientState: z.string().optional(),
  changeType: z.string(),
  resource: z.string(),
  resourceData: z.object({ id: z.string().optional() }).passthrough().optional(),
  subscriptionExpirationDateTime: z.string().optional(),
});

export const graphChangeNotificationEnvelopeSchema = z.object({
  value: z.array(graphChangeNotificationSchema),
});

export type GraphChangeNotification = z.infer<typeof graphChangeNotificationSchema>;
export type GraphChangeNotificationEnvelope = z.infer<typeof graphChangeNotificationEnvelopeSchema>;
