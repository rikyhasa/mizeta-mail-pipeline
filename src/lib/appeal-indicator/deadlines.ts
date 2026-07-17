const GDP_APPEAL_DAYS = 30;
const PREFETTO_APPEAL_DAYS = 60;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface AppealDeadlines {
  daysRemainingGdp: number | null;
  daysRemainingPrefetto: number | null;
}

/**
 * Termini di legge per il ricorso (30gg Giudice di Pace, 60gg Prefetto — nota di prudenza
 * normativa, docs/SPEC-AUTOVELOX-DRAFT.md §15.5: riferimento operativo comune per violazioni
 * del Codice della Strada, non una verifica esaustiva di ogni eccezione procedurale).
 * Calcolati deterministicamente da `notification_date`, mai estratti dal verbale come il
 * generico `appeal_due_at`/`DeadlineKind.APPEAL_DUE` esistente, che resta indipendente. `now` è
 * un parametro esplicito (mai `Date.now()` interno) per restare puro e testabile. `null` quando
 * `notificationDate` non è disponibile — mai una stima approssimata silenziosa.
 */
export function calculateAppealDeadlines(notificationDate: Date | null, now: Date): AppealDeadlines {
  if (!notificationDate) return { daysRemainingGdp: null, daysRemainingPrefetto: null };

  const gdpDueAt = new Date(notificationDate.getTime() + GDP_APPEAL_DAYS * MS_PER_DAY);
  const prefettoDueAt = new Date(notificationDate.getTime() + PREFETTO_APPEAL_DAYS * MS_PER_DAY);

  return {
    daysRemainingGdp: Math.ceil((gdpDueAt.getTime() - now.getTime()) / MS_PER_DAY),
    daysRemainingPrefetto: Math.ceil((prefettoDueAt.getTime() - now.getTime()) / MS_PER_DAY),
  };
}
