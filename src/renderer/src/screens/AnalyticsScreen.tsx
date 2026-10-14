import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Calendar,
  AlertCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SalesAnalytics } from '../../../shared/types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface AnalyticsScreenProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  selectedPeriod: number;
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onNotify, selectedPeriod }) => {
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await window.sellerPilot.getSalesAnalytics(selectedPeriod);
        setAnalytics(data);
      } catch (err: any) {
        onNotify(err.message || 'Failed to load analytics', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [selectedPeriod]);

  if (loading || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Calculating financial and product analytics...</p>
      </div>
    );
  }

  const chartData = analytics.revenueTrend.map((t) => ({
    period: t.period,
    revenue: Math.round(t.revenuePaise / 100),
    profit: Math.round(t.grossProfitPaise / 100),
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Gross Revenue</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(analytics.totalRevenuePaise)}</div>
          <span className="text-[11px] text-slate-400">across {analytics.totalTransactions} transactions</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Cost of Goods Sold (COGS)</span>
          <div className="text-2xl font-bold text-slate-700 mt-1">{formatCurrency(analytics.totalCostPaise)}</div>
          <span className="text-[11px] text-slate-400">actual recorded cost basis</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Gross Profit</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(analytics.grossProfitPaise)}</div>
          <span className="text-[11px] text-emerald-600 font-semibold">{analytics.profitMarginPct}% profit margin</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Avg Order Value (AOV)</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(analytics.avgOrderValuePaise)}</div>
          <span className="text-[11px] text-slate-400">{analytics.totalUnitsSold} total units sold</span>
        </div>
      </div>

      {/* 2. Revenue & Gross Profit Trend Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">Weekly Revenue & Profit Trends</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Net revenue vs gross profit for the selected {selectedPeriod}-day period
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="text-slate-600">Revenue (₹)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600">Gross Profit (₹)</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString('en-IN')}`, name === 'revenue' ? 'Revenue' : 'Gross Profit']}
              />
              <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Product Rankings: Top by Units vs Top by Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by Units */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-1">Best-Selling by Units Sold</h3>
          <p className="text-xs text-slate-500 mb-4">Ranked by volume velocity</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                  <th className="pb-2 w-6">#</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Units</th>
                  <th className="pb-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.topByUnits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No sales data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topByUnits.map((p, i) => (
                    <tr key={p.productId} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-400">{i + 1}</td>
                      <td className="py-2.5">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-blue-600">{p.unitsSold}</td>
                      <td className="py-2.5 text-right font-medium text-slate-700">
                        {formatCurrency(p.revenuePaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top by Revenue */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-bold text-sm text-slate-800 mb-1">Top Products by Revenue</h3>
          <p className="text-xs text-slate-500 mb-4">Ranked by gross sales value</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase">
                  <th className="pb-2 w-6">#</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2 text-right">Units</th>
                  <th className="pb-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.topByRevenue.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No sales data available.
                    </td>
                  </tr>
                ) : (
                  analytics.topByRevenue.map((p, i) => (
                    <tr key={p.productId} className="hover:bg-slate-50">
                      <td className="py-2.5 font-bold text-slate-400">{i + 1}</td>
                      <td className="py-2.5">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</div>
                      </td>
                      <td className="py-2.5 text-right font-medium text-slate-700">{p.unitsSold}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        {formatCurrency(p.revenuePaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Slow Moving Stock Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-amber-500" />
          <h3 className="font-bold text-sm text-slate-800">Slow-Moving Inventory Analysis</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Active products with units in stock but minimal or no recorded sales in the last {selectedPeriod} days.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3 text-right">Current Stock</th>
                <th className="py-2.5 px-3 text-right">Days Since Last Sale</th>
                <th className="py-2.5 px-3 text-right">Capital Locked Up</th>
                <th className="py-2.5 px-3">Action Suggestion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.slowMoving.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    No slow-moving inventory detected! All items have recent velocity.
                  </td>
                </tr>
              ) : (
                analytics.slowMoving.map((s) => (
                  <tr key={s.productId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-800">{s.name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">SKU: {s.sku}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">{s.currentStock} units</td>
                    <td className="py-2.5 px-3 text-right text-amber-600 font-semibold">
                      {s.daysSinceLastSale >= 999 ? 'No recorded sales' : `${s.daysSinceLastSale} days ago`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(s.inventoryCostPaise)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      Consider discount promo or bundling to unlock cash.
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
