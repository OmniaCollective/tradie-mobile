
import React from 'react';
import { 
  Home, 
  Briefcase, 
  FileText, 
  Settings, 
  Zap, 
  ShieldCheck, 
  Clock, 
  MapPin,
  Calendar
} from 'lucide-react';

export const COLORS = {
  primary: '#000000',
  accent: '#40E0D0',
  background: '#0A0A0A',
  surface: '#1A1A1A',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444'
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'invoices', label: 'Billing', icon: FileText },
  { id: 'settings', label: 'Profile', icon: Settings }
];

export const JOB_TYPES = [
  'Tap Repair',
  'Toilet Unblock',
  'Boiler Service',
  'Pipe Leak',
  'Radiator Install',
  'Emergency Callout',
  'Full Bathroom Fit'
];

export const MOCK_PLUMBER: any = {
  id: 'plumb-001',
  businessName: 'SwiftFlow Plumbing',
  phone: '+44 7700 900000',
  hourlyRate: 85,
  emergencyCallOutRate: 150,
  minimumCallout: 120,
  emergencyMultiplier: 1.5,
  isVatRegistered: true,
  basePostcode: 'W1A 1AA',
  maxTravelRadiusMiles: 15,
  workingHours: '08:00 - 18:00',
  paymentTermsDays: 7
};
