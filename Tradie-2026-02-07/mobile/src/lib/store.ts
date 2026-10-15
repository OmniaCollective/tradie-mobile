import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { regionFor, type Country, type RegionInfo } from './region';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as generateId } from 'uuid';
import { Trade, getTradeConfig } from './trades';
import { generateSampleData } from './sampleData';
import { migrateStore, STORE_VERSION } from './storeMigrations';
import { jobFacts, legacyStatus } from './jobSteps';
import { deleteReceipt, deleteAllReceipts } from './receipts';
import { cisDeduction } from './cis';
import { priceLines, type LineItem, type LineKind, type Priced, type PricingRules } from './pricing';
import type { ReminderPrefs } from './reminders';

// Selector hooks for performance — useShallow prevents re-renders when
// the returned object/array is structurally equal but referentially new.
import { useShallow } from 'zustand/react/shallow';

// Types
export type JobStatus = 'REQUESTED' | 'QUOTED' | 'APPROVED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'INVOICED' | 'PAID';

export type JobType =
  | 'service_1'
  | 'service_2'
  | 'service_3'
  | 'service_4'
  | 'service_5'
  | 'service_6'
  | 'service_7'
  | 'service_8'
  | 'emergency'
  /** "Something else": the tradie names the job and sets its price (Job.customName). */
  | 'custom';

export type Urgency = 'standard' | 'urgent' | 'emergency';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
}

/**
 * A price: the tradie's lines, and what they add up to (lib/pricing.ts). The totals are a
 * snapshot, worked out again only when the lines are edited, so a saved invoice never
 * changes on its own.
 */
export interface Quote extends Priced {
  id: string;
  jobId: string;
  lines: LineItem[];
  /** False: the PDF lists the items but shows only the totals. Unset = show prices. */
  showItemPrices?: boolean;
  /** UK construction reverse charge: VAT shown, not charged; the customer pays it to HMRC. */
  reverseCharge?: boolean;
  validUntil: string;
  createdAt: string;
  /** Only on quotes from before 1.7, which had fixed rows (now lines). */
  travel?: number;
  /** Only on quotes from before 1.6. */
  emergencySurcharge?: number;
}

/** An item saved for quick adding: the price list (Pro). */
export interface SavedItem {
  id: string;
  kind: Exclude<LineKind, 'discount'>;
  description: string;
  unit?: string;
  unitPrice: number;
  /** Most recently used first when adding. */
  lastUsedAt?: string;
}

export interface Part {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface JobPhoto {
  id: string;
  uri: string;
  /** Only on photos from before 1.6: they're one list now. */
  type?: 'before' | 'during' | 'after';
  createdAt: string;
}

export interface Job {
  id: string;
  customerId: string;
  type: JobType;
  /** The job's own name when it's "Something else". */
  customName?: string;
  description: string;
  urgency: Urgency;
  status: JobStatus;
  quote?: Quote;
  /** When the quote PDF was shared with the customer. Unset = not sent yet. */
  quoteSentAt?: string;
  /** Each time the customer was reminded about the quote. */
  quoteRemindedAt?: string[];
  /** When the customer said yes. Booking also counts as yes. */
  acceptedAt?: string;
  /** Didn't go ahead (said no, or went elsewhere). Kept, not deleted, so it can be reopened. */
  lostAt?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  completedAt?: string;
  createdAt: string;
  notes: string;
  parts?: Part[];
  photos?: JobPhoto[];
  /** Times suggested to the customer by text, waiting for their reply. */
  offeredSlots?: OfferedSlot[];
  /** When those times were sent; they're held (pencilled in) for OFFER_HOLD_HOURS. */
  offeredAt?: string;
}

export interface OfferedSlot {
  /** YYYY-MM-DD, local */
  date: string;
  /** HH:MM, 24h */
  time: string;
}

/** Offered times stay pencilled in so they aren't offered to someone else. */
export const OFFER_HOLD_HOURS = 48;

export interface Invoice {
  id: string;
  /** Sequential, shown as INV-0001. Follows on from the last invoice, as HMRC expects. */
  number: number;
  jobId: string;
  customerId: string;
  quote: Quote;
  status: 'pending' | 'sent' | 'paid';
  sentAt?: string;
  /** First time the PDF left the app (send, share, chase). Counts toward the free plan's 3 a month. */
  sharedAt?: string;
  paidAt?: string;
  cisDeducted?: boolean;
  cisDeductionAmount?: number;
  /** Each time the customer was chased for payment. */
  chasedAt?: string[];
  /** Paid on the day with no invoice sent ("Mark paid" on the job): counts as income, not as a free invoice. */
  recordedOnly?: boolean;
  createdAt: string;
}

export type ExpenseCategory =
  | 'tools_equipment'
  | 'materials'
  | 'vehicle_mileage'
  | 'subcontractor'
  | 'insurance'
  | 'phone_internet'
  | 'workwear_ppe'
  | 'training'
  | 'home_office'
  | 'other';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  tools_equipment: 'Tools & Equipment',
  materials: 'Materials & Supplies',
  vehicle_mileage: 'Vehicle / Mileage',
  subcontractor: 'Subcontractor',
  insurance: 'Insurance',
  phone_internet: 'Phone & Internet',
  workwear_ppe: 'Workwear & PPE',
  training: 'Training',
  home_office: 'Use of Home',
  other: 'Other',
};

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  date: string; // ISO date
  receiptUri?: string;
  miles?: number; // for vehicle_mileage category
  businessUsePercent?: number; // for phone_internet
  vatAmount?: number; // VAT included in this expense (for input VAT tracking)
  jobId?: string; // link to a specific job
  createdAt: string;
}

/** Insurance, licence or registration the tradie must keep current. */
export interface Renewal {
  id: string;
  name: string;
  /** Policy, licence or registration number (optional). */
  reference?: string;
  /** Expiry day, YYYY-MM-DD. */
  expires: string;
  createdAt: string;
}

export interface TodoItem {
  id: string;
  text: string;
  isVoiceNote: boolean;
  voiceUri?: string;
  completed: boolean;
  createdAt: string;
}

export interface BusinessSettings {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  trade: Trade;
  hourlyRate: number;
  minimumCharge: number;
  urgentMultiplier: number;
  emergencyMultiplier: number;
  travelRatePerMile: number;
  serviceRadiusMiles: number;
  vatRegistered: boolean;
  vatRate: number;
  vatScheme: 'standard' | 'flat_rate';
  vatFlatRatePercent: number;
  vatNumber: string;
  personalAllowance: number;
  onlyIncomeSource: boolean;
  otherAnnualIncome: number;
  cisRegistered: boolean;
  cisRate: number; // percentage, e.g. 20 = 20%
  workingHours: {
    start: string;
    end: string;
  };
  workingDays: number[]; // 0 = Sunday, 6 = Saturday
  /** Where the tradie works. Unset = the phone's region (see lib/region.ts). */
  country?: Country;
  /** US federal filing status for the tax estimate. */
  usFilingStatus?: USFilingStatus;
  /** Turned off in Account: booked jobs aren't added to the iPhone calendar. */
  calendarSyncOff?: boolean;
  /** How customers pay: bank details in the UK, Zelle/Venmo/check in the US. Printed on invoices. */
  paymentDetails: string;
  /** Days a customer has to pay. Sets the due date on invoices and when one counts as overdue. */
  paymentTermsDays: number;
  /** Light or dark: follow the iPhone (default), or always one. */
  appearance?: Appearance;
  /** The one-off explainer on the Tax card has been dismissed (before 1.6; see tipsSeen). */
  taxTipSeen?: boolean;
  /** One-off tips already closed. */
  tipsSeen?: TipKey[];
  /** Which reminders the tradie wants. Unset = all on. */
  reminders?: Partial<ReminderPrefs>;
  /** Pro: added to a part's cost when it's brought into a price, e.g. 20 = 20%. */
  materialsMarkupPercent?: number;
  /** US only: sales tax rate charged on invoices, e.g. 8.25. Unset = none. */
  salesTaxRate?: number;
  /** US only: sales tax on materials only (default), or on everything. */
  salesTaxOn?: 'materials' | 'all';
  /** Days a new quote stays valid. Unset = QUOTE_VALID_DAYS. */
  quoteValidDays?: number;
  /** Printed at the bottom of quotes, e.g. terms. */
  quoteFooter?: string;
  /** Printed at the bottom of invoices, e.g. "Thank you for your business". */
  invoiceFooter?: string;
  /** Company registration number, printed under the business details. */
  companyNumber?: string;
  website?: string;
  /** File name of the business logo in the app's documents (lib/logo.ts). */
  logoFile?: string;
}

export type Appearance = 'automatic' | 'light' | 'dark';

/** One-off tips, each shown once: on Home, the first job opened, and Money. */
export type TipKey = 'home' | 'job' | 'money';

export { reminderPrefs, type ReminderPrefs } from './reminders';

export type USFilingStatus = 'single' | 'married_joint' | 'head_of_household';

export interface PricingPreset {
  type: JobType;
  label: string;
  basePrice: number;
  estimatedHours: number;
}

// Default pricing presets (plumber defaults — overridden by setTrade)
export const defaultPricingPresets: PricingPreset[] = [
  { type: 'service_1', label: 'Blocked Drain', basePrice: 85, estimatedHours: 1 },
  { type: 'service_2', label: 'Leaking Tap', basePrice: 65, estimatedHours: 0.5 },
  { type: 'service_3', label: 'Burst Pipe', basePrice: 150, estimatedHours: 2 },
  { type: 'service_4', label: 'Toilet Repair', basePrice: 95, estimatedHours: 1 },
  { type: 'service_5', label: 'Boiler Service', basePrice: 120, estimatedHours: 1.5 },
  { type: 'service_6', label: 'Radiator Issue', basePrice: 80, estimatedHours: 1 },
  { type: 'service_7', label: 'Water Heater', basePrice: 130, estimatedHours: 1.5 },
  { type: 'service_8', label: 'General Plumbing', basePrice: 75, estimatedHours: 1 },
  { type: 'emergency', label: 'Emergency Call-out', basePrice: 200, estimatedHours: 2 },
];

const defaultSettings: BusinessSettings = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  address: '',
  postcode: '',
  trade: 'plumber',
  hourlyRate: 60,
  minimumCharge: 50,
  urgentMultiplier: 1.5,
  emergencyMultiplier: 2,
  travelRatePerMile: 0.5,
  serviceRadiusMiles: 25,
  vatRegistered: false,
  vatRate: 20,
  vatScheme: 'standard',
  vatFlatRatePercent: 14.5,
  vatNumber: '',
  personalAllowance: 12570,
  onlyIncomeSource: true,
  otherAnnualIncome: 0,
  cisRegistered: false,
  paymentDetails: '',
  paymentTermsDays: 14,
  cisRate: 20,
  workingHours: {
    start: '08:00',
    end: '18:00',
  },
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
};

// Store interface
interface TradeStore {
  // Data
  jobs: Job[];
  customers: Customer[];
  invoices: Invoice[];
  expenses: Expense[];
  todos: TodoItem[];
  renewals: Renewal[];
  settings: BusinessSettings;
  pricingPresets: PricingPreset[];
  /** Saved items for quick adding (Pro). */
  priceList: SavedItem[];

  // Tax set-aside tracking
  taxSetAsideTotal: number; // Cumulative amount user has set aside this tax year
  taxSetAsideTaxYear: string; // taxYearKey() of the year the total belongs to

  // Job actions
  addJob: (job: Omit<Job, 'id' | 'createdAt'>) => string;
  updateJob: (id: string, updates: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  getJob: (id: string) => Job | undefined;

  // The job's checklist. Each step can be done in any order and undone.
  /** Quote shared with the customer (or undone). */
  markQuoteSent: (jobId: string, sent: boolean) => void;
  /** Takes the booking or offered times off the job; the customer's yes stays. */
  unbook: (jobId: string) => void;
  markDone: (jobId: string, done: boolean) => void;
  /**
   * Paid (or undone). With no invoice, a paid record is made so the money counts in Money and
   * tax; undoing removes that record again.
   */
  markPaid: (jobId: string, paid: boolean) => void;
  /** Didn't go ahead (or reopened). */
  setLost: (jobId: string, lost: boolean) => void;
  /** The customer was reminded about the quote. */
  recordQuoteReminder: (jobId: string) => void;

  // Parts actions
  addPart: (jobId: string, part: Omit<Part, 'id'>) => void;
  updatePart: (jobId: string, partId: string, updates: Partial<Part>) => void;
  removePart: (jobId: string, partId: string) => void;

  // Photo actions
  addPhoto: (jobId: string, photo: Omit<JobPhoto, 'id'>) => void;
  removePhoto: (jobId: string, photoId: string) => void;

  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id'>) => string;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  getCustomer: (id: string) => Customer | undefined;

  // Invoice actions
  createInvoice: (jobId: string) => string | null;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  /** Corrects an unpaid invoice's lines; VAT, total and any CIS deduction are worked out again. */
  setInvoiceLines: (id: string, lines: LineItem[], options?: PriceOptions) => void;
  /** The invoice PDF has left the app (sent, shared or chased). The first time counts toward the free plan. */
  recordInvoiceShared: (id: string) => void;
  /** Removes an invoice made by mistake; its job goes back to Done so it can be invoiced again. */
  deleteInvoice: (id: string) => void;
  getInvoice: (id: string) => Invoice | undefined;

  // Expense actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => string;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  getExpense: (id: string) => Expense | undefined;

  // Todo actions
  addTodo: (text: string, isVoiceNote?: boolean, voiceUri?: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;

  // Insurance and licence renewals
  addRenewal: (renewal: Omit<Renewal, 'id' | 'createdAt'>) => string;
  updateRenewal: (id: string, updates: Partial<Omit<Renewal, 'id' | 'createdAt'>>) => void;
  deleteRenewal: (id: string) => void;

  // Price list
  addPriceItem: (item: Omit<SavedItem, 'id'>) => void;
  updatePriceItem: (id: string, updates: Partial<Omit<SavedItem, 'id'>>) => void;
  removePriceItem: (id: string) => void;
  /** Moves an item to the top of the list when it's used. */
  touchPriceItem: (id: string) => void;

  // Settings actions
  updateSettings: (updates: Partial<BusinessSettings>) => void;
  updatePricingPreset: (type: JobType, updates: Partial<PricingPreset>) => void;
  setTrade: (trade: Trade) => void;
  /** Switch country; job names follow, and prices still at the old defaults move to the new ones. */
  setCountry: (country: Country) => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;

  // Tax set-aside actions
  /** Sets the total put aside for tax this tax year (the tradie can correct it any time). */
  setTaxSetAside: (total: number) => void;

  // Demo data actions
  loadSampleData: () => void;
  clearAllData: () => void;

  // Quote calculation
  calculateQuote: (jobType: JobType, urgency: Urgency) => Quote;
  /** A quote for "Something else" at the tradie's own price, at the urgency rate. */
  calculateCustomQuote: (price: number, urgency: Urgency) => Quote;
  /** Changes a job's quote lines; VAT and total are worked out again. */
  setQuoteLines: (jobId: string, lines: LineItem[], options?: PriceOptions) => void;
}

/** Options on a price, alongside its lines. */
export interface PriceOptions {
  showItemPrices?: boolean;
  reverseCharge?: boolean;
}

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      // Initial data — empty for new users
      jobs: [],
      customers: [],
      invoices: [],
      expenses: [],
      todos: [],
      renewals: [],
      settings: defaultSettings,
      pricingPresets: defaultPricingPresets,
      priceList: [],
      hasCompletedOnboarding: false,

      // Tax set-aside tracking
      taxSetAsideTotal: 0,
      taxSetAsideTaxYear: '',

      // Job actions
      addJob: (jobData) => {
        const id = generateId();
        const newJob: Job = {
          ...jobData,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ jobs: [...state.jobs, newJob] }));
        return id;
      },

      updateJob: (id, updates) => {
        set((state) => ({
          jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job)),
        }));
      },

      deleteJob: (id) => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== id),
        }));
      },

      getJob: (id) => get().jobs.find((job) => job.id === id),

      markQuoteSent: (jobId, sent) =>
        set((state) => withSyncedStatus(state, jobId, { quoteSentAt: sent ? new Date().toISOString() : undefined })),

      unbook: (jobId) =>
        set((state) =>
          withSyncedStatus(state, jobId, {
            scheduledDate: undefined,
            scheduledTime: undefined,
            offeredSlots: undefined,
            offeredAt: undefined,
          }),
        ),

      markDone: (jobId, done) =>
        set((state) => withSyncedStatus(state, jobId, { completedAt: done ? new Date().toISOString() : undefined })),

      markPaid: (jobId, paid) =>
        set((state) => {
          const job = state.jobs.find((j) => j.id === jobId);
          if (!job) return {};
          const now = new Date().toISOString();
          const invoice = state.invoices.find((inv) => inv.jobId === jobId);
          let invoices = state.invoices;
          if (paid && invoice) {
            invoices = invoices.map((inv) => (inv.id === invoice.id ? { ...inv, status: 'paid', paidAt: now } : inv));
          } else if (paid && job.quote) {
            invoices = [
              ...invoices,
              {
                id: generateId(),
                number: invoices.reduce((max, inv) => Math.max(max, inv.number ?? 0), 0) + 1,
                jobId,
                customerId: job.customerId,
                quote: job.quote,
                status: 'paid',
                paidAt: now,
                recordedOnly: true,
                createdAt: now,
              },
            ];
          } else if (!paid && invoice?.recordedOnly) {
            invoices = invoices.filter((inv) => inv.id !== invoice.id);
          } else if (!paid && invoice) {
            invoices = invoices.map((inv) =>
              inv.id === invoice.id ? { ...inv, status: inv.sentAt ? 'sent' : 'pending', paidAt: undefined } : inv,
            );
          }
          return withSyncedStatus({ ...state, invoices }, jobId, {});
        }),

      setLost: (jobId, lost) =>
        set((state) => withSyncedStatus(state, jobId, { lostAt: lost ? new Date().toISOString() : undefined })),

      recordQuoteReminder: (jobId) =>
        set((state) => {
          const job = state.jobs.find((j) => j.id === jobId);
          return job
            ? withSyncedStatus(state, jobId, { quoteRemindedAt: [...(job.quoteRemindedAt ?? []), new Date().toISOString()] })
            : {};
        }),

      // Parts actions
      addPart: (jobId, partData) => {
        const part: Part = { ...partData, id: generateId() };
        set((state) => ({
          jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, parts: [...(job.parts ?? []), part] } : job)),
        }));
      },

      updatePart: (jobId, partId, updates) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  parts: (job.parts ?? []).map((p) => (p.id === partId ? { ...p, ...updates } : p)),
                }
              : job,
          ),
        }));
      },

      removePart: (jobId, partId) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId ? { ...job, parts: (job.parts ?? []).filter((p) => p.id !== partId) } : job,
          ),
        }));
      },

      // Photo actions
      addPhoto: (jobId, photoData) => {
        const photo: JobPhoto = { ...photoData, id: generateId() };
        set((state) => ({
          jobs: state.jobs.map((job) => (job.id === jobId ? { ...job, photos: [...(job.photos ?? []), photo] } : job)),
        }));
      },

      removePhoto: (jobId, photoId) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId ? { ...job, photos: (job.photos ?? []).filter((p) => p.id !== photoId) } : job,
          ),
        }));
      },

      // Customer actions
      addCustomer: (customerData) => {
        const id = generateId();
        const newCustomer: Customer = { ...customerData, id };
        set((state) => ({ customers: [...state.customers, newCustomer] }));
        return id;
      },

      updateCustomer: (id, updates) => {
        set((state) => ({
          customers: state.customers.map((customer) => (customer.id === id ? { ...customer, ...updates } : customer)),
        }));
      },

      getCustomer: (id) => get().customers.find((c) => c.id === id),

      // Invoice actions
      createInvoice: (jobId) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job || !job.quote) return null;

        const { settings, invoices } = get();
        const id = generateId();
        // CIS only exists in the UK.
        const cis = settings.cisRegistered && regionFor(settings.country).country === 'GB';
        const invoice: Invoice = {
          id,
          number: invoices.reduce((max, inv) => Math.max(max, inv.number ?? 0), 0) + 1,
          jobId,
          customerId: job.customerId,
          quote: job.quote,
          status: 'pending',
          // Auto-apply CIS deduction if CIS registered
          cisDeducted: cis || undefined,
          cisDeductionAmount: cis ? cisDeduction(job.quote, settings.cisRate) : undefined,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          invoices: [...state.invoices, invoice],
          jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status: 'INVOICED' } : j)),
        }));

        return id;
      },

      setInvoiceLines: (id, lines, options = {}) => {
        const { settings } = get();
        set((state) => ({
          invoices: state.invoices.map((inv) => {
            if (inv.id !== id) return inv;
            const quote = repriced(settings, { ...inv.quote, ...options, lines });
            return {
              ...inv,
              quote,
              cisDeductionAmount: inv.cisDeducted ? cisDeduction(quote, settings.cisRate) : inv.cisDeductionAmount,
            };
          }),
        }));
      },

      recordInvoiceShared: (id) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === id && !inv.sharedAt ? { ...inv, sharedAt: new Date().toISOString() } : inv,
          ),
        }));
      },

      addPriceItem: (item) => {
        set((state) => ({ priceList: [{ ...item, id: generateId() }, ...state.priceList] }));
      },

      updatePriceItem: (id, updates) => {
        set((state) => ({ priceList: state.priceList.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
      },

      removePriceItem: (id) => {
        set((state) => ({ priceList: state.priceList.filter((p) => p.id !== id) }));
      },

      touchPriceItem: (id) => {
        set((state) => ({
          priceList: state.priceList.map((p) => (p.id === id ? { ...p, lastUsedAt: new Date().toISOString() } : p)),
        }));
      },

      deleteInvoice: (id) => {
        set((state) => {
          const invoice = state.invoices.find((inv) => inv.id === id);
          return {
            invoices: state.invoices.filter((inv) => inv.id !== id),
            jobs: invoice ? state.jobs.map((j) => (j.id === invoice.jobId ? { ...j, status: 'COMPLETED' } : j)) : state.jobs,
          };
        });
      },

      updateInvoice: (id, updates) => {
        set((state) => {
          const invoice = state.invoices.find((inv) => inv.id === id);
          // The job follows its invoice: paid means paid, and undoing a payment puts it back to invoiced.
          const jobStatus: JobStatus | undefined =
            updates.status === 'paid' ? 'PAID' : updates.status && invoice?.status === 'paid' ? 'INVOICED' : undefined;
          return {
            invoices: state.invoices.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)),
            jobs:
              jobStatus && invoice
                ? state.jobs.map((j) => (j.id === invoice.jobId ? { ...j, status: jobStatus } : j))
                : state.jobs,
          };
        });
      },

      getInvoice: (id) => get().invoices.find((inv) => inv.id === id),

      // Expense actions
      addExpense: (expenseData) => {
        const id = generateId();
        const expense: Expense = {
          ...expenseData,
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ expenses: [...state.expenses, expense] }));
        return id;
      },

      updateExpense: (id, updates) => {
        // A replaced or removed receipt photo is deleted from the phone.
        const before = get().expenses.find((exp) => exp.id === id)?.receiptUri;
        if (before && 'receiptUri' in updates && updates.receiptUri !== before) void deleteReceipt(before);
        set((state) => ({
          expenses: state.expenses.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)),
        }));
      },

      deleteExpense: (id) => {
        void deleteReceipt(get().expenses.find((exp) => exp.id === id)?.receiptUri);
        set((state) => ({
          expenses: state.expenses.filter((exp) => exp.id !== id),
        }));
      },

      getExpense: (id) => get().expenses.find((exp) => exp.id === id),

      // Todo actions
      addTodo: (text, isVoiceNote = false, voiceUri) => {
        const todo: TodoItem = {
          id: generateId(),
          text,
          isVoiceNote,
          voiceUri,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ todos: [todo, ...state.todos] }));
      },

      toggleTodo: (id) => {
        set((state) => ({
          todos: state.todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
        }));
      },

      addRenewal: (renewal) => {
        const id = generateId();
        set((state) => ({ renewals: [...state.renewals, { ...renewal, id, createdAt: new Date().toISOString() }] }));
        return id;
      },

      updateRenewal: (id, updates) => {
        set((state) => ({ renewals: state.renewals.map((r) => (r.id === id ? { ...r, ...updates } : r)) }));
      },

      deleteRenewal: (id) => {
        set((state) => ({ renewals: state.renewals.filter((r) => r.id !== id) }));
      },

      deleteTodo: (id) => {
        set((state) => ({
          todos: state.todos.filter((todo) => todo.id !== id),
        }));
      },

      // Settings actions
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      updatePricingPreset: (type, updates) => {
        set((state) => ({
          pricingPresets: state.pricingPresets.map((preset) => (preset.type === type ? { ...preset, ...updates } : preset)),
        }));
      },

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      setTrade: (trade: Trade) => {
        const tradeConfig = getTradeConfig(trade, regionFor(get().settings.country).country);
        set((state) => ({
          settings: {
            ...state.settings,
            trade,
            hourlyRate: tradeConfig.defaultHourlyRate,
            minimumCharge: tradeConfig.defaultMinimumCharge,
          },
          pricingPresets: tradeConfig.jobTypes,
        }));
      },

      setCountry: (country: Country) => {
        const { settings, pricingPresets } = get();
        const from = regionFor(settings.country).country;
        if (from === country) {
          set({ settings: { ...settings, country } });
          return;
        }
        const before = getTradeConfig(settings.trade, from);
        const after = getTradeConfig(settings.trade, country);
        // Anything the tradie changed themselves stays as they set it.
        const follow = <T>(current: T, oldDefault: T | undefined, newDefault: T): T =>
          oldDefault === undefined || current === oldDefault ? newDefault : current;
        set({
          settings: {
            ...settings,
            country,
            hourlyRate: follow(settings.hourlyRate, before.defaultHourlyRate, after.defaultHourlyRate),
            minimumCharge: follow(settings.minimumCharge, before.defaultMinimumCharge, after.defaultMinimumCharge),
          },
          pricingPresets: pricingPresets.map((p) => {
            const o = before.jobTypes.find((j) => j.type === p.type);
            const n = after.jobTypes.find((j) => j.type === p.type);
            if (!n) return p;
            return {
              ...p,
              label: follow(p.label, o?.label, n.label),
              basePrice: follow(p.basePrice, o?.basePrice, n.basePrice),
              estimatedHours: follow(p.estimatedHours, o?.estimatedHours, n.estimatedHours),
            };
          }),
        });
      },

      // Tax set-aside actions
      setTaxSetAside: (total) => {
        set((state) => ({
          taxSetAsideTotal: Math.max(0, Math.round(total * 100) / 100),
          taxSetAsideTaxYear: taxYearKey(regionFor(state.settings.country).country),
        }));
      },

      // Demo data actions
      loadSampleData: () => {
        const data = generateSampleData();
        set({
          customers: data.customers,
          jobs: data.jobs,
          invoices: data.invoices,
          expenses: data.expenses,
          todos: data.todos,
          taxSetAsideTotal: data.taxSetAsideTotal,
          taxSetAsideTaxYear: taxYearKey(regionFor(get().settings.country).country),
        });
      },

      clearAllData: () => {
        void deleteAllReceipts();
        set({
          jobs: [],
          customers: [],
          invoices: [],
          expenses: [],
          todos: [],
          renewals: [],
          taxSetAsideTotal: 0,
        });
      },

      // Quote calculation
      // A new quote is one labour line: the tradie's own price for the job type, at the urgency
      // rate. Materials and anything else are added by the tradie, never guessed.
      calculateQuote: (jobType, urgency) => {
        const { settings, pricingPresets } = get();
        const preset = pricingPresets.find((p) => p.type === jobType);
        if (!preset) throw new Error('Invalid job type');
        return newQuote(settings, [autoLabourLine(labourPrice(settings, preset.basePrice, urgency, true), urgency)]);
      },

      calculateCustomQuote: (price, urgency) => {
        const { settings } = get();
        return newQuote(settings, [autoLabourLine(labourPrice(settings, price, urgency, false), urgency)]);
      },

      setQuoteLines: (jobId, lines, options = {}) => {
        const { settings } = get();
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId && j.quote ? { ...j, quote: repriced(settings, { ...j.quote, ...options, lines }) } : j,
          ),
        }));
      },
    }),
    {
      name: 'tradie-storage',
      version: STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: migrateStore,
    },
  ),
);

/**
 * Applies changes to one job and keeps its old single status in step with what has happened,
 * while screens move over to jobPosition (lib/jobSteps.ts).
 */
function withSyncedStatus(
  state: Pick<TradeStore, 'jobs' | 'invoices'>,
  jobId: string,
  changes: Partial<Job>,
): Pick<TradeStore, 'jobs' | 'invoices'> {
  const invoice = state.invoices.find((inv) => inv.jobId === jobId);
  return {
    invoices: state.invoices,
    jobs: state.jobs.map((j) => {
      if (j.id !== jobId) return j;
      const next = { ...j, ...changes };
      return { ...next, status: legacyStatus(jobFacts(next, invoice), next.status) };
    }),
  };
}

export const useJobs = () => useTradeStore(useShallow((s) => s.jobs));
export const useCustomers = () => useTradeStore(useShallow((s) => s.customers));
export const useInvoices = () => useTradeStore(useShallow((s) => s.invoices));
export const useExpenses = () => useTradeStore(useShallow((s) => s.expenses));
export const useTodos = () => useTradeStore(useShallow((s) => s.todos));
export const useRenewals = () => useTradeStore(useShallow((s) => s.renewals));

/** True once saved data has loaded from the phone; decide nothing about the tradie before then. */
export const useHasHydrated = () =>
  useSyncExternalStore(
    (onChange) => useTradeStore.persist.onFinishHydration(onChange),
    () => useTradeStore.persist.hasHydrated(),
  );

/** Days until a renewal expires (negative once it has). */
export function daysUntil(day: string, now: Date = new Date()): number {
  const [y, m, d] = day.split('-').map(Number);
  const end = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((end - today) / (24 * 60 * 60 * 1000));
}
export const useSettings = () => useTradeStore(useShallow((s) => s.settings));

/**
 * Which tax year a date falls in: the UK year starting 6 April (e.g. "2026" for 2026/27),
 * or the US calendar year.
 */
export function taxYearKey(country: Country, now: Date = new Date()): string {
  if (country === 'US') return String(now.getFullYear());
  const afterStart = now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() >= 6);
  return String(afterStart ? now.getFullYear() : now.getFullYear() - 1);
}

/** Amount put aside for tax in the current tax year; a total from a past year counts as nothing. */
export const useTaxSetAside = (): number =>
  useTradeStore((s) => (s.taxSetAsideTaxYear === taxYearKey(regionFor(s.settings.country).country) ? s.taxSetAsideTotal : 0));

/** When a sent invoice is due: the send date plus the tradie's payment terms. Unsent invoices have no due date. */
export function invoiceDueDate(
  invoice: Pick<Invoice, 'sentAt'>,
  settings: Pick<BusinessSettings, 'paymentTermsDays'>,
): Date | null {
  if (!invoice.sentAt) return null;
  return new Date(new Date(invoice.sentAt).getTime() + (settings.paymentTermsDays ?? 14) * 24 * 60 * 60 * 1000);
}

/**
 * Calendar days until a sent invoice is due: 0 on the due day, negative once it's late.
 * Counted in whole days, so the time of day it was sent doesn't matter.
 */
export function daysUntilDue(
  invoice: Pick<Invoice, 'sentAt'>,
  settings: Pick<BusinessSettings, 'paymentTermsDays'>,
  now: Date = new Date(),
): number | null {
  const due = invoiceDueDate(invoice, settings);
  if (!due) return null;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((day(due) - day(now)) / (24 * 60 * 60 * 1000));
}

/** Whole days past the due date (0 if not overdue, or paid). Late from the day after it's due. */
export function daysOverdue(
  invoice: Pick<Invoice, 'sentAt' | 'status'>,
  settings: Pick<BusinessSettings, 'paymentTermsDays'>,
  now: Date = new Date(),
): number {
  if (invoice.status === 'paid') return 0;
  return Math.max(0, -(daysUntilDue(invoice, settings, now) ?? 0));
}

/** How long a new quote stays valid, unless the tradie sets their own (settings.quoteValidDays). */
export const QUOTE_VALID_DAYS = 30;

/** What applies to this tradie's prices: VAT in the UK if registered, sales tax in the US if set. */
export function pricingRules(
  settings: Pick<BusinessSettings, 'vatRegistered' | 'vatRate' | 'country' | 'salesTaxRate' | 'salesTaxOn'>,
): PricingRules {
  const country = regionFor(settings.country).country;
  return {
    vatApplies: settings.vatRegistered && country === 'GB',
    vatRate: settings.vatRate,
    salesTaxRate: country === 'US' ? (settings.salesTaxRate ?? 0) : 0,
    salesTaxOn: settings.salesTaxOn ?? 'materials',
  };
}

/** A quote with its totals worked out again from its lines. */
export function repriced<Q extends Pick<Quote, 'lines' | 'reverseCharge'>>(settings: BusinessSettings, quote: Q): Q & Priced {
  const rules = pricingRules(settings);
  const reverseCharge = rules.vatApplies ? quote.reverseCharge : undefined;
  return { ...quote, reverseCharge, ...priceLines(rules, quote.lines, { reverseCharge }) };
}

function newQuote(settings: BusinessSettings, lines: LineItem[]): Quote {
  const now = new Date();
  const days = settings.quoteValidDays ?? QUOTE_VALID_DAYS;
  return repriced(settings, {
    id: generateId(),
    jobId: '',
    lines,
    validUntil: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  });
}

/** Labour for a job at its urgency rate. A job type's price is never below the minimum charge. */
export function labourPrice(
  settings: Pick<BusinessSettings, 'minimumCharge' | 'urgentMultiplier' | 'emergencyMultiplier'>,
  base: number,
  urgency: Urgency,
  applyMinimum: boolean,
): number {
  let labour = applyMinimum ? Math.max(base, settings.minimumCharge) : Math.max(0, base);
  if (urgency === 'urgent') labour *= settings.urgentMultiplier;
  else if (urgency === 'emergency') labour *= settings.emergencyMultiplier;
  return Math.round(labour * 100) / 100;
}

const labourDescription = (urgency: Urgency) => (urgency === 'standard' ? 'Labour' : `Labour (${urgency} rate)`);

/** The labour line made from the job type and urgency. */
export function autoLabourLine(price: number, urgency: Urgency): LineItem {
  return { id: generateId(), kind: 'labour', description: labourDescription(urgency), quantity: 1, unitPrice: price, auto: true };
}

/**
 * Lines after the job type or urgency changed: the automatic labour line follows (or is added
 * back if there's none); everything the tradie added or edited stays as it is.
 */
export function withAutoLabour(lines: LineItem[], price: number, urgency: Urgency): LineItem[] {
  if (!lines.some((l) => l.auto)) return [autoLabourLine(price, urgency), ...lines];
  return lines.map((l) => (l.auto ? { ...l, unitPrice: price, quantity: 1, description: labourDescription(urgency) } : l));
}

/** The name customers see: the business name, or the tradie's own name if there isn't one. */
export const businessDisplayName = (settings: Pick<BusinessSettings, 'businessName' | 'ownerName'>): string =>
  settings.businessName.trim() || settings.ownerName.trim();

/** INV-0001 */
export const invoiceNumberLabel = (invoice: Pick<Invoice, 'number' | 'id'>): string =>
  invoice.number ? `INV-${String(invoice.number).padStart(4, '0')}` : `#${invoice.id.slice(0, 8).toUpperCase()}`;

/** Currency, date style and tax wording for the tradie's country. */
export const useRegion = (): RegionInfo => regionFor(useTradeStore((s) => s.settings.country));
export const getRegion = (): RegionInfo => regionFor(useTradeStore.getState().settings.country);

/** What the tradie calls this job type — their own list first, then their trade's defaults for their country. */
export const getJobTypeLabel = (trade: Trade, type: JobType): string => {
  const { settings, pricingPresets } = useTradeStore.getState();
  const own = settings.trade === trade ? pricingPresets.find((p) => p.type === type)?.label : undefined;
  return own ?? getTradeConfig(trade, regionFor(settings.country).country).jobTypes.find((j) => j.type === type)?.label ?? type;
};
/** What a job is called: its own name ("Something else"), or the tradie's name for its job type. */
export const jobName = (job: Pick<Job, 'type' | 'customName'>, trade: Trade): string =>
  job.customName?.trim() || getJobTypeLabel(trade, job.type);
export const usePricingPresets = () => useTradeStore(useShallow((s) => s.pricingPresets));
export const useJobExpenses = (jobId: string) => useTradeStore(useShallow((s) => s.expenses.filter((e) => e.jobId === jobId)));
