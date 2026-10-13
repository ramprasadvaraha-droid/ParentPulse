import { describe, expect, it } from 'vitest';

import { calculatePaymentStatus } from '@/lib/payment-status';

describe('institution payment status', () => {
  it('marks a candidate paid when net payments cover the fee', () => {
    expect(calculatePaymentStatus(4200, [
      { amount: 3000, isReversal: false },
      { amount: 1200, isReversal: false },
    ])).toEqual({ amountPaid: 4200, balance: 0, status: 'PAID' });
  });

  it('keeps unpaid and partially paid candidates pending', () => {
    expect(calculatePaymentStatus(4200, [{ amount: 1000, isReversal: false }])).toEqual({
      amountPaid: 1000,
      balance: 3200,
      status: 'PENDING',
    });
  });

  it('subtracts reversals before deciding payment status', () => {
    expect(calculatePaymentStatus(4200, [
      { amount: 4200, isReversal: false },
      { amount: 500, isReversal: true },
    ])).toEqual({ amountPaid: 3700, balance: 500, status: 'PENDING' });
  });
});