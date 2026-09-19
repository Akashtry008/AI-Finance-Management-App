// Recurring Bills & Subscription Radar Data Store with Backend Sync
import api from './api';

const STORAGE_KEY = 'finance-os-recurring-bills';

const DEFAULT_BILLS = [
  { id: 'rb-1', name: 'Streaming & Media Bundle', amount: 649, day: 5, category: 'Entertainment', cycle: 'Monthly', lastPaidMonth: '' },
  { id: 'rb-2', name: 'High-Speed Fiber Internet', amount: 999, day: 10, category: 'Utilities', cycle: 'Monthly', lastPaidMonth: '' },
  { id: 'rb-3', name: 'Housing Rent / Maintenance', amount: 12500, day: 1, category: 'Housing', cycle: 'Monthly', lastPaidMonth: '' },
  { id: 'rb-4', name: 'Cloud Storage & Workspace', amount: 890, day: 18, category: 'Software', cycle: 'Monthly', lastPaidMonth: '' },
  { id: 'rb-5', name: 'Gym & Fitness Membership', amount: 1500, day: 25, category: 'Health', cycle: 'Monthly', lastPaidMonth: '' },
];

export function getRecurringBills() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BILLS));
      return DEFAULT_BILLS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BILLS;
  } catch (err) {
    console.error('Failed to load recurring bills:', err);
    return DEFAULT_BILLS;
  }
}

export async function syncRecurringBillsWithBackend() {
  try {
    const res = await api.get('/recurring-bills');
    if (Array.isArray(res.data) && res.data.length > 0) {
      saveRecurringBills(res.data);
      return res.data;
    } else {
      // If server is empty, initialize server with local/default bills
      const localBills = getRecurringBills();
      for (const bill of localBills) {
        api.post('/recurring-bills', bill).catch(() => {});
      }
    }
  } catch (err) {
    console.log('Using cached local recurring bills:', err);
  }
  return getRecurringBills();
}

export function saveRecurringBills(bills) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    window.dispatchEvent(new CustomEvent('recurringBillsUpdated', { detail: bills }));
  } catch (err) {
    console.error('Failed to save recurring bills:', err);
  }
}

export function addRecurringBill(bill) {
  const bills = getRecurringBills();
  const newBill = {
    id: bill.id || `rb-${Date.now()}`,
    name: bill.name || 'New Subscription',
    amount: parseFloat(bill.amount) || 0,
    day: parseInt(bill.day) || 1,
    category: bill.category || 'Utilities',
    cycle: bill.cycle || 'Monthly',
    lastPaidMonth: ''
  };
  const updated = [newBill, ...bills];
  saveRecurringBills(updated);

  // Sync to cloud backend
  api.post('/recurring-bills', newBill).catch((err) => {
    console.log('Queued recurring bill creation locally:', err);
  });

  return updated;
}

export function deleteRecurringBill(id) {
  const bills = getRecurringBills();
  const updated = bills.filter(b => b.id !== id);
  saveRecurringBills(updated);

  // Sync to cloud backend
  api.delete(`/recurring-bills/${id}`).catch((err) => {
    console.log('Queued recurring bill deletion locally:', err);
  });

  return updated;
}

export function markBillAsPaid(billId, month, year) {
  const bills = getRecurringBills();
  const tag = `${year}-${month}`;
  const updated = bills.map(b => b.id === billId ? { ...b, lastPaidMonth: tag } : b);
  saveRecurringBills(updated);

  // Sync to cloud backend
  api.put(`/recurring-bills/${billId}/pay`, { month, year }).catch((err) => {
    console.log('Queued recurring bill payment locally:', err);
  });

  return updated;
}

export function getBillDueStatus(bill, month, year) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  const tag = `${year}-${month}`;

  if (bill.lastPaidMonth === tag) {
    return { status: 'paid', label: 'Paid', badgeClass: 'badge-paid', daysDiff: 0 };
  }

  if (!isCurrentMonth) {
    const isPast = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1);
    if (isPast) {
      return { status: 'overdue', label: 'Unpaid (Past)', badgeClass: 'badge-overdue', daysDiff: -1 };
    }
    return { status: 'upcoming', label: `Due on ${bill.day}th`, badgeClass: 'badge-upcoming', daysDiff: bill.day };
  }

  const currentDay = today.getDate();
  const diff = bill.day - currentDay;

  if (diff === 0) {
    return { status: 'today', label: 'Due Today!', badgeClass: 'badge-today', daysDiff: 0 };
  } else if (diff > 0) {
    return { status: 'upcoming', label: `Due in ${diff} day${diff > 1 ? 's' : ''}`, badgeClass: 'badge-upcoming', daysDiff: diff };
  } else {
    return { status: 'overdue', label: `Overdue by ${Math.abs(diff)}d`, badgeClass: 'badge-overdue', daysDiff: diff };
  }
}
