/**
 * US wording and starting prices (USD) for each trade. Job types keep the same
 * meaning as their UK counterpart in trades.ts (same `type` key), so switching country
 * renames a job rather than turning it into a different one. Exception: the plumber's
 * Boiler Service and Radiator Issue become Water Heater Flush and Sump Pump Repair,
 * because most US homes don't have boilers.
 *
 * Prices are starting points a tradie edits in Account → Job prices.
 */
import type { Trade, TradeConfig } from '../trades';

type USTrade = Pick<TradeConfig, 'jobTypes' | 'defaultHourlyRate' | 'defaultMinimumCharge'> &
  Partial<Pick<TradeConfig, 'label' | 'description'>>;

export const US_TRADES: Record<Trade, USTrade> = {
  plumber: {
    jobTypes: [
      { type: 'service_1', label: 'Clogged Drain', basePrice: 175, estimatedHours: 1 },
      { type: 'service_2', label: 'Leaky Faucet', basePrice: 150, estimatedHours: 0.5 },
      { type: 'service_3', label: 'Burst Pipe', basePrice: 350, estimatedHours: 2 },
      { type: 'service_4', label: 'Toilet Repair', basePrice: 175, estimatedHours: 1 },
      { type: 'service_5', label: 'Water Heater Flush', basePrice: 150, estimatedHours: 1 },
      { type: 'service_6', label: 'Sump Pump Repair', basePrice: 250, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Water Heater Repair', basePrice: 250, estimatedHours: 1.5 },
      { type: 'service_8', label: 'General Plumbing', basePrice: 150, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Call-out', basePrice: 300, estimatedHours: 2 },
    ],
    defaultHourlyRate: 110,
    defaultMinimumCharge: 125,
  },
  electrician: {
    jobTypes: [
      { type: 'service_1', label: 'Faulty Outlet', basePrice: 150, estimatedHours: 0.75 },
      { type: 'service_2', label: 'Light Fixture Install', basePrice: 175, estimatedHours: 1 },
      { type: 'service_3', label: 'Rewiring', basePrice: 450, estimatedHours: 3 },
      { type: 'service_4', label: 'Tripped Breaker', basePrice: 150, estimatedHours: 1 },
      { type: 'service_5', label: 'Breaker Panel Work', basePrice: 400, estimatedHours: 2 },
      { type: 'service_6', label: 'Outdoor Wiring', basePrice: 250, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Appliance Hookup', basePrice: 175, estimatedHours: 1.5 },
      { type: 'service_8', label: 'Troubleshooting', basePrice: 150, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Call-out', basePrice: 325, estimatedHours: 2 },
    ],
    defaultHourlyRate: 110,
    defaultMinimumCharge: 125,
  },
  gardener: {
    label: 'Landscaper',
    description: 'Lawn care & landscaping',
    jobTypes: [
      { type: 'service_1', label: 'Lawn Mowing', basePrice: 60, estimatedHours: 1 },
      { type: 'service_2', label: 'Hedge Trimming', basePrice: 90, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Landscape Design', basePrice: 300, estimatedHours: 3 },
      { type: 'service_4', label: 'Patio Power Wash', basePrice: 150, estimatedHours: 1.5 },
      { type: 'service_5', label: 'Fencing', basePrice: 250, estimatedHours: 2 },
      { type: 'service_6', label: 'Tree Trimming', basePrice: 175, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Planting', basePrice: 120, estimatedHours: 1 },
      { type: 'service_8', label: 'Yard Cleanup', basePrice: 120, estimatedHours: 1 },
      { type: 'emergency', label: 'Storm Cleanup', basePrice: 250, estimatedHours: 2 },
    ],
    defaultHourlyRate: 60,
    defaultMinimumCharge: 60,
  },
  cleaner: {
    description: 'House & office cleaning',
    jobTypes: [
      { type: 'service_1', label: 'House Cleaning', basePrice: 150, estimatedHours: 2 },
      { type: 'service_2', label: 'Office Cleaning', basePrice: 175, estimatedHours: 2.5 },
      { type: 'service_3', label: 'Deep Cleaning', basePrice: 275, estimatedHours: 3 },
      { type: 'service_4', label: 'Carpet Cleaning', basePrice: 150, estimatedHours: 1.5 },
      { type: 'service_5', label: 'Window Cleaning', basePrice: 150, estimatedHours: 1.5 },
      { type: 'service_6', label: 'Move-out Cleaning', basePrice: 300, estimatedHours: 3 },
      { type: 'service_7', label: 'Post-Party Cleanup', basePrice: 200, estimatedHours: 2 },
      { type: 'service_8', label: 'Recurring Cleaning', basePrice: 130, estimatedHours: 1.5 },
      { type: 'emergency', label: 'Emergency Cleaning', basePrice: 250, estimatedHours: 2 },
    ],
    defaultHourlyRate: 50,
    defaultMinimumCharge: 100,
  },
  dog_walker: {
    jobTypes: [
      { type: 'service_1', label: '30-Minute Walk', basePrice: 25, estimatedHours: 0.5 },
      { type: 'service_2', label: '1-Hour Walk', basePrice: 40, estimatedHours: 1 },
      { type: 'service_3', label: 'Group Walk', basePrice: 25, estimatedHours: 1 },
      { type: 'service_4', label: 'Puppy Visit', basePrice: 25, estimatedHours: 0.5 },
      { type: 'service_5', label: 'Dog Sitting (Day)', basePrice: 90, estimatedHours: 8 },
      { type: 'service_6', label: 'Dog Sitting (Overnight)', basePrice: 100, estimatedHours: 12 },
      { type: 'service_7', label: 'Feeding Visit', basePrice: 25, estimatedHours: 0.5 },
      { type: 'service_8', label: 'General Pet Care', basePrice: 30, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Walk', basePrice: 50, estimatedHours: 1 },
    ],
    defaultHourlyRate: 40,
    defaultMinimumCharge: 25,
  },
  window_cleaner: {
    jobTypes: [
      { type: 'service_1', label: 'Small Home', basePrice: 150, estimatedHours: 1 },
      { type: 'service_2', label: 'Medium Home', basePrice: 250, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Large Home', basePrice: 400, estimatedHours: 2 },
      { type: 'service_4', label: 'Sunroom', basePrice: 125, estimatedHours: 1 },
      { type: 'service_5', label: 'Small Commercial', basePrice: 250, estimatedHours: 2 },
      { type: 'service_6', label: 'Large Commercial', basePrice: 500, estimatedHours: 3 },
      { type: 'service_7', label: 'Gutter Cleaning', basePrice: 175, estimatedHours: 1.5 },
      { type: 'service_8', label: 'General Exterior', basePrice: 150, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Cleaning', basePrice: 200, estimatedHours: 1.5 },
    ],
    defaultHourlyRate: 60,
    defaultMinimumCharge: 100,
  },
  carpenter: {
    jobTypes: [
      { type: 'service_1', label: 'Door Install', basePrice: 250, estimatedHours: 1.5 },
      { type: 'service_2', label: 'Shelving', basePrice: 175, estimatedHours: 1 },
      { type: 'service_3', label: 'Cabinet Install', basePrice: 600, estimatedHours: 4 },
      { type: 'service_4', label: 'Deck Repair', basePrice: 450, estimatedHours: 3 },
      { type: 'service_5', label: 'Closet Build', basePrice: 600, estimatedHours: 3 },
      { type: 'service_6', label: 'Fence Repair', basePrice: 250, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Flooring Install', basePrice: 500, estimatedHours: 2.5 },
      { type: 'service_8', label: 'General Carpentry', basePrice: 150, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Repair', basePrice: 300, estimatedHours: 2 },
    ],
    defaultHourlyRate: 85,
    defaultMinimumCharge: 125,
  },
  diy: {
    label: 'Handyman',
    description: 'Home repairs & odd jobs',
    jobTypes: [
      { type: 'service_1', label: 'Furniture Assembly', basePrice: 100, estimatedHours: 1 },
      { type: 'service_2', label: 'Picture Hanging', basePrice: 75, estimatedHours: 0.5 },
      { type: 'service_3', label: 'Painting', basePrice: 350, estimatedHours: 3 },
      { type: 'service_4', label: 'Tiling', basePrice: 300, estimatedHours: 2 },
      { type: 'service_5', label: 'Wallpapering', basePrice: 300, estimatedHours: 2 },
      { type: 'service_6', label: 'Curtain Rod Install', basePrice: 90, estimatedHours: 0.75 },
      { type: 'service_7', label: 'TV Mounting', basePrice: 150, estimatedHours: 1 },
      { type: 'service_8', label: 'General Odd Jobs', basePrice: 100, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Fix', basePrice: 175, estimatedHours: 1.5 },
    ],
    defaultHourlyRate: 75,
    defaultMinimumCharge: 100,
  },
  car_valet: {
    label: 'Car Detailer',
    description: 'Car cleaning & detailing',
    jobTypes: [
      { type: 'service_1', label: 'Exterior Wash', basePrice: 50, estimatedHours: 0.5 },
      { type: 'service_2', label: 'Interior Detail', basePrice: 120, estimatedHours: 1 },
      { type: 'service_3', label: 'Full Detail', basePrice: 250, estimatedHours: 2.5 },
      { type: 'service_4', label: 'Express Detail', basePrice: 100, estimatedHours: 1.5 },
      { type: 'service_5', label: 'Paint Correction', basePrice: 400, estimatedHours: 3 },
      { type: 'service_6', label: 'Upholstery Shampoo', basePrice: 125, estimatedHours: 1.5 },
      { type: 'service_7', label: 'Engine Bay Detail', basePrice: 75, estimatedHours: 1 },
      { type: 'service_8', label: 'General Detail', basePrice: 100, estimatedHours: 1 },
      { type: 'emergency', label: 'Rush Detail', basePrice: 150, estimatedHours: 1 },
    ],
    defaultHourlyRate: 50,
    defaultMinimumCharge: 50,
  },
  carpet_cleaner: {
    jobTypes: [
      { type: 'service_1', label: 'Single Room', basePrice: 100, estimatedHours: 0.75 },
      { type: 'service_2', label: 'Two Rooms', basePrice: 175, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Whole House', basePrice: 350, estimatedHours: 3 },
      { type: 'service_4', label: 'Stairs', basePrice: 100, estimatedHours: 1 },
      { type: 'service_5', label: 'Sofa Cleaning', basePrice: 150, estimatedHours: 1.5 },
      { type: 'service_6', label: 'Rug Cleaning', basePrice: 80, estimatedHours: 0.75 },
      { type: 'service_7', label: 'Stain Removal', basePrice: 90, estimatedHours: 1 },
      { type: 'service_8', label: 'General Cleaning', basePrice: 120, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency Cleaning', basePrice: 225, estimatedHours: 1.5 },
    ],
    defaultHourlyRate: 60,
    defaultMinimumCharge: 100,
  },
  custom: {
    jobTypes: [
      { type: 'service_1', label: 'Small Job', basePrice: 100, estimatedHours: 1 },
      { type: 'service_2', label: 'Medium Job', basePrice: 175, estimatedHours: 1.5 },
      { type: 'service_3', label: 'Large Job', basePrice: 350, estimatedHours: 3 },
      { type: 'service_4', label: 'Consultation', basePrice: 75, estimatedHours: 0.5 },
      { type: 'service_5', label: 'Full Day', basePrice: 600, estimatedHours: 8 },
      { type: 'service_6', label: 'Half Day', basePrice: 325, estimatedHours: 4 },
      { type: 'service_7', label: 'Follow-Up', basePrice: 100, estimatedHours: 1 },
      { type: 'service_8', label: 'General Service', basePrice: 100, estimatedHours: 1 },
      { type: 'emergency', label: 'Emergency', basePrice: 250, estimatedHours: 2 },
    ],
    defaultHourlyRate: 75,
    defaultMinimumCharge: 100,
  },
};
