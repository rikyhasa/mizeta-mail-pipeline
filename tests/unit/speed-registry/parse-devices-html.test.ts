import { describe, expect, it } from "vitest";
import { parseSpeedRegistryHtml } from "@/lib/speed-registry/parse-devices-html";

function tableRow(cells: string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
}

const HEADER_ROW =
  "<tr><th>Codice ente accertatore</th><th>Nome dispositivo</th><th>Codice catastale</th><th>Decreto normativo</th>" +
  "<th>Data decreto</th><th>Tipo dispositivo</th><th>Produttore</th><th>Modello</th><th>Versione</th><th>Matricola</th>" +
  "<th>Note</th><th>Data ultima comunicazione</th><th>Data primo inserimento</th></tr>";

function page(rows: string[]): string {
  return `<html><body><table>${HEADER_ROW}${rows.join("")}</table></body></html>`;
}

describe("parseSpeedRegistryHtml", () => {
  it("estrae correttamente le 13 colonne di una riga valida", () => {
    const html = page([
      tableRow(["COM1", "Autovelox km 10", "B123", "111/2020", "10/01/2020", "Fisso", "Gatso", "24", "2.1", "AV-001", "", "01/07/2026", "15/03/2020"]),
    ]);
    const { devices, malformedRowCount } = parseSpeedRegistryHtml([html]);

    expect(malformedRowCount).toBe(0);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toEqual({
      accertatoreCode: "COM1",
      deviceName: "Autovelox km 10",
      cadastralCode: "B123",
      decreeNumber: "111/2020",
      decreeDate: "10/01/2020",
      deviceType: "Fisso",
      manufacturer: "Gatso",
      model: "24",
      version: "2.1",
      serialNumber: "AV-001",
      notes: null,
      lastCommunicationDate: "01/07/2026",
      firstRegisteredDate: "15/03/2020",
    });
  });

  it("ignora la riga di intestazione (celle <th>)", () => {
    const html = page([tableRow(["COM1", "Autovelox km 10", "B123", "111/2020", "10/01/2020", "Fisso", "Gatso", "24", "2.1", "AV-001", "", "01/07/2026", "15/03/2020"])]);
    const { devices } = parseSpeedRegistryHtml([html]);
    expect(devices).toHaveLength(1);
  });

  it("aggrega dispositivi da più pagine (paginazione)", () => {
    const page1 = page([tableRow(["COM1", "Dispositivo A", "B1", "1/2020", "01/01/2020", "Fisso", "Gatso", "24", "1.0", "AV-A", "", "01/01/2026", "01/01/2020"])]);
    const page2 = page([tableRow(["COM2", "Dispositivo B", "B2", "2/2020", "02/01/2020", "Mobile", "T-Explorer", "500", "1.0", "AV-B", "", "02/01/2026", "02/01/2020"])]);

    const { devices } = parseSpeedRegistryHtml([page1, page2]);
    expect(devices).toHaveLength(2);
    expect(devices.map((d) => d.deviceName)).toEqual(["Dispositivo A", "Dispositivo B"]);
  });

  it("scarta singolarmente una riga malformata (numero di celle inatteso), senza bloccare le altre", () => {
    const html = page([
      tableRow(["COM1", "Dispositivo A", "B1", "1/2020", "01/01/2020", "Fisso", "Gatso", "24", "1.0", "AV-A", "", "01/01/2026", "01/01/2020"]),
      "<tr><td>Riga incompleta</td><td>Solo due celle</td></tr>",
      tableRow(["COM2", "Dispositivo B", "B2", "2/2020", "02/01/2020", "Mobile", "T-Explorer", "500", "1.0", "AV-B", "", "02/01/2026", "02/01/2020"]),
    ]);

    const { devices, malformedRowCount } = parseSpeedRegistryHtml([html]);
    expect(devices).toHaveLength(2);
    expect(malformedRowCount).toBe(1);
  });

  it("lancia un errore pulito quando la tabella è assente su tutte le pagine (formato cambiato)", () => {
    const html = "<html><body><p>Il registro è temporaneamente in manutenzione.</p></body></html>";
    expect(() => parseSpeedRegistryHtml([html])).toThrow(/formato.*cambiato|nessun dispositivo valido/i);
  });

  it("lancia un errore pulito quando tutte le righe hanno un numero di colonne radicalmente diverso (formato cambiato)", () => {
    const html = `<html><body><table><tr><th>Nome</th><th>Città</th></tr><tr><td>Dispositivo A</td><td>Roma</td></tr></table></body></html>`;
    expect(() => parseSpeedRegistryHtml([html])).toThrow();
  });

  it("decodifica le entità HTML e collassa gli spazi", () => {
    const html = page([
      tableRow(["COM1", "Via dell'Aeroporto &amp; Stazione", "B1", "1/2020", "01/01/2020", "Fisso", "Gatso", "24", "1.0", "AV-A", "Nota\n  su più righe", "01/01/2026", "01/01/2020"]),
    ]);
    const { devices } = parseSpeedRegistryHtml([html]);
    expect(devices[0].deviceName).toBe("Via dell'Aeroporto & Stazione");
    expect(devices[0].notes).toBe("Nota su più righe");
  });

  it("cella vuota diventa null, mai una stringa vuota", () => {
    const html = page([tableRow(["COM1", "Dispositivo A", "B1", "1/2020", "01/01/2020", "Fisso", "", "", "", "AV-A", "", "01/01/2026", "01/01/2020"])]);
    const { devices } = parseSpeedRegistryHtml([html]);
    expect(devices[0].manufacturer).toBeNull();
    expect(devices[0].model).toBeNull();
    expect(devices[0].version).toBeNull();
  });
});
