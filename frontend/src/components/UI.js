import React from "react";

export function Button({ children, variant = "primary", loading = false, className = "", ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function PasswordField({ label, value, onChange, placeholder, hint, required = false }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="password-input-wrap">
        <input className="input" type={visible ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} required={required} />
        <button className="password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </Field>
  );
}

export function Alert({ type = "error", children }) {
  return <div className={`alert alert-${type}`} role={type === "error" ? "alert" : "status"}>{children}</div>;
}

export function Brand() {
  return <span className="brand"><span className="brand-mark">C</span> CertChain</span>;
}
