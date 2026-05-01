export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  customerName?: string;
  paymentMethod?: 'cash' | 'qris' | 'credit';
  date: string; // ISO yyyy-mm-dd
  productName?: string;
  invoiceNo?: string;
  hpp?: number;
  createdAt: any; // Firestore Timestamp
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  businessName?: string;
  directorName?: string;
  address?: string;
  npwp?: string;
  qrisPayload?: string;
  autoGeneratePdfLedger?: boolean;
  thermalPrinterOptimization?: boolean;
  createdAt: any;
}

export interface Product {
  id: string;
  userId: string;
  code: string;
  name: string;
  category: string;
  price: number;
  hpp: number;
  stock: number;
  unit: string;
  createdAt: any;
}

export interface Debt {
  id: string;
  userId: string;
  transactionId: string;
  type: 'payable' | 'receivable';
  contactName: string;
  totalAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'pending' | 'partially_paid' | 'paid';
  createdAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
