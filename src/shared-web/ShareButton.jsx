import "./share.css";

export function ShareIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M8 6l4-4 4 4m-4-4v13" />
    </svg>
  );
}

export default function ShareButton({ label, disabled, onClick }) {
  return (
    <button type="button" className="share-button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <ShareIcon />
    </button>
  );
}
