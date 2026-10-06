import { create } from 'zustand';
import { regionFor, type Country, type RegionInfo } from './region';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as generateId } from 'uuid';
import { Trade, getTradeConfig } from './trades';
import { generateSampleData } from './sampleData';

// Selector hooks for performance — useShallow prevents re-renders when
// the returned object/array is structurally equal but referentially new.
import { useShallow } from 'zustand/react/shallow';

// Types
export type JobStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'INVOICED'
  | 'PAID';

export type JobType =
  | 'service_1'
  | 'service_2'
  | 'service_3'
  | 'service_4'
  | 'service_5'
  | 'service_6'
  | 'service_7'
  | 'service_8'
  | 'emergency';

export type Urgency = 'standard' | 'urgent' | 'emergency';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  postcode: string;
}

export interface Quote {
  id: string;
  jobId: string;
  labour: number;
  materials: number;
  travel: number;
  /** Only on quotes from before 1.6; new quotes put the emergency rate into labour. */
  emergencySurcharge: number;
  vat: number;
  total: number;
  validUntil: string;
  createdAt: string;
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
  type: 'before' | 'during' | 'after';
  createdAt: string;
}

export interface Job {
  id: string;
  customerId: string;
  type: JobType;
  description: string;
  urgency: Urgency;
  status: JobStatus;
  quote?: Quote;
  /** When the quote PDF was shared with the customer. Unset = not sent yet. */
  quoteSentAt?: string;
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
  paidAt?: string;
  cisDeducted?: boolean;
  cisDeductionAmount?: number;
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
}

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
  travelRatePerMile: 0.50,
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
  settings: BusinessSettings;
  pricingPresets: PricingPreset[];

  // Tax set-aside tracking
  taxSetAsideTotal: number; // Cumulative amount user has set aside this tax year
  taxSetAsideTaxYear: string; // taxYearKey() of the year the total belongs to

  // Job actions
  addJob: (job: Omit<Job, 'id' | 'createdAt'>) => string;
  updateJob: (id: string, updates: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  getJob: (id: string) => Job | undefined;

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
  /** Changes a job's quote; VAT and total are worked out again. */
  updateQuote: (jobId: string, prices: QuotePrices) => void;
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
      settings: defaultSettings,
      pricingPresets: defaultPricingPresets,
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
          jobs: state.jobs.map((job) =>
            job.id === id ? { ...job, ...updates } : job
          ),
        }));
      },

      deleteJob: (id) => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== id),
        }));
      },

      getJob: (id) => get().jobs.find((job) => job.id === id),

      // Parts actions
      addPart: (jobId, partData) => {
        const part: Part = { ...partData, id: generateId() };
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? { ...job, parts: [...(job.parts ?? []), part] }
              : job
          ),
        }));
      },

      updatePart: (jobId, partId, updates) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  parts: (job.parts ?? []).map((p) =>
                    p.id === partId ? { ...p, ...updates } : p
                  ),
                }
              : job
          ),
        }));
      },

      removePart: (jobId, partId) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? { ...job, parts: (job.parts ?? []).filter((p) => p.id !== partId) }
              : job
          ),
        }));
      },

      // Photo actions
      addPhoto: (jobId, photoData) => {
        const photo: JobPhoto = { ...photoData, id: generateId() };
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? { ...job, photos: [...(job.photos ?? []), photo] }
              : job
          ),
        }));
      },

      removePhoto: (jobId, photoId) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId
              ? { ...job, photos: (job.photos ?? []).filter((p) => p.id !== photoId) }
              : job
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
          customers: state.customers.map((customer) =>
            customer.id === id ? { ...customer, ...updates } : customer
          ),
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
          cisDeductionAmount: cis
            ? Math.round(job.quote.total * (settings.cisRate / 100) * 100) / 100
            : undefined,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          invoices: [...state.invoices, invoice],
          jobs: state.jobs.map((j) =>
            j.id === jobId ? { ...j, status: 'INVOICED' } : j
          ),
        }));

        return id;
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
            jobs: jobStatus && invoice ? state.jobs.map((j) => (j.id === invoice.jobId ? { ...j, status: jobStatus } : j)) : state.jobs,
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
        set((state) => ({
          expenses: state.expenses.map((exp) =>
            exp.id === id ? { ...exp, ...updates } : exp
          ),
        }));
      },

      deleteExpense: (id) => {
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
          todos: state.todos.map((todo) =>
            todo.id === id ? { ...todo, completed: !todo.completed } : todo
          ),
        }));
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
          pricingPresets: state.pricingPresets.map((preset) =>
            preset.type === type ? { ...preset, ...updates } : preset
          ),
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
        const follow = <T, >(current: T, oldDefault: T | undefined, newDefault: T): T =>
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
        set({
          jobs: [],
          customers: [],
          invoices: [],
          expenses: [],
          todos: [],
          taxSetAsideTotal: 0,
        });
      },

      // Quote calculation
      // A new quote is the tradie's own price for the job type, at the urgency rate. Materials and
      // travel start at nothing and are added by the tradie, never guessed.
      calculateQuote: (jobType, urgency) => {
        const { settings, pricingPresets } = get();
        const preset = pricingPresets.find((p) => p.type === jobType);
        if (!preset) throw new Error('Invalid job type');

        let labour = Math.max(preset.basePrice, settings.minimumCharge);
        if (urgency === 'urgent') labour *= settings.urgentMultiplier;
        else if (urgency === 'emergency') labour *= settings.emergencyMultiplier;

        const now = new Date();
        return {
          id: generateId(),
          jobId: '',
          ...priceQuote(settings, { labour, materials: 0, travel: 0 }),
          validUntil: new Date(now.getTime() + QUOTE_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: now.toISOString(),
        };
      },

      updateQuote: (jobId, prices) => {
        const { settings } = get();
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId && j.quote ? { ...j, quote: { ...j.quote, ...priceQuote(settings, prices, j.quote.emergencySurcharge) } } : j,
          ),
        }));
      },
    }),
    {
      name: 'tradie-storage',
      version: 7,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted: any, version: number) => {
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
        return persisted;
      },
    }
  )
);

export const useJobs = () => useTradeStore(useShallow((s) => s.jobs));
export const useCustomers = () => useTradeStore(useShallow((s) => s.customers));
export const useInvoices = () => useTradeStore(useShallow((s) => s.invoices));
export const useExpenses = () => useTradeStore(useShallow((s) => s.expenses));
export const useTodos = () => useTradeStore(useShallow((s) => s.todos));
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
  useTradeStore((s) =>
    s.taxSetAsideTaxYear === taxYearKey(regionFor(s.settings.country).country) ? s.taxSetAsideTotal : 0,
  );

/** How long a new quote stays valid. */
export const QUOTE_VALID_DAYS = 30;

export interface QuotePrices {
  labour: number;
  materials: number;
  travel: number;
}

const roundPence = (n: number) => Math.round(n * 100) / 100;

/** Line amounts plus VAT (VAT-registered UK traders only) and total. */
export function priceQuote(
  settings: Pick<BusinessSettings, 'vatRegistered' | 'vatRate' | 'country'>,
  { labour, materials, travel }: QuotePrices,
  emergencySurcharge = 0,
): Pick<Quote, 'labour' | 'materials' | 'travel' | 'emergencySurcharge' | 'vat' | 'total'> {
  const subtotal = roundPence(labour) + roundPence(materials) + roundPence(travel) + roundPence(emergencySurcharge);
  const vatApplies = settings.vatRegistered && regionFor(settings.country).country === 'GB';
  const vat = vatApplies ? roundPence(subtotal * (settings.vatRate / 100)) : 0;
  return {
    labour: roundPence(labour),
    materials: roundPence(materials),
    travel: roundPence(travel),
    emergencySurcharge: roundPence(emergencySurcharge),
    vat,
    total: roundPence(subtotal + vat),
  };
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
export const usePricingPresets = () => useTradeStore(useShallow((s) => s.pricingPresets));
export const useJobExpenses = (jobId: string) =>
  useTradeStore(useShallow((s) => s.expenses.filter((e) => e.jobId === jobId)));
