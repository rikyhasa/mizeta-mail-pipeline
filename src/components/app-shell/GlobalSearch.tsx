"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CASE_CATEGORY_LABELS } from "@/lib/i18n/labels";
import { CategoryIcon } from "@/lib/i18n/category-icons";
import type { CaseCategory } from "@/generated/prisma/enums";

interface SearchResult {
  id: string;
  reference: string;
  title: string;
  category: CaseCategory;
  customerOrSupplierName: string | null;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Ricerca globale della topbar (FASE 3, rifinitura finale): sostituisce il form GET statico
 * verso `/pratiche` con un dropdown live — debounce 300ms, minimo 2 caratteri, navigabile da
 * tastiera (frecce/Invio/Esc). Backend reale (`/api/cases/search`, stessa query di
 * `getFilteredCases`), nessun risultato simulato. La ricerca completa resta disponibile: la
 * voce "Vedi tutti i risultati" e Invio senza selezione portano a `/pratiche?q=...`, la stessa
 * pagina/route che il vecchio form usava.
 */
export function GlobalSearch() {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();
  const queryTooShort = trimmedQuery.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (queryTooShort) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cases/search?q=${encodeURIComponent(trimmedQuery)}`);
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { items: SearchResult[]; total: number };
        if (cancelled) return;
        setResults(data.items);
        setTotal(data.total);
        setActiveIndex(-1);
      } catch {
        if (!cancelled) {
          setResults([]);
          setTotal(0);
          setActiveIndex(-1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trimmedQuery deriva da query, stessa dipendenza
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToCase(id: string) {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(`/pratiche/${id}`);
  }

  function goToFullResults() {
    if (!trimmedQuery) return;
    setOpen(false);
    router.push(`/pratiche?q=${encodeURIComponent(trimmedQuery)}`);
  }

  const showDropdown = open && !queryTooShort;
  const effectiveResults = queryTooShort ? null : results;
  const optionCount = effectiveResults?.length ?? 0;
  const maxIndex = optionCount > 0 ? optionCount : -1; // l'indice più alto = la voce "Vedi tutti"

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (maxIndex < 0) return;
      setActiveIndex((i) => (i >= maxIndex ? 0 : i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (maxIndex < 0) return;
      setActiveIndex((i) => (i <= 0 ? maxIndex : i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (effectiveResults && activeIndex >= 0 && activeIndex < optionCount) {
        goToCase(effectiveResults[activeIndex].id);
      } else {
        goToFullResults();
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative hidden min-w-0 max-w-[420px] flex-1 lg:block">
      <label className="relative block">
        <span className="sr-only">Cerca pratiche</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Cerca pratica, cliente, fornitore..."
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] pr-3 pl-9 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
        />
      </label>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Risultati ricerca pratiche"
          className="absolute z-30 mt-1 w-full rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-md"
        >
          {loading && effectiveResults === null ? (
            <p className="px-3 py-3 text-sm text-[var(--color-ink-muted)]">Ricerca in corso…</p>
          ) : effectiveResults && effectiveResults.length > 0 ? (
            <>
              <ul className="max-h-80 overflow-y-auto">
                {effectiveResults.map((r, i) => (
                  <li key={r.id} role="presentation">
                    <button
                      id={`${listboxId}-option-${i}`}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === i}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => goToCase(r.id)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                        activeIndex === i ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-anthracite)]">
                        <CategoryIcon category={r.category} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[var(--color-ink)]">{r.title}</span>
                        <span className="block truncate text-xs text-[var(--color-ink-muted)]">
                          {r.reference} · {CASE_CATEGORY_LABELS[r.category]}
                          {r.customerOrSupplierName ? ` · ${r.customerOrSupplierName}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                id={`${listboxId}-option-${optionCount}`}
                type="button"
                role="option"
                aria-selected={activeIndex === optionCount}
                onMouseDown={(event) => event.preventDefault()}
                onClick={goToFullResults}
                className={`block w-full border-t border-[var(--color-border)] px-3 py-2 text-left text-sm font-medium text-[var(--color-brand-dark)] ${
                  activeIndex === optionCount ? "bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]"
                }`}
              >
                Vedi tutti i {total} risultati →
              </button>
            </>
          ) : (
            <p className="px-3 py-3 text-sm text-[var(--color-ink-muted)]">Nessun risultato per &quot;{trimmedQuery}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}
