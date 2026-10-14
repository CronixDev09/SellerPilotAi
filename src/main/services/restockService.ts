import { AppDatabase } from '../db/database';
import { RestockItem, RestockPriority } from '../../shared/types';

export class RestockService {
  constructor(private db: AppDatabase) {}

  public getRestockRecommendations(options?: {
    historicalDaysWindow?: number;
    targetCoverageDays?: number;
  }): RestockItem[] {
    const windowDays = options?.historicalDaysWindow || 30;
    const settings = this.db.get<any>('SELECT target_stock_coverage_days FROM business_settings WHERE id = 1;');
    const coverageDays = options?.targetCoverageDays || settings?.target_stock_coverage_days || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);
    const startDateStr = startDate.toISOString();

    // Query active products with sales aggregates
    const products = this.db.all<any>(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.current_stock,
        p.min_stock_threshold,
        p.safety_stock,
        p.purchase_cost_paise,
        p.supplier_id,
        p.supplier_lead_time_days,
        c.name as category_name,
        s.name as supplier_name,
        s.min_order_qty,
        s.lead_time_days as supplier_default_lead_time,
        COALESCE(sales_agg.units_sold, 0) as units_sold_in_window,
        COALESCE(sales_agg.days_with_sales, 0) as days_with_sales
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN (
        SELECT 
          si.product_id,
          SUM(si.quantity) as units_sold,
          COUNT(DISTINCT DATE(s.sale_date)) as days_with_sales
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed' AND s.sale_date >= ?
        GROUP BY si.product_id
      ) sales_agg ON sales_agg.product_id = p.id
      WHERE p.is_archived = 0
      ORDER BY p.name ASC;
    `, [startDateStr]);

    const items: RestockItem[] = [];

    for (const p of products) {
      const currentStock = Number(p.current_stock);
      const unitsSold = Number(p.units_sold_in_window);
      const avgDailySales = Number((unitsSold / windowDays).toFixed(2));
      const leadTime = Number(p.supplier_lead_time_days || p.supplier_default_lead_time || 7);
      const safetyStock = Number(p.safety_stock || p.min_stock_threshold || 5);
      const minOrderQty = Number(p.min_order_qty || 1);
      const salesHistoryReliable = unitsSold > 0 || p.days_with_sales > 0;

      // Reorder Point Formula: (Avg Daily Sales * Lead Time) + Safety Stock
      // If no sales history, fallback to min_stock_threshold
      const reorderPoint = salesHistoryReliable
        ? Math.ceil((avgDailySales * leadTime) + safetyStock)
        : Math.ceil(safetyStock);

      let daysRemaining: number | null = null;
      if (avgDailySales > 0) {
        daysRemaining = Math.max(0, Math.floor(currentStock / avgDailySales));
      }

      // Check if product requires attention
      const isStockLowOrZero = currentStock <= reorderPoint || currentStock <= 0;
      const isReorderSoon = currentStock <= reorderPoint * 1.25;

      if (!isStockLowOrZero && !isReorderSoon) {
        continue;
      }

      // Priority determination
      let priority: RestockPriority = 'NORMAL';
      if (currentStock <= 0 || (daysRemaining !== null && daysRemaining <= 2)) {
        priority = 'CRITICAL';
      } else if (currentStock <= reorderPoint || (daysRemaining !== null && daysRemaining <= 7)) {
        priority = 'HIGH';
      }

      // Suggested Order Quantity Formula:
      // (Avg Daily Sales * Target Coverage Days) + Safety Stock - Current Stock
      let rawOrderQty = 0;
      if (salesHistoryReliable && avgDailySales > 0) {
        rawOrderQty = Math.ceil((avgDailySales * coverageDays) + safetyStock - currentStock);
      } else {
        rawOrderQty = Math.ceil(safetyStock * 2 - currentStock);
      }

      const suggestedOrderQty = Math.max(minOrderQty, Math.max(0, rawOrderQty));
      const estimatedCostPaise = Math.round(suggestedOrderQty * Number(p.purchase_cost_paise || 0));

      // Build human-readable deterministic explanation
      let reason = '';
      if (!salesHistoryReliable) {
        reason = `${p.name}: Insufficient sales history in the last ${windowDays} days. Threshold check: Stock is ${currentStock} vs minimum safety stock of ${safetyStock}. Restocking suggested.`;
      } else if (currentStock <= 0) {
        reason = `${p.name}: Out of stock! Average sales are ${avgDailySales} units/day. Lead time is ${leadTime} days with ${safetyStock} safety stock. Immediate reorder of ${suggestedOrderQty} units required.`;
      } else {
        const daysText = daysRemaining !== null ? `${daysRemaining} days of stock remaining` : 'unknown coverage';
        reason = `${p.name}: Current stock is ${currentStock} units (${daysText}). Average daily sales: ${avgDailySales} units/day. Lead time: ${leadTime} days with safety stock of ${safetyStock}. Reorder point is ${reorderPoint} units.`;
      }

      items.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        categoryName: p.category_name || 'Uncategorized',
        currentStock,
        avgDailySales,
        daysRemaining,
        supplierLeadTimeDays: leadTime,
        safetyStock,
        reorderPoint,
        suggestedOrderQty,
        estimatedCostPaise,
        supplierId: p.supplier_id || undefined,
        supplierName: p.supplier_name || 'Unassigned',
        minOrderQty,
        priority,
        reason,
        salesHistoryReliable,
      });
    }

    // Sort by priority (CRITICAL -> HIGH -> NORMAL) then by lowest daysRemaining
    const priorityWeight: Record<RestockPriority, number> = {
      CRITICAL: 1,
      HIGH: 2,
      NORMAL: 3,
    };

    items.sort((a, b) => {
      const pDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (pDiff !== 0) return pDiff;
      if (a.daysRemaining === null && b.daysRemaining === null) return 0;
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });

    return items;
  }

  public exportRestockToCsv(): string {
    const items = this.getRestockRecommendations();
    const header = [
      'SKU',
      'Product Name',
      'Category',
      'Current Stock',
      'Avg Daily Sales',
      'Est Days Remaining',
      'Reorder Point',
      'Suggested Order Qty',
      'Est Cost',
      'Supplier',
      'Lead Time Days',
      'Priority',
      'Explanation',
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

    const rows = items.map(i => [
      escapeCsv(i.sku),
      escapeCsv(i.productName),
      escapeCsv(i.categoryName || ''),
      i.currentStock,
      i.avgDailySales,
      i.daysRemaining !== null ? i.daysRemaining : 'N/A',
      i.reorderPoint,
      i.suggestedOrderQty,
      (i.estimatedCostPaise / 100).toFixed(2),
      escapeCsv(i.supplierName || ''),
      i.supplierLeadTimeDays,
      i.priority,
      escapeCsv(i.reason),
    ].join(','));

    return [header.join(','), ...rows].join('\r\n');
  }
}
