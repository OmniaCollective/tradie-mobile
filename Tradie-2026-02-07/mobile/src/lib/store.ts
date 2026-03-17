import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trade, getTradeConfig } from './trades';

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
  scheduledDate?: string;
  scheduledTime?: string;
  completedAt?: string;
  createdAt: string;
  notes: string;
  parts?: Part[];
  photos?: JobPhoto[];
}

export interface Invoice {
  id: string;
  jobId: string;
  customerId: string;
  quote: Quote;
  status: 'pending' | 'sent' | 'paid';
  stripePaymentLink?: string;
  sentAt?: string;
  paidAt?: string;
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
  vatRate: number;
  workingHours: {
    start: string;
    end: string;
  };
  workingDays: number[]; // 0 = Sunday, 6 = Saturday
}

export interface UsageTracking {
  bookingLinksSentThisMonth: number;
  currentMonth: string; // Format: "YYYY-MM"
}

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
  businessName: 'TRADIE',
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
  vatRate: 20,
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
  todos: TodoItem[];
  settings: BusinessSettings;
  pricingPresets: PricingPreset[];

  // Usage tracking
  bookingLinksSentThisMonth: number;
  usageTrackingMonth: string; // Format: "YYYY-MM"

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
  getInvoice: (id: string) => Invoice | undefined;

  // Todo actions
  addTodo: (text: string, isVoiceNote?: boolean, voiceUri?: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;

  // Settings actions
  updateSettings: (updates: Partial<BusinessSettings>) => void;
  updatePricingPreset: (type: JobType, updates: Partial<PricingPreset>) => void;
  setTrade: (trade: Trade) => void;

  // Usage tracking actions
  incrementBookingLinksSent: () => void;

  // Quote calculation
  calculateQuote: (jobType: JobType, urgency: Urgency, distanceMiles?: number, additionalMaterials?: number, explicitPartsTotal?: number) => Quote;
}

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      // Initial data — empty for new users
      jobs: [],
      customers: [],
      invoices: [],
      todos: [],
      settings: defaultSettings,
      pricingPresets: defaultPricingPresets,

      // Usage tracking
      bookingLinksSentThisMonth: 0,
      usageTrackingMonth: new Date().toISOString().slice(0, 7), // "YYYY-MM"

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

        const id = generateId();
        const invoice: Invoice = {
          id,
          jobId,
          customerId: job.customerId,
          quote: job.quote,
          status: 'pending',
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

      updateInvoice: (id, updates) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === id ? { ...inv, ...updates } : inv
          ),
        }));
      },

      getInvoice: (id) => get().invoices.find((inv) => inv.id === id),

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

      setTrade: (trade: Trade) => {
        const tradeConfig = getTradeConfig(trade);
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

      // Usage tracking actions
      incrementBookingLinksSent: () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        set((state) => {
          // Reset counter if we're in a new month
          if (state.usageTrackingMonth !== currentMonth) {
            return {
              bookingLinksSentThisMonth: 1,
              usageTrackingMonth: currentMonth,
            };
          }
          return {
            bookingLinksSentThisMonth: state.bookingLinksSentThisMonth + 1,
          };
        });
      },

      // Quote calculation
      calculateQuote: (jobType, urgency, distanceMiles = 5, additionalMaterials = 0, explicitPartsTotal) => {
        const { settings, pricingPresets } = get();
        const preset = pricingPresets.find((p) => p.type === jobType);

        if (!preset) {
          throw new Error('Invalid job type');
        }

        // Base labour cost
        let labour = Math.max(preset.basePrice, settings.minimumCharge);

        // Apply urgency multiplier
        if (urgency === 'urgent') {
          labour *= settings.urgentMultiplier;
        } else if (urgency === 'emergency') {
          labour *= settings.emergencyMultiplier;
        }

        // Calculate travel
        const travel = distanceMiles * settings.travelRatePerMile;

        // Materials (base estimate + additional)
        const materials = (preset.basePrice * 0.15) + additionalMaterials;

        // Emergency surcharge
        const emergencySurcharge = urgency === 'emergency' ? labour * 0.25 : 0;

        // Subtotal before VAT
        const subtotal = labour + materials + travel + emergencySurcharge;

        // VAT
        const vat = subtotal * (settings.vatRate / 100);

        // Total
        const total = subtotal + vat;

        return {
          id: generateId(),
          jobId: '',
          labour: Math.round(labour * 100) / 100,
          materials: Math.round(materials * 100) / 100,
          travel: Math.round(travel * 100) / 100,
          emergencySurcharge: Math.round(emergencySurcharge * 100) / 100,
          vat: Math.round(vat * 100) / 100,
          total: Math.round(total * 100) / 100,
          validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        };
      },
    }),
    {
      name: 'tradie-storage',
      version: 2,
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

// Selector hooks for performance — useShallow prevents re-renders when
// the returned object/array is structurally equal but referentially new.
import { useShallow } from 'zustand/react/shallow';

export const useJobs = () => useTradeStore(useShallow((s) => s.jobs));
export const useCustomers = () => useTradeStore(useShallow((s) => s.customers));
export const useInvoices = () => useTradeStore(useShallow((s) => s.invoices));
export const useTodos = () => useTradeStore(useShallow((s) => s.todos));
export const useSettings = () => useTradeStore(useShallow((s) => s.settings));
export const usePricingPresets = () => useTradeStore(useShallow((s) => s.pricingPresets));
