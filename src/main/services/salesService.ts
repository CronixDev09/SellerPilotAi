import { AppDatabase } from '../db/database';
import { Sale, SaleInput, SaleItem } from '../../shared/types';

export class SalesService {
  constructor(private db: AppDatabase) {}

  public getSales(options?: {
    startDate?: string;
    endDate?: string;
    status?: 'completed' | 'cancelled';
    search?: string;
    limit?: number;
    offset?: number;
  }): Sale[] {
    let query = `
      SELECT 
        s.*,
        COUNT(si.id) as item_count
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options?.startDate) {
      query += ' AND s.sale_date >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      query += ' AND s.sale_date <= ?';
      params.push(options.endDate);
    }
    if (options?.status) {
      query += ' AND s.status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      const term = `%${options.search.trim()}%`;
      query += ' AND (s.sale_reference LIKE ? OR s.payment_method LIKE ? OR s.notes LIKE ?)';
      params.push(term, term, term);
    }

    query += ' GROUP BY s.id ORDER BY s.sale_date DESC, s.id DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = this.db.all<any>(query, params);
    return rows.map(r => ({
      id: r.id,
      saleReference: r.sale_reference,
      saleDate: r.sale_date,
      totalAmountPaise: r.total_amount_paise,
      discountPaise: r.discount_paise,
      finalAmountPaise: r.final_amount_paise,
      paymentMethod: r.payment_method,
      notes: r.notes,
      status: r.status,
      cancelledAt: r.cancelled_at,
      cancellationReason: r.cancellation_reason,
      itemCount: r.item_count || 0,
      createdAt: r.created_at,
    }));
  }

  public getSaleById(id: number): Sale | null {
    const saleRow = this.db.get<any>('SELECT * FROM sales WHERE id = ?;', [id]);
    if (!saleRow) return null;

    const itemRows = this.db.all<any>(`
      SELECT si.*, p.name as product_name, p.sku
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?;
    `, [id]);

    const items: SaleItem[] = itemRows.map(r => ({
      id: r.id,
      saleId: r.sale_id,
      productId: r.product_id,
      productName: r.product_name,
      sku: r.sku,
      quantity: r.quantity,
      unitSellingPricePaise: r.unit_selling_price_paise,
      unitCostPaise: r.unit_cost_paise,
      discountPaise: r.discount_paise,
      totalAmountPaise: r.total_amount_paise,
    }));

    return {
      id: saleRow.id,
      saleReference: saleRow.sale_reference,
      saleDate: saleRow.sale_date,
      totalAmountPaise: saleRow.total_amount_paise,
      discountPaise: saleRow.discount_paise,
      finalAmountPaise: saleRow.final_amount_paise,
      paymentMethod: saleRow.payment_method,
      notes: saleRow.notes,
      status: saleRow.status,
      cancelledAt: saleRow.cancelled_at,
      cancellationReason: saleRow.cancellation_reason,
      items,
      itemCount: items.length,
      createdAt: saleRow.created_at,
    };
  }

  public recordSale(input: SaleInput): Sale {
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot record a sale without items');
    }

    // Atomic transaction for sale entry, stock deductions, and audit movement logs
    return this.db.transaction(() => {
      const now = new Date();
      const saleDate = input.saleDate || now.toISOString();
      const timestampMs = now.getTime();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const saleReference = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${timestampMs.toString().slice(-4)}${randomSuffix}`;

      let calculatedTotalPaise = 0;
      const verifiedItems: Array<{
        productId: number;
        quantity: number;
        unitSellingPricePaise: number;
        unitCostPaise: number;
        discountPaise: number;
        totalAmountPaise: number;
      }> = [];

      for (const item of input.items) {
        if (item.quantity <= 0) {
          throw new Error('Item quantity must be greater than zero');
        }

        const product = this.db.get<any>('SELECT * FROM products WHERE id = ?;', [item.productId]);
        if (!product) {
          throw new Error(`Product with ID ${item.productId} does not exist`);
        }
        if (product.is_archived) {
          throw new Error(`Product "${product.name}" (${product.sku}) is archived and cannot be sold`);
        }

        const availableStock = Number(product.current_stock);
        if (availableStock < item.quantity && !input.allowNegativeStockOverride) {
          throw new Error(
            `Insufficient stock for "${product.name}" (${product.sku}). Available: ${availableStock}, Requested: ${item.quantity}. Override required to allow overselling.`
          );
        }

        const unitSellingPricePaise = item.unitSellingPricePaise ?? product.selling_price_paise;
        const discountPaise = item.discountPaise || 0;
        const lineTotal = Math.max(0, Math.round(item.quantity * unitSellingPricePaise) - discountPaise);

        calculatedTotalPaise += lineTotal;
        verifiedItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitSellingPricePaise,
          unitCostPaise: product.purchase_cost_paise, // preserve historical cost basis
          discountPaise,
          totalAmountPaise: lineTotal,
        });
      }

      const overallDiscount = input.discountPaise || 0;
      const finalAmountPaise = Math.max(0, calculatedTotalPaise - overallDiscount);

      // Insert sale record
      const saleResult = this.db.run(
        `INSERT INTO sales (
          sale_reference, sale_date, total_amount_paise, discount_paise,
          final_amount_paise, payment_method, notes, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?);`,
        [
          saleReference,
          saleDate,
          calculatedTotalPaise,
          overallDiscount,
          finalAmountPaise,
          input.paymentMethod,
          input.notes || null,
          now.toISOString(),
        ]
      );

      const saleId = saleResult.lastInsertRowid;

      // Insert line items & deduct stock & log stock movements
      for (const item of verifiedItems) {
        this.db.run(
          `INSERT INTO sale_items (
            sale_id, product_id, quantity, unit_selling_price_paise,
            unit_cost_paise, discount_paise, total_amount_paise
          ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            saleId,
            item.productId,
            item.quantity,
            item.unitSellingPricePaise,
            item.unitCostPaise,
            item.discountPaise,
            item.totalAmountPaise,
          ]
        );

        // Deduct inventory
        this.db.run(
          'UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?;',
          [item.quantity, now.toISOString(), item.productId]
        );

        // Record movement audit
        const movementNotes = input.allowNegativeStockOverride
          ? `Sale ${saleReference} (Stock override enabled)`
          : `Sale ${saleReference}`;

        this.db.run(
          'INSERT INTO stock_movements (product_id, movement_type, quantity, reference, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?);',
          [item.productId, 'SALE', -item.quantity, saleReference, movementNotes, now.toISOString()]
        );
      }

      return this.getSaleById(saleId)!;
    });
  }

  public cancelSale(saleId: number, reason: string): Sale {
    const sale = this.getSaleById(saleId);
    if (!sale) throw new Error(`Sale with ID ${saleId} not found`);
    if (sale.status === 'cancelled') {
      throw new Error(`Sale ${sale.saleReference} is already cancelled`);
    }

    return this.db.transaction(() => {
      const now = new Date().toISOString();

      // Mark sale cancelled
      this.db.run(
        'UPDATE sales SET status = ?, cancelled_at = ?, cancellation_reason = ? WHERE id = ?;',
        ['cancelled', now, reason || 'Customer return / order cancelled', saleId]
      );

      // Restore inventory and record customer return stock movements
      if (sale.items) {
        for (const item of sale.items) {
          this.db.run(
            'UPDATE products SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?;',
            [item.quantity, now, item.productId]
          );

          this.db.run(
            'INSERT INTO stock_movements (product_id, movement_type, quantity, reference, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?);',
            [
              item.productId,
              'CUSTOMER_RETURN',
              item.quantity,
              sale.saleReference,
              `Sale reversal: ${reason || 'Cancelled'}`,
              now,
            ]
          );
        }
      }

      return this.getSaleById(saleId)!;
    });
  }

  public exportSalesToCsv(): string {
    const sales = this.getSales();
    const header = [
      'Sale Reference',
      'Date',
      'Items Count',
      'Total Amount',
      'Discount',
      'Final Amount',
      'Payment Method',
      'Status',
      'Notes',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
        str = `'${str}`;
      }
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = sales.map(s => [
      escapeCsv(s.saleReference),
      escapeCsv(s.saleDate),
      s.itemCount,
      (s.totalAmountPaise / 100).toFixed(2),
      (s.discountPaise / 100).toFixed(2),
      (s.finalAmountPaise / 100).toFixed(2),
      escapeCsv(s.paymentMethod),
      escapeCsv(s.status),
      escapeCsv(s.notes || ''),
    ].join(','));

    return [header.join(','), ...rows].join('\r\n');
  }
}
