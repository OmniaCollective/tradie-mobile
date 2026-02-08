import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trade, getTradeConfig, tradeConfigs } from './trades';

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
  | 'blocked_drain'
  | 'leaking_tap'
  | 'burst_pipe'
  | 'toilet_repair'
  | 'boiler_service'
  | 'radiator_issue'
  | 'water_heater'
  | 'general_plumbing'
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

// Default pricing presets
export const defaultPricingPresets: PricingPreset[] = [
  { type: 'blocked_drain', label: 'Blocked Drain', basePrice: 85, estimatedHours: 1 },
  { type: 'leaking_tap', label: 'Leaking Tap', basePrice: 65, estimatedHours: 0.5 },
  { type: 'burst_pipe', label: 'Burst Pipe', basePrice: 150, estimatedHours: 2 },
  { type: 'toilet_repair', label: 'Toilet Repair', basePrice: 95, estimatedHours: 1 },
  { type: 'boiler_service', label: 'Boiler Service', basePrice: 120, estimatedHours: 1.5 },
  { type: 'radiator_issue', label: 'Radiator Issue', basePrice: 80, estimatedHours: 1 },
  { type: 'water_heater', label: 'Water Heater', basePrice: 130, estimatedHours: 1.5 },
  { type: 'general_plumbing', label: 'General Plumbing', basePrice: 75, estimatedHours: 1 },
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
  calculateQuote: (jobType: JobType, urgency: Urgency, distanceMiles?: number, additionalMaterials?: number) => Quote;
}

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Sample data for demo
const sampleCustomers: Customer[] = [
  {
    id: 'cust1',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '07700 900123',
    address: '42 Oak Street',
    postcode: 'SW1A 1AA',
  },
  {
    id: 'cust2',
    name: 'Mike Peters',
    email: 'mike.p@email.com',
    phone: '07700 900456',
    address: '15 High Road',
    postcode: 'SW1A 2BB',
  },
  {
    id: 'cust3',
    name: 'Emma Wilson',
    email: 'emma.w@email.com',
    phone: '07700 900789',
    address: '8 Church Lane',
    postcode: 'SW1A 3CC',
  },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const sampleJobs: Job[] = [
  {
    id: 'job1',
    customerId: 'cust1',
    type: 'blocked_drain',
    description: 'Kitchen sink draining slowly',
    urgency: 'standard',
    status: 'IN_PROGRESS',
    scheduledDate: today.toISOString().split('T')[0],
    scheduledTime: '09:00',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    notes: 'Customer mentioned it started last week',
    quote: {
      id: 'q1',
      jobId: 'job1',
      labour: 60,
      materials: 15,
      travel: 10,
      emergencySurcharge: 0,
      vat: 17,
      total: 102,
      validUntil: new Date(Date.now() + 172800000).toISOString(),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  },
  {
    id: 'job2',
    customerId: 'cust2',
    type: 'leaking_tap',
    description: 'Bathroom tap won\'t stop dripping',
    urgency: 'standard',
    status: 'SCHEDULED',
    scheduledDate: today.toISOString().split('T')[0],
    scheduledTime: '14:00',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    notes: '',
    quote: {
      id: 'q2',
      jobId: 'job2',
      labour: 45,
      materials: 20,
      travel: 8,
      emergencySurcharge: 0,
      vat: 14.6,
      total: 87.6,
      validUntil: new Date(Date.now() + 172800000).toISOString(),
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  },
  {
    id: 'job3',
    customerId: 'cust3',
    type: 'boiler_service',
    description: 'Annual boiler service',
    urgency: 'standard',
    status: 'SCHEDULED',
    scheduledDate: tomorrow.toISOString().split('T')[0],
    scheduledTime: '10:00',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    notes: 'Customer prefers morning appointments',
    quote: {
      id: 'q3',
      jobId: 'job3',
      labour: 90,
      materials: 30,
      travel: 12,
      emergencySurcharge: 0,
      vat: 26.4,
      total: 158.4,
      validUntil: new Date(Date.now() + 172800000).toISOString(),
      createdAt: new Date(Date.now() - 259200000).toISOString(),
    },
  },
  {
    id: 'job4',
    customerId: 'cust1',
    type: 'toilet_repair',
    description: 'Toilet keeps running after flush',
    urgency: 'urgent',
    status: 'QUOTED',
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    notes: '',
    quote: {
      id: 'q4',
      jobId: 'job4',
      labour: 71.25,
      materials: 25,
      travel: 10,
      emergencySurcharge: 23.75,
      vat: 26,
      total: 156,
      validUntil: new Date(Date.now() + 172800000).toISOString(),
      createdAt: new Date(Date.now() - 43200000).toISOString(),
    },
  },
];

const sampleInvoices: Invoice[] = [
  {
    id: 'inv1',
    jobId: 'job_old1',
    customerId: 'cust2',
    quote: {
      id: 'q_old1',
      jobId: 'job_old1',
      labour: 60,
      materials: 40,
      travel: 15,
      emergencySurcharge: 0,
      vat: 23,
      total: 138,
      validUntil: new Date(Date.now() - 604800000).toISOString(),
      createdAt: new Date(Date.now() - 604800000).toISOString(),
    },
    status: 'pending',
    sentAt: new Date(Date.now() - 259200000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

const sampleTodos: TodoItem[] = [
  {
    id: 'todo1',
    text: 'Order replacement washer for tap job',
    isVoiceNote: false,
    completed: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'todo2',
    text: 'Call supplier about boiler parts',
    isVoiceNote: false,
    completed: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      // Initial data
      jobs: sampleJobs,
      customers: sampleCustomers,
      invoices: sampleInvoices,
      todos: sampleTodos,
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
      calculateQuote: (jobType, urgency, distanceMiles = 5, additionalMaterials = 0) => {
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
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Selector hooks for performance
export const useJobs = () => useTradeStore((s) => s.jobs);
export const useCustomers = () => useTradeStore((s) => s.customers);
export const useInvoices = () => useTradeStore((s) => s.invoices);
export const useTodos = () => useTradeStore((s) => s.todos);
export const useSettings = () => useTradeStore((s) => s.settings);
export const usePricingPresets = () => useTradeStore((s) => s.pricingPresets);
