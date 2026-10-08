/**
 * Keeps the phone's quote, invoice and renewal reminders in step with the data: whenever jobs,
 * invoices, renewals or the reminder switches change (and when the app comes back to the front),
 * the plan is worked out again and synced. Debounced, so typing doesn't reschedule on every key.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTradeStore, jobName } from './store';
import { planNudges } from './nudgePlan';
import { syncNudges } from './notifications';
import { formatMoney } from './money';

const DEBOUNCE_MS = 1500;

function syncNow() {
  const s = useTradeStore.getState();
  const plan = planNudges({
    jobs: s.jobs,
    invoices: s.invoices,
    customers: s.customers,
    renewals: s.renewals,
    settings: s.settings,
    nameOf: (job) => jobName(job, s.settings.trade),
    money: formatMoney,
  });
  return syncNudges(plan);
}

export function useNudgeSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(syncNow, DEBOUNCE_MS);
    };
    // Only the parts that change what's planned.
    const unsubscribe = useTradeStore.subscribe((state, prev) => {
      if (
        state.jobs !== prev.jobs ||
        state.invoices !== prev.invoices ||
        state.renewals !== prev.renewals ||
        state.settings.reminders !== prev.settings.reminders ||
        state.settings.paymentTermsDays !== prev.settings.paymentTermsDays
      ) {
        schedule();
      }
    });
    const appState = AppState.addEventListener('change', (next) => next === 'active' && schedule());
    if (useTradeStore.persist.hasHydrated()) schedule();
    else useTradeStore.persist.onFinishHydration(schedule);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, []);
}
