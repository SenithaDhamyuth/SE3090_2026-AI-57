import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, BookOpen, CheckCircle2, Loader2, X } from "lucide-react";

export function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <BookOpen size={23} strokeWidth={2.2} />
      </span>
      <span>
        <strong>
          IntelliPrep<span>.</span>
        </strong>
        <small>ADMIN WORKSPACE</small>
      </span>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Metric({ label, value, detail, icon: Icon, accent = false }) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`}>
      <div className="metric-top">
        <span>{label}</span>
        {Icon && <Icon size={19} aria-hidden="true" />}
      </div>
      <strong className="metric-value">{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  );
}

export function Notice({ type = "info", text, onDismiss, children }) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`notice ${{ error: "notice-error", success: "notice-success", info: "notice-info" }[type] || "notice-info"}`}
      role={type === "error" ? "alert" : "status"}
    >
      <Icon size={19} aria-hidden="true" />
      <div className="notice-copy">
        {text}
        {children}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss message"
          onClick={onDismiss}
        >
          <X size={17} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = BookOpen,
  title,
  description,
  children,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="loading-state" role="status">
      <Loader2 className="animate-spin" size={25} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// Native dialogs trap keyboard focus, make the background inert, and escape
// animated page containers. No third-party UI dependency is needed.
export function ModalFrame({
  label,
  onClose,
  children,
  className = "",
  wide = false,
}) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-label={label}
      className={`modal-frame ${wide ? "modal-wide" : ""} ${className}`}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const dialog = event.currentTarget;
        const controls = Array.from(
          dialog.querySelectorAll(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            !element.matches(":disabled") &&
            element.tabIndex >= 0 &&
            element.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === dialog)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose?.();
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
