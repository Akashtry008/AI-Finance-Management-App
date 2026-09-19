import { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, TrendingUp, Sparkles,
  ChevronRight, X, Award, HelpCircle, CheckCircle2, Zap,
  Download, Copy, Check, MessageCircle
} from 'lucide-react';
import { calculateFinancialHealthIndex } from '../utils/financialHealth';
import { buildWhatsAppShareUrl, downloadBlob } from '../utils';
import { useTranslation } from '../i18n';
import './FinancialHealthCard.css';

export default function FinancialHealthCard({
  report,
  budgets = [],
  goals = [],
  recurringBills = [],
  pendingGroupDebt = 0
}) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const healthData = calculateFinancialHealthIndex({
    report,
    budgets,
    goals,
    recurringBills,
    pendingGroupDebt
  });

  const { score, tier, tierLabel, tierColor, tierBadgeClass, pillars, boosters } = healthData;

  // Arc Gauge Geometry (Semi-Circle from angle 180 to 0)
  const radius = 80;
  const strokeWidth = 14;
  const circumference = Math.PI * radius; // Half-circle circumference
  const progressRatio = Math.min(1, Math.max(0, score / 1000));
  const strokeDashoffset = circumference - (circumference * progressRatio);

  const handleDownloadScorecard = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // Deep obsidian background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#090b14');
    bgGrad.addColorStop(0.5, '#121424');
    bgGrad.addColorStop(1, '#07080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Glowing aura matching tier
    const aura = ctx.createRadialGradient(540, 410, 60, 540, 410, 480);
    aura.addColorStop(0, tierColor + '40');
    aura.addColorStop(0.8, tierColor + '00');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, 1080, 1080);

    // Inner card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    if (ctx.roundRect) ctx.roundRect(60, 60, 960, 960, 36);
    else ctx.rect(60, 60, 960, 960);
    ctx.stroke();

    // App Branding Header
    ctx.textAlign = 'left';
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('FINANCEOS', 110, 140);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 24px sans-serif';
    ctx.fillText('FINANCIAL HEALTH INDEX', 110, 180);

    // Center Score Numeral
    ctx.textAlign = 'center';
    ctx.fillStyle = tierColor;
    ctx.font = 'bold 160px sans-serif';
    ctx.fillText(String(score), 540, 415);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 26px sans-serif';
    ctx.fillText('OUT OF 1,000 POINTS', 540, 475);

    // Tier badge box
    ctx.fillStyle = tierColor + '22';
    ctx.strokeStyle = tierColor + '88';
    ctx.lineWidth = 2;
    if (ctx.roundRect) ctx.roundRect(360, 515, 360, 60, 30);
    else ctx.rect(360, 515, 360, 60);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tierColor;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(tierLabel.toUpperCase(), 540, 555);

    // 4 Pillars Grid
    ctx.textAlign = 'left';
    const gridY = 635;
    const boxW = 410;
    const boxH = 110;

    pillars.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = 110 + col * (boxW + 40);
      const by = gridY + row * (boxH + 25);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 18);
      else ctx.rect(bx, by, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(p.name, bx + 24, by + 45);

      ctx.fillStyle = p.percentage >= 70 ? '#10b981' : '#f59e0b';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${p.score}/${p.maxScore} pts`, bx + 24, by + 85);
    });

    // Watermark footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '500 20px sans-serif';
    ctx.fillText('100% Privacy Preserved • Confidential Balances Masked • Generated with FinanceOS', 540, 970);

    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `FinanceOS_Scorecard_${score}.png`);
    }, 'image/png');
  };

  const scorecardSummaryText = `🏆 My Financial Health Score on FinanceOS is ${score}/1,000 (${tierLabel})!\n\n🛡️ Budget Adherence: ${pillars[0]?.score}/300 pts\n⏳ Emergency Runway: ${pillars[1]?.score}/250 pts\n⚖️ 50/30/20 Balance: ${pillars[2]?.score}/250 pts\n⚡ Debt Velocity: ${pillars[3]?.score}/200 pts\n\nTrack your financial discipline with #FinanceOS`;

  const handleCopyScorecard = () => {
    navigator.clipboard.writeText(scorecardSummaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <>
      <div className="financial-health-card glass-panel">
        <div className="fhi-header">
          <div className="fhi-title-wrap">
            <div className="fhi-icon-badge" style={{ borderColor: `${tierColor}55`, background: `${tierColor}18` }}>
              <Award size={20} color={tierColor} />
            </div>
            <div>
              <div className="fhi-main-title">
                <h3>{t('financialHealth', 'Financial Health Index')}</h3>
                <span className="fhi-tag">0–1000 Score</span>
              </div>
              <p className="text-muted">{t('fhiSubtitle', 'Credit-score style virtual financial discipline index')}</p>
            </div>
          </div>

          <div className="fhi-header-actions">
            <button
              type="button"
              className="btn btn-secondary fhi-share-btn"
              onClick={() => setShowScorecardModal(true)}
              title="Share privacy-safe financial health scorecard"
            >
              <Sparkles size={14} color="#f59e0b" />
              <span>{t('shareScorecard', 'Share Card')}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary fhi-deepdive-btn"
              onClick={() => setShowModal(true)}
              title="Inspect comprehensive score factors"
            >
              <span>{t('viewDeepDive', 'Breakdown')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="fhi-content-grid">
          {/* Gauge Meter Column */}
          <div className="fhi-meter-col">
            <div className="fhi-gauge-container">
              <svg className="fhi-gauge-svg" viewBox="0 0 200 120" width="200" height="120">
                <defs>
                  <linearGradient id="fhiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="35%" stopColor="#f59e0b" />
                    <stop offset="70%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="fhiGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={tierColor} floodOpacity="0.4" />
                  </filter>
                </defs>

                {/* Background Arc Track */}
                <path
                  d="M 20 105 A 80 80 0 0 1 180 105"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />

                {/* Animated Score Arc */}
                <path
                  d="M 20 105 A 80 80 0 0 1 180 105"
                  fill="none"
                  stroke="url(#fhiGradient)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="fhi-gauge-fill"
                  filter="url(#fhiGlow)"
                />
              </svg>

              <div className="fhi-meter-center">
                <span className="fhi-score-number" style={{ color: tierColor }}>
                  {score}
                </span>
                <span className="fhi-score-sub">{t('scoreOutOf', 'out of 1,000')}</span>
                <div className={`fhi-tier-badge ${tierBadgeClass}`}>
                  {tier === 'elite' && <ShieldCheck size={12} />}
                  {tier === 'prime' && <TrendingUp size={12} />}
                  {tier === 'moderate' && <Sparkles size={12} />}
                  {tier === 'vulnerable' && <AlertTriangle size={12} />}
                  <span>{tierLabel}</span>
                </div>
              </div>
            </div>

            <div className="fhi-scale-ticks">
              <span>0</span>
              <span className="tick-mid">580</span>
              <span className="tick-high">720</span>
              <span>1,000</span>
            </div>
          </div>

          {/* 4 Pillars Breakdown Column */}
          <div className="fhi-pillars-col">
            <div className="fhi-pillars-header">
              <span className="text-muted">{t('healthPillars', '4 Score Pillars')}</span>
              <span className="fhi-total-pill">{score}/1000 pts</span>
            </div>

            <div className="fhi-pillars-list">
              {pillars.map(pillar => (
                <div key={pillar.id} className="fhi-pillar-item">
                  <div className="fhi-pillar-info">
                    <span className="fhi-pillar-name">{pillar.name}</span>
                    <span className="fhi-pillar-pts">
                      <strong>{pillar.score}</strong> / {pillar.maxScore} pts
                    </span>
                  </div>

                  <div className="fhi-pillar-bar-track">
                    <div
                      className="fhi-pillar-bar-fill"
                      style={{
                        width: `${pillar.percentage}%`,
                        background: pillar.percentage >= 80 ? '#10b981' : pillar.percentage >= 60 ? '#6366f1' : pillar.percentage >= 40 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>

                  <div className="fhi-pillar-sub text-muted">
                    {pillar.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actionable Boosters Banner */}
        {boosters.length > 0 && (
          <div className="fhi-boosters-row">
            <div className="fhi-boosters-badge">
              <Zap size={14} />
              <span>{t('scoreBoosters', 'Actionable Boosters')}</span>
            </div>
            <div className="fhi-boosters-chips">
              {boosters.map(b => (
                <div key={b.id} className="fhi-booster-chip">
                  <span className="booster-pts">{b.points}</span>
                  <span className="booster-text">{b.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deep-Dive Modal */}
      {showModal && (
        <div className="modal-overlay fhi-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card glass-panel fhi-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="fhi-icon-badge" style={{ borderColor: `${tierColor}55`, background: `${tierColor}18` }}>
                  <Award size={20} color={tierColor} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Financial Health Index Deep-Dive</h3>
                  <p className="text-muted" style={{ margin: '0.15rem 0 0', fontSize: '0.78rem' }}>
                    0–1000 Weighted Financial Discipline Engine
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="fhi-modal-body">
              <div className="fhi-modal-summary-banner" style={{ borderColor: `${tierColor}55` }}>
                <div className="modal-score-badge" style={{ color: tierColor }}>
                  {score}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.2rem' }}>Tier: {tierLabel}</h4>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                    Your discipline rating is determined dynamically from your live ledger, active category limits, savings cushion, and debt clearance habits.
                  </p>
                </div>
              </div>

              <div className="fhi-modal-section">
                <h4>Pillar Score Matrix</h4>
                <div className="fhi-modal-pillars-grid">
                  {pillars.map(p => (
                    <div key={p.id} className="fhi-modal-pillar-box glass-panel">
                      <div className="box-top">
                        <span className="box-title">{p.name}</span>
                        <span className="box-score">{p.score}/{p.maxScore}</span>
                      </div>
                      <div className="fhi-pillar-bar-track">
                        <div
                          className="fhi-pillar-bar-fill"
                          style={{
                            width: `${p.percentage}%`,
                            background: p.percentage >= 80 ? '#10b981' : p.percentage >= 60 ? '#6366f1' : '#f59e0b'
                          }}
                        />
                      </div>
                      <p className="box-desc text-muted">{p.subtitle}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fhi-modal-section">
                <h4>Actionable High-Impact Steps to Reach 850+ Elite</h4>
                <div className="fhi-modal-boosters-list">
                  {boosters.map(b => (
                    <div key={b.id} className="fhi-modal-booster-item">
                      <div className="booster-header">
                        <CheckCircle2 size={16} color="#10b981" />
                        <strong>{b.title}</strong>
                        <span className="booster-points-badge">{b.points}</span>
                      </div>
                      <p className="text-muted" style={{ margin: '0.25rem 0 0 1.5rem', fontSize: '0.82rem' }}>
                        {b.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fhi-modal-footer-note text-muted">
                <HelpCircle size={14} />
                <span>
                  The Financial Health Index operates completely client-side in FinanceOS with zero third-party credit bureau reporting.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Financial Scorecard Modal */}
      {showScorecardModal && (
        <div className="modal-overlay fhi-modal-overlay animate-fade-in" onClick={() => setShowScorecardModal(false)}>
          <div className="modal-card glass-panel fhi-scorecard-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="fhi-icon-badge" style={{ borderColor: `${tierColor}55`, background: `${tierColor}18` }}>
                  <Sparkles size={20} color={tierColor} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Social Financial Scorecard</h3>
                  <p className="text-muted" style={{ margin: '0.15rem 0 0', fontSize: '0.78rem' }}>
                    100% Privacy-Safe • Balances Hidden
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary modal-close"
                onClick={() => setShowScorecardModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="fhi-scorecard-modal-body">
              {/* Preview Card */}
              <div className="social-scorecard-preview" style={{ borderColor: `${tierColor}44` }}>
                <div className="scorecard-top-bar">
                  <span className="scorecard-brand">FINANCEOS</span>
                  <span className="scorecard-badge" style={{ color: tierColor, borderColor: `${tierColor}55` }}>
                    {tierLabel}
                  </span>
                </div>

                <div className="scorecard-center">
                  <div className="scorecard-numeral" style={{ color: tierColor }}>
                    {score}
                  </div>
                  <span className="scorecard-points-label">out of 1,000 Points</span>
                </div>

                <div className="scorecard-pillars-grid">
                  {pillars.map(p => (
                    <div key={p.id} className="scorecard-pillar-tile">
                      <span className="pillar-tile-name">{p.name}</span>
                      <span className="pillar-tile-score" style={{ color: p.percentage >= 70 ? '#10b981' : '#f59e0b' }}>
                        {p.score}/{p.maxScore}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="scorecard-footer-privacy text-muted">
                  🔒 Zero Private Dollar Balances Revealed • Certified by FinanceOS
                </div>
              </div>

              {/* Action Buttons */}
              <div className="scorecard-actions-row">
                <button
                  type="button"
                  className="btn btn-primary scorecard-action-btn"
                  onClick={handleDownloadScorecard}
                  title="Download High-Resolution 1080x1080 PNG"
                >
                  <Download size={15} />
                  <span>Download Image</span>
                </button>

                <a
                  href={buildWhatsAppShareUrl(scorecardSummaryText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-whatsapp scorecard-action-btn"
                  title="Share Scorecard on WhatsApp"
                >
                  <MessageCircle size={15} />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  className="btn btn-secondary scorecard-action-btn"
                  onClick={handleCopyScorecard}
                  title="Copy Scorecard Summary to Clipboard"
                >
                  {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                  <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
