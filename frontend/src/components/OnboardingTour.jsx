import React, { useState, useEffect } from 'react';
import { Target, PiggyBank, ArrowLeftRight, X } from 'lucide-react';

export default function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('finance-os-tour-done');
    if (!hasSeenTour) {
      // Delay opening slightly so the dashboard has time to render
      setTimeout(() => setIsOpen(true), 1000);
    }
  }, []);

  const closeTour = () => {
    setIsOpen(false);
    localStorage.setItem('finance-os-tour-done', 'true');
  };

  const nextStep = () => {
    if (step === 3) {
      closeTour();
    } else {
      setStep(step + 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-card glass-panel animate-fade-in" style={{ maxWidth: '500px', textAlign: 'center' }}>
        <button className="btn btn-secondary modal-close" style={{ position: 'absolute', top: '1rem', right: '1rem' }} onClick={closeTour}>
          <X size={16} />
        </button>

        {step === 1 && (
          <div style={{ padding: '2rem 1rem' }}>
            <PiggyBank size={64} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
            <h2>Welcome to FinanceOS!</h2>
            <p className="text-muted" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
              Your journey to better financial health starts here. Let's take a quick look around.
              First, set up your monthly <strong>Budgets</strong> so you don't overspend.
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: '2rem 1rem' }}>
            <ArrowLeftRight size={64} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
            <h2>Track Everything</h2>
            <p className="text-muted" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
              Head over to <strong>Transactions</strong> to log your daily income and expenses.
              We'll automatically compare them against your budgets and notify you if you're close to the limit!
            </p>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: '2rem 1rem' }}>
            <Target size={64} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
            <h2>Achieve Your Goals</h2>
            <p className="text-muted" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
              Got big plans? Use the <strong>Savings Goals</strong> tab to set a target for a vacation, new car, or emergency fund, and track your progress visually.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: step === 1 ? 'var(--text-color)' : 'var(--text-muted)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: step === 2 ? 'var(--text-color)' : 'var(--text-muted)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: step === 3 ? 'var(--text-color)' : 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={closeTour}>Skip</button>
            <button className="btn btn-primary" onClick={nextStep}>
              {step === 3 ? "Let's Go!" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
