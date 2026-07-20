import { describe, expect, it } from "vitest";
import forge from "node-forge";
import { extractStructuredFatturaPa } from "@/lib/attachments/extractors/structured-fattura-pa";

const VALID_FATTURA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>AutoService S.r.l.</Denominazione></Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-07-14</Data>
        <Numero>FAT-2026-1001</Numero>
        <ImportoTotaleDocumento>1464.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DatiRiepilogo>
        <ImponibileImporto>1200.00</ImponibileImporto>
        <Imposta>264.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <DettaglioPagamento>
        <DataScadenzaPagamento>2026-07-28</DataScadenzaPagamento>
        <IBAN>IT60X0542811101000000123456</IBAN>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

/** Genera una busta CMS/PKCS#7 SignedData sintetica di test con un certificato self-signed
 * generato al volo — MAI una firma reale/qualificata (CLAUDE.md invariante 5). */
function buildSyntheticP7m(xml: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60);
  const attrs = [{ name: "commonName", value: "Test Synthetic Signer" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  const p7 = forge.pkcs7.createSignedData();
  // node-forge auto-genera il ContentInfo solo se `content` è una stringa semplice, non un
  // ByteBuffer già pronto (gotcha noto della libreria).
  p7.content = forge.util.encodeUtf8(xml);
  p7.addCertificate(cert);
  p7.addSigner({ key: keys.privateKey, certificate: cert, digestAlgorithm: forge.pki.oids.sha256 });
  p7.sign();

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, "binary");
}

describe("extractStructuredFatturaPa", () => {
  it("mappa una FatturaPA XML valida sui field key di supplierInvoiceExtractionSchema", () => {
    const result = extractStructuredFatturaPa("FAT-2026-1001.xml", Buffer.from(VALID_FATTURA_XML, "utf-8"));
    expect(result.status).toBe("SUCCEEDED");
    if (result.status !== "SUCCEEDED" || result.method !== "STRUCTURED") throw new Error("atteso STRUCTURED");
    expect(result.structuredFields).toEqual({
      supplier_name: "AutoService S.r.l.",
      vat_number: "IT01234567890",
      invoice_number: "FAT-2026-1001",
      invoice_date: "2026-07-14",
      amount_net: 1200,
      vat_amount: 264,
      amount_total: 1464,
      currency: "EUR",
      due_date: "2026-07-28",
      iban: "IT60X0542811101000000123456",
    });
  });

  it("estrae l'XML firmato da una busta .p7m senza verificarne la firma", () => {
    const p7m = buildSyntheticP7m(VALID_FATTURA_XML);
    const result = extractStructuredFatturaPa("FAT-2026-1001.xml.p7m", p7m);
    expect(result.status).toBe("SUCCEEDED");
    if (result.status !== "SUCCEEDED" || result.method !== "STRUCTURED") throw new Error("atteso STRUCTURED");
    expect(result.structuredFields.invoice_number).toBe("FAT-2026-1001");
    expect(result.structuredFields.amount_total).toBe(1464);
  });

  it("una busta .p7m corrotta fallisce in modo pulito", () => {
    const result = extractStructuredFatturaPa("corrotto.p7m", Buffer.from("non è una vera busta p7m"));
    expect(result.status).toBe("FAILED");
  });

  it("un XML non a forma di FatturaElettronica non viene mai letto come testo generico", () => {
    const result = extractStructuredFatturaPa("altro.xml", Buffer.from("<root><foo>bar</foo></root>", "utf-8"));
    expect(result.status).toBe("FAILED");
  });

  it("contenuto non XML fallisce in modo pulito", () => {
    const result = extractStructuredFatturaPa("non-xml.xml", Buffer.from("questo non è XML", "utf-8"));
    expect(result.status).toBe("FAILED");
  });

  it("un payload XXE (entità esterna) non viene mai risolto: fallisce, non legge alcun file", () => {
    const xxe = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE FatturaElettronica [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
      "<FatturaElettronica><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento>",
      "<Numero>&xxe;</Numero></DatiGeneraliDocumento></DatiGenerali></FatturaElettronicaBody></FatturaElettronica>",
    ].join("\n");
    const result = extractStructuredFatturaPa("evil.xml", Buffer.from(xxe, "utf-8"));
    // L'esito preciso (FAILED, o al più SUCCEEDED con &xxe; letterale mai risolto) non è
    // l'invariante da testare: quello che conta è che il contenuto di /etc/passwd non compaia
    // mai in nessun campo estratto.
    if (result.status === "SUCCEEDED" && result.method === "STRUCTURED") {
      const values = Object.values(result.structuredFields).join(" ");
      expect(values).not.toContain("root:");
      expect(values).not.toContain("/bin/");
    }
  });
});
