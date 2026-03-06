import { JobType } from './store';

export type Trade = 'plumber' | 'electrician' | 'gardener' | 'cleaner' | 'dog_walker' | 'window_cleaner' | 'carpenter' | 'diy' | 'car_valet' | 'carpet_cleaner' | 'custom';

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
  dog_walker: {
    name: 'dog_walker',
    label: 'Dog Walker',
    icon: '🐕',
    description: 'Dog walking & pet care',
    jobTypes: [
      { type: 'blocked_drain', label: '30-Min Walk', basePrice: 15, estimatedHours: 0.5 },
      { type: 'leaking_tap', label: '1-Hour Walk', basePrice: 25, estimatedHours: 1 },
      { type: 'burst_pipe', label: 'Group Walk', basePrice: 20, estimatedHours: 1 },
      { type: 'toilet_repair', label: 'Puppy Visit', basePrice: 20, estimatedHours: 0.5 },
      { type: 'boiler_service', label: 'Dog Sitting (Day)', basePrice: 45, estimatedHours: 8 },
      { type: 'radiator_issue', label: 'Dog Sitting (Night)', basePrice: 60, estimatedHours: 12 },
      { type: 'water_heater', label: 'Pet Feeding Visit', basePrice: 15, estimatedHours: 0.5 },
      { type: 'general_plumbing', label: 'General Pet Care', basePrice: 20, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Walk', basePrice: 35, estimatedHours: 1 },
    ],
    defaultHourlyRate: 20,
    defaultMinimumCharge: 15,
  },
  window_cleaner: {
    name: 'window_cleaner',
    label: 'Window Cleaner',
    icon: '🪟',
    description: 'Window & exterior cleaning',
    jobTypes: [
      { type: 'blocked_drain', label: 'Small House', basePrice: 30, estimatedHours: 1 },
      { type: 'leaking_tap', label: 'Medium House', basePrice: 50, estimatedHours: 1.5 },
      { type: 'burst_pipe', label: 'Large House', basePrice: 75, estimatedHours: 2 },
      { type: 'toilet_repair', label: 'Conservatory', basePrice: 40, estimatedHours: 1 },
      { type: 'boiler_service', label: 'Commercial Small', basePrice: 80, estimatedHours: 2 },
      { type: 'radiator_issue', label: 'Commercial Large', basePrice: 150, estimatedHours: 3 },
      { type: 'water_heater', label: 'Gutter Clean', basePrice: 60, estimatedHours: 1.5 },
      { type: 'general_plumbing', label: 'General Exterior', basePrice: 45, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Clean', basePrice: 70, estimatedHours: 1.5 },
    ],
    defaultHourlyRate: 30,
    defaultMinimumCharge: 25,
  },
  carpenter: {
    name: 'carpenter',
    label: 'Carpenter',
    icon: '🪚',
    description: 'Woodwork & carpentry services',
    jobTypes: [
      { type: 'blocked_drain', label: 'Door Fitting', basePrice: 80, estimatedHours: 1.5 },
      { type: 'leaking_tap', label: 'Shelving', basePrice: 65, estimatedHours: 1 },
      { type: 'burst_pipe', label: 'Kitchen Fitting', basePrice: 250, estimatedHours: 4 },
      { type: 'toilet_repair', label: 'Decking', basePrice: 180, estimatedHours: 3 },
      { type: 'boiler_service', label: 'Wardrobe Build', basePrice: 200, estimatedHours: 3 },
      { type: 'radiator_issue', label: 'Fence Repair', basePrice: 90, estimatedHours: 1.5 },
      { type: 'water_heater', label: 'Floor Laying', basePrice: 150, estimatedHours: 2.5 },
      { type: 'general_plumbing', label: 'General Carpentry', basePrice: 70, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Repair', basePrice: 130, estimatedHours: 2 },
    ],
    defaultHourlyRate: 55,
    defaultMinimumCharge: 50,
  },
  diy: {
    name: 'diy',
    label: 'DIY / Handyman',
    icon: '🔨',
    description: 'General DIY & odd jobs',
    jobTypes: [
      { type: 'blocked_drain', label: 'Furniture Assembly', basePrice: 50, estimatedHours: 1 },
      { type: 'leaking_tap', label: 'Picture Hanging', basePrice: 35, estimatedHours: 0.5 },
      { type: 'burst_pipe', label: 'Painting', basePrice: 120, estimatedHours: 3 },
      { type: 'toilet_repair', label: 'Tiling', basePrice: 100, estimatedHours: 2 },
      { type: 'boiler_service', label: 'Wallpapering', basePrice: 90, estimatedHours: 2 },
      { type: 'radiator_issue', label: 'Curtain Fitting', basePrice: 45, estimatedHours: 0.75 },
      { type: 'water_heater', label: 'TV Mounting', basePrice: 55, estimatedHours: 1 },
      { type: 'general_plumbing', label: 'General Odd Jobs', basePrice: 40, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Fix', basePrice: 80, estimatedHours: 1.5 },
    ],
    defaultHourlyRate: 35,
    defaultMinimumCharge: 30,
  },
  car_valet: {
    name: 'car_valet',
    label: 'Car Valet',
    icon: '🚗',
    description: 'Car cleaning & valeting',
    jobTypes: [
      { type: 'blocked_drain', label: 'Exterior Wash', basePrice: 25, estimatedHours: 0.5 },
      { type: 'leaking_tap', label: 'Interior Clean', basePrice: 35, estimatedHours: 1 },
      { type: 'burst_pipe', label: 'Full Valet', basePrice: 80, estimatedHours: 2.5 },
      { type: 'toilet_repair', label: 'Mini Valet', basePrice: 50, estimatedHours: 1.5 },
      { type: 'boiler_service', label: 'Paint Correction', basePrice: 120, estimatedHours: 3 },
      { type: 'radiator_issue', label: 'Upholstery Clean', basePrice: 60, estimatedHours: 1.5 },
      { type: 'water_heater', label: 'Engine Bay Clean', basePrice: 45, estimatedHours: 1 },
      { type: 'general_plumbing', label: 'General Valet', basePrice: 40, estimatedHours: 1 },
      { type: 'emergency', label: 'Express Valet', basePrice: 55, estimatedHours: 1 },
    ],
    defaultHourlyRate: 30,
    defaultMinimumCharge: 25,
  },
  carpet_cleaner: {
    name: 'carpet_cleaner',
    label: 'Carpet Cleaner',
    icon: '🧽',
    description: 'Carpet & upholstery cleaning',
    jobTypes: [
      { type: 'blocked_drain', label: 'Single Room', basePrice: 40, estimatedHours: 0.75 },
      { type: 'leaking_tap', label: 'Two Rooms', basePrice: 70, estimatedHours: 1.5 },
      { type: 'burst_pipe', label: 'Whole House', basePrice: 150, estimatedHours: 3 },
      { type: 'toilet_repair', label: 'Staircase', basePrice: 45, estimatedHours: 1 },
      { type: 'boiler_service', label: 'Sofa Cleaning', basePrice: 65, estimatedHours: 1.5 },
      { type: 'radiator_issue', label: 'Rug Cleaning', basePrice: 35, estimatedHours: 0.75 },
      { type: 'water_heater', label: 'Stain Removal', basePrice: 50, estimatedHours: 1 },
      { type: 'general_plumbing', label: 'General Cleaning', basePrice: 45, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Clean', basePrice: 80, estimatedHours: 1.5 },
    ],
    defaultHourlyRate: 35,
    defaultMinimumCharge: 35,
  },
  custom: {
    name: 'custom',
    label: 'Other',
    icon: '⚙️',
    description: 'Custom trade or service',
    jobTypes: [
      { type: 'blocked_drain', label: 'Small Job', basePrice: 50, estimatedHours: 1 },
      { type: 'leaking_tap', label: 'Medium Job', basePrice: 80, estimatedHours: 1.5 },
      { type: 'burst_pipe', label: 'Large Job', basePrice: 150, estimatedHours: 3 },
      { type: 'toilet_repair', label: 'Consultation', basePrice: 40, estimatedHours: 0.5 },
      { type: 'boiler_service', label: 'Full Day', basePrice: 250, estimatedHours: 8 },
      { type: 'radiator_issue', label: 'Half Day', basePrice: 140, estimatedHours: 4 },
      { type: 'water_heater', label: 'Follow-Up', basePrice: 60, estimatedHours: 1 },
      { type: 'general_plumbing', label: 'General Service', basePrice: 50, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency', basePrice: 120, estimatedHours: 2 },
    ],
    defaultHourlyRate: 40,
    defaultMinimumCharge: 40,
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
