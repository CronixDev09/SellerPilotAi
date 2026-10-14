import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Layers,
  AlertTriangle,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';
import { Product, Sale, RestockItem, BusinessSettings } from '../../../shared/types';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters';

interface ReportsScreenProps {
  settings: BusinessSettings | null;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ settings, onNotify }) => {
  const [reportType, setReportType] = useState<
    'inventory' | 'shortages' | 'sales' | 'restock'
  >('inventory');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [restockItems, setRestockItems] = useState<RestockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReportData = async () => {
      try {
        setLoading(true);
        const [p, s, r] = await Promise.all([
          window.sellerPilot.getProducts(),
          window.sellerPilot.getSales({ limit: 50 }),
          window.sellerPilot.getRestockRecommendations(),
        ]);
        setProducts(p);
        setSales(s);
        setRestockItems(r);
      } catch (err: any) {
        onNotify('Failed to prepare reports data', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadReportData();
  }, []);

  const totalCostValuation = products.reduce((acc, p) => acc + (p.estimatedCostValuePaise || 0), 0);
  const totalRetailValuation = products.reduce((acc, p) => acc + (p.estimatedRetailValuePaise || 0), 0);
  const totalUnits = products.reduce((acc, p) => acc + p.currentStock, 0);

  const lowStockProducts = products.filter((p) => p.currentStock <= p.minStockThreshold);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Print Action */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Business Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Generate printable business records and audit sheets</p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Report Selector Pills */}
      <div className="flex items-center gap-2 no-print overflow-x-auto pb-1">
        {[
          { id: 'inventory' as const, label: 'Inventory Valuation Sheet', icon: Layers },
          { id: 'shortages' as const, label: 'Stock Shortage & Alert Report', icon: AlertTriangle },
          { id: 'sales' as const, label: 'Recent Sales Audit', icon: TrendingUp },
          { id: 'restock' as const, label: 'Restock Reorder Plan', icon: ShoppingBag },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                reportType === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm print:border-none print:shadow-none print:p-0 space-y-6">
        {/* Document Header */}
        <div className="flex items-start justify-between pb-6 border-b border-slate-200">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">OFFICIAL LOCAL BUSINESS REPORT</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {settings?.businessName || 'Business Store'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Type: {settings?.businessType || 'Retail'} • Currency: {settings?.currency || 'INR'}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-0.5">
            <p className="font-bold text-slate-800">
              {reportType === 'inventory' && 'Inventory Valuation Report'}
              {reportType === 'shortages' && 'Stock Shortage & Reorder Alert'}
              {reportType === 'sales' && 'Sales Transaction Audit Log'}
              {reportType === 'restock' && 'Restocking Demand Worksheet'}
            </p>
            <p>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-[10px] text-slate-400">Source: SQLite Local Database</p>
          </div>
        </div>

        {/* Report Content 1: Inventory Valuation */}
        {reportType === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Total Active SKUs:</span>
                <p className="text-base font-bold text-slate-900">{products.length}</p>
              </div>
              <div>
                <span className="text-slate-500">Total Units in Stock:</span>
                <p className="text-base font-bold text-slate-900">{formatNumber(totalUnits)}</p>
              </div>
              <div>
                <span className="text-slate-500">Total Purchase Cost Valuation:</span>
                <p className="text-base font-bold text-blue-700">{formatCurrency(totalCostValuation)}</p>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase font-semibold">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Product Name</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2 text-right">Stock</th>
                  <th className="pb-2 text-right">Unit Cost</th>
                  <th className="pb-2 text-right">Total Cost</th>
                  <th className="pb-2 text-right">Retail Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 font-mono text-[11px] text-slate-600">{p.sku}</td>
                    <td className="py-2 font-semibold text-slate-800">{p.name}</td>
                    <td className="py-2 text-slate-600">{p.categoryName || '-'}</td>
                    <td className="py-2 text-right font-bold text-slate-900">{p.currentStock} {p.unit}</td>
                    <td className="py-2 text-right text-slate-600">{formatCurrency(p.purchaseCostPaise)}</td>
                    <td className="py-2 text-right font-medium text-slate-800">{formatCurrency(p.estimatedCostValuePaise)}</td>
                    <td className="py-2 text-right font-bold text-slate-900">{formatCurrency(p.estimatedRetailValuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report Content 2: Stock Shortages */}
        {reportType === 'shortages' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Showing products where current stock is at or below the configured minimum stock threshold.
            </p>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase font-semibold">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Product Name</th>
                  <th className="pb-2 text-right">Current Stock</th>
                  <th className="pb-2 text-right">Min Threshold</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2">Preferred Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockProducts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 font-mono text-slate-600">{p.sku}</td>
                    <td className="py-2.5 font-bold text-slate-800">{p.name}</td>
                    <td className="py-2.5 text-right font-bold text-rose-600">{p.currentStock} {p.unit}</td>
                    <td className="py-2.5 text-right text-slate-600">{p.minStockThreshold}</td>
                    <td className="py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                        {p.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-600">{p.supplierName || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report Content 3: Recent Sales */}
        {reportType === 'sales' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase font-semibold">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Reference</th>
                  <th className="pb-2">Payment</th>
                  <th className="pb-2 text-right">Discount</th>
                  <th className="pb-2 text-right">Total Amount</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 text-slate-600">{formatDate(s.saleDate)}</td>
                    <td className="py-2 font-mono font-bold text-slate-800">{s.saleReference}</td>
                    <td className="py-2 text-slate-600 uppercase font-medium">{s.paymentMethod}</td>
                    <td className="py-2 text-right text-rose-600">
                      {s.discountPaise > 0 ? `-${formatCurrency(s.discountPaise)}` : '-'}
                    </td>
                    <td className="py-2 text-right font-bold text-slate-900">{formatCurrency(s.finalAmountPaise)}</td>
                    <td className="py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report Content 4: Restock Plan */}
        {reportType === 'restock' && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase font-semibold">
                  <th className="pb-2">Product / SKU</th>
                  <th className="pb-2 text-right">Stock</th>
                  <th className="pb-2 text-right">Avg Sales</th>
                  <th className="pb-2 text-right">Days Left</th>
                  <th className="pb-2 text-center">Priority</th>
                  <th className="pb-2 text-right">Suggested Order</th>
                  <th className="pb-2">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {restockItems.map((item) => (
                  <tr key={item.productId}>
                    <td className="py-2">
                      <span className="font-bold text-slate-800">{item.productName}</span>
                      <span className="text-[10px] text-slate-500 block font-mono">{item.sku}</span>
                    </td>
                    <td className="py-2 text-right font-bold">{item.currentStock}</td>
                    <td className="py-2 text-right text-slate-600">{item.avgDailySales}/day</td>
                    <td className="py-2 text-right text-slate-700">
                      {item.daysRemaining !== null ? `${item.daysRemaining}d` : '-'}
                    </td>
                    <td className="py-2 text-center">
                      <span className="font-bold text-[10px] uppercase text-rose-600">{item.priority}</span>
                    </td>
                    <td className="py-2 text-right font-bold text-blue-700 text-sm">{item.suggestedOrderQty}</td>
                    <td className="py-2 text-slate-600">{item.supplierName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Document Footer */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <span>SellerPilot AI • Offline-first Store Management</span>
          <span>Certified Local Business Record</span>
        </div>
      </div>
    </div>
  );
};
