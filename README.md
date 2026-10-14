# SellerPilot AI 🚀

> **Version:** 1.0.0  
> **Platform:** Windows 10 & Windows 11  
> **Application Type:** Offline-First Desktop Application with Optional Local AI Inference

SellerPilot AI is an offline-first desktop application designed for small retailers, online sellers, and boutique warehouse operators. It unifies inventory control, point of sale, live analytics, smart reorder planning, and local open-weight AI intelligence into a fast, privacy-respecting native experience.

---

## 📸 Interface & Design System

The interface matches a clean, modern enterprise design:
* **Sidebar:** Deep Navy (`#0B132B`) with dynamic business store status indicator.
* **Header:** Dynamic greeting, time period selector, offline-readiness badge, local AI readiness pill, alerts, and store avatar.
* **Metrics:** 4 live cards for Active Products, Units in Stock, Sales Revenue (₹), and Low Stock Items with period-over-period trend percentages.
* **Visualizations:** Dual-curve area chart for Revenue & Units Sold over time, and an Inventory by Category donut chart with centered unit totals and proportional shares.
* **Actionable Tables:** Top-selling products table with stock status badges and Restock Attention table with priority badges.

---

## ✨ Key Capabilities

### 1. Offline-First Architecture & Privacy
* Core inventory, sales entry, reorder calculations, and analytics operate **100% locally** on your machine with zero internet dependency.
* Data is stored in a normalized SQLite database with foreign keys, versioned migrations, and ACID transactions.
* No mandatory cloud accounts, no hidden telemetry, and zero transmission of customer records.

### 2. Product & Inventory Management
* Full catalog tracking: SKU, Barcode, Category, Brand, Unit, Purchase Cost (in minor units / paise), Selling Price, Current Stock, Min Threshold, and Safety Stock.
* Strict validation preventing duplicate SKUs, negative pricing, and invalid quantities.
* Complete stock movement audit history: `OPENING_STOCK`, `PURCHASE_RECEIPT`, `SALE`, `CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `MANUAL_ADJUSTMENT`, `DAMAGED_STOCK`, and `CORRECTION`.
* Safe CSV Import and Export with formula injection protection (`'`, `+`, `-`, `=`, `@`).

### 3. Sales Management & Point of Sale (POS)
* Fast sales entry with real-time stock deduction in an atomic database transaction.
* Line item pricing and cost basis are locked to each sale, ensuring historical profit reports remain 100% accurate even when catalog prices change later.
* Prevents overselling unless negative stock override is explicitly toggled (and logged).
* Auditable sale cancellation and refund process that automatically restores inventory and logs a customer return movement.
* Printable retail invoice receipt (`window.print()`).

### 4. Smart Restock Planner
* Calculates reorder points transparently:
  $$\text{Reorder Point} = (\text{Average Daily Sales} \times \text{Supplier Lead Time}) + \text{Safety Stock}$$
* Recommends suggested reorder quantities:
  $$\text{Suggested Order Qty} = \max(\text{Supplier MOQ}, \lceil(\text{Avg Daily Sales} \times \text{Coverage Days}) + \text{Safety Stock} - \text{Current Stock}\rceil)$$
* Prioritizes shortages as **CRITICAL** (Stock = 0 or $\le 2$ days left), **HIGH** (Stock $\le$ Reorder Point), or **NORMAL**.
* Generates printable Draft Purchase Orders grouped by vendor.

### 5. Local AI Assistant (Ollama + Gemma)
* **Capability A (Product Listing Generator):** Generates structured JSON copy (Title, Short Desc, Detailed Specs, Bullet Points, Keywords, Promotional Caption) based strictly on confirmed inputs.
* **Capability B (Business Insights):** Runs allowlisted deterministic SQLite analytical queries first, passes aggregated figures to the local model, and synthesizes clear natural-language insights with zero hallucinated figures.
* **Graceful Degradation:** When Ollama is offline or missing, a built-in deterministic heuristic engine ensures no features are blocked.

### 6. Backup, Integrity & Recovery
* Single-click timestamped SQLite database backups.
* Safe restore workflow: validates SQLite header, creates an automatic recovery backup snapshot before restoring, verifies database integrity (`PRAGMA integrity_check`), and logs history.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Runtime** | Electron 34, Context Isolation, Secure Preload API, strict CSP |
| **Frontend UI** | React 18, TypeScript 5, Vite 6, Tailwind CSS, Lucide Icons |
| **Charts** | Recharts (Dual-axis AreaChart & Donut PieChart) |
| **Database** | SQLite via official WebAssembly SQLite (`sql.js`), ACID Transactions, Foreign Keys |
| **Local AI** | Ollama local inference daemon (`gemma:2b`, `llama3`, or compatible) |
| **Testing** | Vitest automated unit & integration test suite (19 passed test cases) |
| **Packaging** | electron-builder (Windows NSIS Installer & Portable Executable) |

---

## 🚀 Getting Started

### Prerequisites
* Windows 10 or Windows 11 (x64)
* Node.js v18+ (tested on Node v24)
* (Optional for AI) Ollama installed from [https://ollama.com](https://ollama.com)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/SellerPilotAi.git
cd SellerPilotAi

# Install dependencies
npm install

# Run automated tests
npm run test

# Launch in Development Mode (Vite + Electron)
npm run electron:dev
```

---

## 🤖 Local AI (Ollama) Setup Guide

1. Download and install Ollama for Windows from [https://ollama.com/download](https://ollama.com/download).
2. Open PowerShell or Command Prompt and download the open-weight model:
   ```powershell
   ollama run gemma:2b
   ```
   *(Alternatively, you can run `ollama run llama3` or `ollama run mistral`)*
3. In SellerPilot AI, navigate to **Settings** $\rightarrow$ **Local AI Inference**.
4. Ensure the endpoint is `http://127.0.0.1:11434` and the model name is set to `gemma:2b`.
5. Click **Test Connection & Save**. The status pill in the top header will update to **AI Ready**.

*Note: Initial model download requires an internet connection. Once downloaded, all AI features operate 100% offline.*

---

## 🧪 Automated Testing

Run the test suite covering product management, atomic transactions, reorder calculations, backups, and demo data:
```bash
npm run test
```
All 11 unit tests verify:
* Product creation with opening stock audit trail
* Case-insensitive duplicate SKU rejection
* Manual stock adjustments with delta movements
* Atomic sales transactions and stock deductions
* Overselling prevention
* Sale cancellation with stock restoration
* Restock planner reorder point calculations
* Critical priority identification
* Safe backup creation and header validation
* Corrupt backup file rejection
* Demonstration store seeding and clean reset

---

## 📦 Packaging for Windows

To build the standalone Windows application:
```bash
npm run pack
```
The packaged application executable is generated in:
`release\win-unpacked\SellerPilot AI.exe`

---

## 📜 Community Wisdom & Architecture Provenance

In accordance with community best practices on DEV Community:
* Handling SQLite inside Electron's main process with a typed preload IPC bridge isolates file handles from renderer vulnerabilities.
* Using minor currency units (paise/cents) prevents IEEE 754 floating-point rounding errors in retail accounting.
* Pairing deterministic database aggregates with local open-weight language models eliminates statistical hallucinations in financial metrics.

---

## 📄 License
MIT License. Built for independent retailers and small businesses worldwide.
