# Booking Cancellation Flows

This document details the two main flows for cancelling bookings in the Livex platform: cancelling a **Pending Booking** (unpaid) and cancelling a **Confirmed Booking** (paid, with refund).

Both flows are handled by the unified `cancelBooking` endpoint in the `BookingsController`, which delegates logic to the `BookingsService`.

---

## 1. Pending Booking Cancellation

This scenario occurs when a user has started the checkout process (locking inventory) but decides to cancel before completing the payment, or the system cancels it due to timeout.

### Scenario
- **Booking Status:** `pending`
- **Payment Status:** `pending` or `authorized` (but not captured)
- **Inventory:** Locked temporarily

### Process Flow
1.  **Validation:**
    - The system verifies the booking exists and belongs to the requesting user.
    - Specifies that the booking is in `pending` status.

2.  **Payment Cancellation:**
    - If a payment intent exists (e.g., a PayPal Order created but not captured), the system attempts to **void/cancel** this intent with the payment provider.
    - This ensures the user is not charged later for a cancelled booking.

3.  **Inventory Release:**
    - The `inventory_locks` associated with the booking are marked as **released**.
    - This immediately frees up the slots for other users to book.

4.  **Status Update:**
    - The booking status is updated to `cancelled`.
    - No financial transaction (refund) is recorded as no charge was made.

---

## 2. Confirmed Booking Cancellation (With Refund)

This scenario occurs when a user has successfully paid for a booking but decides to cancel it later. The system enforces a **48-hour window** from the time of payment to allow an automatic refund.

### Scenario
- **Booking Status:** `confirmed`
- **Payment Status:** `paid`
- **Inventory:** Consumed (slots are taken)

### Process Flow
1.  **Validation:**
    - The system verifies the booking exists and belongs to the user.
    - Checks that the booking is `confirmed` and has a `paid` payment.

2.  **Refund Eligibility Check (48-Hour Rule):**
    - The system calculates the time elapsed since the `paid_at` timestamp.
    - **Condition:** If `Time Elapsed <= 48 hours`:
        - The cancellation proceeds.
        - A full refund is initiated.
    - **Condition:** If `Time Elapsed > 48 hours`:
        - The cancellation is **rejected**.
        - The user receives an error message: `Refund window expired. Refunds must be requested within 48 hours of payment.`

3.  **Refund Processing:**
    - A `refund` record is created in the database with status `pending`.
    - The system communicates with the payment provider (PayPal, Wompi) to execute the refund.
    - **Success:** Refund status updates to `processed`.
    - **Failure:** Refund status updates to `failed`, and the process may report an error (though the booking might still be cancelled depending on implementation strictness, usually the operation atomic).

4.  **Inventory Restoration:**
    - The `inventory_locks` are released.
    - The `available_spots` for the experience slot are **incremented** back, restoring availability for sale.

5.  **Notifications:**
    - The user receives an email notification confirming the cancellation and the refund details (Amount, Transaction ID).

---

## Summary Table

| Feature | Pending Booking Cancellation | Confirmed Booking Cancellation |
| :--- | :--- | :--- |
| **Trigger** | User Manual / System Timeout | User Manual |
| **Financial Action** | Void Payment Intent (No Charge) | Issue Full Refund |
| **Time Constraint** | Before Expiry (approx. 15 mins) | Within 48 Hours of Payment |
| **Inventory** | Released (Lock removed) | Restored (Availability added back) |
| **Auth Required** | Yes (Owner) | Yes (Owner) |

## API Reference

**Endpoint:** `POST /api/v1/bookings/:id/cancel`

**Payload:**
```json
{
  "reason": "Optional reason for cancellation"
}
```

**Response (Confirmed/Refunded):**
```json
{
  "booking": { ... },
  "refundId": "ref_...",
  "refundAmount": 150.00,
  "message": "Booking cancelled and refund of 150.00 USD processed successfully"
}
```
