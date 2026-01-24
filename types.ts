
export enum JobStatus {
  REQUESTED = 'requested',
  QUOTED = 'quoted',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  INVOICED = 'invoiced',
  PAID = 'paid'
}

export enum Urgency {
  STANDARD = 'standard',
  URGENT = 'urgent',
  EMERGENCY = 'emergency'
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
}

export interface Quote {
  id: string;
  labourHours: number;
  labourRate: number;
  materialsEstimate: number;
  travelCost: number;
  emergencySurcharge: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  validUntil: string;
}

export interface Job {
  id: string;
  customer: Customer;
  type: string;
  description: string;
  urgency: Urgency;
  status: JobStatus;
  quote?: Quote;
  scheduledDate?: string;
  createdAt: string;
  distance: number;
}

export interface PlumberProfile {
  id: string;
  businessName: string;
  phone: string;
  hourlyRate: number;
  minimumCallout: number;
  emergencyMultiplier: number;
  isVatRegistered: boolean;
  basePostcode: string;
}
