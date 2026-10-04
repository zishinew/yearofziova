export function PaymentConfirming() {
  return <div className="payment-confirming" role="status" aria-live="polite">
    <span className="payment-spinner" aria-hidden="true" />
    <h1>Confirming your payment…</h1>
    <p>Your downloads will be ready in a moment.</p>
  </div>;
}
