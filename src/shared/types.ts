// Data models and IPC types for SellerPilot AI

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';

export interface BusinessSettings {
  id: number;
  businessName: string;
  businessType: string;
  currency: CurrencyCode;
  country: string;
  language: string;
  logoData?: string;
  isOnboarded: boolean;
  demoMode: boolean;
  targetStockCoverageDays: number;
  warningThresholdDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  color?: string;
  createdAt: string;
  productCount?: number;
}

export interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  leadTimeDays: number;
  minOrderQty: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Product {
  id: number;
  sku: string;
  name: string;
  categoryId?: number;
  categoryName?: string;
  categoryColor?: string;
  description?: string;
  brand?: string;
  barcode?: string;
  unit: string;
  purchaseCostPaise: number; // in minor units (paise/cents)
  sellingPricePaise: number; // in minor units (paise/cents)
  currentStock: number;
  minStockThreshold: number;
  safetyStock: number;
  supplierId?: number;
  supplierName?: string;
  supplierLeadTimeDays: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed / status fields
  stockStatus?: StockStatus;
  estimatedCostValuePaise?: number;
  estimatedRetailValuePaise?: number;
}

export type MovementType =
  | 'OPENING_STOCK'
  | 'PURCHASE_RECEIPT'
  | 'SALE'
  | 'CUSTOMER_RETURN'
  | 'SUPPLIER_RETURN'
  | 'MANUAL_ADJUSTMENT'
  | 'DAMAGED_STOCK'
  | 'CORRECTION';

export interface StockMovement {
  id: number;
  productId: number;
  productName?: string;
  sku?: string;
  movementType: MovementType;
  quantity: number;
  reference?: string;
  notes?: string;
  timestamp: string;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'OTHER';

export interface SaleItemInput {
  productId: number;
  quantity: number;
  unitSellingPricePaise: number;
  discountPaise?: number;
}

export interface SaleItem extends SaleItemInput {
  id: number;
  saleId: number;
  productName: string;
  sku: string;
  unitCostPaise: number;
  totalAmountPaise: number;
}

export interface SaleInput {
  saleDate?: string;
  items: SaleItemInput[];
  discountPaise?: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  allowNegativeStockOverride?: boolean;
}

export interface Sale {
  id: number;
  saleReference: string;
  saleDate: string;
  totalAmountPaise: number;
  discountPaise: number;
  finalAmountPaise: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  status: 'completed' | 'cancelled';
  cancelledAt?: string;
  cancellationReason?: string;
  items?: SaleItem[];
  itemCount?: number;
  createdAt: string;
}

export type RestockPriority = 'CRITICAL' | 'HIGH' | 'NORMAL';

export interface RestockItem {
  productId: number;
  productName: string;
  sku: string;
  categoryName?: string;
  currentStock: number;
  avgDailySales: number;
  daysRemaining: number | null; // null if zero sales
  supplierLeadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;
  estimatedCostPaise: number;
  supplierId?: number;
  supplierName?: string;
  minOrderQty: number;
  priority: RestockPriority;
  reason: string;
  salesHistoryReliable: boolean;
}

export interface DashboardMetrics {
  activeProductsCount: number;
  activeProductsChangePct: number;
  unitsInStock: number;
  unitsInStockChangePct: number;
  salesRevenuePaise: number;
  salesRevenueChangePct: number;
  lowStockItemsCount: number;
  lowStockItemsChangePct: number;
  outOfStockCount: number;
  reorderRequiredCount: number;
  inventoryCostPaise: number;
  inventoryRetailPaise: number;
  grossProfitPaise: number;
  salesOverview: Array<{
    date: string;
    revenuePaise: number;
    revenueFormatted: number;
    unitsSold: number;
  }>;
  categoryDistribution: Array<{
    categoryId: number;
    name: string;
    units: number;
    percentage: number;
    color: string;
  }>;
  topSellingProducts: Array<{
    productId: number;
    name: string;
    sku: string;
    unitsSold: number;
    revenuePaise: number;
    stock: number;
    stockStatus: StockStatus;
  }>;
  restockAttention: RestockItem[];
}

export interface SalesAnalytics {
  totalRevenuePaise: number;
  totalCostPaise: number;
  grossProfitPaise: number;
  profitMarginPct: number;
  totalUnitsSold: number;
  totalTransactions: number;
  avgOrderValuePaise: number;
  topByUnits: Array<{
    productId: number;
    name: string;
    sku: string;
    unitsSold: number;
    revenuePaise: number;
  }>;
  topByRevenue: Array<{
    productId: number;
    name: string;
    sku: string;
    revenuePaise: number;
    unitsSold: number;
  }>;
  slowMoving: Array<{
    productId: number;
    name: string;
    sku: string;
    currentStock: number;
    lastSoldDate?: string;
    daysSinceLastSale: number;
    inventoryCostPaise: number;
  }>;
  categoryPerformance: Array<{
    categoryId: number;
    name: string;
    unitsSold: number;
    revenuePaise: number;
    grossProfitPaise: number;
  }>;
  revenueTrend: Array<{
    period: string;
    revenuePaise: number;
    costPaise: number;
    grossProfitPaise: number;
    unitsSold: number;
  }>;
}

export interface AiModelStatus {
  available: boolean;
  endpoint: string;
  selectedModel: string;
  installedModels: string[];
  isModelReady: boolean;
  lastChecked: string;
  error?: string;
}

export interface AiListingPromptInput {
  productName: string;
  brand?: string;
  category?: string;
  confirmedSpecs: Record<string, string>;
  intendedSalesChannel?: string;
  language?: string;
  brandVoice?: string;
}

export interface AiListingOutput {
  title: string;
  shortDescription: string;
  detailedDescription: string;
  keyFeatures: string[];
  searchKeywords: string[];
  promotionalCaption?: string;
}

export interface AiBusinessInsight {
  queryType: string;
  userQuestion: string;
  calculatedData: Record<string, any>;
  naturalLanguageAnswer: string;
  recommendations: string[];
  isAiGenerated: boolean;
  generatedAt: string;
}

export interface BackupRecord {
  id: number;
  filename: string;
  filePath: string;
  fileSizeBytes: number;
  status: 'success' | 'failed';
  createdAt: string;
}

export interface CsvPreviewRow {
  rowNumber: number;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  unit?: string;
  purchaseCostPaise: number;
  sellingPricePaise: number;
  currentStock: number;
  minStockThreshold: number;
  supplier?: string;
  isValid: boolean;
  errors: string[];
}

export interface CsvValidationResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: CsvPreviewRow[];
  headersFound: string[];
}

