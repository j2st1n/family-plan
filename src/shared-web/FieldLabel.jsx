export default function FieldLabel({children, required = false}) {
  return <span>{children}{required
    ? <span title="必填" aria-label="必填" style={{color: 'var(--danger)', marginLeft: 3}}>*</span>
    : <small style={{color: 'var(--muted)', marginLeft: 4}}>（选填）</small>}
  </span>;
}
