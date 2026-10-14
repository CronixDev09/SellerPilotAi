import { AppDatabase } from '../db/database';
import { DashboardMetrics, SalesAnalytics, StockStatus } from '../../shared/types';
import { RestockService } from './restockService';

export class AnalyticsService {
  private restockService: RestockService;

  constructor(private db: AppDatabase) {
    this.restockService = new RestockService(db);
  }

  public getDashboardMetrics(periodDays: number = 30): DashboardMetrics {
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodStartStr = periodStart.toISOString();

    const prevPeriodStart = new Date();
    prevPeriodStart.setDate(prevPeriodStart.getDate() - (periodDays * 2));
    const prevPeriodStartStr = prevPeriodStart.toISOString();

    // 1. Current Active Products & Stock
    const invStats = this.db.get<any>(`
      SELECT 
        COUNT(id) as active_count,
        COALESCE(SUM(current_stock), 0) as total_units,
        COALESCE(SUM(current_stock * purchase_cost_paise), 0) as total_cost_paise,
        COALESCE(SUM(current_stock * selling_price_paise), 0) as total_retail_paise,
        COALESCE(SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count,
        COALESCE(SUM(CASE WHEN current_stock > 0 AND current_stock <= min_stock_threshold THEN 1 ELSE 0 END), 0) as low_stock_count
      FROM products
      WHERE is_archived = 0;
    `);

    // 2. Sales Revenue in current period
    const salesStats = this.db.get<any>(`
      SELECT 
        COALESCE(SUM(s.final_amount_paise), 0) as total_revenue_paise,
        COALESCE(SUM(si.quantity * si.unit_cost_paise), 0) as total_cost_basis_paise,
        COALESCE(SUM(si.quantity), 0) as units_sold
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed' AND s.sale_date >= ?;
    `, [periodStartStr]);

    // Previous period inventory snapshot (estimated from movements if any, or 0 change if no prior history)
    const prevSalesStats = this.db.get<any>(`
      SELECT 
        COALESCE(SUM(s.final_amount_paise), 0) as total_revenue_paise,
        COALESCE(SUM(si.quantity), 0) as units_sold
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed' AND s.sale_date >= ? AND s.sale_date < ?;
    `, [prevPeriodStartStr, periodStartStr]);

    const currentRevenue = salesStats?.total_revenue_paise || 0;
    const prevRevenue = prevSalesStats?.total_revenue_paise || 0;
    let salesRevenueChangePct = 0;
    if (prevRevenue > 0) {
      salesRevenueChangePct = Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100);
    } else if (currentRevenue > 0) {
      salesRevenueChangePct = 100;
    }

    // Previous period product creations for real active products change %
    const newProductsInPeriod = this.db.get<any>(`
      SELECT COUNT(id) as count FROM products WHERE created_at >= ? AND is_archived = 0;
    `, [periodStartStr])?.count || 0;
    const prevTotalActive = (invStats?.active_count || 0) - newProductsInPeriod;
    let activeProductsChangePct = 0;
    if (prevTotalActive > 0 && newProductsInPeriod > 0) {
      activeProductsChangePct = Math.round((newProductsInPeriod / prevTotalActive) * 100);
    }

    // Units in stock change based on net movement in period
    const netUnitsMovement = this.db.get<any>(`
      SELECT COALESCE(SUM(quantity), 0) as net_qty
      FROM stock_movements
      WHERE timestamp >= ?;
    `, [periodStartStr])?.net_qty || 0;
    const prevTotalUnits = (invStats?.total_units || 0) - netUnitsMovement;
    let unitsInStockChangePct = 0;
    if (prevTotalUnits > 0 && netUnitsMovement !== 0) {
      unitsInStockChangePct = Math.round((netUnitsMovement / prevTotalUnits) * 100);
    }

    let lowStockItemsChangePct = 0; // 0 unless prior period snapshot is available

    const restockItems = this.restockService.getRestockRecommendations({ historicalDaysWindow: periodDays });

    // 4. Sales Overview Chart (grouped by date)
    const dailyMap = new Map<string, { revenuePaise: number; unitsSold: number }>();
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      dailyMap.set(dateKey, { revenuePaise: 0, unitsSold: 0 });
    }

    const dailyRows = this.db.all<any>(`
      SELECT 
        DATE(s.sale_date) as s_date,
        COALESCE(SUM(s.final_amount_paise), 0) as day_revenue,
        COALESCE(SUM(si.quantity), 0) as day_units
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed' AND s.sale_date >= ?
      GROUP BY DATE(s.sale_date)
      ORDER BY s_date ASC;
    `, [periodStartStr]);

    for (const r of dailyRows) {
      if (dailyMap.has(r.s_date)) {
        dailyMap.set(r.s_date, {
          revenuePaise: r.day_revenue,
          unitsSold: r.day_units,
        });
      }
    }

    const salesOverview = Array.from(dailyMap.entries()).map(([dateStr, val]) => {
      const d = new Date(dateStr);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        date: label,
        revenuePaise: val.revenuePaise,
        revenueFormatted: Math.round(val.revenuePaise / 100),
        unitsSold: val.unitsSold,
      };
    });

    // 5. Category Distribution (Units and percentage)
    const categoryRows = this.db.all<any>(`
      SELECT 
        COALESCE(c.id, 0) as category_id,
        COALESCE(c.name, 'Uncategorized') as name,
        COALESCE(c.color, '#3B82F6') as color,
        COALESCE(SUM(p.current_stock), 0) as units
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_archived = 0
      GROUP BY c.id
      ORDER BY units DESC;
    `);

    const totalUnits = invStats?.total_units || 0;
    const categoryDistribution = categoryRows.map(c => ({
      categoryId: c.category_id,
      name: c.name,
      units: c.units,
      percentage: totalUnits > 0 ? Math.round((c.units / totalUnits) * 100) : 0,
      color: c.color,
    }));

    // 6. Top Selling Products
    const topRows = this.db.all<any>(`
      SELECT 
        p.id as product_id,
        p.name,
        p.sku,
        p.current_stock,
        p.min_stock_threshold,
        COALESCE(SUM(si.quantity), 0) as units_sold,
        COALESCE(SUM(si.total_amount_paise), 0) as revenue_paise
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' AND s.sale_date >= ?
      GROUP BY p.id
      ORDER BY revenue_paise DESC, units_sold DESC
      LIMIT 5;
    `, [periodStartStr]);

    const topSellingProducts = topRows.map(r => {
      let stockStatus: StockStatus = 'IN_STOCK';
      const curStock = Number(r.current_stock);
      const minStock = Number(r.min_stock_threshold);
      if (curStock <= 0) stockStatus = 'OUT_OF_STOCK';
      else if (curStock <= minStock) stockStatus = 'LOW_STOCK';

      return {
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        unitsSold: Number(r.units_sold),
        revenuePaise: Number(r.revenue_paise),
        stock: curStock,
        stockStatus,
      };
    });

    const totalRevenuePaise = salesStats?.total_revenue_paise || 0;
    const totalCostBasisPaise = salesStats?.total_cost_basis_paise || 0;
    const grossProfitPaise = totalRevenuePaise - totalCostBasisPaise;

    return {
      activeProductsCount: invStats?.active_count || 0,
      activeProductsChangePct: (invStats?.active_count || 0) === 0 ? 0 : activeProductsChangePct,
      unitsInStock: totalUnits,
      unitsInStockChangePct: totalUnits === 0 ? 0 : unitsInStockChangePct,
      salesRevenuePaise: totalRevenuePaise,
      salesRevenueChangePct,
      lowStockItemsCount: invStats?.low_stock_count || 0,
      lowStockItemsChangePct: (invStats?.low_stock_count || 0) === 0 ? 0 : lowStockItemsChangePct,
      outOfStockCount: invStats?.out_of_stock_count || 0,
      reorderRequiredCount: restockItems.length,
      inventoryCostPaise: invStats?.total_cost_paise || 0,
      inventoryRetailPaise: invStats?.total_retail_paise || 0,
      grossProfitPaise,
      salesOverview,
      categoryDistribution,
      topSellingProducts,
      restockAttention: restockItems.slice(0, 5),
    };
  }

  public getSalesAnalytics(periodDays: number = 30): SalesAnalytics {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodStartStr = periodStart.toISOString();

    // Overall summary
    const summary = this.db.get<any>(`
      SELECT 
        COALESCE(SUM(s.final_amount_paise), 0) as total_revenue,
        COALESCE(SUM(si.quantity * si.unit_cost_paise), 0) as total_cost,
        COALESCE(SUM(si.quantity), 0) as total_units,
        COUNT(DISTINCT s.id) as total_txns
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed' AND s.sale_date >= ?;
    `, [periodStartStr]);

    const totalRevenuePaise = summary?.total_revenue || 0;
    const totalCostPaise = summary?.total_cost || 0;
    const grossProfitPaise = totalRevenuePaise - totalCostPaise;
    const profitMarginPct = totalRevenuePaise > 0 ? Number(((grossProfitPaise / totalRevenuePaise) * 100).toFixed(1)) : 0;
    const totalUnitsSold = summary?.total_units || 0;
    const totalTransactions = summary?.total_txns || 0;
    const avgOrderValuePaise = totalTransactions > 0 ? Math.round(totalRevenuePaise / totalTransactions) : 0;

    // Top by units
    const topByUnitsRows = this.db.all<any>(`
      SELECT 
        p.id as product_id,
        p.name,
        p.sku,
        SUM(si.quantity) as units_sold,
        SUM(si.total_amount_paise) as revenue_paise
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' AND s.sale_date >= ?
      GROUP BY p.id
      ORDER BY units_sold DESC
      LIMIT 10;
    `, [periodStartStr]);

    const topByUnits = topByUnitsRows.map(r => ({
      productId: r.product_id,
      name: r.name,
      sku: r.sku,
      unitsSold: Number(r.units_sold),
      revenuePaise: Number(r.revenue_paise),
    }));

    // Top by revenue
    const topByRevenueRows = this.db.all<any>(`
      SELECT 
        p.id as product_id,
        p.name,
        p.sku,
        SUM(si.quantity) as units_sold,
        SUM(si.total_amount_paise) as revenue_paise
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' AND s.sale_date >= ?
      GROUP BY p.id
      ORDER BY revenue_paise DESC
      LIMIT 10;
    `, [periodStartStr]);

    const topByRevenue = topByRevenueRows.map(r => ({
      productId: r.product_id,
      name: r.name,
      sku: r.sku,
      unitsSold: Number(r.units_sold),
      revenuePaise: Number(r.revenue_paise),
    }));

    // Slow moving items (active products with inventory > 0 but 0 or minimal sales in window)
    const slowRows = this.db.all<any>(`
      SELECT 
        p.id as product_id,
        p.name,
        p.sku,
        p.current_stock,
        p.purchase_cost_paise,
        MAX(s.sale_date) as last_sold_date,
        COALESCE(SUM(CASE WHEN s.sale_date >= ? THEN si.quantity ELSE 0 END), 0) as recent_sales
      FROM products p
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
      WHERE p.is_archived = 0 AND p.current_stock > 0
      GROUP BY p.id
      HAVING recent_sales <= 1
      ORDER BY p.current_stock * p.purchase_cost_paise DESC
      LIMIT 10;
    `, [periodStartStr]);

    const now = new Date().getTime();
    const slowMoving = slowRows.map(r => {
      let daysSinceLastSale = 999;
      if (r.last_sold_date) {
        const lastTime = new Date(r.last_sold_date).getTime();
        daysSinceLastSale = Math.max(0, Math.floor((now - lastTime) / (1000 * 60 * 60 * 24)));
      }
      return {
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        currentStock: Number(r.current_stock),
        lastSoldDate: r.last_sold_date || undefined,
        daysSinceLastSale,
        inventoryCostPaise: Math.round(Number(r.current_stock) * Number(r.purchase_cost_paise)),
      };
    });

    // Category performance
    const catPerfRows = this.db.all<any>(`
      SELECT 
        COALESCE(c.id, 0) as category_id,
        COALESCE(c.name, 'Uncategorized') as name,
        COALESCE(SUM(si.quantity), 0) as units_sold,
        COALESCE(SUM(si.total_amount_paise), 0) as revenue_paise,
        COALESCE(SUM(si.total_amount_paise - (si.quantity * si.unit_cost_paise)), 0) as gross_profit_paise
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.status = 'completed' AND s.sale_date >= ?
      GROUP BY c.id
      ORDER BY revenue_paise DESC;
    `, [periodStartStr]);

    const categoryPerformance = catPerfRows.map(r => ({
      categoryId: r.category_id,
      name: r.name,
      unitsSold: Number(r.units_sold),
      revenuePaise: Number(r.revenue_paise),
      grossProfitPaise: Number(r.gross_profit_paise),
    }));

    // Revenue trend (weekly breakdown for the period)
    const trendRows = this.db.all<any>(`
      SELECT 
        strftime('%Y-%W', s.sale_date) as week_period,
        MIN(DATE(s.sale_date)) as period_label,
        COALESCE(SUM(s.final_amount_paise), 0) as revenue_paise,
        COALESCE(SUM(si.quantity * si.unit_cost_paise), 0) as cost_paise,
        COALESCE(SUM(s.final_amount_paise - (si.quantity * si.unit_cost_paise)), 0) as gross_profit_paise,
        COALESCE(SUM(si.quantity), 0) as units_sold
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status = 'completed' AND s.sale_date >= ?
      GROUP BY week_period
      ORDER BY week_period ASC;
    `, [periodStartStr]);

    const revenueTrend = trendRows.map(r => ({
      period: r.period_label || r.week_period,
      revenuePaise: Number(r.revenue_paise),
      costPaise: Number(r.cost_paise),
      grossProfitPaise: Number(r.gross_profit_paise),
      unitsSold: Number(r.units_sold),
    }));

    return {
      totalRevenuePaise,
      totalCostPaise,
      grossProfitPaise,
      profitMarginPct,
      totalUnitsSold,
      totalTransactions,
      avgOrderValuePaise,
      topByUnits,
      topByRevenue,
      slowMoving,
      categoryPerformance,
      revenueTrend,
    };
  }
}
