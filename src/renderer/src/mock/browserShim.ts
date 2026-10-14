// Browser development fallback shim with realistic SQLite-like local persistence
// Ensures zero-hardcoded data for new stores and functional browser file operations
import {
  Product,
  Category,
  Supplier,
  Sale,
  DashboardMetrics,
  RestockItem,
  StockMovement,
  AiModelStatus,
  StockStatus,
  CsvValidationResult,
  CsvPreviewRow,
} from '../../../shared/types';

const STORAGE_KEY = 'sellerpilot_browser_store_v2';

interface BrowserStore {
  settings: {
    id: number;
    businessName: string;
    businessType: string;
    currency: 'INR';
    country: string;
    language: string;
    isOnboarded: boolean;
    demoMode: boolean;
    targetStockCoverageDays: number;
    warningThresholdDays: number;
    createdAt: string;
    updatedAt: string;
  };
  categories: Category[];
  suppliers: Supplier[];
  products: Product[];
  sales: Sale[];
  stockMovements: StockMovement[];
}

function getDefaultStore(): BrowserStore {
  const now = new Date().toISOString();
  return {
    settings: {
      id: 1,
      businessName: 'My Store',
      businessType: 'Retail',
      currency: 'INR',
      country: 'India',
      language: 'en',
      isOnboarded: false,
      demoMode: false,
      targetStockCoverageDays: 30,
      warningThresholdDays: 7,
      createdAt: now,
      updatedAt: now,
    },
    categories: [],
    suppliers: [],
    products: [],
    sales: [],
    stockMovements: [],
  };
}

function loadStore(): BrowserStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[SellerPilot] Error loading localStorage store:', err);
  }
  const defaultStore = getDefaultStore();
  saveStore(defaultStore);
  return defaultStore;
}

function saveStore(store: BrowserStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('[SellerPilot] Error saving localStorage store:', err);
  }
}

// RFC 4180 CSV parser
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((r) => r.length > 0 && r.some((c) => c.length > 0));
}

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function installBrowserShim() {
  if (typeof window !== 'undefined' && !window.sellerPilot) {
    console.log('[SellerPilot] Initializing browser runtime adapter with local SQLite-like storage');

    let store = loadStore();

    const computeStockStatus = (current: number, minThresh: number): StockStatus => {
      if (current <= 0) return 'OUT_OF_STOCK';
      if (current <= minThresh) return 'LOW_STOCK';
      return 'IN_STOCK';
    };

    const getDashboard = (periodDays: number = 30): DashboardMetrics => {
      const activeProducts = store.products.filter((p) => !p.isArchived);
      const activeCount = activeProducts.length;
      const totalUnits = activeProducts.reduce((acc, p) => acc + p.currentStock, 0);

      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      const periodStartMs = periodStart.getTime();

      const completedSales = store.sales.filter(
        (s) => s.status === 'completed' && new Date(s.saleDate).getTime() >= periodStartMs
      );

      const totalRevenue = completedSales.reduce((acc, s) => acc + s.finalAmountPaise, 0);
      const lowStockCount = activeProducts.filter(
        (p) => p.currentStock > 0 && p.currentStock <= p.minStockThreshold
      ).length;
      const outOfStockCount = activeProducts.filter((p) => p.currentStock <= 0).length;

      // Group sales by day
      const dailyMap = new Map<string, { revenuePaise: number; unitsSold: number }>();
      for (let i = periodDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dailyMap.set(key, { revenuePaise: 0, unitsSold: 0 });
      }

      for (const sale of completedSales) {
        const dayKey = sale.saleDate.slice(0, 10);
        if (dailyMap.has(dayKey)) {
          const entry = dailyMap.get(dayKey)!;
          entry.revenuePaise += sale.finalAmountPaise;
          entry.unitsSold += (sale.items || []).reduce((acc: number, it: any) => acc + it.quantity, 0);
        }
      }

      const salesOverview = Array.from(dailyMap.entries()).map(([dateStr, val]) => {
        const d = new Date(dateStr);
        return {
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenuePaise: val.revenuePaise,
          revenueFormatted: Math.round(val.revenuePaise / 100),
          unitsSold: val.unitsSold,
        };
      });

      // Categories distribution
      const catCountMap = new Map<number, number>();
      for (const p of activeProducts) {
        const cId = p.categoryId || 0;
        catCountMap.set(cId, (catCountMap.get(cId) || 0) + p.currentStock);
      }

      const categoryDistribution = Array.from(catCountMap.entries()).map(([cId, units]) => {
        const cat = store.categories.find((c) => c.id === cId);
        return {
          categoryId: cId,
          name: cat?.name || 'Uncategorized',
          units,
          percentage: totalUnits > 0 ? Math.round((units / totalUnits) * 100) : 0,
          color: cat?.color || '#3B82F6',
        };
      });

      // Top selling products
      const prodSalesMap = new Map<number, { unitsSold: number; revenuePaise: number }>();
      for (const sale of completedSales) {
        for (const item of sale.items || []) {
          const prev = prodSalesMap.get(item.productId) || { unitsSold: 0, revenuePaise: 0 };
          prev.unitsSold += item.quantity;
          prev.revenuePaise += item.totalAmountPaise;
          prodSalesMap.set(item.productId, prev);
        }
      }

      const topSellingProducts = Array.from(prodSalesMap.entries())
        .map(([pId, agg]) => {
          const p = store.products.find((prod) => prod.id === pId);
          if (!p) return null;
          return {
            productId: p.id,
            name: p.name,
            sku: p.sku,
            unitsSold: agg.unitsSold,
            revenuePaise: agg.revenuePaise,
            stock: p.currentStock,
            stockStatus: computeStockStatus(p.currentStock, p.minStockThreshold),
          };
        })
        .filter(Boolean)
        .sort((a, b) => b!.revenuePaise - a!.revenuePaise)
        .slice(0, 5) as DashboardMetrics['topSellingProducts'];

      // Restock attention
      const restockAttention: RestockItem[] = activeProducts
        .filter((p) => p.currentStock <= p.minStockThreshold)
        .map((p) => {
          const sold = prodSalesMap.get(p.id)?.unitsSold || 0;
          const avgDaily = Number((sold / Math.max(1, periodDays)).toFixed(2));
          const daysLeft = avgDaily > 0 ? Math.round(p.currentStock / avgDaily) : null;
          const reorderPt = Math.ceil(avgDaily * p.supplierLeadTimeDays + p.safetyStock);
          const suggested = Math.max(0, reorderPt - p.currentStock + 10);
          const priority = p.currentStock <= 0 ? 'CRITICAL' : p.currentStock <= p.minStockThreshold / 2 ? 'HIGH' : 'NORMAL';

          return {
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            categoryName: p.categoryName,
            currentStock: p.currentStock,
            avgDailySales: avgDaily,
            daysRemaining: daysLeft,
            supplierLeadTimeDays: p.supplierLeadTimeDays,
            safetyStock: p.safetyStock,
            reorderPoint: reorderPt,
            suggestedOrderQty: suggested,
            estimatedCostPaise: suggested * p.purchaseCostPaise,
            supplierId: p.supplierId,
            supplierName: p.supplierName,
            minOrderQty: 1,
            priority,
            reason: `${p.name}: Current stock is ${p.currentStock} units (safety threshold: ${p.minStockThreshold}).`,
            salesHistoryReliable: sold > 0,
          };
        });

      return {
        activeProductsCount: activeCount,
        activeProductsChangePct: 0,
        unitsInStock: totalUnits,
        unitsInStockChangePct: 0,
        salesRevenuePaise: totalRevenue,
        salesRevenueChangePct: 0,
        lowStockItemsCount: lowStockCount,
        lowStockItemsChangePct: 0,
        outOfStockCount,
        reorderRequiredCount: restockAttention.length,
        inventoryCostPaise: activeProducts.reduce((acc: number, p: Product) => acc + p.currentStock * p.purchaseCostPaise, 0),
        inventoryRetailPaise: activeProducts.reduce((acc: number, p: Product) => acc + p.currentStock * p.sellingPricePaise, 0),
        grossProfitPaise: completedSales.reduce((acc: number, s: Sale) => {
          const cost = (s.items || []).reduce((c: number, it: any) => c + it.quantity * it.unitCostPaise, 0);
          return acc + (s.finalAmountPaise - cost);
        }, 0),
        salesOverview,
        categoryDistribution,
        topSellingProducts,
        restockAttention,
      };
    };

    (window as any).sellerPilot = {
      // Settings
      getSettings: async () => store.settings,
      updateSettings: async (input: any) => {
        store.settings = { ...store.settings, ...input, updatedAt: new Date().toISOString() };
        saveStore(store);
        return store.settings;
      },

      // Categories
      getCategories: async () => store.categories,
      addCategory: async (name: string, color?: string) => {
        const c: Category = {
          id: Date.now(),
          name: name.trim(),
          color: color || '#3B82F6',
          createdAt: new Date().toISOString(),
        };
        store.categories.push(c);
        saveStore(store);
        return c;
      },

      // Products
      getProducts: async (options?: any) => {
        let prods = [...store.products];
        if (!options?.includeArchived) {
          prods = prods.filter((p) => !p.isArchived);
        }
        if (options?.categoryId) {
          prods = prods.filter((p) => p.categoryId === options.categoryId);
        }
        if (options?.search) {
          const q = options.search.toLowerCase();
          prods = prods.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              (p.brand && p.brand.toLowerCase().includes(q))
          );
        }
        return prods.map((p) => ({
          ...p,
          stockStatus: computeStockStatus(p.currentStock, p.minStockThreshold),
          estimatedCostValuePaise: p.currentStock * p.purchaseCostPaise,
          estimatedRetailValuePaise: p.currentStock * p.sellingPricePaise,
        }));
      },

      getProductById: async (id: number) => {
        const p = store.products.find((prod) => prod.id === id);
        return p || null;
      },

      createProduct: async (input: any) => {
        const sku = (input.sku || '').trim().toUpperCase();
        if (store.products.some((p) => p.sku.toUpperCase() === sku)) {
          throw new Error(`Product with SKU "${sku}" already exists`);
        }
        const now = new Date().toISOString();
        const cat = store.categories.find((c) => c.id === input.categoryId);
        const sup = store.suppliers.find((s) => s.id === input.supplierId);

        const newProd: Product = {
          id: Date.now(),
          sku,
          name: input.name.trim(),
          categoryId: input.categoryId,
          categoryName: cat?.name,
          categoryColor: cat?.color,
          brand: input.brand,
          barcode: input.barcode,
          unit: input.unit || 'pcs',
          purchaseCostPaise: input.purchaseCostPaise || 0,
          sellingPricePaise: input.sellingPricePaise || 0,
          currentStock: Number(input.initialStock || 0),
          minStockThreshold: Number(input.minStockThreshold ?? 5),
          safetyStock: Number(input.safetyStock ?? 5),
          supplierId: input.supplierId,
          supplierName: sup?.name,
          supplierLeadTimeDays: Number(input.supplierLeadTimeDays ?? 7),
          description: input.description,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
          stockStatus: computeStockStatus(Number(input.initialStock || 0), Number(input.minStockThreshold ?? 5)),
        };

        store.products.push(newProd);

        if (newProd.currentStock > 0) {
          store.stockMovements.push({
            id: Date.now(),
            productId: newProd.id,
            productName: newProd.name,
            sku: newProd.sku,
            movementType: 'OPENING_STOCK',
            quantity: newProd.currentStock,
            reference: 'INIT',
            notes: 'Opening stock',
            timestamp: now,
          });
        }

        saveStore(store);
        return newProd;
      },

      updateProduct: async (id: number, input: any) => {
        const idx = store.products.findIndex((p) => p.id === id);
        if (idx === -1) throw new Error(`Product with ID ${id} not found`);

        if (input.sku) {
          const sku = input.sku.trim().toUpperCase();
          if (store.products.some((p) => p.id !== id && p.sku.toUpperCase() === sku)) {
            throw new Error(`SKU "${sku}" is already in use by another product`);
          }
        }

        const cat = input.categoryId ? store.categories.find((c) => c.id === input.categoryId) : undefined;
        const sup = input.supplierId ? store.suppliers.find((s) => s.id === input.supplierId) : undefined;

        store.products[idx] = {
          ...store.products[idx],
          ...input,
          categoryName: cat ? cat.name : store.products[idx].categoryName,
          categoryColor: cat ? cat.color : store.products[idx].categoryColor,
          supplierName: sup ? sup.name : store.products[idx].supplierName,
          updatedAt: new Date().toISOString(),
        };

        saveStore(store);
        return store.products[idx];
      },

      archiveProduct: async (id: number, archive: boolean) => {
        const prod = store.products.find((p) => p.id === id);
        if (prod) {
          prod.isArchived = archive;
          saveStore(store);
        }
        return true;
      },

      adjustStock: async ({ productId, quantityDelta, movementType, reference, notes }: any) => {
        const prod = store.products.find((p) => p.id === productId);
        if (!prod) throw new Error('Product not found');

        prod.currentStock = Math.max(0, prod.currentStock + quantityDelta);
        prod.updatedAt = new Date().toISOString();

        store.stockMovements.push({
          id: Date.now(),
          productId,
          productName: prod.name,
          sku: prod.sku,
          movementType: movementType || 'MANUAL_ADJUSTMENT',
          quantity: quantityDelta,
          reference,
          notes,
          timestamp: new Date().toISOString(),
        });

        saveStore(store);
        return prod;
      },

      getStockMovements: async (options?: any) => {
        let moves = [...store.stockMovements];
        if (options?.productId) {
          moves = moves.filter((m) => m.productId === options.productId);
        }
        if (options?.movementType) {
          moves = moves.filter((m) => m.movementType === options.movementType);
        }
        return moves.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      // CSV Validation and Import
      validateProductsCsv: async (csvText: string): Promise<CsvValidationResult> => {
        const rawRows = parseCsv(csvText);
        if (rawRows.length < 2) {
          return {
            totalRows: 0,
            validCount: 0,
            errorCount: 1,
            headersFound: [],
            rows: [
              {
                rowNumber: 1,
                sku: '',
                name: '',
                purchaseCostPaise: 0,
                sellingPricePaise: 0,
                currentStock: 0,
                minStockThreshold: 5,
                isValid: false,
                errors: ['CSV file contains no data rows. Expected header + data rows.'],
              },
            ],
          };
        }

        const headers = rawRows[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));
        const headersFound = rawRows[0].map((h) => h.trim());

        const findIndex = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));

        const skuIdx = findIndex(['sku', 'productsku', 'itemsku', 'code']);
        const nameIdx = findIndex(['name', 'productname', 'itemname', 'title', 'product']);
        const priceIdx = findIndex(['sellingprice', 'price', 'retailprice', 'mrp', 'unitprice']);
        const costIdx = findIndex(['purchasecost', 'cost', 'costprice', 'buyprice']);
        const stockIdx = findIndex(['stock', 'currentstock', 'stockquantity', 'quantity', 'qty', 'units']);
        const thresholdIdx = findIndex(['minimumstockthreshold', 'minstockthreshold', 'minstock', 'minthreshold', 'minimumthreshold', 'reorderpoint', 'threshold', 'minimumstock', 'safetystock']);
        const catIdx = findIndex(['category', 'categoryname', 'department']);
        const supIdx = findIndex(['supplier', 'suppliername', 'vendor']);
        const brandIdx = findIndex(['brand', 'manufacturer']);
        const unitIdx = findIndex(['unit', 'uom']);

        const missing: string[] = [];
        if (skuIdx === -1) missing.push('SKU');
        if (nameIdx === -1) missing.push('Product Name');
        if (priceIdx === -1) missing.push('Selling Price');

        if (missing.length > 0) {
          return {
            totalRows: rawRows.length - 1,
            validCount: 0,
            errorCount: rawRows.length - 1,
            headersFound,
            rows: [
              {
                rowNumber: 1,
                sku: '',
                name: '',
                purchaseCostPaise: 0,
                sellingPricePaise: 0,
                currentStock: 0,
                minStockThreshold: 5,
                isValid: false,
                errors: [`Missing required columns: ${missing.join(', ')}`],
              },
            ],
          };
        }

        const previewRows: CsvPreviewRow[] = [];
        const seenSkusInFile = new Set<string>();

        for (let i = 1; i < rawRows.length; i++) {
          const rowNum = i + 1;
          const cols = rawRows[i];
          const errors: string[] = [];

          const rawSku = (cols[skuIdx] || '').trim();
          const sku = rawSku.toUpperCase();
          const name = (cols[nameIdx] || '').trim();

          if (!sku) {
            errors.push('Missing SKU');
          } else if (seenSkusInFile.has(sku)) {
            errors.push(`Duplicate SKU in CSV: "${sku}"`);
          } else {
            seenSkusInFile.add(sku);
            if (store.products.some((p) => p.sku.toUpperCase() === sku)) {
              errors.push(`SKU "${sku}" already exists in store`);
            }
          }

          if (!name) {
            errors.push('Missing Product Name');
          }

          const rawPrice = cols[priceIdx];
          const price = parseFloat(rawPrice || '');
          if (isNaN(price) || price < 0) {
            errors.push(`Invalid selling price: "${rawPrice || ''}"`);
          }

          let cost = 0;
          if (costIdx !== -1 && cols[costIdx]?.trim()) {
            cost = parseFloat(cols[costIdx]);
            if (isNaN(cost) || cost < 0) errors.push(`Invalid purchase cost: "${cols[costIdx]}"`);
          }

          let stock = 0;
          if (stockIdx !== -1 && cols[stockIdx]?.trim()) {
            stock = parseFloat(cols[stockIdx]);
            if (isNaN(stock) || stock < 0) errors.push(`Invalid stock quantity: "${cols[stockIdx]}"`);
          }

          let minThresh = 5;
          if (thresholdIdx !== -1 && cols[thresholdIdx]?.trim()) {
            minThresh = parseFloat(cols[thresholdIdx]);
            if (isNaN(minThresh) || minThresh < 0) errors.push(`Invalid min threshold: "${cols[thresholdIdx]}"`);
          }

          previewRows.push({
            rowNumber: rowNum,
            sku: rawSku,
            name,
            category: catIdx !== -1 ? cols[catIdx]?.trim() : undefined,
            brand: brandIdx !== -1 ? cols[brandIdx]?.trim() : undefined,
            unit: unitIdx !== -1 && cols[unitIdx]?.trim() ? cols[unitIdx].trim() : 'pcs',
            purchaseCostPaise: Math.round((isNaN(cost) ? 0 : cost) * 100),
            sellingPricePaise: Math.round((isNaN(price) ? 0 : price) * 100),
            currentStock: isNaN(stock) ? 0 : stock,
            minStockThreshold: isNaN(minThresh) ? 5 : minThresh,
            supplier: supIdx !== -1 ? cols[supIdx]?.trim() : undefined,
            isValid: errors.length === 0,
            errors,
          });
        }

        return {
          totalRows: previewRows.length,
          validCount: previewRows.filter((r) => r.isValid).length,
          errorCount: previewRows.filter((r) => !r.isValid).length,
          rows: previewRows,
          headersFound,
        };
      },

      importProductsCsv: async (csvText: string) => {
        const valRes = await (window as any).sellerPilot.validateProductsCsv(csvText);
        const validRows = valRes.rows.filter((r: CsvPreviewRow) => r.isValid);

        if (validRows.length === 0) {
          return {
            success: false,
            importedCount: 0,
            errors: valRes.rows.filter((r: CsvPreviewRow) => !r.isValid).map((r: CsvPreviewRow) => ({ row: r.rowNumber, error: r.errors.join('; ') })),
          };
        }

        const now = new Date().toISOString();
        for (const row of validRows) {
          let cat = store.categories.find((c) => c.name.toLowerCase() === (row.category || '').toLowerCase());
          if (!cat && row.category) {
            cat = { id: Date.now() + Math.floor(Math.random() * 1000), name: row.category, color: '#3B82F6', createdAt: now };
            store.categories.push(cat);
          }

          let sup = store.suppliers.find((s) => s.name.toLowerCase() === (row.supplier || '').toLowerCase());
          if (!sup && row.supplier) {
            sup = {
              id: Date.now() + Math.floor(Math.random() * 1000),
              name: row.supplier,
              leadTimeDays: 7,
              minOrderQty: 1,
              createdAt: now,
              updatedAt: now,
            };
            store.suppliers.push(sup);
          }

          const newProd: Product = {
            id: Date.now() + Math.floor(Math.random() * 100000),
            sku: row.sku.trim().toUpperCase(),
            name: row.name.trim(),
            categoryId: cat?.id,
            categoryName: cat?.name,
            categoryColor: cat?.color,
            brand: row.brand,
            unit: row.unit || 'pcs',
            purchaseCostPaise: row.purchaseCostPaise,
            sellingPricePaise: row.sellingPricePaise,
            currentStock: row.currentStock,
            minStockThreshold: row.minStockThreshold,
            safetyStock: row.minStockThreshold,
            supplierId: sup?.id,
            supplierName: sup?.name,
            supplierLeadTimeDays: 7,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
            stockStatus: computeStockStatus(row.currentStock, row.minStockThreshold),
          };

          store.products.push(newProd);

          if (row.currentStock > 0) {
            store.stockMovements.push({
              id: Date.now() + Math.floor(Math.random() * 100000),
              productId: newProd.id,
              productName: newProd.name,
              sku: newProd.sku,
              movementType: 'OPENING_STOCK',
              quantity: row.currentStock,
              reference: 'CSV_IMPORT',
              notes: 'CSV batch import',
              timestamp: now,
            });
          }
        }

        saveStore(store);

        return {
          success: true,
          importedCount: validRows.length,
          errors: valRes.rows.filter((r: CsvPreviewRow) => !r.isValid).map((r: CsvPreviewRow) => ({ row: r.rowNumber, error: r.errors.join('; ') })),
        };
      },

      exportProductsCsv: async () => {
        const header = [
          'SKU',
          'Product Name',
          'Category',
          'Brand',
          'Unit',
          'Purchase Cost',
          'Selling Price',
          'Current Stock',
          'Min Stock Threshold',
          'Supplier',
          'Status',
        ];

        const rows = store.products.map((p) =>
          [
            escapeCsvField(p.sku),
            escapeCsvField(p.name),
            escapeCsvField(p.categoryName || ''),
            escapeCsvField(p.brand || ''),
            escapeCsvField(p.unit),
            (p.purchaseCostPaise / 100).toFixed(2),
            (p.sellingPricePaise / 100).toFixed(2),
            p.currentStock,
            p.minStockThreshold,
            escapeCsvField(p.supplierName || ''),
            p.isArchived ? 'Archived' : computeStockStatus(p.currentStock, p.minStockThreshold),
          ].join(',')
        );

        return [header.join(','), ...rows].join('\r\n');
      },

      // Sales
      getSales: async () => store.sales,
      getSaleById: async (id: number) => store.sales.find((s) => s.id === id) || null,

      recordSale: async (input: any) => {
        const now = new Date().toISOString();
        const saleId = Date.now();
        const saleRef = `INV-${new Date().getFullYear()}-${String(store.sales.length + 1).padStart(4, '0')}`;

        let subtotalPaise = 0;
        const lineItems = input.items.map((it: any, idx: number) => {
          const prod = store.products.find((p) => p.id === it.productId);
          if (!prod) throw new Error(`Product ID ${it.productId} not found`);

          if (!input.allowNegativeStockOverride && prod.currentStock < it.quantity) {
            throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.currentStock}, Requested: ${it.quantity}`);
          }

          // Deduct stock
          prod.currentStock -= it.quantity;
          prod.updatedAt = now;

          // Log movement
          store.stockMovements.push({
            id: Date.now() + idx,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            movementType: 'SALE',
            quantity: -it.quantity,
            reference: saleRef,
            notes: `Sale ${saleRef}`,
            timestamp: now,
          });

          const total = it.quantity * it.unitSellingPricePaise - (it.discountPaise || 0);
          subtotalPaise += total;

          return {
            id: Date.now() + idx + 100,
            saleId,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            quantity: it.quantity,
            unitSellingPricePaise: it.unitSellingPricePaise,
            unitCostPaise: prod.purchaseCostPaise,
            discountPaise: it.discountPaise || 0,
            totalAmountPaise: total,
          };
        });

        const overallDiscount = input.discountPaise || 0;
        const finalAmount = Math.max(0, subtotalPaise - overallDiscount);

        const newSale: Sale = {
          id: saleId,
          saleReference: saleRef,
          saleDate: input.saleDate || now,
          totalAmountPaise: subtotalPaise,
          discountPaise: overallDiscount,
          finalAmountPaise: finalAmount,
          paymentMethod: input.paymentMethod || 'CASH',
          notes: input.notes,
          status: 'completed',
          items: lineItems,
          itemCount: lineItems.length,
          createdAt: now,
        };

        store.sales.push(newSale);
        saveStore(store);

        return newSale;
      },

      cancelSale: async (saleId: number, reason: string) => {
        const sale = store.sales.find((s) => s.id === saleId);
        if (!sale) throw new Error('Sale not found');
        if (sale.status === 'cancelled') throw new Error('Sale is already cancelled');

        const now = new Date().toISOString();
        sale.status = 'cancelled';
        sale.cancelledAt = now;
        sale.cancellationReason = reason;

        // Restore stock
        for (const it of sale.items || []) {
          const prod = store.products.find((p) => p.id === it.productId);
          if (prod) {
            prod.currentStock += it.quantity;
            prod.updatedAt = now;

            store.stockMovements.push({
              id: Date.now() + Math.floor(Math.random() * 1000),
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              movementType: 'CUSTOMER_RETURN',
              quantity: it.quantity,
              reference: sale.saleReference,
              notes: `Sale cancellation: ${reason}`,
              timestamp: now,
            });
          }
        }

        saveStore(store);
        return sale;
      },

      exportSalesCsv: async () => {
        const header = ['Sale Reference', 'Date', 'Payment Method', 'Status', 'Discount', 'Total Amount'];
        const rows = store.sales.map((s) =>
          [
            escapeCsvField(s.saleReference),
            escapeCsvField(s.saleDate),
            escapeCsvField(s.paymentMethod),
            escapeCsvField(s.status),
            (s.discountPaise / 100).toFixed(2),
            (s.finalAmountPaise / 100).toFixed(2),
          ].join(',')
        );
        return [header.join(','), ...rows].join('\r\n');
      },

      // Analytics & Dashboard
      getDashboardMetrics: async (periodDays: number) => getDashboard(periodDays),

      getSalesAnalytics: async (periodDays: number) => {
        const d = getDashboard(periodDays);
        return {
          totalRevenuePaise: d.salesRevenuePaise,
          totalCostPaise: d.inventoryCostPaise,
          grossProfitPaise: d.grossProfitPaise,
          profitMarginPct: d.salesRevenuePaise > 0 ? Math.round((d.grossProfitPaise / d.salesRevenuePaise) * 1000) / 10 : 0,
          totalUnitsSold: d.salesOverview.reduce((acc: number, it: any) => acc + it.unitsSold, 0),
          totalTransactions: store.sales.filter((s) => s.status === 'completed').length,
          avgOrderValuePaise:
            store.sales.filter((s) => s.status === 'completed').length > 0
              ? Math.round(d.salesRevenuePaise / store.sales.filter((s) => s.status === 'completed').length)
              : 0,
          topByUnits: d.topSellingProducts.map((p: any) => ({
            productId: p.productId,
            name: p.name,
            sku: p.sku,
            unitsSold: p.unitsSold,
            revenuePaise: p.revenuePaise,
          })),
          topByRevenue: d.topSellingProducts.map((p: any) => ({
            productId: p.productId,
            name: p.name,
            sku: p.sku,
            revenuePaise: p.revenuePaise,
            unitsSold: p.unitsSold,
          })),
          slowMoving: [],
          categoryPerformance: [],
          revenueTrend: [],
        };
      },

      // Restock
      getRestockRecommendations: async (options?: any) => getDashboard(options?.historicalDaysWindow || 30).restockAttention,
      exportRestockCsv: async () => 'SKU,Product,Current Stock,Suggested Qty,Priority\r\n',

      // Suppliers
      getSuppliers: async () => store.suppliers,
      getSupplierById: async (id: number) => {
        const s = store.suppliers.find((sup) => sup.id === id);
        return s ? { ...s, products: store.products.filter((p) => p.supplierId === id) } : null;
      },
      createSupplier: async (input: any) => {
        const s: Supplier = {
          ...input,
          id: Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        store.suppliers.push(s);
        saveStore(store);
        return s;
      },
      updateSupplier: async (id: number, input: any) => {
        const idx = store.suppliers.findIndex((s) => s.id === id);
        if (idx !== -1) {
          store.suppliers[idx] = { ...store.suppliers[idx], ...input, updatedAt: new Date().toISOString() };
          saveStore(store);
          return store.suppliers[idx];
        }
        return null;
      },

      // AI status
      checkAiHealth: async (): Promise<AiModelStatus> => ({
        available: false,
        endpoint: 'http://127.0.0.1:11434',
        selectedModel: 'gemma:2b',
        installedModels: [],
        isModelReady: false,
        lastChecked: new Date().toISOString(),
        error: 'Ollama is offline. Operating in local heuristic mode.',
      }),

      generateAiListing: async (input: any) => ({
        title: `${input.brand ? input.brand + ' ' : ''}${input.productName}`,
        shortDescription: `Quality ${input.productName} for everyday commercial and personal use.`,
        detailedDescription: `${input.productName} designed to meet durability and performance standards.`,
        keyFeatures: ['Standard build', 'Easy setup', 'Reliable performance'],
        searchKeywords: [input.productName.toLowerCase(), 'retail', 'quality'],
        promotionalCaption: `Discover our new ${input.productName}! Available now.`,
      }),

      getAiInsights: async (question: string) => {
        const d = getDashboard(30);
        return {
          queryType: 'STORE_ANALYSIS',
          userQuestion: question,
          calculatedData: {
            revenue: `₹${(d.salesRevenuePaise / 100).toLocaleString('en-IN')}`,
            grossProfit: `₹${(d.grossProfitPaise / 100).toLocaleString('en-IN')}`,
            activeProducts: d.activeProductsCount,
            unitsInStock: d.unitsInStock,
          },
          naturalLanguageAnswer: `Your store currently has ${d.activeProductsCount} active products with ${d.unitsInStock} total units in stock. Recorded sales revenue is ₹${(d.salesRevenuePaise / 100).toLocaleString('en-IN')}.`,
          recommendations: d.activeProductsCount === 0 ? ['Start by adding products or importing your product catalog via CSV.'] : ['Keep inventory levels updated and record daily sales.'],
          isAiGenerated: false,
          generatedAt: new Date().toISOString(),
        };
      },

      setAiConfig: async () => ({
        available: false,
        endpoint: 'http://127.0.0.1:11434',
        selectedModel: 'gemma:2b',
        installedModels: [],
        isModelReady: false,
        lastChecked: new Date().toISOString(),
      }),

      // Demo Data Seeding
      seedDemoData: async () => {
        const now = new Date().toISOString();
        store.settings.demoMode = true;
        store.settings.isOnboarded = true;

        store.categories = [
          { id: 1, name: 'Electronics', color: '#3B82F6', createdAt: now },
          { id: 2, name: 'Accessories', color: '#10B981', createdAt: now },
          { id: 3, name: 'Home', color: '#F59E0B', createdAt: now },
        ];

        store.suppliers = [
          { id: 1, name: 'Apex Electronics Wholesale', leadTimeDays: 5, minOrderQty: 10, createdAt: now, updatedAt: now },
          { id: 2, name: 'Swift Cables & Power', leadTimeDays: 3, minOrderQty: 25, createdAt: now, updatedAt: now },
        ];

        store.products = [
          {
            id: 1,
            sku: 'WM-001',
            name: 'Wireless Mouse',
            categoryId: 2,
            categoryName: 'Accessories',
            categoryColor: '#10B981',
            brand: 'LogiTech Pro',
            unit: 'pcs',
            purchaseCostPaise: 32000,
            sellingPricePaise: 59900,
            currentStock: 25,
            minStockThreshold: 15,
            safetyStock: 8,
            supplierId: 1,
            supplierName: 'Apex Electronics Wholesale',
            supplierLeadTimeDays: 5,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 2,
            sku: 'USC-002',
            name: 'USB-C Fast Cable',
            categoryId: 2,
            categoryName: 'Accessories',
            categoryColor: '#10B981',
            brand: 'Anker Power',
            unit: 'pcs',
            purchaseCostPaise: 8000,
            sellingPricePaise: 19900,
            currentStock: 8,
            minStockThreshold: 20,
            safetyStock: 10,
            supplierId: 2,
            supplierName: 'Swift Cables & Power',
            supplierLeadTimeDays: 3,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 3,
            sku: 'MK-003',
            name: 'Mechanical Keyboard RGB',
            categoryId: 1,
            categoryName: 'Electronics',
            categoryColor: '#3B82F6',
            brand: 'Keychron Key',
            unit: 'pcs',
            purchaseCostPaise: 180000,
            sellingPricePaise: 299900,
            currentStock: 12,
            minStockThreshold: 5,
            safetyStock: 4,
            supplierId: 1,
            supplierName: 'Apex Electronics Wholesale',
            supplierLeadTimeDays: 5,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          },
        ];

        store.sales = [
          {
            id: 1,
            saleReference: 'INV-2026-0001',
            saleDate: now,
            totalAmountPaise: 59900,
            discountPaise: 0,
            finalAmountPaise: 59900,
            paymentMethod: 'UPI',
            status: 'completed',
            items: [
              {
                id: 1,
                saleId: 1,
                productId: 1,
                productName: 'Wireless Mouse',
                sku: 'WM-001',
                quantity: 1,
                unitSellingPricePaise: 59900,
                unitCostPaise: 32000,
                totalAmountPaise: 59900,
              },
            ],
            createdAt: now,
          },
        ];

        saveStore(store);
        return true;
      },

      resetDemoData: async () => {
        store = getDefaultStore();
        saveStore(store);
        return true;
      },

      // Backup & DB
      createBackup: async () => ({ filename: 'sellerpilot_backup.json', filePath: 'downloads', size: 1024 }),
      restoreBackup: async () => true,
      getBackupHistory: async () => [],
      getDbInfo: async () => ({ dbPath: 'localStorage:sellerpilot', sizeBytes: 4096, integrityOk: true }),

      // File dialogs with real browser file picker and downloader
      openFileDialog: async () => {
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.csv,text/csv,text/plain';
          input.style.display = 'none';

          input.onchange = (e: any) => {
            const file = e.target?.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = (re) => {
              const content = (re.target?.result as string) || '';
              resolve({ filePath: file.name, content });
              document.body.removeChild(input);
            };
            reader.onerror = () => {
              resolve(null);
              document.body.removeChild(input);
            };
            reader.readAsText(file);
          };

          input.oncancel = () => {
            resolve(null);
            document.body.removeChild(input);
          };

          document.body.appendChild(input);
          input.click();
        });
      },

      saveFileDialog: async ({ defaultName, content }: { defaultName: string; content: string }) => {
        try {
          const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', defaultName || 'sellerpilot_products.csv');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          return defaultName;
        } catch (err: any) {
          throw new Error(`Failed to save file: ${err.message}`);
        }
      },

      selectDirectoryDialog: async () => 'Downloads',
    };
  }
}
