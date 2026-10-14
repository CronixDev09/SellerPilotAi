import React from 'react';
import {
  Package,
  Layers,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Info,
  ChevronRight,
  PlusCircle,
  Upload,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardMetrics, StockStatus } from '../../../shared/types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { NavScreen } from '../components/layout/Sidebar';

interface DashboardScreenProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  onNavigate: (screen: NavScreen) => void;
  onSeedDemo: () => void;
  selectedPeriod: number;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  metrics,
  loading,
  onNavigate,
  onSeedDemo,
  selectedPeriod,
}) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Calculating dashboard statistics...</p>
      </div>
    );
  }

  // Stock status badge component
  const renderStockBadge = (status: StockStatus) => {
    switch (status) {
      case 'IN_STOCK':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            In Stock
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            <AlertTriangle className="w-3 h-3" /> Low Stock
          </span>
        );
      case 'OUT_OF_STOCK':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            Out of Stock
          </span>
        );
    }
  };

  const periodLabel = `vs last ${selectedPeriod} days`;

  const hasSales = Boolean(
    metrics?.salesOverview &&
    metrics.salesOverview.length > 0 &&
    metrics.salesOverview.some((d) => d.revenuePaise > 0 || d.unitsSold > 0)
  );

  const hasCategories = Boolean(
    metrics?.categoryDistribution &&
    metrics.categoryDistribution.length > 0 &&
    metrics.categoryDistribution.some((c) => c.units > 0)
  );

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Four Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Products */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Products</span>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{formatNumber(metrics?.activeProductsCount || 0)}</h3>
          </div>
          {metrics && metrics.activeProductsChangePct !== 0 ? (
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${metrics.activeProductsChangePct > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
              {metrics.activeProductsChangePct > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{metrics.activeProductsChangePct > 0 ? `+${metrics.activeProductsChangePct}%` : `${metrics.activeProductsChangePct}%`} {periodLabel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-400">
              <span>0% {periodLabel}</span>
            </div>
          )}
        </div>

        {/* Units in Stock */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Units in Stock</span>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{formatNumber(metrics?.unitsInStock || 0)}</h3>
          </div>
          {metrics && metrics.unitsInStockChangePct !== 0 ? (
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${metrics.unitsInStockChangePct > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {metrics.unitsInStockChangePct > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{metrics.unitsInStockChangePct > 0 ? `+${metrics.unitsInStockChangePct}%` : `${metrics.unitsInStockChangePct}%`} {periodLabel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-400">
              <span>0% {periodLabel}</span>
            </div>
          )}
        </div>

        {/* Sales Revenue */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sales Revenue</span>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(metrics?.salesRevenuePaise || 0)}</h3>
          </div>
          {metrics && metrics.salesRevenueChangePct !== 0 ? (
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${metrics.salesRevenueChangePct > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {metrics.salesRevenueChangePct > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{metrics.salesRevenueChangePct > 0 ? `+${metrics.salesRevenueChangePct}%` : `${metrics.salesRevenueChangePct}%`} {periodLabel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-400">
              <span>0% {periodLabel}</span>
            </div>
          )}
        </div>

        {/* Low Stock Items */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Items</span>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{formatNumber(metrics?.lowStockItemsCount || 0)}</h3>
          </div>
          {metrics && metrics.lowStockItemsChangePct !== 0 ? (
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${metrics.lowStockItemsCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              {metrics.lowStockItemsChangePct > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{metrics.lowStockItemsChangePct > 0 ? `+${metrics.lowStockItemsChangePct}%` : `${metrics.lowStockItemsChangePct}%`} {periodLabel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-400">
              <span>0% {periodLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Charts Row: Sales Overview & Inventory by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Overview Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Sales Overview</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Revenue and units sold in the last {selectedPeriod} days
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-slate-600">Revenue (₹)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Units Sold</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {!hasSales ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No Sales in Selected Period</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Revenue and unit trends will automatically graph here once customer sales are recorded.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics?.salesOverview} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#10B981' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white text-xs rounded-lg p-2.5 shadow-lg space-y-1">
                            <p className="font-semibold text-slate-300">{label}</p>
                            <p className="text-blue-300">Revenue: ₹{payload[0]?.value?.toLocaleString('en-IN')}</p>
                            <p className="text-emerald-300">Units: {payload[1]?.value} sold</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenueFormatted"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="unitsSold"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#10B981' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Inventory by Category Donut Chart (1 col) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Inventory by Category</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Total {formatNumber(metrics?.unitsInStock || 0)} units across {metrics?.categoryDistribution?.length || 0} categories
            </p>
          </div>

          {!hasCategories ? (
            <div className="h-48 w-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 my-auto">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Layers className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No Category Data</p>
              <p className="text-xs text-slate-400 mt-1">Add products with categories to view stock distribution.</p>
            </div>
          ) : (
            <div className="relative h-48 w-full my-auto flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics?.categoryDistribution}
                    dataKey="units"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {metrics?.categoryDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#3B82F6'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [`${val} units`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Inner Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-900">{formatNumber(metrics?.unitsInStock || 0)}</span>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Units in Stock</span>
              </div>
            </div>
          )}

          {/* Legend */}
          {!hasCategories ? (
            <div className="text-center text-xs text-slate-400 py-3 border-t border-slate-100">
              No categories to display
            </div>
          ) : (
            <div className="space-y-1.5 pt-3 border-t border-slate-100 max-h-36 overflow-y-auto">
              {metrics?.categoryDistribution.map((cat) => (
                <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-slate-700 font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600 font-semibold">{formatNumber(cat.units)}</span>
                    <span className="text-slate-400 w-8 text-right font-medium">{cat.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Row: Top Selling Products & Restock Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products Table */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Top Selling Products</h3>
              <p className="text-xs text-slate-500 mt-0.5">Best performing products in last {selectedPeriod} days</p>
            </div>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 w-8">#</th>
                  <th className="pb-3">Product</th>
                  <th className="pb-3 text-right">Units Sold</th>
                  <th className="pb-3 text-right">Revenue</th>
                  <th className="pb-3 text-right">Stock</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {!metrics || metrics.topSellingProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <Package className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                      <p className="font-semibold text-slate-600">No sales recorded yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Your best-selling products will appear here after sales are logged.</p>
                    </td>
                  </tr>
                ) : (
                  metrics.topSellingProducts.map((p, idx) => (
                    <tr key={p.productId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-semibold text-slate-400">{idx + 1}</td>
                      <td className="py-3">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400">SKU: {p.sku}</div>
                      </td>
                      <td className="py-3 text-right font-medium text-slate-700">{p.unitsSold}</td>
                      <td className="py-3 text-right font-semibold text-slate-800">{formatCurrency(p.revenuePaise)}</td>
                      <td className="py-3 text-right font-medium text-slate-600">{p.stock}</td>
                      <td className="py-3 text-right">{renderStockBadge(p.stockStatus)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Restock Attention Table */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Restock Attention</h3>
                <p className="text-xs text-slate-500 mt-0.5">Products that need your attention</p>
              </div>
              <button
                onClick={() => onNavigate('restock')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Product</th>
                    <th className="pb-3 text-right">Current Stock</th>
                    <th className="pb-3 text-right">Est. Days Left</th>
                    <th className="pb-3 text-center">Priority</th>
                    <th className="pb-3 text-right">Suggested Qty</th>
                    <th className="pb-3 w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {!metrics || metrics.restockAttention.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5 text-emerald-500" />
                        <p className="font-semibold text-slate-600">
                          {(metrics?.activeProductsCount || 0) === 0 ? 'No products in inventory' : 'Stock levels healthy'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {(metrics?.activeProductsCount || 0) === 0
                            ? 'Add products to track safety stock and reorder recommendations.'
                            : 'No products currently need urgent restocking.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    metrics.restockAttention.map((item) => (
                      <tr
                        key={item.productId}
                        onClick={() => onNavigate('restock')}
                        className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      >
                        <td className="py-3">
                          <div className="font-semibold text-slate-800">{item.productName}</div>
                          <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                        </td>
                        <td className="py-3 text-right font-medium text-slate-700">{item.currentStock}</td>
                        <td className="py-3 text-right text-slate-600">
                          {item.daysRemaining !== null ? `${item.daysRemaining} days` : 'N/A'}
                        </td>
                        <td className="py-3 text-center">
                          {item.priority === 'CRITICAL' ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              Critical
                            </span>
                          ) : item.priority === 'HIGH' ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                              Reorder soon
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right font-bold text-slate-800">{item.suggestedOrderQty}</td>
                        <td className="py-3 text-right text-slate-400">
                          <ChevronRight className="w-4 h-4" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transparent Formula Callout Tip */}
          <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-800">
            <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Based on average daily sales, supplier lead time and safety stock levels.</span>
          </div>
        </div>
      </div>

      {/* 4. Footer info */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-200/60">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>All figures are calculated from your local records.</span>
        </div>
        <span>SellerPilot AI v1.0.0</span>
      </div>
    </div>
  );
};
