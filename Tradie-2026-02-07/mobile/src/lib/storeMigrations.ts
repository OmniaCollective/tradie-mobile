/**
 * Brings saved data from older versions of Tradie up to date. Each step only
 * fills in or reshapes what an older version didn't have; nothing the tradie
 * entered is dropped. Kept apart from the store so it can be tested on its own.
 */

/** The saved-data version the store writes. Bump it with a new step below. */
export const STORE_VERSION = 9;

export function migrateStore(persisted: any, version: number): any {
  if (!persisted || typeof persisted !== 'object') return persisted;

  if (version === 0) {
    // Migrate old plumbing-specific JobType names to generic slot names
    const typeMap: Record<string, string> = {
      blocked_drain: 'service_1',
      leaking_tap: 'service_2',
      burst_pipe: 'service_3',
      toilet_repair: 'service_4',
      boiler_service: 'service_5',
      radiator_issue: 'service_6',
      water_heater: 'service_7',
      general_plumbing: 'service_8',
    };
    const migrateType = (t: string) => typeMap[t] ?? t;

    if (persisted.jobs) {
      persisted.jobs = persisted.jobs.map((j: any) => ({
        ...j,
        type: migrateType(j.type),
      }));
    }
    if (persisted.pricingPresets) {
      persisted.pricingPresets = persisted.pricingPresets.map((p: any) => ({
        ...p,
        type: migrateType(p.type),
      }));
    }
  }
  if (version < 3) {
    // Ensure expenses array exists
    if (!persisted.expenses) {
      persisted.expenses = [];
    }
    // Ensure new tax settings exist
    if (persisted.settings) {
      if (persisted.settings.vatRegistered === undefined) persisted.settings.vatRegistered = false;
      if (persisted.settings.vatScheme === undefined) persisted.settings.vatScheme = 'standard';
      if (persisted.settings.vatFlatRatePercent === undefined) persisted.settings.vatFlatRatePercent = 14.5;
      if (persisted.settings.vatNumber === undefined) persisted.settings.vatNumber = '';
      if (persisted.settings.personalAllowance === undefined) persisted.settings.personalAllowance = 12570;
      if (persisted.settings.onlyIncomeSource === undefined) persisted.settings.onlyIncomeSource = true;
      if (persisted.settings.otherAnnualIncome === undefined) persisted.settings.otherAnnualIncome = 0;
      if (persisted.settings.cisRegistered === undefined) persisted.settings.cisRegistered = false;
    }
  }
  if (version < 5) {
    // Add configurable CIS deduction rate
    if (persisted.settings && persisted.settings.cisRate === undefined) {
      persisted.settings.cisRate = 20;
    }
  }
  if (version < 6) {
    // Anyone with saved data from an earlier version has already set up the app
    persisted.hasCompletedOnboarding = true;
  }
  if (version < 8) {
    if (!Array.isArray(persisted.renewals)) persisted.renewals = [];
  }
  if (version < 7) {
    // 'TRADIE' was a placeholder business name, never the tradie's own
    if (persisted.settings) {
      if (persisted.settings.businessName === 'TRADIE') persisted.settings.businessName = '';
      if (persisted.settings.paymentDetails === undefined) persisted.settings.paymentDetails = '';
      if (persisted.settings.paymentTermsDays === undefined) persisted.settings.paymentTermsDays = 14;
    }
    // Number existing invoices in the order they were made
    if (Array.isArray(persisted.invoices)) {
      const order = [...persisted.invoices].sort((a: any, b: any) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const numbers = new Map(order.map((inv: any, i: number) => [inv.id, i + 1]));
      persisted.invoices = persisted.invoices.map((inv: any) => ({ ...inv, number: numbers.get(inv.id) }));
    }
  }
  if (version < 2) {
    // Clear sample data for clean new-user experience
    const sampleIds = ['cust1', 'cust2', 'cust3', 'job1', 'job2', 'job3', 'job4', 'inv1', 'todo1', 'todo2'];
    if (persisted.customers) {
      persisted.customers = persisted.customers.filter((c: any) => !sampleIds.includes(c.id));
    }
    if (persisted.jobs) {
      persisted.jobs = persisted.jobs.filter((j: any) => !sampleIds.includes(j.id));
    }
    if (persisted.invoices) {
      persisted.invoices = persisted.invoices.filter((i: any) => !sampleIds.includes(i.id));
    }
    if (persisted.todos) {
      persisted.todos = persisted.todos.filter((t: any) => !sampleIds.includes(t.id));
    }
  }
  if (version < 9) {
    // Jobs move from one status to facts (quote sent, said yes, booked, done...), so steps can
    // happen in any order. Fill in the facts each old status implied.
    const invoiceFor = new Map<string, any>();
    if (Array.isArray(persisted.invoices)) for (const inv of persisted.invoices) invoiceFor.set(inv.jobId, inv);
    if (Array.isArray(persisted.jobs)) {
      persisted.jobs = persisted.jobs.map((j: any) => {
        const job = { ...j };
        const status: string = job.status;
        const past = ['APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID'];
        // A quote marked Quoted before send dates were kept was sent; keep it waiting, not "to send".
        if (status === 'QUOTED' && !job.quoteSentAt) job.quoteSentAt = job.createdAt;
        // Said yes (with or without a time yet).
        if (past.includes(status) && !job.acceptedAt) job.acceptedAt = job.createdAt;
        // "In progress" is no longer a separate step: it's booked, not yet done.
        if (status === 'IN_PROGRESS') job.status = 'SCHEDULED';
        // Finished jobs need a finished date for the checklist.
        if (['COMPLETED', 'INVOICED', 'PAID'].includes(status) && !job.completedAt) {
          job.completedAt = invoiceFor.get(job.id)?.createdAt ?? job.createdAt;
        }
        // Photos are one list now; their old before/during/after tag is kept but no longer used.
        if (job.photos !== undefined && !Array.isArray(job.photos)) job.photos = [];
        return job;
      });
    }
    if (persisted.settings) {
      // The old one-off Tax tip, if already closed, counts as the Money tip seen.
      if (!Array.isArray(persisted.settings.tipsSeen)) {
        persisted.settings.tipsSeen = persisted.settings.taxTipSeen ? ['money'] : [];
      }
    }
  }
  return persisted;
}
