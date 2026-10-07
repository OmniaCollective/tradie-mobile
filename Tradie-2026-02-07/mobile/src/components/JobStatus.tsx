/**
 * Job status as words plus a line icon (brand system v4).
 * Grey for normal states; Paid in the link colour; Emergency in alert red.
 */
import React from 'react';
import { View, Text } from 'react-native';
import {
  Inbox,
  FileText,
  FileCheck,
  Calendar,
  Timer,
  Check,
  Send,
  CircleCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import type { Job, JobStatus as Status } from '@/lib/store';
import { useTheme } from '@/lib/theme';

const STATUS: Record<Status, { label: string; icon: LucideIcon }> = {
  REQUESTED: { label: 'Requested', icon: Inbox },
  QUOTED: { label: 'Quoted', icon: FileText },
  APPROVED: { label: 'Approved', icon: FileCheck },
  SCHEDULED: { label: 'Scheduled', icon: Calendar },
  IN_PROGRESS: { label: 'In progress', icon: Timer },
  COMPLETED: { label: 'Done', icon: Check },
  INVOICED: { label: 'Invoiced', icon: Send },
  PAID: { label: 'Paid', icon: CircleCheck },
};

/**
 * What happens next for this job, in plain words, so every status tells the
 * tradie their next step ("waiting for Sarah to say yes", "pick a time to book it").
 */
export function nextStep(
  job: Pick<Job, 'status' | 'quoteSentAt' | 'offeredSlots' | 'scheduledDate'>,
  customerName: string,
  opts: { overdueDays?: number } = {},
): string {
  const first = customerName.trim().split(/\s+/)[0] || 'the customer';
  switch (job.status) {
    case 'REQUESTED':
      return 'Send the quote';
    case 'QUOTED':
      return `Waiting for ${first} to say yes`;
    case 'APPROVED':
      return job.offeredSlots?.length ? `Times offered · waiting for ${first} to pick one` : 'Pick a time to book it';
    case 'SCHEDULED':
      return 'Booked · start the job on the day';
    case 'IN_PROGRESS':
      return 'Mark it done when you finish';
    case 'COMPLETED':
      return 'Create the invoice';
    case 'INVOICED':
      return opts.overdueDays ? `Payment ${opts.overdueDays} ${opts.overdueDays === 1 ? 'day' : 'days'} late · chase it` : `Waiting for ${first} to pay`;
    case 'PAID':
      return 'All done';
  }
}

/** Status line for a job. An open emergency shows "Emergency" instead, in red. */
export function JobStatus({ job, size = 'sm' }: { job: Pick<Job, 'status' | 'urgency'>; size?: 'sm' | 'md' }) {
  const t = useTheme();
  const done = job.status === 'COMPLETED' || job.status === 'INVOICED' || job.status === 'PAID';
  const emergency = job.urgency === 'emergency' && !done;
  const { label, icon: Icon } = emergency ? { label: 'Emergency', icon: TriangleAlert } : STATUS[job.status];
  const color = emergency ? t.alert : job.status === 'PAID' ? t.link : t.secondary;
  const iconSize = size === 'md' ? 16 : 14;

  return (
    <View className="flex-row items-center">
      <Icon size={iconSize} color={color} strokeWidth={2} />
      <Text style={{ color }} className={size === 'md' ? 'text-sm font-semibold ml-1.5' : 'text-[13px] font-medium ml-1'}>
        {label}
      </Text>
    </View>
  );
}
