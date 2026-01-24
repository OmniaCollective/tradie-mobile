
import { Job, PlumberProfile, Quote, Urgency, JobStatus } from '../types';

export function calculateQuote(
  baseHours: number,
  materialsCost: number,
  urgency: Urgency,
  plumber: PlumberProfile,
  distance: number = 5
): Quote {
  const labourCost = baseHours * plumber.hourlyRate;
  const travelCost = distance * 1.5; // £1.50 per mile
  
  let emergencySurcharge = 0;
  if (urgency === Urgency.EMERGENCY) {
    emergencySurcharge = (labourCost + travelCost) * (plumber.emergencyMultiplier - 1);
  } else if (urgency === Urgency.URGENT) {
    emergencySurcharge = (labourCost + travelCost) * 0.2; // 20% flat surge
  }

  const subtotal = Math.max(
    labourCost + materialsCost + travelCost + emergencySurcharge,
    plumber.minimumCallout
  );

  const vatAmount = plumber.isVatRegistered ? subtotal * 0.20 : 0;
  const total = subtotal + vatAmount;

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 2);

  return {
    id: `q-${Math.random().toString(36).substr(2, 9)}`,
    labourHours: baseHours,
    labourRate: plumber.hourlyRate,
    materialsEstimate: materialsCost,
    travelCost,
    emergencySurcharge,
    subtotal,
    vatAmount,
    total: Math.round(total * 100) / 100,
    validUntil: validUntil.toISOString()
  };
}
