import type { Job, Customer, Invoice, Expense, Quote, TodoItem } from './store';

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Helper to get dates relative to today
const daysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const daysAgo = (days: number): string => daysFromNow(-days);

const dateOnly = (iso: string): string => iso.split('T')[0];

export function generateSampleData() {
  // --- Customers ---
  const customers: Customer[] = [
    {
      id: generateId(),
      name: 'John Smith',
      email: 'john.smith@gmail.com',
      phone: '07700 900123',
      address: '14 Oak Lane',
      postcode: 'SW1A 1AA',
    },
    {
      id: generateId(),
      name: 'Sarah Williams',
      email: 'sarah.w@hotmail.com',
      phone: '07700 900456',
      address: '28 Elm Street',
      postcode: 'E1 6AN',
    },
    {
      id: generateId(),
      name: 'Mike Johnson',
      email: 'mike.j@outlook.com',
      phone: '07700 900789',
      address: '5 River Close',
      postcode: 'N1 9GU',
    },
    {
      id: generateId(),
      name: 'Emma Davis',
      email: 'emma.davis@icloud.com',
      phone: '07700 900321',
      address: '91 Church Road',
      postcode: 'SE1 7TP',
    },
    {
      id: generateId(),
      name: 'Tom Baker',
      email: 'tom.baker@gmail.com',
      phone: '07700 900654',
      address: '7 Station Approach',
      postcode: 'W1D 3BT',
    },
  ];

  // --- Helper to build a quote ---
  const makeQuote = (jobId: string, labour: number, materials: number, travel: number, daysAgoCreated: number, validDays: number): Quote => {
    const createdAt = daysAgo(daysAgoCreated);
    const validUntil = new Date(createdAt);
    validUntil.setDate(validUntil.getDate() + validDays);
    const subtotal = labour + materials + travel;
    return {
      id: generateId(),
      jobId,
      labour,
      materials,
      travel,
      emergencySurcharge: 0,
      vat: 0, // VAT handled separately when VAT-registered
      total: subtotal,
      validUntil: validUntil.toISOString(),
      createdAt,
    };
  };

  // --- Jobs ---
  const jobIds = Array.from({ length: 8 }, () => generateId());

  // Job 0: PAID — completed 3 weeks ago (triggers profitability card + tax income)
  const job0: Job = {
    id: jobIds[0],
    customerId: customers[0].id,
    type: 'service_1',
    description: 'Blocked kitchen drain — cleared with rods and jet wash',
    urgency: 'standard',
    status: 'PAID',
    quote: makeQuote(jobIds[0], 280, 45, 25, 21, 14),
    scheduledDate: dateOnly(daysAgo(22)),
    scheduledTime: '09:00',
    completedAt: daysAgo(21),
    createdAt: daysAgo(24),
    notes: 'Used 6mm rod set. Grease build-up in trap.',
    parts: [
      { id: generateId(), name: 'Drain cleaner fluid', quantity: 2, unitCost: 4.50 },
      { id: generateId(), name: 'P-trap replacement', quantity: 1, unitCost: 8.00 },
    ],
  };

  // Job 1: INVOICED — completed 10 days ago (triggers profitability card)
  const job1: Job = {
    id: jobIds[1],
    customerId: customers[1].id,
    type: 'service_2',
    description: 'Leaking mixer tap in bathroom — replaced cartridge',
    urgency: 'standard',
    status: 'INVOICED',
    quote: makeQuote(jobIds[1], 65, 22, 5, 14, 14),
    scheduledDate: dateOnly(daysAgo(11)),
    scheduledTime: '14:00',
    completedAt: daysAgo(10),
    createdAt: daysAgo(16),
    notes: 'Quarter turn ceramic cartridge fitted.',
    parts: [
      { id: generateId(), name: 'Ceramic cartridge', quantity: 1, unitCost: 12.00 },
      { id: generateId(), name: 'O-ring set', quantity: 1, unitCost: 3.50 },
    ],
  };

  // Job 2: PAID — boiler service completed 2 weeks ago (more paid income for tax calc)
  const job2: Job = {
    id: jobIds[2],
    customerId: customers[2].id,
    type: 'service_5',
    description: 'Annual boiler service and safety check',
    urgency: 'standard',
    status: 'PAID',
    quote: makeQuote(jobIds[2], 120, 0, 15, 16, 14),
    scheduledDate: dateOnly(daysAgo(17)),
    scheduledTime: '10:00',
    completedAt: daysAgo(16),
    createdAt: daysAgo(20),
    notes: 'Boiler running efficiently. Recommended powerflush next year.',
  };

  // Job 3: SCHEDULED — in 2 days (shows in "Next 7 Days")
  const job3: Job = {
    id: jobIds[3],
    customerId: customers[3].id,
    type: 'service_4',
    description: 'Toilet continuously running — likely fill valve issue',
    urgency: 'standard',
    status: 'SCHEDULED',
    quote: makeQuote(jobIds[3], 85, 25, 8, 5, 30),
    scheduledDate: dateOnly(daysFromNow(2)),
    scheduledTime: '11:00',
    createdAt: daysAgo(5),
    notes: '',
  };

  // Job 4: SCHEDULED — in 5 days (shows in "Next 7 Days")
  const job4: Job = {
    id: jobIds[4],
    customerId: customers[4].id,
    type: 'service_6',
    description: 'Radiator not heating up in master bedroom',
    urgency: 'standard',
    status: 'SCHEDULED',
    quote: makeQuote(jobIds[4], 80, 0, 12, 3, 30),
    scheduledDate: dateOnly(daysFromNow(5)),
    scheduledTime: '09:30',
    createdAt: daysAgo(3),
    notes: 'Likely airlock or stuck valve.',
  };

  // Job 5: QUOTED — expired quote (triggers "Expired" badge on dashboard)
  const job5: Job = {
    id: jobIds[5],
    customerId: customers[0].id,
    type: 'service_3',
    description: 'Burst pipe under floorboards in hallway',
    urgency: 'urgent',
    status: 'QUOTED',
    quote: makeQuote(jobIds[5], 180, 45, 15, 20, 7), // Created 20 days ago, valid 7 days = expired
    createdAt: daysAgo(20),
    notes: 'Customer said they might get another quote.',
  };

  // Job 6: QUOTED — valid quote (active pending quote)
  const job6: Job = {
    id: jobIds[6],
    customerId: customers[2].id,
    type: 'service_7',
    description: 'Water heater replacement — old unit leaking from base',
    urgency: 'standard',
    status: 'QUOTED',
    quote: makeQuote(jobIds[6], 200, 350, 10, 3, 30), // Valid for 30 days
    createdAt: daysAgo(3),
    notes: 'Quoted for Megaflo unvented cylinder.',
  };

  // Job 7: IN_PROGRESS — started today
  const job7: Job = {
    id: jobIds[7],
    customerId: customers[4].id,
    type: 'emergency',
    description: 'Emergency call-out — water pouring through ceiling',
    urgency: 'emergency',
    status: 'IN_PROGRESS',
    quote: (() => {
      const q = makeQuote(jobIds[7], 200, 30, 20, 0, 14);
      q.emergencySurcharge = 100;
      q.total = q.labour + q.materials + q.travel + q.emergencySurcharge;
      return q;
    })(),
    scheduledDate: dateOnly(daysFromNow(0)),
    scheduledTime: '07:30',
    createdAt: daysAgo(0),
    notes: 'Isolate mains first. Likely burst joint in loft.',
  };

  const jobs: Job[] = [job0, job1, job2, job3, job4, job5, job6, job7];

  // --- Invoices ---
  // Invoice for job0 (PAID)
  const invoice0: Invoice = {
    id: generateId(),
    jobId: job0.id,
    customerId: customers[0].id,
    quote: job0.quote!,
    status: 'paid',
    sentAt: daysAgo(20),
    paidAt: daysAgo(18),
    createdAt: daysAgo(21),
  };

  // Invoice for job1 (INVOICED — sent but not paid)
  const invoice1: Invoice = {
    id: generateId(),
    jobId: job1.id,
    customerId: customers[1].id,
    quote: job1.quote!,
    status: 'sent',
    sentAt: daysAgo(9),
    createdAt: daysAgo(10),
  };

  // Invoice for job2 (PAID — boiler service)
  const invoice2: Invoice = {
    id: generateId(),
    jobId: job2.id,
    customerId: customers[2].id,
    quote: job2.quote!,
    status: 'paid',
    sentAt: daysAgo(15),
    paidAt: daysAgo(13),
    createdAt: daysAgo(16),
  };

  const invoices: Invoice[] = [invoice0, invoice1, invoice2];

  // --- Expenses ---
  const expenses: Expense[] = [
    {
      id: generateId(),
      amount: 45.00,
      description: 'Pipe cutter and fittings kit',
      category: 'tools_equipment',
      date: dateOnly(daysAgo(15)),
      vatAmount: 7.50,
      createdAt: daysAgo(15),
    },
    {
      id: generateId(),
      amount: 28.50,
      description: 'Copper pipe 15mm x 3m (x4)',
      category: 'materials',
      date: dateOnly(daysAgo(12)),
      vatAmount: 4.75,
      jobId: job0.id, // Linked to Job 0
      createdAt: daysAgo(12),
    },
    {
      id: generateId(),
      amount: 62.00,
      description: 'Diesel — week commencing 10 March',
      category: 'vehicle_mileage',
      date: dateOnly(daysAgo(14)),
      miles: 180,
      createdAt: daysAgo(14),
    },
    {
      id: generateId(),
      amount: 35.00,
      description: 'Phone bill — March (60% business use)',
      category: 'phone_internet',
      date: dateOnly(daysAgo(7)),
      businessUsePercent: 60,
      createdAt: daysAgo(7),
    },
    {
      id: generateId(),
      amount: 18.00,
      description: 'Safety goggles and gloves',
      category: 'workwear_ppe',
      date: dateOnly(daysAgo(10)),
      vatAmount: 3.00,
      createdAt: daysAgo(10),
    },
  ];

  // --- Todos ---
  const todos: TodoItem[] = [
    {
      id: generateId(),
      text: 'Order Megaflo cylinder for Tom Baker job',
      isVoiceNote: false,
      completed: false,
      createdAt: daysAgo(2),
    },
    {
      id: generateId(),
      text: 'Chase Sarah Williams — invoice overdue',
      isVoiceNote: false,
      completed: false,
      createdAt: daysAgo(5),
    },
    {
      id: generateId(),
      text: 'Gas Safe certificate renewal — due April',
      isVoiceNote: false,
      completed: false,
      createdAt: daysAgo(10),
    },
  ];

  return {
    customers,
    jobs,
    invoices,
    expenses,
    todos,
    taxSetAsideTotal: 150, // User has already set aside £150 this tax year
  };
}
