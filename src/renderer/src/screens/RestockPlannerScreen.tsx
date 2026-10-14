import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Download,
  Printer,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  FileText,
  Filter,
  RefreshCw,
  X,
  ChevronRight,
} from 'lucide-react';
import { RestockItem, RestockPriority } from '../../../shared/types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface RestockPlannerScreenProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const RestockPlannerScreen: React.FC<RestockPlannerScreenProps> = ({ onNotify }) => {
  const [items, setItems] = useState<RestockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverageDays, setCoverageDays] = useState(30);
  const [selectedPriority, setSelectedPriority] = useState<RestockPriority | ''>('');

  // Editable Quantities state
  const [customQuantities, setCustomQuantities] = useState<Record<number, number>>({});

  // Draft Purchase Order Modal
  const [showPOModal, setShowPOModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await window.sellerPilot.getRestockRecommendations({
        targetCoverageDays: coverageDays,
        historicalDaysWindow: 30,
      });
      setItems(data);

      // Initialize custom quantities
      const initialMap: Record<number, number> = {};
      data.forEach((i: RestockItem) => {
        initialMap[i.productId] = i.suggestedOrderQty;
      });
      setCustomQuantities(initialMap);
    } catch (err: any) {
      onNotify(err.message || 'Failed to calculate restock recommendations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [coverageDays]);

  const handleQuantityChange = (productId: number, val: number) => {
    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, val),
    }));
  };

  const handleExportCsv = async () => {
    try {
      const csv = await window.sellerPilot.exportRestockCsv();
      const savedPath = await window.sellerPilot.saveFileDialog({
        defaultName: `sellerpilot_restock_order_${new Date().toISOString().slice(0, 10)}.csv`,
        content: csv,
        filters: [{ name: 'CSV File', extensions: ['csv'] }],
      });
      if (savedPath) {
        onNotify(`Restock recommendations exported to ${savedPath}`, 'success');
      }
    } catch (err: any) {
      onNotify('Export failed', 'error');
    }
  };

  const filteredItems = items.filter((i) => {
    if (selectedPriority && i.priority !== selectedPriority) return false;
    return true;
  });

  // Calculate PO totals
  const totalItemsToOrder = Object.values(customQuantities).filter((q) => q > 0).length;
  const totalUnitsToOrder = Object.values(customQuantities).reduce((acc, q) => acc + q, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Coverage Settings */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Smart Restock Planner</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent deterministic restocking calculations based on sales velocity and lead times
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs">
            <span className="text-slate-500 font-medium">Target Stock Coverage:</span>
            <select
              value={coverageDays}
              onChange={(e) => setCoverageDays(Number(e.target.value))}
              className="font-bold text-blue-600 focus:outline-none cursor-pointer"
            >
              <option value={15}>15 days</option>
              <option value={30}>30 days</option>
              <option value={45}>45 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowPOModal(true)}
            disabled={totalItemsToOrder === 0}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-colors ${
              totalItemsToOrder === 0
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Generate Draft PO ({totalUnitsToOrder} units)</span>
          </button>
        </div>
      </div>

      {/* Transparent Logic Banner */}
      <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 space-y-1">
          <p className="font-bold">Transparent Reorder Formula:</p>
          <p className="font-mono text-[11px] text-blue-800">
            Reorder Point = (Average Daily Sales × Supplier Lead Time) + Safety Stock
          </p>
          <p className="text-blue-700">
            When available stock drops below the reorder point, SellerPilot proposes ordering enough to cover{' '}
            <span className="font-bold">{coverageDays} days</span> of demand, respecting supplier Minimum Order Quantities (MOQ).
          </p>
        </div>
      </div>

      {/* Filter and Priority Pills */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter Priority:</span>
          {(['', 'CRITICAL', 'HIGH', 'NORMAL'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPriority(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                selectedPriority === p
                  ? 'bg-slate-800 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p === '' ? 'All Attention Items' : p}
            </button>
          ))}
        </div>

        <button
          onClick={loadData}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recalculate</span>
        </button>
      </div>

      {/* Restock Recommendations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-right">Avg Daily Sales</th>
                <th className="py-3 px-3 text-right">Est. Days Left</th>
                <th className="py-3 px-3 text-right">Lead Time</th>
                <th className="py-3 px-3 text-right">Safety Stock</th>
                <th className="py-3 px-3 text-right">Reorder Point</th>
                <th className="py-3 px-3 text-center">Priority</th>
                <th className="py-3 px-3 text-right">Suggested Qty</th>
                <th className="py-3 px-3">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    All active products have adequate stock coverage! No reordering required.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{item.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 max-w-xs">{item.reason}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">{item.currentStock}</td>
                    <td className="py-3 px-3 text-right text-slate-600 font-medium">{item.avgDailySales} /day</td>
                    <td className="py-3 px-3 text-right font-bold">
                      <span className={item.daysRemaining !== null && item.daysRemaining <= 3 ? 'text-rose-600' : 'text-slate-700'}>
                        {item.daysRemaining !== null ? `${item.daysRemaining} days` : 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">{item.supplierLeadTimeDays}d</td>
                    <td className="py-3 px-3 text-right text-slate-600">{item.safetyStock}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-blue-600">{item.reorderPoint}</td>
                    <td className="py-3 px-3 text-center">
                      {item.priority === 'CRITICAL' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          Critical
                        </span>
                      ) : item.priority === 'HIGH' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Low stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                          Reorder soon
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={customQuantities[item.productId] ?? item.suggestedOrderQty}
                        onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 rounded border border-slate-300 text-right font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{item.supplierName}</div>
                      <div className="text-[10px] text-slate-400">MOQ: {item.minOrderQty}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Draft Purchase Order Printable Modal */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-800">Draft Purchase Order Summary</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print PO</span>
                </button>
                <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="text-center pb-3 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-900 uppercase">SELLERPILOT RESTOCK ORDER</h2>
                <p className="text-[11px] text-slate-500">Generated on {new Date().toLocaleDateString()}</p>
                <p className="text-[11px] text-slate-500">Target Coverage: {coverageDays} Days</p>
              </div>

              <div className="space-y-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-[10px] text-slate-500 uppercase">
                      <th className="pb-2">Product / SKU</th>
                      <th className="pb-2">Supplier</th>
                      <th className="pb-2 text-right">Current</th>
                      <th className="pb-2 text-right">Order Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items
                      .filter((i) => (customQuantities[i.productId] ?? i.suggestedOrderQty) > 0)
                      .map((item) => (
                        <tr key={item.productId} className="py-2">
                          <td className="py-2">
                            <div className="font-bold text-slate-800">{item.productName}</div>
                            <div className="text-[10px] text-slate-500">SKU: {item.sku}</div>
                          </td>
                          <td className="py-2 text-slate-600">{item.supplierName}</td>
                          <td className="py-2 text-right text-slate-600">{item.currentStock}</td>
                          <td className="py-2 text-right font-bold text-blue-700 text-sm">
                            {customQuantities[item.productId] ?? item.suggestedOrderQty} units
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t border-slate-300 flex justify-between text-sm font-bold text-slate-900">
                <span>TOTAL PROPOSED UNITS:</span>
                <span>{totalUnitsToOrder} units across {totalItemsToOrder} products</span>
              </div>

              <p className="text-[10px] text-slate-400 text-center pt-2">
                Note: Verify supplier minimum order quantities (MOQ) and pricing before dispatch.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
