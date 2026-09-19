/**
 * Proprietary Financial Health Index (0–1000 Score) Calculation Engine
 * Inspired by credit rating models (FICO) and 50/30/20 wealth frameworks.
 */

export function calculateFinancialHealthIndex({
  report = { income: 0, expense: 0, savings: 0 },
  budgets = [],
  goals = [],
  recurringBills = [],
  pendingGroupDebt = 0
}) {
  const income = parseFloat(report?.income) || 0;
  const expense = parseFloat(report?.expense) || 0;
  const savings = parseFloat(report?.savings) || 0;

  // ─────────────────────────────────────────────────────────────
  // 1. BUDGET ADHERENCE (Max: 300 pts)
  // ─────────────────────────────────────────────────────────────
  let budgetScore = 220; // baseline if no budgets configured
  let budgetDetails = {
    totalBudgets: budgets.length,
    breachedCount: 0,
    safeCount: 0,
    adherenceRate: 100
  };

  if (budgets.length > 0) {
    let breached = 0;
    let totalLimit = 0;
    let totalSpent = 0;

    budgets.forEach(b => {
      const limit = parseFloat(b.limit_amount || b.amount || 0);
      const spent = parseFloat(b.spent || 0);
      totalLimit += limit;
      totalSpent += spent;
      if (limit > 0 && spent > limit) {
        breached += 1;
      }
    });

    const safe = budgets.length - breached;
    budgetDetails.breachedCount = breached;
    budgetDetails.safeCount = safe;
    budgetDetails.adherenceRate = Math.round((safe / budgets.length) * 100);

    if (breached === 0) {
      // Bonus if overall spending is <= 85% of total budget limit
      if (totalLimit > 0 && totalSpent <= totalLimit * 0.85) {
        budgetScore = 300;
      } else {
        budgetScore = 280;
      }
    } else {
      const breachRatio = breached / budgets.length;
      budgetScore = Math.max(50, Math.round(280 - (breachRatio * 200)));
    }
  } else if (income > 0) {
    // If no budgets configured, gauge monthly savings vs expense
    if (savings > 0) budgetScore = 240;
    else if (savings === 0) budgetScore = 180;
    else budgetScore = 100;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. EMERGENCY RUNWAY (Max: 250 pts)
  // ─────────────────────────────────────────────────────────────
  const totalGoalsSaved = goals.reduce((acc, g) => acc + (parseFloat(g.current_amount || 0)), 0);
  const liquidReserves = Math.max(0, totalGoalsSaved + (savings > 0 ? savings : 0));
  const monthlyBurn = expense > 0 ? expense : (income > 0 ? income * 0.7 : 1000);
  const runwayMonths = Math.round((liquidReserves / monthlyBurn) * 10) / 10;

  let runwayScore;
  if (runwayMonths >= 6.0) {
    runwayScore = 250;
  } else if (runwayMonths >= 4.0) {
    runwayScore = 215;
  } else if (runwayMonths >= 3.0) {
    runwayScore = 185;
  } else if (runwayMonths >= 2.0) {
    runwayScore = 140;
  } else if (runwayMonths >= 1.0) {
    runwayScore = 95;
  } else {
    runwayScore = Math.max(30, Math.round(runwayMonths * 70));
  }

  // ─────────────────────────────────────────────────────────────
  // 3. 50/30/20 GOLDEN BALANCE (Max: 250 pts)
  // ─────────────────────────────────────────────────────────────
  let goldenScore = 150;
  let savingsRate = 0;
  let expenseRate;

  if (income > 0) {
    savingsRate = Math.round((savings / income) * 100);
    expenseRate = Math.round((expense / income) * 100);

    // Savings score (up to 110 pts)
    let savingsSubScore;
    if (savingsRate >= 20) savingsSubScore = 110;
    else if (savingsRate >= 10) savingsSubScore = 80;
    else if (savingsRate > 0) savingsSubScore = 50;
    else savingsSubScore = 15;

    // Expense constraint score (up to 140 pts)
    let expenseSubScore;
    if (expenseRate <= 70) expenseSubScore = 140;
    else if (expenseRate <= 80) expenseSubScore = 110;
    else if (expenseRate <= 95) expenseSubScore = 75;
    else expenseSubScore = 30;

    goldenScore = savingsSubScore + expenseSubScore;
  } else if (expense > 0) {
    goldenScore = 120;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. DEBT & PAYMENT VELOCITY (Max: 200 pts)
  // ─────────────────────────────────────────────────────────────
  let debtScore = 180;
  let overdueBills = 0;

  recurringBills.forEach(b => {
    const status = b.statusInfo?.status || 'upcoming';
    if (status === 'overdue') overdueBills += 1;
  });

  if (overdueBills > 0) {
    debtScore -= Math.min(90, overdueBills * 45);
  }

  if (pendingGroupDebt > 0) {
    // Deduct points based on unsettled shared expenses
    debtScore -= Math.min(50, Math.round(pendingGroupDebt > 1000 ? 50 : pendingGroupDebt / 25));
  }

  if (overdueBills === 0 && pendingGroupDebt === 0) {
    debtScore = 200; // Perfect discipline
  }

  debtScore = Math.max(30, Math.min(200, debtScore));

  // ─────────────────────────────────────────────────────────────
  // TOTAL COMPOSITE SCORE (0 – 1000)
  // ─────────────────────────────────────────────────────────────
  const totalScore = Math.max(0, Math.min(1000, Math.round(budgetScore + runwayScore + goldenScore + debtScore)));

  // Tier classification
  let tier = 'vulnerable';
  let tierLabel = 'Needs Attention';
  let tierColor = '#ef4444'; // Red
  let tierBadgeClass = 'tier-vulnerable';

  if (totalScore >= 850) {
    tier = 'elite';
    tierLabel = 'Elite Discipline';
    tierColor = '#10b981'; // Emerald Green
    tierBadgeClass = 'tier-elite';
  } else if (totalScore >= 720) {
    tier = 'prime';
    tierLabel = 'Strong Stability';
    tierColor = '#6366f1'; // Indigo/Blue
    tierBadgeClass = 'tier-prime';
  } else if (totalScore >= 580) {
    tier = 'moderate';
    tierLabel = 'Moderate / Fair';
    tierColor = '#f59e0b'; // Amber
    tierBadgeClass = 'tier-moderate';
  }

  // Actionable smart boosters
  const boosters = [];
  if (budgetDetails.breachedCount > 0) {
    boosters.push({
      id: 'boost-budget',
      points: '+45 pts',
      title: 'Normalize Breached Budgets',
      description: `Resolve ${budgetDetails.breachedCount} category overrun(s) to secure maximum budget points.`
    });
  } else if (budgets.length === 0) {
    boosters.push({
      id: 'boost-create-budget',
      points: '+30 pts',
      title: 'Set Category Spending Targets',
      description: 'Create at least 2 category budgets to activate complete compliance tracking.'
    });
  }

  if (runwayMonths < 3.0) {
    const needed = Math.round((3.0 - runwayMonths) * monthlyBurn);
    boosters.push({
      id: 'boost-runway',
      points: `+${Math.min(65, Math.round((3.0 - runwayMonths) * 35))} pts`,
      title: 'Build 3-Month Emergency Cushion',
      description: `Increase liquid reserves by ~${needed > 0 ? needed.toLocaleString() : '500'} to reach safe 3.0 months runway.`
    });
  }

  if (savingsRate < 20 && income > 0) {
    boosters.push({
      id: 'boost-savings-rate',
      points: '+35 pts',
      title: 'Reach 20% Golden Savings Rate',
      description: `Current savings rate is ${savingsRate}%. Trimming 5-10% of flexible wants boosts your score into the Prime band.`
    });
  }

  if (overdueBills > 0) {
    boosters.push({
      id: 'boost-bills',
      points: `+${overdueBills * 45} pts`,
      title: 'Settle Overdue Recurring Bills',
      description: `Pay ${overdueBills} overdue bill(s) in the bills radar to eliminate payment friction penalties.`
    });
  }

  if (pendingGroupDebt > 0) {
    boosters.push({
      id: 'boost-split',
      points: '+30 pts',
      title: 'Clear Shared Group Expenses',
      description: 'Settle your pending split trip expenses to maintain a 100% clean debt clearance velocity.'
    });
  }

  if (boosters.length === 0) {
    boosters.push({
      id: 'boost-maintain',
      points: 'Top Tier',
      title: 'Maintain Stellar Financial Habits',
      description: 'You are performing in the top decile. Keep discretionary burn steady to stay Elite!'
    });
  }

  return {
    score: totalScore,
    tier,
    tierLabel,
    tierColor,
    tierBadgeClass,
    pillars: [
      {
        id: 'budget',
        name: 'Budget Adherence',
        score: budgetScore,
        maxScore: 300,
        percentage: Math.round((budgetScore / 300) * 100),
        subtitle: `${budgetDetails.safeCount} of ${budgets.length || '—'} budgets on track`
      },
      {
        id: 'runway',
        name: 'Emergency Runway',
        score: runwayScore,
        maxScore: 250,
        percentage: Math.round((runwayScore / 250) * 100),
        subtitle: `${runwayMonths} months buffer (${runwayMonths >= 3 ? 'Safe' : 'Building'})`
      },
      {
        id: 'golden',
        name: '50/30/20 Balance',
        score: goldenScore,
        maxScore: 250,
        percentage: Math.round((goldenScore / 250) * 100),
        subtitle: `${savingsRate > 0 ? savingsRate + '% saved' : 'Balanced spending'}`
      },
      {
        id: 'debt',
        name: 'Debt & Bill Velocity',
        score: debtScore,
        maxScore: 200,
        percentage: Math.round((debtScore / 200) * 100),
        subtitle: overdueBills > 0 ? `${overdueBills} bills need attention` : 'On-time settlements'
      }
    ],
    boosters: boosters.slice(0, 3),
    rawMetrics: {
      income,
      expense,
      savings,
      runwayMonths,
      savingsRate,
      overdueBills,
      pendingGroupDebt
    }
  };
}
