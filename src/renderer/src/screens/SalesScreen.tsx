import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Receipt,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Building,
} from 'lucide-react';
import { Product, Sale, SaleItemInput, PaymentMethod } from '../../../shared/types';
import { formatCurrency, formatDateTime } from '../utils/formatters';

interface SalesScreenProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onDataChanged?: () => void;
}

export const SalesScreen: React.FC<SalesScreenProps> = ({ onNotify, onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // POS State
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<
    Array<{
      product: Product;
      quantity: number;
      unitPricePaise: number;
      discountPaise: number;
    }>
  >([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [overallDiscount, setOverallDiscount] = useState<string>('0');
  const [saleNotes, setSaleNotes] = useState('');
  const [allowNegativeStockOverride, setAllowNegativeStockOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt Modal
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  // Cancellation Modal
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer return / refund requested');

  // History Filter
  const [historySearch, setHistorySearch] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, sList] = await Promise.all([
        window.sellerPilot.getProducts(),
        window.sellerPilot.getSales({ search: historySearch, limit: 100 }),
      ]);
      setProducts(prods);
      setSales(sList);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load sales data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [historySearch]);

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0 && !allowNegativeStockOverride) {
      onNotify(`"${product.name}" is out of stock! Enable override to oversell.`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPricePaise: product.sellingPricePaise,
          discountPaise: 0,
        },
      ];
    });
  };

  const updateCartQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const calculateSubtotalPaise = () => {
    return cart.reduce(
      (acc, item) => acc + item.quantity * item.unitPricePaise - item.discountPaise,
      0
    );
  };

  const calculateTotalPaise = () => {
    const sub = calculateSubtotalPaise();
    const disc = Math.round(parseFloat(overallDiscount || '0') * 100);
    return Math.max(0, sub - disc);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      onNotify('Cannot complete an empty sale', 'error');
      return;
    }
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const itemsInput: SaleItemInput[] = cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
        unitSellingPricePaise: c.unitPricePaise,
        discountPaise: c.discountPaise,
      }));

      const newSale = await window.sellerPilot.recordSale({
        items: itemsInput,
        discountPaise: Math.round(parseFloat(overallDiscount || '0') * 100),
        paymentMethod,
        notes: saleNotes || undefined,
        allowNegativeStockOverride,
      });

      onNotify(`Sale ${newSale.saleReference} recorded successfully!`, 'success');
      setCart([]);
      setOverallDiscount('0');
      setSaleNotes('');
      setViewingSale(newSale);
      loadData();
      onDataChanged?.();
    } catch (err: any) {
      onNotify(err.message || 'Failed to record sale', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSale = async () => {
    if (!cancellingSale) return;
    try {
      await window.sellerPilot.cancelSale(cancellingSale.id, cancelReason);
      onNotify(`Sale ${cancellingSale.saleReference} cancelled and stock restored`, 'success');
      setCancellingSale(null);
      loadData();
      onDataChanged?.();
    } catch (err: any) {
      onNotify(err.message || 'Failed to cancel sale', 'error');
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await window.sellerPilot.exportSalesCsv();
      const savedPath = await window.sellerPilot.saveFileDialog({
        defaultName: `sellerpilot_sales_${new Date().toISOString().slice(0, 10)}.csv`,
        content: csv,
        filters: [{ name: 'CSV File', extensions: ['csv'] }],
      });
      if (savedPath) {
        onNotify(`Sales records exported to ${savedPath}`, 'success');
      }
    } catch (err: any) {
      onNotify('Export failed', 'error');
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Tab Switcher & Export */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('pos')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'pos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Point of Sale (New Sale)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Sales History ({sales.length})</span>
          </button>
        </div>

        <button
          onClick={handleExportCsv}
          className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Sales CSV</span>
        </button>
      </div>

      {/* TAB 1: POS / Sales Entry Screen */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Product Selector (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">Select Products to Add</h3>
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products or scan barcode..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-sm bg-slate-50/50 hover:bg-white text-left transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">SKU: {p.sku}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          p.currentStock <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : p.currentStock <= p.minStockThreshold
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {p.currentStock} left
                      </span>
                    </div>
                    <h4 className="font-semibold text-xs text-slate-800 mt-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {p.name}
                    </h4>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/50">
                    <span className="font-bold text-sm text-slate-900">
                      {formatCurrency(p.sellingPricePaise)}
                    </span>
                    <span className="text-xs text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                      + Add
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={allowNegativeStockOverride}
                onChange={(e) => setAllowNegativeStockOverride(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Allow overselling (Negative stock override recorded in audit history)</span>
            </label>
          </div>

          {/* Right: Checkout Cart & Payment (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800">Current Sale</h3>
              <span className="text-xs text-slate-500 font-medium">{cart.length} items</span>
            </div>

            {/* Cart Items List */}
            <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Cart is empty. Click items on the left to add.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 truncate">{item.product.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatCurrency(item.unitPricePaise)} each
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-slate-200 rounded-md bg-white">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          className="px-2 py-0.5 text-slate-500 hover:bg-slate-100 font-bold"
                        >
                          -
                        </button>
                        <span className="px-2 font-bold text-slate-800">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          className="px-2 py-0.5 text-slate-500 hover:bg-slate-100 font-bold"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-bold text-slate-900 w-16 text-right">
                        {formatCurrency(item.quantity * item.unitPricePaise)}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Discounts and Totals */}
            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(calculateSubtotalPaise())}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Special Discount (₹):</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-slate-200 text-right font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
                <span>Total Amount:</span>
                <span className="text-xl text-blue-600">{formatCurrency(calculateTotalPaise())}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method Label</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'UPI' as PaymentMethod, label: 'UPI', icon: QrCode },
                  { id: 'CASH' as PaymentMethod, label: 'Cash', icon: Banknote },
                  { id: 'CARD' as PaymentMethod, label: 'Card', icon: CreditCard },
                  { id: 'BANK_TRANSFER' as PaymentMethod, label: 'Bank', icon: Building },
                ].map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-2 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === pm.id
                          ? 'border-blue-600 bg-blue-50/70 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <input
                type="text"
                placeholder="Sale notes / customer name..."
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || isSubmitting}
              className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-sm flex items-center justify-center gap-2 transition-all ${
                cart.length === 0 || isSubmitting
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSubmitting ? 'Recording Sale...' : `Complete Sale (${formatCurrency(calculateTotalPaise())})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Sales History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reference, notes, payment..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-500">Showing last {sales.length} transactions</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        No sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    sales.map((s) => (
                      <tr
                        key={s.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          s.status === 'cancelled' ? 'opacity-50 bg-slate-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-slate-500">{formatDateTime(s.saleDate)}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">{s.saleReference}</td>
                        <td className="py-3 px-3 text-slate-600">{s.itemCount} items</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(s.finalAmountPaise)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {s.status === 'completed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Completed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={async () => {
                                const details = await window.sellerPilot.getSaleById(s.id);
                                if (details) setViewingSale(details);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
                            >
                              Receipt
                            </button>
                            {s.status === 'completed' && (
                              <button
                                onClick={() => setCancellingSale(s)}
                                title="Cancel and reverse sale"
                                className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px]"
                              >
                                Cancel / Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between no-print">
              <h3 className="font-bold text-base text-slate-800">Sale Receipt</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => setViewingSale(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="text-base font-bold text-slate-900 uppercase">SELLERPILOT STORE</h2>
                <p className="text-[11px] text-slate-500">Retail Invoice</p>
                <p className="text-[11px] text-slate-500 mt-1">Ref: {viewingSale.saleReference}</p>
                <p className="text-[10px] text-slate-400">{formatDateTime(viewingSale.saleDate)}</p>
              </div>

              <div className="space-y-1.5 divide-y divide-slate-100">
                {viewingSale.items?.map((item) => (
                  <div key={item.id} className="pt-1.5 flex justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{item.productName}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.quantity} x {formatCurrency(item.unitSellingPricePaise)}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">{formatCurrency(item.totalAmountPaise)}</div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-dashed border-slate-300 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(viewingSale.totalAmountPaise)}</span>
                </div>
                {viewingSale.discountPaise > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(viewingSale.discountPaise)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(viewingSale.finalAmountPaise)}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1">
                  <span>Payment Mode:</span>
                  <span className="font-semibold uppercase">{viewingSale.paymentMethod}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-dashed border-slate-300">
                Thank you for your business!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-rose-700">Cancel & Return Sale</h3>
              <button onClick={() => setCancellingSale(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to cancel sale <span className="font-bold text-slate-900">{cancellingSale.saleReference}</span>?
                This will automatically restore inventory stock levels and log a Customer Return audit event.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Cancellation</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancellingSale(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Keep Sale
                </button>
                <button
                  type="button"
                  onClick={handleCancelSale}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
