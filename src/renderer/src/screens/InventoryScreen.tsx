import React, { useState, useEffect } from 'react';
import {
  Database,
  ArrowUpDown,
  History,
  Layers,
  Search,
  PlusCircle,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { Product, StockMovement, MovementType, StockStatus } from '../../../shared/types';
import { formatCurrency, formatNumber, formatDateTime } from '../utils/formatters';

interface InventoryScreenProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onDataChanged?: () => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ onNotify, onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<'levels' | 'movements'>('levels');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementType | ''>('');

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<MovementType>('MANUAL_ADJUSTMENT');
  const [adjustQuantity, setAdjustQuantity] = useState<string>('1');
  const [adjustReference, setAdjustReference] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, moves] = await Promise.all([
        window.sellerPilot.getProducts({ search: searchTerm }),
        window.sellerPilot.getStockMovements({
          movementType: movementFilter ? (movementFilter as MovementType) : undefined,
          limit: 100,
        }),
      ]);
      setProducts(prods);
      setMovements(moves);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load inventory records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, movementFilter]);

  const handleOpenAdjust = (p: Product) => {
    setSelectedProduct(p);
    setAdjustType('PURCHASE_RECEIPT');
    setAdjustQuantity('10');
    setAdjustReference('');
    setAdjustNotes('');
    setShowAdjustModal(true);
  };

  const handleExecuteAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseFloat(adjustQuantity);
    if (isNaN(qty) || qty === 0) {
      onNotify('Quantity must be a non-zero number', 'error');
      return;
    }

    // Adjust delta based on type
    const isSubtraction = ['DAMAGED_STOCK', 'SUPPLIER_RETURN'].includes(adjustType);
    const finalDelta = isSubtraction ? -Math.abs(qty) : Math.abs(qty);

    try {
      await window.sellerPilot.adjustStock({
        productId: selectedProduct.id,
        quantityDelta: finalDelta,
        movementType: adjustType,
        reference: adjustReference || undefined,
        notes: adjustNotes || undefined,
      });

      onNotify(
        `Stock adjusted for "${selectedProduct.name}": ${finalDelta >= 0 ? `+${finalDelta}` : finalDelta} units`,
        'success'
      );
      setShowAdjustModal(false);
      loadData();
      onDataChanged?.();
    } catch (err: any) {
      onNotify(err.message || 'Stock adjustment failed', 'error');
    }
  };

  // Valuation summary
  const totalUnits = products.reduce((acc, p) => acc + p.currentStock, 0);
  const totalCostValue = products.reduce((acc, p) => acc + (p.estimatedCostValuePaise || 0), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + (p.estimatedRetailValuePaise || 0), 0);
  const potentialMargin = totalRetailValue > 0 ? Math.round(((totalRetailValue - totalCostValue) / totalRetailValue) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Valuation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Inventory Units</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{formatNumber(totalUnits)}</div>
          <span className="text-[11px] text-slate-400">across {products.length} products</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Cost Valuation</span>
          <div className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(totalCostValue)}</div>
          <span className="text-[11px] text-slate-400">based on purchase cost</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Potential Retail Value</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(totalRetailValue)}</div>
          <span className="text-[11px] text-slate-400">based on selling price</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Gross Margin Potential</span>
          <div className="text-2xl font-bold text-purple-700 mt-1">{potentialMargin}%</div>
          <span className="text-[11px] text-slate-400">{formatCurrency(totalRetailValue - totalCostValue)} spread</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('levels')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'levels'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Stock Levels</span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'movements'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Movement Audit History ({movements.length})</span>
          </button>
        </div>

        <div className="pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Stock Levels */}
      {activeTab === 'levels' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Stock</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Cost Value</th>
                  <th className="py-3 px-3 text-right">Retail Value</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{p.name}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{p.sku}</td>
                      <td className="py-3 px-3 text-slate-600">{p.categoryName || '-'}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatNumber(p.currentStock)} {p.unit}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {p.stockStatus === 'IN_STOCK' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            In Stock
                          </span>
                        ) : p.stockStatus === 'LOW_STOCK' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Out of Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {formatCurrency(p.estimatedCostValuePaise)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {formatCurrency(p.estimatedRetailValuePaise)}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">{p.supplierName || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenAdjust(p)}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition-colors text-[11px]"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Stock Movements Audit Log */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter Movement Type:</span>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value as MovementType | '')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
            >
              <option value="">All Movement Types</option>
              <option value="OPENING_STOCK">Opening Stock</option>
              <option value="PURCHASE_RECEIPT">Purchase Receipt (+)</option>
              <option value="SALE">Sale (-)</option>
              <option value="CUSTOMER_RETURN">Customer Return (+)</option>
              <option value="SUPPLIER_RETURN">Supplier Return (-)</option>
              <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
              <option value="DAMAGED_STOCK">Damaged Stock (-)</option>
              <option value="CORRECTION">Correction</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Quantity Delta</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No movement audit records found.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(m.timestamp)}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800">{m.productName}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">SKU: {m.sku}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {m.movementType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          <span className={m.quantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{m.reference || '-'}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{m.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-800">Adjust Stock</h3>
                <p className="text-xs text-slate-500">{selectedProduct.name} ({selectedProduct.sku})</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdjust} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between">
                <span className="text-slate-500">Current Stock:</span>
                <span className="font-bold text-slate-800">{selectedProduct.currentStock} {selectedProduct.unit}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Movement Type *</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as MovementType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="PURCHASE_RECEIPT">Purchase Receipt (Add Stock +)</option>
                  <option value="MANUAL_ADJUSTMENT">Manual Adjustment (Add Stock +)</option>
                  <option value="DAMAGED_STOCK">Damaged Stock (Deduct Stock -)</option>
                  <option value="SUPPLIER_RETURN">Supplier Return (Deduct Stock -)</option>
                  <option value="CUSTOMER_RETURN">Customer Return (Add Stock +)</option>
                  <option value="CORRECTION">Correction (Inventory Audit)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Units *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference / PO #</label>
                <input
                  type="text"
                  placeholder="e.g. PO-2026-088"
                  value={adjustReference}
                  onChange={(e) => setAdjustReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Reason for adjustment..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
