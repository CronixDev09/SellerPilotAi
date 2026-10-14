import { contextBridge, ipcRenderer } from 'electron';

export const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (input: any) => ipcRenderer.invoke('settings:update', input),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:get'),
  addCategory: (name: string, color?: string) => ipcRenderer.invoke('categories:add', { name, color }),

  // Products
  getProducts: (options?: any) => ipcRenderer.invoke('products:get', options),
  getProductById: (id: number) => ipcRenderer.invoke('products:getById', id),
  createProduct: (input: any) => ipcRenderer.invoke('products:create', input),
  updateProduct: (id: number, input: any) => ipcRenderer.invoke('products:update', { id, input }),
  archiveProduct: (id: number, archive: boolean) => ipcRenderer.invoke('products:archive', { id, archive }),
  adjustStock: (args: { productId: number; quantityDelta: number; movementType: string; reference?: string; notes?: string }) =>
    ipcRenderer.invoke('products:adjustStock', args),
  getStockMovements: (options?: any) => ipcRenderer.invoke('products:getMovements', options),
  validateProductsCsv: (csvText: string) => ipcRenderer.invoke('products:validateCsv', csvText),
  importProductsCsv: (csvText: string) => ipcRenderer.invoke('products:importCsv', csvText),
  exportProductsCsv: () => ipcRenderer.invoke('products:exportCsv'),

  // Sales
  getSales: (options?: any) => ipcRenderer.invoke('sales:get', options),
  getSaleById: (id: number) => ipcRenderer.invoke('sales:getById', id),
  recordSale: (input: any) => ipcRenderer.invoke('sales:record', input),
  cancelSale: (saleId: number, reason: string) => ipcRenderer.invoke('sales:cancel', { saleId, reason }),
  exportSalesCsv: () => ipcRenderer.invoke('sales:exportCsv'),

  // Analytics & Dashboard
  getDashboardMetrics: (periodDays: number) => ipcRenderer.invoke('analytics:dashboard', periodDays),
  getSalesAnalytics: (periodDays: number) => ipcRenderer.invoke('analytics:sales', periodDays),

  // Restock Planner
  getRestockRecommendations: (options?: any) => ipcRenderer.invoke('restock:getRecommendations', options),
  exportRestockCsv: () => ipcRenderer.invoke('restock:exportCsv'),

  // Suppliers
  getSuppliers: () => ipcRenderer.invoke('suppliers:get'),
  getSupplierById: (id: number) => ipcRenderer.invoke('suppliers:getById', id),
  createSupplier: (input: any) => ipcRenderer.invoke('suppliers:create', input),
  updateSupplier: (id: number, input: any) => ipcRenderer.invoke('suppliers:update', { id, input }),

  // Local AI
  checkAiHealth: () => ipcRenderer.invoke('ai:checkHealth'),
  generateAiListing: (input: any) => ipcRenderer.invoke('ai:generateListing', input),
  getAiInsights: (question: string) => ipcRenderer.invoke('ai:getInsights', question),
  setAiConfig: (args: { endpoint?: string; model?: string }) => ipcRenderer.invoke('ai:setConfig', args),

  // Demo Mode
  seedDemoData: () => ipcRenderer.invoke('demo:seed'),
  resetDemoData: () => ipcRenderer.invoke('demo:reset'),

  // Backup & Restore
  createBackup: (customDir?: string) => ipcRenderer.invoke('backup:create', customDir),
  restoreBackup: (backupFilePath: string) => ipcRenderer.invoke('backup:restore', backupFilePath),
  getBackupHistory: () => ipcRenderer.invoke('backup:getHistory'),
  getDbInfo: () => ipcRenderer.invoke('backup:getDbInfo'),

  // File Dialogs
  openFileDialog: (options?: any) => ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (args: { defaultName: string; content: string; filters?: any[] }) =>
    ipcRenderer.invoke('dialog:saveFile', args),
  selectDirectoryDialog: () => ipcRenderer.invoke('dialog:selectDirectory'),
};

contextBridge.exposeInMainWorld('sellerPilot', api);
