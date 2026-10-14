import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Phone,
  Mail,
  MapPin,
  Clock,
  Package,
  AlertTriangle,
  ChevronRight,
  X,
} from 'lucide-react';
import { Supplier, Product, RestockItem } from '../../../shared/types';
import { formatCurrency } from '../utils/formatters';

interface SuppliersScreenProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SuppliersScreen: React.FC<SuppliersScreenProps> = ({ onNotify }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<(Supplier & {
    products: Product[];
    stockShortages: Product[];
    restockSuggestions: RestockItem[];
  }) | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    leadTimeDays: '7',
    minOrderQty: '10',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await window.sellerPilot.getSuppliers();
      setSuppliers(list);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      leadTimeDays: '7',
      minOrderQty: '10',
      notes: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (s: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      leadTimeDays: s.leadTimeDays.toString(),
      minOrderQty: s.minOrderQty.toString(),
      notes: s.notes || '',
    });
    setShowAddModal(true);
  };

  const handleViewDetail = async (s: Supplier) => {
    try {
      const detail = await window.sellerPilot.getSupplierById(s.id);
      setSelectedSupplierDetail(detail);
    } catch (err: any) {
      onNotify('Failed to fetch supplier details', 'error');
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await window.sellerPilot.updateSupplier(editingSupplier.id, {
          name: formData.name,
          contactPerson: formData.contactPerson,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          leadTimeDays: parseInt(formData.leadTimeDays || '7'),
          minOrderQty: parseInt(formData.minOrderQty || '1'),
          notes: formData.notes,
        });
        onNotify(`Supplier "${formData.name}" updated successfully`, 'success');
      } else {
        await window.sellerPilot.createSupplier({
          name: formData.name,
          contactPerson: formData.contactPerson,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          leadTimeDays: parseInt(formData.leadTimeDays || '7'),
          minOrderQty: parseInt(formData.minOrderQty || '1'),
          notes: formData.notes,
        });
        onNotify(`Supplier "${formData.name}" added successfully`, 'success');
      }
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Failed to save supplier', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Supplier Directory</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage vendors, lead times, contact details, and stock shortages</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.map((s) => (
          <div
            key={s.id}
            onClick={() => handleViewDetail(s)}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3">
                  <Truck className="w-5 h-5" />
                </div>
                <button
                  onClick={(e) => handleOpenEdit(s, e)}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Edit
                </button>
              </div>

              <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                {s.name}
              </h3>
              {s.contactPerson && (
                <p className="text-xs text-slate-500 mt-0.5">Contact: {s.contactPerson}</p>
              )}

              <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{s.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{s.leadTimeDays}d lead time</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                <span>{s.productCount} products</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Supplier Detail Modal */}
      {selectedSupplierDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-800">{selectedSupplierDetail.name}</h3>
                <p className="text-xs text-slate-500">
                  {selectedSupplierDetail.contactPerson} • {selectedSupplierDetail.leadTimeDays} days lead time • MOQ: {selectedSupplierDetail.minOrderQty} units
                </p>
              </div>
              <button
                onClick={() => setSelectedSupplierDetail(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Shortages Alert */}
              {selectedSupplierDetail.stockShortages.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{selectedSupplierDetail.stockShortages.length} Stock Shortages Detected</span>
                  </div>
                  <div className="space-y-1">
                    {selectedSupplierDetail.stockShortages.map((p) => (
                      <div key={p.id} className="flex justify-between text-amber-900">
                        <span>{p.name} ({p.sku})</span>
                        <span className="font-bold">Stock: {p.currentStock} / Min: {p.minStockThreshold}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Associated Products */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Associated Products ({selectedSupplierDetail.products.length})</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3 text-right">Cost</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSupplierDetail.products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">{p.name}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{p.sku}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(p.purchaseCostPaise)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800">{formatCurrency(p.sellingPricePaise)}</td>
                          <td className="py-2 px-3 text-right font-bold">{p.currentStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedSupplierDetail.notes && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1">Notes</h4>
                  <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {selectedSupplierDetail.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Electronics Wholesale"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="orders@supplier.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Typical Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address / Warehouse Location</label>
                <input
                  type="text"
                  placeholder="Street, City, Postal Code"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Payment terms, bank details, or catalog notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
                >
                  {editingSupplier ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
