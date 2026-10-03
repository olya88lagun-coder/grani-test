export const DEFAULTS = Object.freeze({
  price: 599, feePct: 3.5, vatOnFeePct: 22, taxReservePct: 6,
  refundReservePct: 3, infrastructure: 20, support: 30, bookCost: 20,
  bookEvery: 3, cac: 900, churnPct: 20, fixed: 40000, horizon: 12
});
export function calculate(raw = {}) {
  const p = { ...DEFAULTS, ...raw };
  for (const [key, value] of Object.entries(p)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('INVALID_' + key);
  }
  for (const key of ['feePct', 'vatOnFeePct', 'taxReservePct', 'refundReservePct', 'churnPct'])
    if (p[key] > 100) throw new Error('INVALID_' + key);
  if (p.bookEvery <= 0 || !Number.isInteger(p.horizon) || p.horizon < 1 || p.horizon > 12)
    throw new Error('INVALID_HORIZON_OR_BOOK_FREQUENCY');
  const processing = p.price * p.feePct / 100 * (1 + p.vatOnFeePct / 100);
  const taxReserve = p.price * p.taxReservePct / 100;
  const refundReserve = p.price * p.refundReservePct / 100;
  const bookReserve = p.bookCost / p.bookEvery;
  const contribution = p.price - processing - taxReserve - refundReserve -
    p.infrastructure - p.support - bookReserve;
  let expectedPaidPeriods = 0, survival = 1, cumulativeMargin = 0;
  let paybackPeriod = p.cac === 0 ? 0 : null;
  const cohort = [];
  for (let period = 1; period <= p.horizon; period++) {
    expectedPaidPeriods += survival;
    cumulativeMargin += survival * contribution;
    cohort.push({ period, survival, cumulativeMargin, netAfterAcquisition: cumulativeMargin - p.cac });
    if (paybackPeriod === null && contribution > 0 && cumulativeMargin >= p.cac) paybackPeriod = period;
    survival *= 1 - p.churnPct / 100;
  }
  const marginLTV = contribution * expectedPaidPeriods;
  const contributionAfterReplacement = contribution - p.cac / expectedPaidPeriods;
  return {
    inputs: p, processing, taxReserve, refundReserve, bookReserve, contribution,
    expectedPaidPeriods, marginLTV, netCohort: marginLTV - p.cac,
    ltvToCac: p.cac > 0 ? marginLTV / p.cac : null, paybackPeriod,
    contributionAfterReplacement,
    breakEvenActivePairs: contributionAfterReplacement > 0 ? Math.ceil(p.fixed / contributionAfterReplacement) : null,
    cohort
  };
}
