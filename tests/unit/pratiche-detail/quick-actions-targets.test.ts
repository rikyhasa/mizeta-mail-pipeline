import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// TaskForm/CommentForm/ActionButton sono "use client" e chiamano useRouter(): un rendering SSR
// isolato (fuori dal runtime Next.js reale) non ha un router montato, va quindi stubbato — stesso
// approccio già usato altrove nel repo per mockare next/headers nei test di route handler.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, back: () => {} }),
}));

const { QuickActions } = await import("@/app/(app)/pratiche/[id]/_components/QuickActions");
const { TasksCard } = await import("@/app/(app)/pratiche/[id]/_components/TasksCard");
const { CommentsCard } = await import("@/app/(app)/pratiche/[id]/_components/CommentsCard");
const { DocumentsCard } = await import("@/app/(app)/pratiche/[id]/_components/DocumentsCard");

/** Ogni `<a>` contiene un'icona SVG prima del testo, quindi il testo dell'etichetta non segue
 * direttamente il tag di apertura — si cerca la label ovunque nel contenuto dell'anchor, non
 * subito dopo `>`. */
function hrefForLabel(html: string, label: string): string | undefined {
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (match[2].includes(label)) return match[1];
  }
  return undefined;
}

/**
 * "Aggiungi attività"/"Commento interno"/"Genera documento" (docs/UX-AUDIT-2026-07.md, punto
 * 3.3.5): la navigazione a un fragment dentro un `<details>` chiuso lo apre e sposta il focus
 * sul target è un comportamento nativo del browser, non testabile in un ambiente Node senza
 * browser reale — quello che si può e si deve verificare qui è che il fragment di ogni
 * scorciatoia punti a un id che il componente target rende davvero (nessun link a vuoto), e che
 * "Vai ai dati" sia rimasta pura navigazione (nessuna promessa di apertura automatica).
 */
describe("QuickActions — collegamento reale tra scorciatoie e campi target", () => {
  it("'Vai ai dati' punta alla sezione, non a un campo specifico", () => {
    const quickActionsHtml = renderToStaticMarkup(createElement(QuickActions));
    expect(hrefForLabel(quickActionsHtml, "Vai ai dati")).toBe("#dati-estratti");
  });

  it("'Aggiungi attività' punta al primo campo del form, presente nell'HTML di TasksCard", () => {
    const quickActionsHtml = renderToStaticMarkup(createElement(QuickActions));
    const target = hrefForLabel(quickActionsHtml, "Aggiungi attività");
    expect(target).toBe("#new-task-title");

    const cardHtml = renderToStaticMarkup(createElement(TasksCard, { caseId: "case-1", tasks: [], users: [] }));
    expect(cardHtml).toContain(`id="${target!.slice(1)}"`);
  });

  it("'Commento interno' punta al primo campo del form, presente nell'HTML di CommentsCard", () => {
    const quickActionsHtml = renderToStaticMarkup(createElement(QuickActions));
    const target = hrefForLabel(quickActionsHtml, "Commento interno");
    expect(target).toBe("#new-comment");

    const cardHtml = renderToStaticMarkup(createElement(CommentsCard, { caseId: "case-1", comments: [] }));
    expect(cardHtml).toContain(`id="${target!.slice(1)}"`);
  });

  it("'Genera documento' punta a un id sempre presente in DocumentsCard, con o senza modello disponibile", () => {
    const quickActionsHtml = renderToStaticMarkup(createElement(QuickActions));
    const target = hrefForLabel(quickActionsHtml, "Genera documento");
    expect(target).toBe("#documenti-azione");

    const withTemplate = renderToStaticMarkup(
      createElement(DocumentsCard, {
        caseId: "case-1",
        documents: [],
        documentType: { type: "FINE_SHEET", label: "Genera scheda multa" },
      }),
    );
    expect(withTemplate).toContain(`id="${target!.slice(1)}"`);

    const withoutTemplate = renderToStaticMarkup(
      createElement(DocumentsCard, { caseId: "case-1", documents: [], documentType: undefined }),
    );
    expect(withoutTemplate).toContain(`id="${target!.slice(1)}"`);
  });
});
