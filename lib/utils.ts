import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { OperationType } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined | null) {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (numericAmount === undefined || numericAmount === null || isNaN(numericAmount)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericAmount);
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`Firestore Error [${operationType}] at [${path}]:`, error);
  // Re-throwing as expected by instructions in Firebase integration
  throw new Error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {} // Minimal for build success
  }));
}
