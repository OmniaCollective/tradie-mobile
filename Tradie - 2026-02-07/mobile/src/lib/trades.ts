import { JobType } from './store';

export type Trade = 'plumber' | 'electrician' | 'gardener' | 'cleaner';

export interface PricingPreset {
  type: JobType;
  label: string;
  basePrice: number;
  estimatedHours: number;
}

export interface TradeConfig {
  name: string;
  label: string;
  icon: string;
  description: string;
  jobTypes: PricingPreset[];
  defaultHourlyRate: number;
  defaultMinimumCharge: number;
}

export const tradeConfigs: Record<Trade, TradeConfig> = {
  plumber: {
    name: 'plumber',
    label: 'Plumber',
    icon: '🔧',
    description: 'Plumbing & heating services',
    jobTypes: [
      { type: 'blocked_drain', label: 'Blocked Drain', basePrice: 85, estimatedHours: 1 },
      { type: 'leaking_tap', label: 'Leaking Tap', basePrice: 65, estimatedHours: 0.5 },
      { type: 'burst_pipe', label: 'Burst Pipe', basePrice: 150, estimatedHours: 2 },
      { type: 'toilet_repair', label: 'Toilet Repair', basePrice: 95, estimatedHours: 1 },
      { type: 'boiler_service', label: 'Boiler Service', basePrice: 120, estimatedHours: 1.5 },
      { type: 'radiator_issue', label: 'Radiator Issue', basePrice: 80, estimatedHours: 1 },
      { type: 'water_heater', label: 'Water Heater', basePrice: 130, estimatedHours: 1.5 },
      { type: 'general_plumbing', label: 'General Plumbing', basePrice: 75, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Call-out', basePrice: 200, estimatedHours: 2 },
    ],
    defaultHourlyRate: 60,
    defaultMinimumCharge: 50,
  },
  electrician: {
    name: 'electrician',
    label: 'Electrician',
    icon: '⚡',
    description: 'Electrical installation & repair',
    jobTypes: [
      { type: 'blocked_drain', label: 'Faulty Socket', basePrice: 75, estimatedHours: 0.75 },
      { type: 'leaking_tap', label: 'Light Installation', basePrice: 85, estimatedHours: 1 },
      { type: 'burst_pipe', label: 'Rewiring', basePrice: 200, estimatedHours: 3 },
      { type: 'toilet_repair', label: 'Circuit Breaker Trip', basePrice: 95, estimatedHours: 1 },
      { type: 'boiler_service', label: 'Consumer Unit', basePrice: 150, estimatedHours: 2 },
      { type: 'radiator_issue', label: 'Outdoor Wiring', basePrice: 120, estimatedHours: 1.5 },
      { type: 'water_heater', label: 'Appliance Install', basePrice: 110, estimatedHours: 1.5 },
      { type: 'general_plumbing', label: 'Fault Finding', basePrice: 80, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Call-out', basePrice: 220, estimatedHours: 2 },
    ],
    defaultHourlyRate: 65,
    defaultMinimumCharge: 55,
  },
  gardener: {
    name: 'gardener',
    label: 'Gardener',
    icon: '🌿',
    description: 'Garden maintenance & landscaping',
    jobTypes: [
      { type: 'blocked_drain', label: 'Lawn Mowing', basePrice: 45, estimatedHours: 1 },
      { type: 'leaking_tap', label: 'Hedge Trimming', basePrice: 55, estimatedHours: 1.5 },
      { type: 'burst_pipe', label: 'Garden Design', basePrice: 150, estimatedHours: 3 },
      { type: 'toilet_repair', label: 'Patio Cleaning', basePrice: 65, estimatedHours: 1.5 },
      { type: 'boiler_service', label: 'Fencing', basePrice: 120, estimatedHours: 2 },
      { type: 'radiator_issue', label: 'Tree Pruning', basePrice: 95, estimatedHours: 1.5 },
      { type: 'water_heater', label: 'Planting', basePrice: 70, estimatedHours: 1 },
      { type: 'general_plumbing', label: 'Garden Tidy', basePrice: 50, estimatedHours: 1 },
      { type: 'emergency', label: 'Storm Cleanup', basePrice: 120, estimatedHours: 2 },
    ],
    defaultHourlyRate: 40,
    defaultMinimumCharge: 40,
  },
  cleaner: {
    name: 'cleaner',
    label: 'Cleaner',
    icon: '🧹',
    description: 'Cleaning & housekeeping services',
    jobTypes: [
      { type: 'blocked_drain', label: 'House Clean', basePrice: 40, estimatedHours: 2 },
      { type: 'leaking_tap', label: 'Office Clean', basePrice: 50, estimatedHours: 2.5 },
      { type: 'burst_pipe', label: 'Deep Clean', basePrice: 80, estimatedHours: 3 },
      { type: 'toilet_repair', label: 'Carpet Clean', basePrice: 60, estimatedHours: 1.5 },
      { type: 'boiler_service', label: 'Window Clean', basePrice: 45, estimatedHours: 1.5 },
      { type: 'radiator_issue', label: 'End of Tenancy', basePrice: 100, estimatedHours: 3 },
      { type: 'water_heater', label: 'After Party Clean', basePrice: 70, estimatedHours: 2 },
      { type: 'general_plumbing', label: 'Regular Cleaning', basePrice: 35, estimatedHours: 1.5 },
      { type: 'emergency', label: 'Emergency Clean', basePrice: 90, estimatedHours: 2 },
    ],
    defaultHourlyRate: 25,
    defaultMinimumCharge: 30,
  },
};

export const getTradeConfig = (trade: Trade): TradeConfig => {
  return tradeConfigs[trade];
};

export const getJobTypeLabel = (trade: Trade, jobType: JobType): string => {
  const config = getTradeConfig(trade);
  const preset = config.jobTypes.find((j) => j.type === jobType);
  return preset?.label || jobType;
};
