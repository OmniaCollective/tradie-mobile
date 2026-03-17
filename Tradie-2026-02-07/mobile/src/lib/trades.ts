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
      { type: 'service_1', label: 'Blocked Drain', basePrice: 85, estimatedHours: 1 },
      { type: 'service_2', label: 'Leaking Tap', basePrice: 65, estimatedHours: 0.5 },
      { type: 'service_3', label: 'Burst Pipe', basePrice: 150, estimatedHours: 2 },
      { type: 'service_4', label: 'Toilet Repair', basePrice: 95, estimatedHours: 1 },
      { type: 'service_5', label: 'Boiler Service', basePrice: 120, estimatedHours: 1.5 },
      { type: 'service_6', label: 'Radiator Issue', basePrice: 80, estimatedHours: 1 },
      { type: 'service_7', label: 'Water Heater', basePrice: 130, estimatedHours: 1.5 },
      { type: 'service_8', label: 'General Plumbing', basePrice: 75, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Faulty Socket', basePrice: 75, estimatedHours: 0.75 },
      { type: 'service_2', label: 'Light Installation', basePrice: 85, estimatedHours: 1 },
      { type: 'service_3', label: 'Rewiring', basePrice: 200, estimatedHours: 3 },
      { type: 'service_4', label: 'Circuit Breaker Trip', basePrice: 95, estimatedHours: 1 },
      { type: 'service_5', label: 'Consumer Unit', basePrice: 150, estimatedHours: 2 },
      { type: 'service_6', label: 'Outdoor Wiring', basePrice: 120, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Appliance Install', basePrice: 110, estimatedHours: 1.5 },
      { type: 'service_8', label: 'Fault Finding', basePrice: 80, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Lawn Mowing', basePrice: 45, estimatedHours: 1 },
      { type: 'service_2', label: 'Hedge Trimming', basePrice: 55, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Garden Design', basePrice: 150, estimatedHours: 3 },
      { type: 'service_4', label: 'Patio Cleaning', basePrice: 65, estimatedHours: 1.5 },
      { type: 'service_5', label: 'Fencing', basePrice: 120, estimatedHours: 2 },
      { type: 'service_6', label: 'Tree Pruning', basePrice: 95, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Planting', basePrice: 70, estimatedHours: 1 },
      { type: 'service_8', label: 'Garden Tidy', basePrice: 50, estimatedHours: 1 },
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
      { type: 'service_1', label: 'House Clean', basePrice: 40, estimatedHours: 2 },
      { type: 'service_2', label: 'Office Clean', basePrice: 50, estimatedHours: 2.5 },
      { type: 'service_3', label: 'Deep Clean', basePrice: 80, estimatedHours: 3 },
      { type: 'service_4', label: 'Carpet Clean', basePrice: 60, estimatedHours: 1.5 },
      { type: 'service_5', label: 'Window Clean', basePrice: 45, estimatedHours: 1.5 },
      { type: 'service_6', label: 'End of Tenancy', basePrice: 100, estimatedHours: 3 },
      { type: 'service_7', label: 'After Party Clean', basePrice: 70, estimatedHours: 2 },
      { type: 'service_8', label: 'Regular Cleaning', basePrice: 35, estimatedHours: 1.5 },
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
      { type: 'service_1', label: '30-Min Walk', basePrice: 15, estimatedHours: 0.5 },
      { type: 'service_2', label: '1-Hour Walk', basePrice: 25, estimatedHours: 1 },
      { type: 'service_3', label: 'Group Walk', basePrice: 20, estimatedHours: 1 },
      { type: 'service_4', label: 'Puppy Visit', basePrice: 20, estimatedHours: 0.5 },
      { type: 'service_5', label: 'Dog Sitting (Day)', basePrice: 45, estimatedHours: 8 },
      { type: 'service_6', label: 'Dog Sitting (Night)', basePrice: 60, estimatedHours: 12 },
      { type: 'service_7', label: 'Pet Feeding Visit', basePrice: 15, estimatedHours: 0.5 },
      { type: 'service_8', label: 'General Pet Care', basePrice: 20, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Small House', basePrice: 30, estimatedHours: 1 },
      { type: 'service_2', label: 'Medium House', basePrice: 50, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Large House', basePrice: 75, estimatedHours: 2 },
      { type: 'service_4', label: 'Conservatory', basePrice: 40, estimatedHours: 1 },
      { type: 'service_5', label: 'Commercial Small', basePrice: 80, estimatedHours: 2 },
      { type: 'service_6', label: 'Commercial Large', basePrice: 150, estimatedHours: 3 },
      { type: 'service_7', label: 'Gutter Clean', basePrice: 60, estimatedHours: 1.5 },
      { type: 'service_8', label: 'General Exterior', basePrice: 45, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Door Fitting', basePrice: 80, estimatedHours: 1.5 },
      { type: 'service_2', label: 'Shelving', basePrice: 65, estimatedHours: 1 },
      { type: 'service_3', label: 'Kitchen Fitting', basePrice: 250, estimatedHours: 4 },
      { type: 'service_4', label: 'Decking', basePrice: 180, estimatedHours: 3 },
      { type: 'service_5', label: 'Wardrobe Build', basePrice: 200, estimatedHours: 3 },
      { type: 'service_6', label: 'Fence Repair', basePrice: 90, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Floor Laying', basePrice: 150, estimatedHours: 2.5 },
      { type: 'service_8', label: 'General Carpentry', basePrice: 70, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Furniture Assembly', basePrice: 50, estimatedHours: 1 },
      { type: 'service_2', label: 'Picture Hanging', basePrice: 35, estimatedHours: 0.5 },
      { type: 'service_3', label: 'Painting', basePrice: 120, estimatedHours: 3 },
      { type: 'service_4', label: 'Tiling', basePrice: 100, estimatedHours: 2 },
      { type: 'service_5', label: 'Wallpapering', basePrice: 90, estimatedHours: 2 },
      { type: 'service_6', label: 'Curtain Fitting', basePrice: 45, estimatedHours: 0.75 },
      { type: 'service_7', label: 'TV Mounting', basePrice: 55, estimatedHours: 1 },
      { type: 'service_8', label: 'General Odd Jobs', basePrice: 40, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Exterior Wash', basePrice: 25, estimatedHours: 0.5 },
      { type: 'service_2', label: 'Interior Clean', basePrice: 35, estimatedHours: 1 },
      { type: 'service_3', label: 'Full Valet', basePrice: 80, estimatedHours: 2.5 },
      { type: 'service_4', label: 'Mini Valet', basePrice: 50, estimatedHours: 1.5 },
      { type: 'service_5', label: 'Paint Correction', basePrice: 120, estimatedHours: 3 },
      { type: 'service_6', label: 'Upholstery Clean', basePrice: 60, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Engine Bay Clean', basePrice: 45, estimatedHours: 1 },
      { type: 'service_8', label: 'General Valet', basePrice: 40, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Single Room', basePrice: 40, estimatedHours: 0.75 },
      { type: 'service_2', label: 'Two Rooms', basePrice: 70, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Whole House', basePrice: 150, estimatedHours: 3 },
      { type: 'service_4', label: 'Staircase', basePrice: 45, estimatedHours: 1 },
      { type: 'service_5', label: 'Sofa Cleaning', basePrice: 65, estimatedHours: 1.5 },
      { type: 'service_6', label: 'Rug Cleaning', basePrice: 35, estimatedHours: 0.75 },
      { type: 'service_7', label: 'Stain Removal', basePrice: 50, estimatedHours: 1 },
      { type: 'service_8', label: 'General Cleaning', basePrice: 45, estimatedHours: 1 },
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
      { type: 'service_1', label: 'Small Job', basePrice: 50, estimatedHours: 1 },
      { type: 'service_2', label: 'Medium Job', basePrice: 80, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Large Job', basePrice: 150, estimatedHours: 3 },
      { type: 'service_4', label: 'Consultation', basePrice: 40, estimatedHours: 0.5 },
      { type: 'service_5', label: 'Full Day', basePrice: 250, estimatedHours: 8 },
      { type: 'service_6', label: 'Half Day', basePrice: 140, estimatedHours: 4 },
      { type: 'service_7', label: 'Follow-Up', basePrice: 60, estimatedHours: 1 },
      { type: 'service_8', label: 'General Service', basePrice: 50, estimatedHours: 1 },
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
