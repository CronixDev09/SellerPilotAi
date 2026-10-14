import { AppDatabase } from '../db/database';
import { Supplier, Product, RestockItem } from '../../shared/types';
import { RestockService } from './restockService';

export class SupplierService {
  private restockService: RestockService;

  constructor(private db: AppDatabase) {
    this.restockService = new RestockService(db);
  }

  public getSuppliers(): Supplier[] {
    const rows = this.db.all<any>(`
      SELECT s.*, COUNT(p.id) as product_count
      FROM suppliers s
      LEFT JOIN products p ON p.supplier_id = s.id AND p.is_archived = 0
      GROUP BY s.id
      ORDER BY s.name ASC;
    `);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      contactPerson: r.contact_person,
      phone: r.phone,
      email: r.email,
      address: r.address,
      leadTimeDays: Number(r.lead_time_days || 7),
      minOrderQty: Number(r.min_order_qty || 1),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      productCount: r.product_count || 0,
    }));
  }

  public getSupplierById(id: number): (Supplier & {
    products: Product[];
    stockShortages: Product[];
    restockSuggestions: RestockItem[];
  }) | null {
    const s = this.db.get<any>('SELECT * FROM suppliers WHERE id = ?;', [id]);
    if (!s) return null;

    const productRows = this.db.all<any>(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.supplier_id = ? AND p.is_archived = 0
      ORDER BY p.name ASC;
    `, [id]);

    const products: Product[] = productRows.map(r => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      categoryId: r.category_id,
      categoryName: r.category_name,
      unit: r.unit || 'pcs',
      purchaseCostPaise: r.purchase_cost_paise,
      sellingPricePaise: r.selling_price_paise,
      currentStock: Number(r.current_stock),
      minStockThreshold: Number(r.min_stock_threshold),
      safetyStock: Number(r.safety_stock),
      supplierId: r.supplier_id,
      supplierLeadTimeDays: Number(r.supplier_lead_time_days || 7),
      isArchived: false,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const stockShortages = products.filter(p => p.currentStock <= p.minStockThreshold);
    const allRestock = this.restockService.getRestockRecommendations();
    const restockSuggestions = allRestock.filter(r => r.supplierId === id);

    return {
      id: s.id,
      name: s.name,
      contactPerson: s.contact_person,
      phone: s.phone,
      email: s.email,
      address: s.address,
      leadTimeDays: Number(s.lead_time_days || 7),
      minOrderQty: Number(s.min_order_qty || 1),
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      productCount: products.length,
      products,
      stockShortages,
      restockSuggestions,
    };
  }

  public createSupplier(input: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    leadTimeDays?: number;
    minOrderQty?: number;
    notes?: string;
  }): Supplier {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error('Supplier name is required');

    const now = new Date().toISOString();
    const res = this.db.run(
      `INSERT INTO suppliers (
        name, contact_person, phone, email, address, lead_time_days,
        min_order_qty, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        trimmed,
        input.contactPerson || null,
        input.phone || null,
        input.email || null,
        input.address || null,
        input.leadTimeDays ?? 7,
        input.minOrderQty ?? 1,
        input.notes || null,
        now,
        now,
      ]
    );

    return {
      id: res.lastInsertRowid,
      name: trimmed,
      contactPerson: input.contactPerson,
      phone: input.phone,
      email: input.email,
      address: input.address,
      leadTimeDays: input.leadTimeDays ?? 7,
      minOrderQty: input.minOrderQty ?? 1,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
      productCount: 0,
    };
  }

  public updateSupplier(id: number, input: Partial<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>): Supplier {
    const existing = this.db.get('SELECT id FROM suppliers WHERE id = ?;', [id]);
    if (!existing) throw new Error(`Supplier with ID ${id} not found`);

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE suppliers SET
        name = COALESCE(?, name),
        contact_person = COALESCE(?, contact_person),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        lead_time_days = COALESCE(?, lead_time_days),
        min_order_qty = COALESCE(?, min_order_qty),
        notes = COALESCE(?, notes),
        updated_at = ?
      WHERE id = ?;`,
      [
        input.name?.trim(),
        input.contactPerson,
        input.phone,
        input.email,
        input.address,
        input.leadTimeDays,
        input.minOrderQty,
        input.notes,
        now,
        id,
      ]
    );

    const updated = this.getSupplierById(id);
    return updated!;
  }
}
