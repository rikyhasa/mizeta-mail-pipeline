import type { SpeedRegistryFetcher } from "./types";

/**
 * Fixture statiche con la struttura reale a 13 colonne verificata su velox.mit.gov.it/dispositivi
 * (docs/SPEC-AUTOVELOX-DRAFT.md §7bis): codice ente accertatore, nome dispositivo, codice
 * catastale, decreto normativo, data decreto, tipo dispositivo, produttore, modello, versione,
 * matricola, note, data ultima comunicazione, data primo inserimento. Contenuto interamente
 * sintetico (CLAUDE.md invariante 5), mai dati reali del registro.
 */
const MOCK_PAGE_1_HTML = `<!DOCTYPE html>
<html><body>
<table>
  <thead>
    <tr>
      <th>Codice ente accertatore</th><th>Nome dispositivo</th><th>Codice catastale</th>
      <th>Decreto normativo</th><th>Data decreto</th><th>Tipo dispositivo</th>
      <th>Produttore</th><th>Modello</th><th>Versione</th><th>Matricola</th>
      <th>Note</th><th>Data ultima comunicazione</th><th>Data primo inserimento</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>COM12345</td><td>Autovelox SS16 km 42</td><td>B123</td>
      <td>12345/2020</td><td>10/03/2020</td><td>Fisso</td>
      <td>Gatso</td><td>24</td><td>2.1</td><td>AV-2020-0456</td>
      <td></td><td>01/07/2026</td><td>15/03/2020</td>
    </tr>
    <tr>
      <td>COM67890</td><td>Postazione mobile A14</td><td>C456</td>
      <td>67890/2021</td><td>05/06/2021</td><td>Mobile</td>
      <td>T-Explorer</td><td>500</td><td>1.0</td><td>TE-2021-0789</td>
      <td>In manutenzione periodica</td><td>28/06/2026</td><td>12/06/2021</td>
    </tr>
  </tbody>
</table>
<a href="?page=2">Successiva</a>
</body></html>`;

const MOCK_PAGE_2_HTML = `<!DOCTYPE html>
<html><body>
<table>
  <thead>
    <tr>
      <th>Codice ente accertatore</th><th>Nome dispositivo</th><th>Codice catastale</th>
      <th>Decreto normativo</th><th>Data decreto</th><th>Tipo dispositivo</th>
      <th>Produttore</th><th>Modello</th><th>Versione</th><th>Matricola</th>
      <th>Note</th><th>Data ultima comunicazione</th><th>Data primo inserimento</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>COM11111</td><td>Tutor A1 km 210-225</td><td>D789</td>
      <td>11111/2019</td><td>20/01/2019</td><td>Controllo velocità media</td>
      <td>Velomatic</td><td>T-900</td><td>3.4</td><td>VM-2019-0012</td>
      <td></td><td>30/06/2026</td><td>01/02/2019</td>
    </tr>
  </tbody>
</table>
</body></html>`;

export class MockSpeedRegistryFetcher implements SpeedRegistryFetcher {
  async fetchDevicePages(): Promise<string[]> {
    return [MOCK_PAGE_1_HTML, MOCK_PAGE_2_HTML];
  }
}
