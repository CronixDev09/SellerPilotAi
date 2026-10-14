import { AppDatabase } from '../db/database';
import { Product, Category, StockMovement, MovementType, StockStatus, CsvPreviewRow, CsvValidationResult } from '../../shared/types';

export class InventoryService {
  constructor(private db: AppDatabase) {}

  public getCategories(): Category[] {
    const rows = this.db.all<any>(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_archived = 0
      GROUP BY c.id
      ORDER BY c.name ASC;
    `);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color || '#3B82F6',
      createdAt: r.created_at,
      productCount: r.product_count || 0,
    }));
  }

  public addCategory(name: string, color?: string): Category {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name cannot be empty');
    const existing = this.db.get('SELECT id FROM categories WHERE name = ? COLLATE NOCASE;', [trimmed]);
    if (existing) throw new Error(`Category "${trimmed}" already exists`);

    const now = new Date().toISOString();
    const result = this.db.run(
      'INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?);',
      [trimmed, color || '#3B82F6', now]
    );
    return {
      id: result.lastInsertRowid,
      name: trimmed,
      color: color || '#3B82F6',
      createdAt: now,
      productCount: 0,
    };
  }

  public getProducts(options?: {
    search?: string;
    categoryId?: number;
    stockStatus?: StockStatus;
    includeArchived?: boolean;
    sortBy?: 'name' | 'sku' | 'current_stock' | 'selling_price' | 'created_at';
    sortOrder?: 'asc' | 'desc';
  }): Product[] {
    let query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.color as category_color,
        s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!options?.includeArchived) {
      query += ' AND p.is_archived = 0';
    }

    if (options?.categoryId) {
      query += ' AND p.category_id = ?';
      params.push(options.categoryId);
    }

    if (options?.search) {
      const term = `%${options.search.trim()}%`;
      query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)';
      params.push(term, term, term, term);
    }

    const sortCol = options?.sortBy === 'sku' ? 'p.sku'
      : options?.sortBy === 'current_stock' ? 'p.current_stock'
      : options?.sortBy === 'selling_price' ? 'p.selling_price_paise'
      : options?.sortBy === 'created_at' ? 'p.created_at'
      : 'p.name';
    const sortDir = options?.sortOrder === 'desc' ? 'DESC' : 'ASC';

    query += ` ORDER BY ${sortCol} ${sortDir};`;

    const rows = this.db.all<any>(query, params);

    return rows.map(r => {
      const currentStock = Number(r.current_stock);
      const minStockThreshold = Number(r.min_stock_threshold);
      let stockStatus: StockStatus = 'IN_STOCK';
      if (currentStock <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (currentStock <= minStockThreshold) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        id: r.id,
        sku: r.sku,
        name: r.name,
        categoryId: r.category_id,
        categoryName: r.category_name,
        categoryColor: r.category_color,
        description: r.description,
        brand: r.brand,
        barcode: r.barcode,
        unit: r.unit || 'pcs',
        purchaseCostPaise: r.purchase_cost_paise,
        sellingPricePaise: r.selling_price_paise,
        currentStock,
        minStockThreshold,
        safetyStock: Number(r.safety_stock),
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        supplierLeadTimeDays: Number(r.supplier_lead_time_days || 7),
        isArchived: Boolean(r.is_archived),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        stockStatus,
        estimatedCostValuePaise: Math.round(currentStock * r.purchase_cost_paise),
        estimatedRetailValuePaise: Math.round(currentStock * r.selling_price_paise),
      };
    }).filter(p => {
      if (options?.stockStatus && p.stockStatus !== options.stockStatus) {
        return false;
      }
      return true;
    });
  }

  public getProductById(id: number): Product | null {
    const products = this.getProducts({ includeArchived: true });
    return products.find(p => p.id === id) || null;
  }

  public createProduct(input: {
    sku: string;
    name: string;
    categoryId?: number;
    description?: string;
    brand?: string;
    barcode?: string;
    unit?: string;
    purchaseCostPaise: number;
    sellingPricePaise: number;
    initialStock?: number;
    minStockThreshold?: number;
    safetyStock?: number;
    supplierId?: number;
    supplierLeadTimeDays?: number;
  }): Product {
    const sku = input.sku.trim().toUpperCase();
    const name = input.name.trim();

    if (!sku) throw new Error('Product SKU is required');
    if (!name) throw new Error('Product name is required');
    if (input.purchaseCostPaise < 0) throw new Error('Purchase cost cannot be negative');
    if (input.sellingPricePaise < 0) throw new Error('Selling price cannot be negative');

    const existingSku = this.db.get('SELECT id FROM products WHERE sku = ? COLLATE NOCASE;', [sku]);
    if (existingSku) {
      throw new Error(`Product with SKU "${sku}" already exists`);
    }

    const initialStock = Number(input.initialStock || 0);
    if (initialStock < 0) throw new Error('Initial stock cannot be negative');

    const now = new Date().toISOString();

    return this.db.transaction(() => {
      const res = this.db.run(
        `INSERT INTO products (
          sku, name, category_id, description, brand, barcode, unit,
          purchase_cost_paise, selling_price_paise, current_stock,
          min_stock_threshold, safety_stock, supplier_id,
          supplier_lead_time_days, is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
        [
          sku,
          name,
          input.categoryId || null,
          input.description || null,
          input.brand || null,
          input.barcode || null,
          input.unit || 'pcs',
          input.purchaseCostPaise,
          input.sellingPricePaise,
          initialStock,
          input.minStockThreshold ?? 5,
          input.safetyStock ?? 5,
          input.supplierId || null,
          input.supplierLeadTimeDays ?? 7,
          now,
          now,
        ]
      );

      const productId = res.lastInsertRowid;

      if (initialStock > 0) {
        this.db.run(
          'INSERT INTO stock_movements (product_id, movement_type, quantity, reference, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?);',
          [productId, 'OPENING_STOCK', initialStock, 'INIT', 'Initial opening stock', now]
        );
      }

      return this.getProductById(productId)!;
    });
  }

  public updateProduct(id: number, input: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>): Product {
    const existing = this.getProductById(id);
    if (!existing) throw new Error(`Product with ID ${id} not found`);

    if (input.sku) {
      const sku = input.sku.trim().toUpperCase();
      const duplicate = this.db.get('SELECT id FROM products WHERE sku = ? COLLATE NOCASE AND id != ?;', [sku, id]);
      if (duplicate) throw new Error(`SKU "${sku}" is already in use by another product`);
    }

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE products SET
        sku = COALESCE(?, sku),
        name = COALESCE(?, name),
        category_id = ?,
        description = COALESCE(?, description),
        brand = COALESCE(?, brand),
        barcode = COALESCE(?, barcode),
        unit = COALESCE(?, unit),
        purchase_cost_paise = COALESCE(?, purchase_cost_paise),
        selling_price_paise = COALESCE(?, selling_price_paise),
        min_stock_threshold = COALESCE(?, min_stock_threshold),
        safety_stock = COALESCE(?, safety_stock),
        supplier_id = ?,
        supplier_lead_time_days = COALESCE(?, supplier_lead_time_days),
        updated_at = ?
      WHERE id = ?;`,
      [
        input.sku?.trim().toUpperCase(),
        input.name?.trim(),
        input.categoryId !== undefined ? input.categoryId : existing.categoryId,
        input.description,
        input.brand,
        input.barcode,
        input.unit,
        input.purchaseCostPaise,
        input.sellingPricePaise,
        input.minStockThreshold,
        input.safetyStock,
        input.supplierId !== undefined ? input.supplierId : existing.supplierId,
        input.supplierLeadTimeDays,
        now,
        id,
      ]
    );

    return this.getProductById(id)!;
  }

  public archiveProduct(id: number, archive: boolean = true): void {
    const now = new Date().toISOString();
    this.db.run('UPDATE products SET is_archived = ?, updated_at = ? WHERE id = ?;', [archive ? 1 : 0, now, id]);
  }

  public adjustStock(
    productId: number,
    quantityDelta: number,
    movementType: MovementType,
    reference?: string,
    notes?: string
  ): Product {
    if (quantityDelta === 0) throw new Error('Stock adjustment quantity cannot be zero');

    return this.db.transaction(() => {
      const product = this.getProductById(productId);
      if (!product) throw new Error(`Product with ID ${productId} not found`);

      const newStock = product.currentStock + quantityDelta;
      if (newStock < 0) {
        throw new Error(`Insufficient stock. Current: ${product.currentStock}, Requested delta: ${quantityDelta}`);
      }

      const now = new Date().toISOString();
      this.db.run('UPDATE products SET current_stock = ?, updated_at = ? WHERE id = ?;', [newStock, now, productId]);

      this.db.run(
        'INSERT INTO stock_movements (product_id, movement_type, quantity, reference, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?);',
        [productId, movementType, quantityDelta, reference || null, notes || null, now]
      );

      return this.getProductById(productId)!;
    });
  }

  public getStockMovements(options?: {
    productId?: number;
    movementType?: MovementType;
    limit?: number;
  }): StockMovement[] {
    let query = `
      SELECT sm.*, p.name as product_name, p.sku
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options?.productId) {
      query += ' AND sm.product_id = ?';
      params.push(options.productId);
    }

    if (options?.movementType) {
      query += ' AND sm.movement_type = ?';
      params.push(options.movementType);
    }

    query += ' ORDER BY sm.timestamp DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.all<any>(query, params);
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      movementType: r.movement_type as MovementType,
      quantity: r.quantity,
      reference: r.reference,
      notes: r.notes,
      timestamp: r.timestamp,
    }));
  }

  private parseCsvRows(text: string): string[][] {
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
          i++; // Skip escaped quote
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

    return rows.filter(r => r.length > 0 && r.some(cell => cell.length > 0));
  }

  public validateProductsFromCsv(csvText: string): CsvValidationResult {
    const rawRows = this.parseCsvRows(csvText);
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
            errors: ['CSV file contains no data rows. Expected at least a header row and 1 data row.'],
          },
        ],
      };
    }

    const headers = rawRows[0].map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, ''));
    const headersFound = rawRows[0].map(h => h.trim());

    const findIndex = (aliases: string[]) => headers.findIndex(h => aliases.includes(h));

    const skuIdx = findIndex(['sku', 'productsku', 'itemsku', 'code', 'itemcode']);
    const nameIdx = findIndex(['name', 'productname', 'itemname', 'title', 'product']);
    const priceIdx = findIndex(['sellingprice', 'price', 'retailprice', 'mrp', 'unitprice', 'saleprice']);
    const costIdx = findIndex(['purchasecost', 'cost', 'costprice', 'buyprice', 'unitcost']);
    const stockIdx = findIndex(['stock', 'currentstock', 'stockquantity', 'quantity', 'qty', 'units', 'initialstock']);
    const thresholdIdx = findIndex(['minimumstockthreshold', 'minstockthreshold', 'minstock', 'minthreshold', 'minimumthreshold', 'reorderpoint', 'threshold', 'minimumstock', 'safetystock']);
    const catIdx = findIndex(['category', 'categoryname', 'department', 'type']);
    const supplierIdx = findIndex(['supplier', 'suppliername', 'vendor', 'vendorname']);
    const brandIdx = findIndex(['brand', 'brandname', 'manufacturer']);
    const unitIdx = findIndex(['unit', 'uom', 'unittype']);

    const missingColumns: string[] = [];
    if (skuIdx === -1) missingColumns.push('SKU');
    if (nameIdx === -1) missingColumns.push('Product Name');
    if (priceIdx === -1) missingColumns.push('Selling Price');

    if (missingColumns.length > 0) {
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
            errors: [`Missing required header columns: ${missingColumns.join(', ')}. Please include these columns.`],
          },
        ],
      };
    }

    const previewRows: CsvPreviewRow[] = [];
    const seenSkusInFile = new Set<string>();

    for (let i = 1; i < rawRows.length; i++) {
      const rowNum = i + 1;
      const cols = rawRows[i];
      const rowErrors: string[] = [];

      const rawSku = (cols[skuIdx] || '').trim();
      const sku = rawSku.toUpperCase();
      const name = (cols[nameIdx] || '').trim();

      if (!sku) {
        rowErrors.push('Missing SKU');
      } else if (seenSkusInFile.has(sku)) {
        rowErrors.push(`Duplicate SKU in CSV: "${sku}"`);
      } else {
        seenSkusInFile.add(sku);
        const existingDb = this.db.get('SELECT id FROM products WHERE sku = ? COLLATE NOCASE;', [sku]);
        if (existingDb) {
          rowErrors.push(`SKU "${sku}" already exists in database`);
        }
      }

      if (!name) {
        rowErrors.push('Missing Product Name');
      }

      const rawPrice = priceIdx !== -1 ? cols[priceIdx] : '';
      const priceNum = parseFloat(rawPrice || '');
      if (isNaN(priceNum) || priceNum < 0) {
        rowErrors.push(`Invalid selling price: "${rawPrice || ''}"`);
      }

      let costNum = 0;
      if (costIdx !== -1 && cols[costIdx] !== undefined && cols[costIdx].trim() !== '') {
        costNum = parseFloat(cols[costIdx]);
        if (isNaN(costNum) || costNum < 0) {
          rowErrors.push(`Invalid purchase cost: "${cols[costIdx]}"`);
        }
      }

      let stockNum = 0;
      if (stockIdx !== -1 && cols[stockIdx] !== undefined && cols[stockIdx].trim() !== '') {
        stockNum = parseFloat(cols[stockIdx]);
        if (isNaN(stockNum) || stockNum < 0) {
          rowErrors.push(`Invalid stock quantity: "${cols[stockIdx]}"`);
        }
      }

      let minThresholdNum = 5;
      if (thresholdIdx !== -1 && cols[thresholdIdx] !== undefined && cols[thresholdIdx].trim() !== '') {
        minThresholdNum = parseFloat(cols[thresholdIdx]);
        if (isNaN(minThresholdNum) || minThresholdNum < 0) {
          rowErrors.push(`Invalid min threshold: "${cols[thresholdIdx]}"`);
        }
      }

      const category = catIdx !== -1 ? cols[catIdx]?.trim() || undefined : undefined;
      const supplier = supplierIdx !== -1 ? cols[supplierIdx]?.trim() || undefined : undefined;
      const brand = brandIdx !== -1 ? cols[brandIdx]?.trim() || undefined : undefined;
      const unit = unitIdx !== -1 && cols[unitIdx]?.trim() ? cols[unitIdx].trim() : 'pcs';

      previewRows.push({
        rowNumber: rowNum,
        sku: rawSku,
        name,
        category,
        brand,
        unit,
        purchaseCostPaise: Math.round((isNaN(costNum) ? 0 : costNum) * 100),
        sellingPricePaise: Math.round((isNaN(priceNum) ? 0 : priceNum) * 100),
        currentStock: isNaN(stockNum) ? 0 : stockNum,
        minStockThreshold: isNaN(minThresholdNum) ? 5 : minThresholdNum,
        supplier,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
      });
    }

    const validCount = previewRows.filter(r => r.isValid).length;
    const errorCount = previewRows.filter(r => !r.isValid).length;

    return {
      totalRows: previewRows.length,
      validCount,
      errorCount,
      rows: previewRows,
      headersFound,
    };
  }

  public importProductsFromCsv(csvText: string): {
    success: boolean;
    importedCount: number;
    errors: Array<{ row: number; error: string; data?: any }>;
  } {
    const validation = this.validateProductsFromCsv(csvText);

    const errors = validation.rows
      .filter(r => !r.isValid)
      .map(r => ({
        row: r.rowNumber,
        error: r.errors.join('; '),
      }));

    const validRows = validation.rows.filter(r => r.isValid);

    if (validRows.length === 0) {
      return {
        success: false,
        importedCount: 0,
        errors,
      };
    }

    // Insert valid rows in an atomic transaction
    this.db.transaction(() => {
      const now = new Date().toISOString();
      for (const row of validRows) {
        let categoryId: number | null = null;
        if (row.category) {
          let cat = this.db.get<{ id: number }>('SELECT id FROM categories WHERE name = ? COLLATE NOCASE;', [row.category]);
          if (!cat) {
            const catRes = this.db.run('INSERT INTO categories (name, color, created_at) VALUES (?, ?, ?);', [row.category, '#3B82F6', now]);
            categoryId = catRes.lastInsertRowid;
          } else {
            categoryId = cat.id;
          }
        }

        let supplierId: number | null = null;
        if (row.supplier) {
          let sup = this.db.get<{ id: number }>('SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE;', [row.supplier]);
          if (!sup) {
            const supRes = this.db.run(
              'INSERT INTO suppliers (name, lead_time_days, min_order_qty, created_at, updated_at) VALUES (?, 7, 1, ?, ?);',
              [row.supplier, now, now]
            );
            supplierId = supRes.lastInsertRowid;
          } else {
            supplierId = sup.id;
          }
        }

        const res = this.db.run(
          `INSERT INTO products (
            sku, name, category_id, brand, unit,
            purchase_cost_paise, selling_price_paise, current_stock,
            min_stock_threshold, safety_stock, supplier_id, is_archived, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
          [
            row.sku.trim().toUpperCase(),
            row.name.trim(),
            categoryId,
            row.brand || null,
            row.unit || 'pcs',
            row.purchaseCostPaise,
            row.sellingPricePaise,
            row.currentStock,
            row.minStockThreshold,
            row.minStockThreshold,
            supplierId,
            now,
            now,
          ]
        );

        if (row.currentStock > 0) {
          this.db.run(
            'INSERT INTO stock_movements (product_id, movement_type, quantity, reference, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?);',
            [res.lastInsertRowid, 'OPENING_STOCK', row.currentStock, 'CSV_IMPORT', 'CSV batch import', now]
          );
        }
      }
    });

    return {
      success: true,
      importedCount: validRows.length,
      errors,
    };
  }

  public exportProductsToCsv(): string {
    const products = this.getProducts({ includeArchived: true });
    const header = [
      'SKU',
      'Product Name',
      'Category',
      'Brand',
      'Barcode',
      'Unit',
      'Purchase Cost',
      'Selling Price',
      'Current Stock',
      'Min Stock Threshold',
      'Safety Stock',
      'Supplier',
      'Supplier Lead Time Days',
      'Status',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      // Protect spreadsheet exports against formula injection (=, +, -, @)
      if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = products.map(p => [
      escapeCsv(p.sku),
      escapeCsv(p.name),
      escapeCsv(p.categoryName || ''),
      escapeCsv(p.brand || ''),
      escapeCsv(p.barcode || ''),
      escapeCsv(p.unit),
      (p.purchaseCostPaise / 100).toFixed(2),
      (p.sellingPricePaise / 100).toFixed(2),
      p.currentStock,
      p.minStockThreshold,
      p.safetyStock,
      escapeCsv(p.supplierName || ''),
      p.supplierLeadTimeDays,
      p.isArchived ? 'Archived' : p.stockStatus,
    ].join(','));

    return [header.join(','), ...rows].join('\r\n');
  }
}
