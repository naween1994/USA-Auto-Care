import { z } from 'zod';
import { JOB_STATUSES, ROLES } from '../utils/domainLogic.js';

export const loginSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const customerSchema = z.object({
  name: z.string().min(2, 'Customer name is required').max(120),
  phone: z.string().min(7, 'Valid phone number is required').max(30),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
  __v: z.number().int().optional(),
});

export const vehicleSchema = z.object({
  customer: z.string().min(1, 'Customer ID is required'),
  registrationNumber: z.string().min(3, 'Registration number is required').max(25),
  make: z.string().min(1, 'Make is required').max(60),
  model: z.string().min(1, 'Model is required').max(60),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  fuelType: z.enum(['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Other']),
  transmission: z.enum(['Automatic', 'Manual', 'CVT', 'DCT', 'Other']),
  mileageKm: z.coerce.number().min(0),
  vin: z.string().max(50).optional().or(z.literal('')),
  engineNumber: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
  nextServiceDate: z.string().optional().nullable(),
  nextServiceMileageKm: z.coerce.number().optional().nullable(),
  __v: z.number().int().optional(),
});

export const appointmentSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  vehicle: z.string().min(1, 'Vehicle is required'),
  isWalkIn: z.boolean().optional().default(false),
  requestedService: z.string().min(2, 'Requested service is required').max(300),
  scheduledAt: z.string().min(1, 'Scheduled date/time is required'),
  notes: z.string().max(1000).optional().or(z.literal('')),
  status: z.enum(['Scheduled', 'Confirmed', 'Arrived', 'Cancelled', 'No-show']).optional(),
  __v: z.number().int().optional(),
});

export const createJobCardSchema = z.object({
  appointmentId: z.string().optional().nullable(),
  customer: z.string().min(1, 'Customer is required'),
  vehicle: z.string().min(1, 'Vehicle is required'),
  mileageInKm: z.coerce.number().min(0, 'Check-in mileage is required'),
  fuelLevel: z.enum(['Empty', '1/4', '1/2', '3/4', 'Full']),
  customerComplaints: z.string().min(3, 'Customer complaint description is required'),
  existingDamageNotes: z.string().optional().or(z.literal('')),
  accessoriesNotes: z.string().optional().or(z.literal('')),
  assignedMechanic: z.string().optional().nullable(),
  estimatedCompletionAt: z.string().optional().nullable(),
});

export const updateJobCardSchema = z.object({
  mileageInKm: z.coerce.number().min(0).optional(),
  fuelLevel: z.enum(['Empty', '1/4', '1/2', '3/4', 'Full']).optional(),
  customerComplaints: z.string().min(3).optional(),
  existingDamageNotes: z.string().optional(),
  accessoriesNotes: z.string().optional(),
  diagnosisNotes: z.string().optional(),
  mechanicNotes: z.string().optional(),
  assignedMechanic: z.string().optional().nullable(),
  estimatedCompletionAt: z.string().optional().nullable(),
  inspectionChecklist: z
    .array(
      z.object({
        key: z.enum(['oil', 'coolant', 'brakes', 'tyres', 'battery', 'lights', 'belts', 'leaks']),
        label: z.string(),
        status: z.enum(['Good', 'Attention Needed', 'Urgent']),
        notes: z.string().optional().default(''),
      })
    )
    .optional(),
  workTasks: z
    .array(
      z.object({
        _id: z.string().optional(),
        description: z.string().min(1),
        completed: z.boolean().default(false),
      })
    )
    .optional(),
  labourCharges: z
    .array(
      z.object({
        _id: z.string().optional(),
        description: z.string().min(1),
        hours: z.coerce.number().min(0.1),
        rateLkr: z.coerce.number().min(0),
        directLabourCostLkr: z.coerce.number().min(0).optional().default(0),
      })
    )
    .optional(),
  qualityCheckPassed: z.boolean().optional(),
  qualityCheckNotes: z.string().optional(),
  nextServiceDate: z.string().optional().nullable(),
  nextServiceMileageKm: z.coerce.number().optional().nullable(),
  __v: z.number().int().optional(),
});

export const jobStatusTransitionSchema = z.object({
  status: z.enum(JOB_STATUSES),
  note: z.string().optional().default(''),
  __v: z.number().int().optional(),
});

export const issueJobPartSchema = z.object({
  partId: z.string().optional().nullable(),
  sku: z.string().optional().default('CUST-PART'),
  name: z.string().optional().default(''),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  isCustomerSupplied: z.boolean().default(false),
  unitPriceLkr: z.coerce.number().min(0).optional(),
});

export const returnJobPartSchema = z.object({
  issuedPartId: z.string().min(1),
  returnQuantity: z.coerce.number().positive(),
  reason: z.string().min(2, 'Return reason is required'),
});

export const estimatePayloadSchema = z.object({
  jobCard: z.string().min(1),
  parts: z.array(
    z.object({
      part: z.string().optional().nullable(),
      sku: z.string().optional().default(''),
      name: z.string().min(1),
      quantity: z.coerce.number().positive(),
      isCustomerSupplied: z.boolean().optional().default(false),
      unitPriceLkr: z.coerce.number().min(0),
      unitCostLkr: z.coerce.number().min(0).optional().default(0),
    })
  ),
  labour: z.array(
    z.object({
      description: z.string().min(1),
      hours: z.coerce.number().positive(),
      rateLkr: z.coerce.number().min(0),
    })
  ),
  discountLkr: z.coerce.number().min(0).default(0),
  taxEnabled: z.boolean().optional().default(false),
  taxRatePercent: z.coerce.number().min(0).max(100).optional().default(0),
  notes: z.string().optional().default(''),
  __v: z.number().int().optional(),
});

export const estimateApprovalSchema = z.object({
  status: z.enum(['Sent', 'Approved', 'Rejected']),
  method: z.enum(['In-Person', 'Phone']).optional(),
  approvingCustomerName: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  __v: z.number().int().optional(),
});

export const partSchema = z.object({
  sku: z.string().min(2, 'SKU is required').max(40),
  name: z.string().min(2, 'Part name is required').max(150),
  category: z.string().min(2, 'Category is required').max(80),
  compatibilityNotes: z.string().optional().default(''),
  unit: z.string().min(1).default('pcs'),
  purchaseCostLkr: z.coerce.number().min(0),
  sellingPriceLkr: z.coerce.number().min(0),
  quantityOnHand: z.coerce.number().min(0).optional().default(0),
  reorderThreshold: z.coerce.number().min(0).default(5),
  supplier: z.string().optional().nullable(),
  storageLocation: z.string().optional().default(''),
  __v: z.number().int().optional(),
});

export const stockAdjustmentSchema = z.object({
  movementType: z.enum(['RECEIPT', 'ADJUSTMENT']),
  quantityDelta: z.coerce.number().refine((n) => n !== 0, 'Quantity change cannot be zero'),
  unitCostLkr: z.coerce.number().min(0).optional(),
  supplier: z.string().optional().nullable(),
  reason: z.string().min(3, 'Reason is required for audit ledger'),
});

export const createInvoiceFromJobSchema = z.object({
  jobCardId: z.string().min(1),
  discountLkr: z.coerce.number().min(0).default(0),
  taxEnabled: z.boolean().optional(),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
  paymentTerms: z.string().optional().default('Due on receipt'),
  notes: z.string().optional().default(''),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().optional().nullable(),
  customerId: z.string().min(1),
  paymentType: z.enum(['INVOICE_PAYMENT', 'CUSTOMER_DEPOSIT', 'DEPOSIT_ALLOCATION']).default('INVOICE_PAYMENT'),
  method: z.enum(['Cash', 'Bank Transfer', 'Card', 'Deposit Allocation']),
  amountLkr: z.coerce.number().positive('Amount must be greater than zero'),
  referenceNumber: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  idempotencyKey: z.string().min(6, 'Idempotency key is required'),
});

export const expenseSchema = z.object({
  category: z.enum(['Utilities', 'Workshop Consumables', 'Tools & Equipment', 'Rent', 'Staff Welfare', 'Transport', 'Other']),
  amountLkr: z.coerce.number().positive('Expense amount must be positive'),
  incurredOn: z.string().min(1),
  vendorName: z.string().optional().default(''),
  notes: z.string().min(2, 'Expense description is required'),
});

export const staffUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(Object.values(ROLES)),
  phone: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
});
