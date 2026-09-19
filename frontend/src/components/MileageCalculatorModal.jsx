import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Car, Bike, Navigation, Check, X, Calculator, Plus } from 'lucide-react';
import api from '../api';
import { formatCurrency, getCurrencySymbol, formatErrorMessage } from '../utils';
import './MileageCalculatorModal.css';

export default function MileageCalculatorModal({ isOpen, onClose, categories = [], onExpenseLogged }) {
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState('km'); // 'km' | 'mi'
  const [rate, setRate] = useState(12); // e.g. 12 per km
  const [vehicleType, setVehicleType] = useState('car');
  const [purpose, setPurpose] = useState('');
  const [tolls, setTolls] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const distNum = parseFloat(distance) || 0;
  const rateNum = parseFloat(rate) || 0;
  const tollsNum = parseFloat(tolls) || 0;
  const mileageCost = Math.round(distNum * rateNum * 100) / 100;
  const totalAmount = Math.round((mileageCost + tollsNum) * 100) / 100;

  const handleVehiclePreset = (type) => {
    setVehicleType(type);
    if (type === 'car') setRate(unit === 'km' ? 12 : 18);
    else if (type === 'bike') setRate(unit === 'km' ? 5 : 8);
    else if (type === 'cab') setRate(unit === 'km' ? 18 : 25);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (distNum <= 0) {
      setError('Please enter a valid distance greater than 0.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Find Transport / Travel category or default
    const transportCat = categories.find(c =>
      c.name.toLowerCase().includes('transport') ||
      c.name.toLowerCase().includes('travel') ||
      c.name.toLowerCase().includes('commute') ||
      c.name.toLowerCase().includes('fuel')
    ) || categories[0] || { id: 1 };

    const tripDesc = purpose.trim() || 'Mileage & Travel';
    const tollText = tollsNum > 0 ? ` + ${getCurrencySymbol()}${tollsNum} tolls` : '';
    const fullDesc = `${tripDesc} (${distNum} ${unit} @ ${getCurrencySymbol()}${rateNum}/${unit}${tollText}) #Mileage`;

    try {
      await api.post('/transactions', {
        category_id: transportCat.id,
        amount: totalAmount,
        txn_date: date,
        description: fullDesc
      });
      onExpenseLogged?.();
      onClose();
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to log mileage expense.'));
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel mileage-modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="mileage-icon-wrap">
              <Car size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Mileage & Travel Calculator</h3>
              <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                Compute distance-based reimbursement & auto-log with #Mileage
              </span>
            </div>
          </div>
          <button className="btn btn-secondary modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSaveExpense} className="mileage-form">
          {error && <div className="auth-error">{error}</div>}

          {/* Vehicle Type Presets */}
          <div className="form-group">
            <label>Vehicle Preset</label>
            <div className="mileage-presets">
              <button
                type="button"
                className={`preset-btn ${vehicleType === 'car' ? 'active' : ''}`}
                onClick={() => handleVehiclePreset('car')}
              >
                <Car size={16} /> Car ({getCurrencySymbol()}{unit === 'km' ? '12' : '18'}/{unit})
              </button>
              <button
                type="button"
                className={`preset-btn ${vehicleType === 'bike' ? 'active' : ''}`}
                onClick={() => handleVehiclePreset('bike')}
              >
                <Bike size={16} /> Two-Wheeler ({getCurrencySymbol()}{unit === 'km' ? '5' : '8'}/{unit})
              </button>
              <button
                type="button"
                className={`preset-btn ${vehicleType === 'cab' ? 'active' : ''}`}
                onClick={() => handleVehiclePreset('cab')}
              >
                <Navigation size={16} /> Cab/Taxi ({getCurrencySymbol()}{unit === 'km' ? '18' : '25'}/{unit})
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Distance</label>
              <div className="mileage-input-group">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g. 45"
                  value={distance}
                  onChange={e => setDistance(e.target.value)}
                  required
                  className="mileage-input"
                />
                <select
                  value={unit}
                  onChange={e => {
                    const u = e.target.value;
                    setUnit(u);
                    setRate(u === 'km' ? 12 : 18);
                  }}
                  className="mileage-unit-select"
                >
                  <option value="km">km</option>
                  <option value="mi">mi</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Rate per {unit} ({getCurrencySymbol()})</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                placeholder="12"
                value={rate}
                onChange={e => { setRate(e.target.value); setVehicleType('custom'); }}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tolls, Parking & Surcharges ({getCurrencySymbol()})</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={tolls}
                onChange={e => setTolls(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Trip Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Trip Purpose / Notes</label>
            <input
              type="text"
              placeholder="e.g. Client visit to Downtown HQ, Airport drop"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
            />
          </div>

          {/* Real-time Calculation Summary Card */}
          <div className="mileage-summary-box glass-panel">
            <div className="summary-breakdown">
              <span>Distance Cost ({distNum} {unit} × {getCurrencySymbol()}{rateNum}):</span>
              <strong>{formatCurrency(mileageCost)}</strong>
            </div>
            {tollsNum > 0 && (
              <div className="summary-breakdown">
                <span>Tolls & Parking:</span>
                <strong>{formatCurrency(tollsNum)}</strong>
              </div>
            )}
            <div className="summary-total-row">
              <span>Total Calculated Expense:</span>
              <span className="summary-total-amt">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || distNum <= 0}>
              <Plus size={16} /> {submitting ? 'Logging...' : 'Log as Travel Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
