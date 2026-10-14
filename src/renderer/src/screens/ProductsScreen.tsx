import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  AlertTriangle,
  Archive,
  RefreshCw,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Product, Category, Supplier, StockStatus, CsvValidationResult } from '../../../shared/types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface ProductsScreenProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onDataChanged?: () => void;
}

export const ProductsScreen: React.FC<ProductsScreenProps> = ({ onNotify, onDataChanged }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<StockStatus | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<CsvValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    importedCount: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    categoryId: '',
    brand: '',
    barcode: '',
    unit: 'pcs',
    purchaseCost: '',
    sellingPrice: '',
    initialStock: '',
    minStockThreshold: '5',
    safetyStock: '5',
    supplierId: '',
    supplierLeadTimeDays: '7',
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats, sups] = await Promise.all([
        window.sellerPilot.getProducts({
          search: searchTerm,
          categoryId: selectedCategory,
          stockStatus: selectedStatus,
          includeArchived: showArchived,
        }),
        window.sellerPilot.getCategories(),
        window.sellerPilot.getSuppliers(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, selectedCategory, selectedStatus, showArchived]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      categoryId: categories[0]?.id?.toString() || '',
      brand: '',
      barcode: '',
      unit: 'pcs',
      purchaseCost: '',
      sellingPrice: '',
      initialStock: '0',
      minStockThreshold: '5',
      safetyStock: '5',
      supplierId: suppliers[0]?.id?.toString() || '',
      supplierLeadTimeDays: '7',
      description: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      name: p.name,
      categoryId: p.categoryId?.toString() || '',
      brand: p.brand || '',
      barcode: p.barcode || '',
      unit: p.unit || 'pcs',
      purchaseCost: (p.purchaseCostPaise / 100).toString(),
      sellingPrice: (p.sellingPricePaise / 100).toString(),
      initialStock: p.currentStock.toString(),
      minStockThreshold: p.minStockThreshold.toString(),
      safetyStock: p.safetyStock.toString(),
      supplierId: p.supplierId?.toString() || '',
      supplierLeadTimeDays: p.supplierLeadTimeDays.toString(),
      description: p.description || '',
    });
    setShowAddModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const purchaseCostPaise = Math.round(parseFloat(formData.purchaseCost || '0') * 100);
      const sellingPricePaise = Math.round(parseFloat(formData.sellingPrice || '0') * 100);

      if (editingProduct) {
        await window.sellerPilot.updateProduct(editingProduct.id, {
          sku: formData.sku,
          name: formData.name,
          categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
          brand: formData.brand,
          barcode: formData.barcode,
          unit: formData.unit,
          purchaseCostPaise,
          sellingPricePaise,
          minStockThreshold: parseFloat(formData.minStockThreshold || '5'),
          safetyStock: parseFloat(formData.safetyStock || '5'),
          supplierId: formData.supplierId ? Number(formData.supplierId) : undefined,
          supplierLeadTimeDays: parseInt(formData.supplierLeadTimeDays || '7'),
          description: formData.description,
        });
        onNotify(`Product "${formData.name}" updated successfully`, 'success');
      } else {
        await window.sellerPilot.createProduct({
          sku: formData.sku,
          name: formData.name,
          categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
          brand: formData.brand,
          barcode: formData.barcode,
          unit: formData.unit,
          purchaseCostPaise,
          sellingPricePaise,
          initialStock: parseFloat(formData.initialStock || '0'),
          minStockThreshold: parseFloat(formData.minStockThreshold || '5'),
          safetyStock: parseFloat(formData.safetyStock || '5'),
          supplierId: formData.supplierId ? Number(formData.supplierId) : undefined,
          supplierLeadTimeDays: parseInt(formData.supplierLeadTimeDays || '7'),
          description: formData.description,
        });
        onNotify(`Product "${formData.name}" created successfully`, 'success');
      }
      setShowAddModal(false);
      loadData();
      onDataChanged?.();
    } catch (err: any) {
      onNotify(err.message || 'Failed to save product', 'error');
    }
  };

  const handleArchiveToggle = async (p: Product) => {
    const action = p.isArchived ? 'unarchive' : 'archive';
    if (confirm(`Are you sure you want to ${action} product "${p.name}"?`)) {
      try {
        await window.sellerPilot.archiveProduct(p.id, !p.isArchived);
        onNotify(`Product "${p.name}" ${action}d successfully`, 'success');
        loadData();
        onDataChanged?.();
      } catch (err: any) {
        onNotify(err.message || 'Operation failed', 'error');
      }
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await window.sellerPilot.exportProductsCsv();
      const defaultName = `sellerpilot_products_${new Date().toISOString().slice(0, 10)}.csv`;
      const savedPath = await window.sellerPilot.saveFileDialog({
        defaultName,
        content: csv,
        filters: [{ name: 'CSV File', extensions: ['csv'] }],
      });
      if (savedPath) {
        onNotify(`Products exported successfully to ${savedPath}`, 'success');
      }
    } catch (err: any) {
      onNotify(err.message || 'Export failed', 'error');
    }
  };

  const handleValidateCsv = async (textToValidate?: string) => {
    const raw = (textToValidate !== undefined ? textToValidate : importCsvText).trim();
    if (!raw) {
      onNotify('Please select a file or paste CSV text first', 'error');
      return;
    }
    try {
      setIsValidating(true);
      const res = await window.sellerPilot.validateProductsCsv(raw);
      setImportPreview(res);
      setImportResult(null);
    } catch (err: any) {
      onNotify(err.message || 'CSV validation failed', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSelectCsvFile = async () => {
    try {
      const res = await window.sellerPilot.openFileDialog({
        filters: [{ name: 'CSV Files', extensions: ['csv', 'txt'] }],
      });
      if (res && res.content) {
        setImportCsvText(res.content);
        await handleValidateCsv(res.content);
      }
    } catch (err: any) {
      onNotify('Failed to read CSV file', 'error');
    }
  };

  const handleExecuteImport = async () => {
    if (!importCsvText.trim()) {
      onNotify('Please select or paste CSV data first', 'error');
      return;
    }
    try {
      const res = await window.sellerPilot.importProductsCsv(importCsvText);
      setImportResult(res);
      if (res.success) {
        onNotify(`Successfully imported ${res.importedCount} products`, 'success');
        setShowImportModal(false);
        setImportPreview(null);
        setImportCsvText('');
        loadData();
        onDataChanged?.();
      } else {
        onNotify('Import failed: please resolve validation errors', 'error');
      }
    } catch (err: any) {
      onNotify(err.message || 'Import failed', 'error');
    }
  };

  const handleCancelImport = () => {
    setShowImportModal(false);
    setImportPreview(null);
    setImportCsvText('');
    setImportResult(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Product Catalog</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage SKUs, stock levels, suppliers, and pricing</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
            className="py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus((e.target.value as StockStatus) || undefined)}
            className="py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <option value="">All Stock Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Archived</span>
          </label>

          <button
            onClick={loadData}
            title="Refresh Catalog"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3 text-right">Purchase Cost</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No products found matching the selected filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/70 transition-colors ${p.isArchived ? 'opacity-50 bg-slate-50/30' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</div>
                    </td>
                    <td className="py-3 px-3">
                      {p.categoryName ? (
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{
                            backgroundColor: `${p.categoryColor || '#3B82F6'}15`,
                            color: p.categoryColor || '#3B82F6',
                          }}
                        >
                          {p.categoryName}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">{p.brand || '-'}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-600">
                      {formatCurrency(p.purchaseCostPaise)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {formatCurrency(p.sellingPricePaise)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      <span className={p.currentStock <= 0 ? 'text-rose-600' : p.currentStock <= p.minStockThreshold ? 'text-amber-600' : 'text-slate-800'}>
                        {formatNumber(p.currentStock)} {p.unit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{p.supplierName || 'Unassigned'}</div>
                      <div className="text-[10px] text-slate-400">{p.supplierLeadTimeDays}d lead time</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {p.isArchived ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Archived
                        </span>
                      ) : p.stockStatus === 'IN_STOCK' ? (
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
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(p)}
                          title={p.isArchived ? 'Restore Product' : 'Archive Product'}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing {products.length} products</span>
          <span>Click Edit to update details, thresholds, and suppliers</span>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WM-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Wireless Mouse"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. LogiTech"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. pcs, kg, box"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Opening Stock</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.initialStock}
                    onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">This will be recorded in stock movements as Opening Stock.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Stock Threshold</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.minStockThreshold}
                    onChange={(e) => setFormData({ ...formData, minStockThreshold: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Triggers Low Stock warning badge</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Safety Stock (Restock Buffer)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.safetyStock}
                    onChange={(e) => setFormData({ ...formData, safetyStock: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used in Smart Restock Planner formula</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Supplier</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">No Supplier Assigned</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.leadTimeDays}d lead time)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Lead Time (Days)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={formData.supplierLeadTimeDays}
                    onChange={(e) => setFormData({ ...formData, supplierLeadTimeDays: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional details or specifications..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal with Interactive Preview */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-2xl w-full ${importPreview ? 'max-w-4xl' : 'max-w-xl'} max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150`}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-800">
                  {importPreview ? 'Review & Confirm CSV Import' : 'Import Products from CSV'}
                </h3>
              </div>
              <button
                onClick={handleCancelImport}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              {!importPreview ? (
                // Step 1: Select / Paste CSV
                <>
                  <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1.5">
                    <p className="font-semibold text-blue-950">Supported CSV Columns:</p>
                    <p className="font-mono text-[11px] text-blue-800">
                      Required: SKU, Product Name, Selling Price
                    </p>
                    <p className="text-[11px] text-blue-700">
                      Optional: Category, Purchase Cost, Stock Quantity, Minimum Stock Threshold, Supplier, Brand, Barcode, Unit.
                    </p>
                    <p className="text-[11px] text-blue-600">
                      Duplicate SKUs and invalid numbers will be detected and highlighted in the preview.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSelectCsvFile}
                      className="px-4 py-2.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Upload className="w-4 h-4 text-slate-600" />
                      <span>Choose CSV File from Computer</span>
                    </button>
                    <span className="text-xs text-slate-400">or paste CSV text directly below:</span>
                  </div>

                  <textarea
                    rows={8}
                    placeholder="SKU,Product Name,Category,Purchase Cost,Selling Price,Stock,Min Threshold,Supplier&#10;WM-001,Wireless Mouse,Accessories,320,599,25,5,Apex Wholesale&#10;KB-002,Mechanical Keyboard,Electronics,1800,2999,10,5,Apex Wholesale"
                    value={importCsvText}
                    onChange={(e) => setImportCsvText(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />

                  <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCancelImport}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isValidating || !importCsvText.trim()}
                      onClick={() => handleValidateCsv()}
                      className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
                    >
                      {isValidating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Validating...</span>
                        </>
                      ) : (
                        <span>Preview & Validate CSV</span>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                // Step 2: Interactive Import Preview Table
                <>
                  {/* Summary Metric Chips */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-slate-500">Total Rows: </span>
                        <span className="font-bold text-slate-800">{importPreview.totalRows}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-slate-500">Valid: </span>
                        <span className="font-bold text-emerald-700">{importPreview.validCount}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-slate-500">Errors: </span>
                        <span className="font-bold text-rose-700">{importPreview.errorCount}</span>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Headers found: {importPreview.headersFound.join(', ')}
                    </span>
                  </div>

                  {/* Warning banner for errors */}
                  {importPreview.errorCount > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{importPreview.errorCount} row(s) contain validation errors.</span>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          Invalid rows will not be saved. You can proceed to import only the valid rows, or go back to correct the CSV data.
                        </p>
                      </div>
                    </div>
                  )}

                  {importPreview.validCount === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 text-center">
                      <p className="font-bold">No valid product records found.</p>
                      <p className="text-[11px] text-amber-800 mt-1">
                        Please check the errors indicated in the preview below, correct the CSV, and try again.
                      </p>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[46vh] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 w-8">#</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3 text-right">Cost</th>
                          <th className="py-2.5 px-3 text-right">Selling Price</th>
                          <th className="py-2.5 px-3 text-right">Stock</th>
                          <th className="py-2.5 px-3 text-right">Min Stock</th>
                          <th className="py-2.5 px-3">Supplier</th>
                          <th className="py-2.5 px-3">Validation Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        {importPreview.rows.map((r) => (
                          <tr
                            key={r.rowNumber}
                            className={r.isValid ? 'hover:bg-slate-50/60' : 'bg-rose-50/40 hover:bg-rose-50/70'}
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">{r.rowNumber}</td>
                            <td className="py-2.5 px-3">
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" /> Error
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold font-mono text-slate-800">{r.sku || '-'}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{r.name || '-'}</td>
                            <td className="py-2.5 px-3 text-slate-600">{r.category || '-'}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(r.purchaseCostPaise)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatCurrency(r.sellingPricePaise)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700 font-medium">{r.currentStock}</td>
                            <td className="py-2.5 px-3 text-right text-slate-500">{r.minStockThreshold}</td>
                            <td className="py-2.5 px-3 text-slate-600">{r.supplier || '-'}</td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {r.isValid ? (
                                <span className="text-emerald-700 font-medium">Ready to import</span>
                              ) : (
                                <span className="text-rose-600 font-semibold">{r.errors.join('; ')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setImportPreview(null)}
                      className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      ← Back to Edit CSV
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCancelImport}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={importPreview.validCount === 0}
                        onClick={handleExecuteImport}
                        className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Import {importPreview.validCount} Valid Product{importPreview.validCount !== 1 ? 's' : ''}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
