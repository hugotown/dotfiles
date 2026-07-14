// Pure work-catalog logic: turn the LLM's classification (two lists) into a
// validated, counted catalog. No I/O here — persistence/announcement is wired
// in index.ts. Kept pure so it is unit-testable.

export interface CatalogCounts {
  requirements: number;
  issues: number;
}

export interface Catalog {
  counts: CatalogCounts;
  requirements: string[];
  issues: string[];
  /** ISO timestamp of when the classification was recorded. */
  ts: string;
}

/** Trim, drop blanks, and count. The LLM decides membership; this stays exact. */
export function buildCatalog(requirements: string[], issues: string[]): Catalog {
  const clean = (xs: string[]): string[] =>
    xs.map((s) => s.trim()).filter((s) => s.length > 0);

  const reqs = clean(requirements);
  const iss = clean(issues);

  return {
    counts: { requirements: reqs.length, issues: iss.length },
    requirements: reqs,
    issues: iss,
    ts: new Date().toISOString(),
  };
}

/**
 * Session-scoped, in-memory store: the variable that holds how many issues and
 * requirements (change-requests) have been cataloged this session. Lives in the
 * extension closure; keeps running totals plus the last catalog.
 */
export class CatalogStore {
  private readonly totals: CatalogCounts = { requirements: 0, issues: 0 };
  private latest: Catalog | undefined;

  /** Record a catalog: adds to the running totals and stores it as the latest. */
  add(catalog: Catalog): void {
    this.totals.requirements += catalog.counts.requirements;
    this.totals.issues += catalog.counts.issues;
    this.latest = catalog;
  }

  /** Running totals across every catalog seen this session. */
  total(): CatalogCounts {
    return { ...this.totals };
  }

  /** The most recent catalog, or undefined if nothing has been cataloged yet. */
  last(): Catalog | undefined {
    return this.latest;
  }
}
