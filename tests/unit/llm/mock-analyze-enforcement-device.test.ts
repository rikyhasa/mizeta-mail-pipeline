import { describe, expect, it } from "vitest";
import { analyzeEnforcementDeviceHeuristically } from "@/lib/adapters/llm/mock/analyze-enforcement-device-heuristics";
import type { ExtractionMessageInput } from "@/lib/adapters/llm/types";

function messages(overrides: Partial<ExtractionMessageInput>): ExtractionMessageInput[] {
  return [
    {
      emailMessageId: "msg-1",
      subject: "",
      bodyText: "",
      receivedAt: new Date().toISOString(),
      attachments: [],
      ...overrides,
    },
  ];
}

describe("analyzeEnforcementDeviceHeuristically — applicability", () => {
  it("rileva SPEED_CAMERA_FIXED da 'autovelox'", () => {
    const result = analyzeEnforcementDeviceHeuristically(
      messages({ bodyText: "Le si notifica che è stata rilevata un'infrazione tramite autovelox in postazione fissa." }),
    );
    expect(result.applicability.value).toBe("SPEED_CAMERA_FIXED");
    expect(result.applicability.needs_human_review).toBe(true);
  });

  it("rileva SPEED_CAMERA_MOBILE da 'autovelox mobile'", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Rilevamento tramite autovelox mobile installato su pattuglia." }));
    expect(result.applicability.value).toBe("SPEED_CAMERA_MOBILE");
  });

  it("rileva AVERAGE_SPEED_CONTROL da 'tutor'/'velocità media'", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Infrazione rilevata dal sistema Tutor di controllo della velocità media." }));
    expect(result.applicability.value).toBe("AVERAGE_SPEED_CONTROL");
  });

  it("rileva TELELASER da 'telelaser'", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Accertamento effettuato con telelaser in dotazione alla pattuglia." }));
    expect(result.applicability.value).toBe("TELELASER");
  });

  it("esclude subito con NOT_APPLICABLE quando il verbale riguarda una ZTL", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Accesso non autorizzato alla ZTL rilevato da varco elettronico." }));
    expect(result.applicability.value).toBe("NOT_APPLICABLE");
  });

  it("ricade su TO_BE_IDENTIFIED quando c'è un segnale di violazione di velocità (art. 142) ma nessun dispositivo nominato", () => {
    const result = analyzeEnforcementDeviceHeuristically(
      messages({ bodyText: "Violazione dell'art. 142 del Codice della Strada per superamento dei limiti di velocità." }),
    );
    expect(result.applicability.value).toBe("TO_BE_IDENTIFIED");
  });

  it("ricade onestamente su TO_BE_IDENTIFIED quando non c'è alcun segnale nel testo", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Comunicazione generica priva di riferimenti a infrazioni di velocità." }));
    expect(result.applicability.value).toBe("TO_BE_IDENTIFIED");
    expect(result.applicability.confidence).toBeNull();
    expect(result.applicability.needs_human_review).toBe(true);
  });

  it("una regola non legata alla velocità (ZTL) prevale su un segnale di velocità nello stesso testo", () => {
    const result = analyzeEnforcementDeviceHeuristically(
      messages({ bodyText: "Superamento dei limiti di velocità in zona a traffico limitato, varco elettronico attivo." }),
    );
    expect(result.applicability.value).toBe("NOT_APPLICABLE");
  });
});

describe("analyzeEnforcementDeviceHeuristically — dati tecnici", () => {
  it("estrae il produttore da un marchio noto", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Rilevamento tramite autovelox Gatso installato sulla SS16." }));
    expect(result.manufacturer.value).toBe("gatso");
  });

  it("estrae la matricola tramite regex", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Autovelox fisso, matricola n. AV-2019-0456, installato sulla SS16." }));
    expect(result.serial_number.value).toBe("AV-2019-0456");
  });

  it("estrae il numero di decreto tramite regex", () => {
    const result = analyzeEnforcementDeviceHeuristically(
      messages({ bodyText: "Autovelox fisso, decreto di approvazione numero 12345/2020, installato sulla SS16." }),
    );
    expect(result.decree_number.value).toBe("12345/2020");
  });

  it("non inventa mai model/authority quando non c'è alcun segnale nel testo", () => {
    const result = analyzeEnforcementDeviceHeuristically(messages({ bodyText: "Autovelox fisso installato sulla SS16, nessun altro dettaglio." }));
    expect(result.model.value).toBeNull();
    expect(result.authority.value).toBeNull();
  });

  it("non legge mai il contenuto di un allegato non leggibile", () => {
    const result = analyzeEnforcementDeviceHeuristically(
      messages({
        bodyText: "Autovelox fisso installato sulla SS16.",
        attachments: [{ attachmentId: "att-1", fileName: "verbale.pdf", isReadable: false, text: null }],
      }),
    );
    expect(result.manufacturer.value).toBeNull();
  });
});
