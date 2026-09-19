import { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n';
import './LanguageSwitcher.css';

export default function LanguageSwitcher({ compact = false }) {
  const { currentLang, setLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div className={`lang-switcher-wrap ${compact ? 'compact' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="lang-switcher-btn glass-panel"
        onClick={() => setOpen(prev => !prev)}
        title={`Change Language (${activeLang.name})`}
        aria-label="Change Language"
        aria-expanded={open}
      >
        <span className="lang-flag">{activeLang.flag}</span>
        {!compact && <span className="lang-code">{activeLang.code.toUpperCase()}</span>}
        <ChevronDown size={13} className={`lang-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="lang-dropdown-menu glass-panel animate-fade-in">
          <div className="lang-dropdown-header">
            <Globe size={14} className="text-muted" />
            <span>{t('selectLanguage', 'Select Language')}</span>
          </div>

          <div className="lang-options-list">
            {SUPPORTED_LANGUAGES.map(lang => {
              const isSelected = lang.code === currentLang;
              return (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-option-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(lang.code)}
                >
                  <div className="lang-option-info">
                    <span className="lang-option-flag">{lang.flag}</span>
                    <div className="lang-option-names">
                      <span className="lang-option-name">{lang.name}</span>
                      {lang.dir === 'rtl' && <span className="lang-rtl-badge">RTL</span>}
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="lang-selected-check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
