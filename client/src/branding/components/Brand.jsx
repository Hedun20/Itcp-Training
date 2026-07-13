import logo from '../assets/itcp-logo.png';

export function Brand({ compact = false }) {
  return (
    <span className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="ITCP Training by ITCP Europe">
      <span className="brand-mark" aria-hidden="true"><img src={logo} alt="" /></span>
      {!compact && <span className="brand-copy"><strong>ITCP</strong><span>TRAINING</span></span>}
    </span>
  );
}
