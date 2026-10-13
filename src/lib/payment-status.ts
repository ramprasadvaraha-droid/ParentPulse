export type PaymentRecordStatus = 'PAID' | 'PENDING';

export function calculatePaymentStatus(
  amountDue: number,
  entries: Array<{ amount: number; isReversal: boolean }>,
) {
  const amountPaid = Number(Math.max(0, entries.reduce(
    (total, entry) => total + (entry.isReversal ? -entry.amount : entry.amount),
    0,
  )).toFixed(2));
  const balance = Number(Math.max(0, amountDue - amountPaid).toFixed(2));

  return {
    amountPaid,
    balance,
    status: balance <= 0 ? 'PAID' as const : 'PENDING' as const,
  };
}