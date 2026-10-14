import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AppDatabase } from '../src/main/db/database';
import { InventoryService } from '../src/main/services/inventoryService';
import { SalesService } from '../src/main/services/salesService';
import { AnalyticsService } from '../src/main/services/analyticsService';
import { RestockService } from '../src/main/services/restockService';
import { DemoDataService } from '../src/main/services/demoDataService';

describe('SellerPilot AI Core Business Logic & Database Tests', () => {
  let db: AppDatabase;
  const testDbDir = path.join(process.cwd(), 'test-data');
  const testDbPath = path.join(testDbDir, 'test-sellerpilot.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new AppDatabase(testDbPath);
    await db.init();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  describe('Inventory Management', () => {
    it('creates product with valid SKU and opening stock audit movement', () => {
      const inventory = new InventoryService(db);
      const product = inventory.createProduct({
        sku: 'WM-001',
        name: 'Wireless Mouse',
        purchaseCostPaise: 32000,
        sellingPricePaise: 59900,
        initialStock: 25,
        minStockThreshold: 10,
        safetyStock: 8,
      });

      expect(product.id).toBeGreaterThan(0);
      expect(product.sku).toBe('WM-001');
      expect(product.currentStock).toBe(25);
      expect(product.stockStatus).toBe('IN_STOCK');

      const movements = inventory.getStockMovements({ productId: product.id });
      expect(movements.length).toBe(1);
      expect(movements[0].movementType).toBe('OPENING_STOCK');
      expect(movements[0].quantity).toBe(25);
    });

    it('rejects duplicate SKUs case-insensitively', () => {
      const inventory = new InventoryService(db);
      inventory.createProduct({
        sku: 'USB-001',
        name: 'USB-C Cable',
        purchaseCostPaise: 5000,
        sellingPricePaise: 15000,
      });

      expect(() => {
        inventory.createProduct({
          sku: 'usb-001',
          name: 'Another Cable',
          purchaseCostPaise: 6000,
          sellingPricePaise: 16000,
        });
      }).toThrow(/already exists/i);
    });

    it('handles manual stock adjustments with audit logging', () => {
      const inventory = new InventoryService(db);
      const prod = inventory.createProduct({
        sku: 'KB-001',
        name: 'Keyboard',
        purchaseCostPaise: 100000,
        sellingPricePaise: 150000,
        initialStock: 10,
      });

      const updated = inventory.adjustStock(
        prod.id,
        15,
        'PURCHASE_RECEIPT',
        'PO-1001',
        'Received from vendor'
      );
      expect(updated.currentStock).toBe(25);

      const movements = inventory.getStockMovements({ productId: prod.id });
      expect(movements.length).toBe(2);
      expect(movements[0].movementType).toBe('PURCHASE_RECEIPT');
      expect(movements[0].quantity).toBe(15);
    });
  });

  describe('Sales Transactions & Stock Deductions', () => {
    it('records a sale and deducts inventory in an atomic transaction', () => {
      const inventory = new InventoryService(db);
      const sales = new SalesService(db);

      const p1 = inventory.createProduct({
        sku: 'ITEM-A',
        name: 'Item A',
        purchaseCostPaise: 1000,
        sellingPricePaise: 2500,
        initialStock: 20,
      });

      const sale = sales.recordSale({
        paymentMethod: 'UPI',
        items: [{ productId: p1.id, quantity: 5, unitSellingPricePaise: 2500 }],
        discountPaise: 500,
      });

      expect(sale.id).toBeGreaterThan(0);
      expect(sale.finalAmountPaise).toBe(12000); // (5 * 2500) - 500 = 12000 paise (₹120)
      expect(sale.status).toBe('completed');

      // Check stock deduction
      const updatedP1 = inventory.getProductById(p1.id)!;
      expect(updatedP1.currentStock).toBe(15);

      // Check stock movement logged
      const movements = inventory.getStockMovements({ productId: p1.id });
      const saleMove = movements.find((m) => m.movementType === 'SALE');
      expect(saleMove).toBeDefined();
      expect(saleMove?.quantity).toBe(-5);
    });

    it('prevents overselling unless negative stock override is explicitly enabled', () => {
      const inventory = new InventoryService(db);
      const sales = new SalesService(db);

      const p1 = inventory.createProduct({
        sku: 'ITEM-LIMITED',
        name: 'Limited Item',
        purchaseCostPaise: 5000,
        sellingPricePaise: 10000,
        initialStock: 2,
      });

      expect(() => {
        sales.recordSale({
          paymentMethod: 'CASH',
          items: [{ productId: p1.id, quantity: 5, unitSellingPricePaise: 10000 }],
          allowNegativeStockOverride: false,
        });
      }).toThrow(/insufficient stock/i);

      // Verify stock was NOT deducted after rollback
      const checkedP1 = inventory.getProductById(p1.id)!;
      expect(checkedP1.currentStock).toBe(2);
    });

    it('cancels sale and reverses stock via customer return audit movement', () => {
      const inventory = new InventoryService(db);
      const sales = new SalesService(db);

      const p1 = inventory.createProduct({
        sku: 'RETURN-TEST',
        name: 'Returnable Item',
        purchaseCostPaise: 4000,
        sellingPricePaise: 8000,
        initialStock: 10,
      });

      const sale = sales.recordSale({
        paymentMethod: 'CARD',
        items: [{ productId: p1.id, quantity: 3, unitSellingPricePaise: 8000 }],
      });

      expect(inventory.getProductById(p1.id)!.currentStock).toBe(7);

      // Cancel the sale
      const cancelled = sales.cancelSale(sale.id, 'Customer requested return');
      expect(cancelled.status).toBe('cancelled');

      // Verify stock restored
      expect(inventory.getProductById(p1.id)!.currentStock).toBe(10);

      // Verify customer return movement
      const movements = inventory.getStockMovements({ productId: p1.id });
      const returnMove = movements.find((m) => m.movementType === 'CUSTOMER_RETURN');
      expect(returnMove).toBeDefined();
      expect(returnMove?.quantity).toBe(3);
    });
  });

  describe('Restock Planner Formulas', () => {
    it('accurately calculates reorder points and suggested quantities', () => {
      const inventory = new InventoryService(db);
      const sales = new SalesService(db);
      const restock = new RestockService(db);

      const p = inventory.createProduct({
        sku: 'MOUSE-01',
        name: 'Optical Mouse',
        purchaseCostPaise: 20000,
        sellingPricePaise: 50000,
        initialStock: 100,
        minStockThreshold: 10,
        safetyStock: 8,
        supplierLeadTimeDays: 5,
      });

      // Simulate 60 units sold over past 30 days -> 2.0 avg daily sales
      sales.recordSale({
        paymentMethod: 'UPI',
        items: [{ productId: p.id, quantity: 60, unitSellingPricePaise: 50000 }],
      });

      // Stock is now 40
      // Reorder Point = (2.0 * 5) + 8 = 18
      // Stock 40 > 18 -> No reorder yet

      // Now sell 30 more units -> stock is 10
      sales.recordSale({
        paymentMethod: 'UPI',
        items: [{ productId: p.id, quantity: 30, unitSellingPricePaise: 50000 }],
      });

      // Now stock = 10 <= Reorder Point (18) -> Requires Restock!
      const recs = restock.getRestockRecommendations({ historicalDaysWindow: 30, targetCoverageDays: 30 });
      const itemRec = recs.find((r) => r.productId === p.id);

      expect(itemRec).toBeDefined();
      expect(itemRec?.currentStock).toBe(10);
      expect(itemRec?.reorderPoint).toBeGreaterThanOrEqual(18);
      expect(itemRec?.suggestedOrderQty).toBeGreaterThan(0);
      expect(itemRec?.priority).toBe('HIGH');
    });

    it('identifies Critical priority when stock drops to zero or days left <= 2', () => {
      const inventory = new InventoryService(db);
      const sales = new SalesService(db);
      const restock = new RestockService(db);

      const p = inventory.createProduct({
        sku: 'URGENT-01',
        name: 'Critical Stock Item',
        purchaseCostPaise: 10000,
        sellingPricePaise: 20000,
        initialStock: 10,
        safetyStock: 5,
        supplierLeadTimeDays: 4,
      });

      // Sell all 10 units -> stock = 0
      sales.recordSale({
        paymentMethod: 'CASH',
        items: [{ productId: p.id, quantity: 10, unitSellingPricePaise: 20000 }],
      });

      const recs = restock.getRestockRecommendations();
      const itemRec = recs.find((r) => r.productId === p.id);

      expect(itemRec).toBeDefined();
      expect(itemRec?.currentStock).toBe(0);
      expect(itemRec?.priority).toBe('CRITICAL');
    });
  });

  describe('Backup, Integrity, and Recovery', () => {
    it('exports backup file and passes integrity check', () => {
      const backupDir = path.join(testDbDir, 'backups');
      const backup = db.exportBackup(backupDir);

      expect(fs.existsSync(backup.filePath)).toBe(true);
      expect(backup.size).toBeGreaterThan(0);

      // Verify file starts with SQLite format 3 header
      const buffer = fs.readFileSync(backup.filePath);
      expect(buffer.slice(0, 15).toString()).toBe('SQLite format 3');
      expect(db.checkIntegrity()).toBe(true);

      fs.unlinkSync(backup.filePath);
    });

    it('rejects corrupt backup file when restoring', async () => {
      const fakeBackupPath = path.join(testDbDir, 'corrupt.db');
      fs.writeFileSync(fakeBackupPath, 'INVALID_NOT_SQLITE_DATA');

      await expect(db.restoreFromBackup(fakeBackupPath)).rejects.toThrow(/not a valid sqlite/i);

      fs.unlinkSync(fakeBackupPath);
    });
  });

  describe('Demonstration Store Seeding', () => {
    it('seeds and resets demo store data cleanly', () => {
      const demoService = new DemoDataService(db);
      const inventory = new InventoryService(db);
      const sales = new SalesService(db);

      demoService.seedDemoData();
      expect(demoService.isDemoMode()).toBe(true);

      const products = inventory.getProducts();
      expect(products.length).toBeGreaterThanOrEqual(8);

      const salesList = sales.getSales();
      expect(salesList.length).toBeGreaterThan(10);

      // Reset
      demoService.resetDemoData();
      expect(demoService.isDemoMode()).toBe(false);
      expect(inventory.getProducts().length).toBe(0);
      expect(sales.getSales().length).toBe(0);
    });
  });

  describe('Priority 1: Empty Database Baseline', () => {
    it('returns zero metrics and empty state collections for a brand-new business', () => {
      const analytics = new AnalyticsService(db);
      const metrics = analytics.getDashboardMetrics(30);

      expect(metrics.activeProductsCount).toBe(0);
      expect(metrics.activeProductsChangePct).toBe(0);
      expect(metrics.unitsInStock).toBe(0);
      expect(metrics.unitsInStockChangePct).toBe(0);
      expect(metrics.salesRevenuePaise).toBe(0);
      expect(metrics.salesRevenueChangePct).toBe(0);
      expect(metrics.lowStockItemsCount).toBe(0);
      expect(metrics.lowStockItemsChangePct).toBe(0);
      expect(metrics.outOfStockCount).toBe(0);
      expect(metrics.reorderRequiredCount).toBe(0);
      expect(metrics.inventoryCostPaise).toBe(0);
      expect(metrics.inventoryRetailPaise).toBe(0);
      expect(metrics.grossProfitPaise).toBe(0);

      // Collections must be empty arrays for empty states
      expect(metrics.categoryDistribution).toEqual([]);
      expect(metrics.topSellingProducts).toEqual([]);
      expect(metrics.restockAttention).toEqual([]);

      // Sales overview exists but contains zero revenue and units
      expect(metrics.salesOverview.length).toBe(30);
      const nonZeroDay = metrics.salesOverview.find((d) => d.revenuePaise > 0 || d.unitsSold > 0);
      expect(nonZeroDay).toBeUndefined();
    });
  });

  describe('Priority 2: Product Import with Preview, Validation & Transactions', () => {
    it('validates CSV rows and displays preview without modifying database', () => {
      const inventory = new InventoryService(db);
      const csvData = [
        'SKU,Product Name,Category,Purchase Cost,Selling Price,Stock Quantity,Minimum Stock Threshold,Supplier',
        'WM-001,Wireless Optical Mouse,Accessories,350,699,25,8,Apex Wholesale',
        'KB-002,RGB Gaming Keyboard,Electronics,1200,2499,15,5,Apex Wholesale',
        'USB-003,USB-C Braided Cable,Accessories,80,249,60,15,Swift Cables',
      ].join('\r\n');

      const preview = inventory.validateProductsFromCsv(csvData);

      expect(preview.totalRows).toBe(3);
      expect(preview.validCount).toBe(3);
      expect(preview.errorCount).toBe(0);
      expect(preview.rows.length).toBe(3);

      expect(preview.rows[0].sku).toBe('WM-001');
      expect(preview.rows[0].name).toBe('Wireless Optical Mouse');
      expect(preview.rows[0].category).toBe('Accessories');
      expect(preview.rows[0].purchaseCostPaise).toBe(35000);
      expect(preview.rows[0].sellingPricePaise).toBe(69900);
      expect(preview.rows[0].currentStock).toBe(25);
      expect(preview.rows[0].minStockThreshold).toBe(8);
      expect(preview.rows[0].supplier).toBe('Apex Wholesale');
      expect(preview.rows[0].isValid).toBe(true);

      // Verify database remains untouched before confirmation
      expect(inventory.getProducts().length).toBe(0);
    });

    it('imports 3 valid products in a transaction, creating categories and suppliers', () => {
      const inventory = new InventoryService(db);
      const csvData = [
        'SKU,Product Name,Category,Purchase Cost,Selling Price,Stock Quantity,Minimum Stock Threshold,Supplier',
        'WM-001,Wireless Optical Mouse,Accessories,350,699,25,8,Apex Wholesale',
        'KB-002,RGB Gaming Keyboard,Electronics,1200,2499,15,5,Apex Wholesale',
        'USB-003,USB-C Braided Cable,Accessories,80,249,60,15,Swift Cables',
      ].join('\r\n');

      const result = inventory.importProductsFromCsv(csvData);

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(3);
      expect(result.errors.length).toBe(0);

      // Verify products created
      const products = inventory.getProducts();
      expect(products.length).toBe(3);

      const p1 = products.find((p) => p.sku === 'WM-001');
      expect(p1).toBeDefined();
      expect(p1?.name).toBe('Wireless Optical Mouse');
      expect(p1?.categoryName).toBe('Accessories');
      expect(p1?.supplierName).toBe('Apex Wholesale');
      expect(p1?.purchaseCostPaise).toBe(35000);
      expect(p1?.sellingPricePaise).toBe(69900);
      expect(p1?.currentStock).toBe(25);
      expect(p1?.minStockThreshold).toBe(8);

      // Verify audit movements created for initial stocks
      const movements = inventory.getStockMovements();
      expect(movements.length).toBe(3);
      expect(movements.every((m) => m.movementType === 'OPENING_STOCK')).toBe(true);

      // Verify dashboard uses these database records immediately
      const analytics = new AnalyticsService(db);
      const metrics = analytics.getDashboardMetrics(30);

      expect(metrics.activeProductsCount).toBe(3);
      expect(metrics.unitsInStock).toBe(25 + 15 + 60); // 100 units
      expect(metrics.salesRevenuePaise).toBe(0);
      expect(metrics.lowStockItemsCount).toBe(0);

      expect(metrics.categoryDistribution.length).toBe(2);
      const accCat = metrics.categoryDistribution.find((c) => c.name === 'Accessories');
      expect(accCat?.units).toBe(85); // 25 + 60
    });

    it('detects duplicate SKUs within CSV and against existing database', () => {
      const inventory = new InventoryService(db);

      // Pre-existing product
      inventory.createProduct({
        sku: 'EXIST-01',
        name: 'Existing Product',
        purchaseCostPaise: 1000,
        sellingPricePaise: 2000,
      });

      const invalidCsv = [
        'SKU,Product Name,Selling Price',
        'DUP-01,Product One,500',
        'DUP-01,Duplicate SKU,600',
        'EXIST-01,Colliding with DB,700',
        ',Missing SKU,800',
        'VALID-01,Valid Product,900',
      ].join('\n');

      const preview = inventory.validateProductsFromCsv(invalidCsv);

      expect(preview.totalRows).toBe(5);
      expect(preview.validCount).toBe(2); // DUP-01 (first occurrence) and VALID-01
      expect(preview.errorCount).toBe(3);

      const dupRow = preview.rows.find((r) => r.rowNumber === 3);
      expect(dupRow?.isValid).toBe(false);
      expect(dupRow?.errors.some((e) => e.includes('Duplicate SKU in CSV'))).toBe(true);

      const existRow = preview.rows.find((r) => r.rowNumber === 4);
      expect(existRow?.isValid).toBe(false);
      expect(existRow?.errors.some((e) => e.includes('already exists in database'))).toBe(true);

      const emptySkuRow = preview.rows.find((r) => r.rowNumber === 5);
      expect(emptySkuRow?.isValid).toBe(false);
      expect(emptySkuRow?.errors.some((e) => e.includes('Missing SKU'))).toBe(true);
    });

    it('never silently discards invalid rows and returns clear error reports', () => {
      const inventory = new InventoryService(db);
      const badCsv = [
        'SKU,Product Name,Selling Price',
        'BAD-01,Bad Price,NOT_A_NUMBER',
        'BAD-02,,100',
      ].join('\n');

      const res = inventory.importProductsFromCsv(badCsv);
      expect(res.success).toBe(false);
      expect(res.importedCount).toBe(0);
      expect(res.errors.length).toBe(2);
      expect(res.errors[0].row).toBe(2);
      expect(res.errors[0].error).toMatch(/Invalid selling price/i);
      expect(res.errors[1].row).toBe(3);
      expect(res.errors[1].error).toMatch(/Missing Product Name/i);
    });
  });

  describe('Priority 3: Export and Download Functionality', () => {
    it('exports actual products to CSV with proper escaping and headers', () => {
      const inventory = new InventoryService(db);
      inventory.createProduct({
        sku: 'EXP-01',
        name: 'Item with, comma and "quotes"',
        categoryName: 'Gadgets',
        purchaseCostPaise: 45000,
        sellingPricePaise: 89900,
        initialStock: 30,
        minStockThreshold: 10,
        supplierName: 'Acme Wholesale',
      });

      const csv = inventory.exportProductsToCsv();

      expect(csv).toContain('SKU,Product Name,Category,Brand,Barcode,Unit,Purchase Cost,Selling Price,Current Stock,Min Stock Threshold,Safety Stock,Supplier,Supplier Lead Time Days,Status');
      expect(csv).toContain('EXP-01');
      // Verify proper quotation escaping
      expect(csv).toContain('"Item with, comma and ""quotes"""');
      expect(csv).toContain('450.00');
      expect(csv).toContain('899.00');
      expect(csv).toContain('30');
    });

    it('handles empty datasets cleanly by returning valid header row', () => {
      const inventory = new InventoryService(db);
      const csv = inventory.exportProductsToCsv();

      const lines = csv.split('\r\n').filter((l) => l.trim().length > 0);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('SKU,Product Name,Category');
    });
  });

  describe('Priority 4 & 5: Complete Sales, Stock Deductions & Persistence Workflow', () => {
    it('records sale, deducts stock, updates revenue, and persists across DB restart', async () => {
      const inventory = new InventoryService(db);
      const sales = new SalesService(db);
      const analytics = new AnalyticsService(db);

      // 1. Import 3 products
      const csv = [
        'SKU,Product Name,Category,Purchase Cost,Selling Price,Stock Quantity,Minimum Stock Threshold,Supplier',
        'PROD-1,Pro Headset,Audio,2000,4000,20,5,Apex Tech',
        'PROD-2,Ergo Mouse,Office,1000,2500,30,10,Apex Tech',
        'PROD-3,Desk Mat,Office,500,1200,50,15,Swift Office',
      ].join('\r\n');

      inventory.importProductsFromCsv(csv);
      const products = inventory.getProducts();
      const p1 = products.find((p) => p.sku === 'PROD-1')!;

      // 2. Record a sale for PROD-1 (quantity: 5 at ₹40.00 each = ₹200.00)
      const sale = sales.recordSale({
        paymentMethod: 'UPI',
        items: [{ productId: p1.id, quantity: 5, unitSellingPricePaise: 400000 }],
        discountPaise: 0,
      });

      expect(sale.finalAmountPaise).toBe(2000000); // ₹20,000

      // Verify stock was deducted from 20 to 15
      expect(inventory.getProductById(p1.id)!.currentStock).toBe(15);

      // Verify dashboard revenue and top products updated
      const metricsAfterSale = analytics.getDashboardMetrics(30);
      expect(metricsAfterSale.salesRevenuePaise).toBe(2000000);
      expect(metricsAfterSale.unitsInStock).toBe(15 + 30 + 50); // 95
      expect(metricsAfterSale.topSellingProducts.length).toBe(1);
      expect(metricsAfterSale.topSellingProducts[0].sku).toBe('PROD-1');
      expect(metricsAfterSale.topSellingProducts[0].unitsSold).toBe(5);

      // 3. Export product list and verify updated stock is exported
      const exportedCsv = inventory.exportProductsToCsv();
      expect(exportedCsv).toContain('PROD-1');
      expect(exportedCsv).toContain('15'); // Current stock is now 15, not 20

      // 4. Force synchronous save and close DB (simulating app quit)
      db.saveImmediate();
      db.close();

      // 5. Restart application: re-open DB from disk
      const restartedDb = new AppDatabase(testDbPath);
      await restartedDb.init();

      const restartedInventory = new InventoryService(restartedDb);
      const restartedSales = new SalesService(restartedDb);
      const restartedAnalytics = new AnalyticsService(restartedDb);

      // Verify products persisted
      const persistedProducts = restartedInventory.getProducts();
      expect(persistedProducts.length).toBe(3);
      const restartedP1 = persistedProducts.find((p) => p.sku === 'PROD-1')!;
      expect(restartedP1.currentStock).toBe(15);

      // Verify sales persisted
      const persistedSales = restartedSales.getSales();
      expect(persistedSales.length).toBe(1);
      expect(persistedSales[0].finalAmountPaise).toBe(2000000);

      // Verify dashboard persists
      const restartedMetrics = restartedAnalytics.getDashboardMetrics(30);
      expect(restartedMetrics.activeProductsCount).toBe(3);
      expect(restartedMetrics.salesRevenuePaise).toBe(2000000);
      expect(restartedMetrics.unitsInStock).toBe(95);

      restartedDb.close();
    });
  });
});

