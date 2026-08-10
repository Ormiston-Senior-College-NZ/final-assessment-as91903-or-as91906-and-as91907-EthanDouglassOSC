/* Shared in-page confirmation dialog for destructive or irreversible actions. */
import "./confirmDialog.css";

function ConfirmDialog({ title = "Confirm action", message, confirmLabel = "Confirm", onConfirm, onCancel }) {
  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <footer>
          <button type="button" className="confirm-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="confirm-submit" onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}

export default ConfirmDialog;
