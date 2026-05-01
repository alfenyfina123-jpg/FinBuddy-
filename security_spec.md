# Security Specification - BISA UI (UMKM Intelligence)

## Data Invariants
1. **Financial Integrity**: Every transaction must have a non-negative amount and be tied to the authenticated user.
2. **Relational Sync**: Debts must be linked to a valid transaction. Products must have a unique code (SKU) within the user's catalog.
3. **Identity Guard**: Users can only read/write their own data (`userId == request.auth.uid`).
4. **Terminal States**: A debt marked as `paid` should ideally not revert to `pending` without admin intervention (though for UMKM flexibilty, we might allow it if owned).
5. **Inventory Integrity**: Product stock should be a number.

## The Dirty Dozen Payloads (Rejection Targets)

1. **Identity Spoofing**: `create` a transaction with `userId: "OTHER_USER_ID"`.
2. **Negative Wealth**: `create` a transaction with `amount: -1000`.
3. **ID Poisoning**: `create` a document with a 2KB long string as the ID.
4. **Shadow Fields**: `create` a product with an extra field `isVerifiedByAdmin: true`.
5. **Ghost Payments**: `create` a transaction with an invalid `paymentMethod: "crypto"`.
6. **Price Manipulation**: `update` a product price to a negative value.
7. **Orphaned Debts**: `create` a debt with a `contactName` exceeding 255 characters.
8. **Stale Timestamps**: `create` a record with a `createdAt` from the past instead of `request.time`.
9. **Blanket Read Attack**: Attempting a `list` query without a `where` filter on `userId`.
10. **Type Confusion**: `create` a product where `stock` is a string `"lot"` instead of a number.
11. **Enum Bypass**: `update` a debt status to `"deleted"` (not in enum).
12. **Immutable Violation**: `update` a transaction's `userId` to a different value.
