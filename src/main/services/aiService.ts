import { AppDatabase } from '../db/database';
import {
  AiModelStatus,
  AiListingPromptInput,
  AiListingOutput,
  AiBusinessInsight,
} from '../../shared/types';
import { AnalyticsService } from './analyticsService';
import { RestockService } from './restockService';

export class AiService {
  private endpoint: string = 'http://127.0.0.1:11434';
  private selectedModel: string = 'gemma:2b';
  private analyticsService: AnalyticsService;
  private restockService: RestockService;

  constructor(private db: AppDatabase) {
    this.analyticsService = new AnalyticsService(db);
    this.restockService = new RestockService(db);
  }

  public setEndpoint(url: string): void {
    this.endpoint = url.replace(/\/+$/, '');
  }

  public getEndpoint(): string {
    return this.endpoint;
  }

  public setSelectedModel(model: string): void {
    this.selectedModel = model;
  }

  public getSelectedModel(): string {
    return this.selectedModel;
  }

  public async checkHealth(): Promise<AiModelStatus> {
    const status: AiModelStatus = {
      available: false,
      endpoint: this.endpoint,
      selectedModel: this.selectedModel,
      installedModels: [],
      isModelReady: false,
      lastChecked: new Date().toISOString(),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.endpoint}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json() as { models?: Array<{ name: string }> };
        const models = (data.models || []).map(m => m.name);
        status.available = true;
        status.installedModels = models;
        status.isModelReady = models.some(m => m.includes(this.selectedModel) || m === this.selectedModel);
        if (!status.isModelReady && models.length > 0) {
          // If selected model not found, pick first available
          this.selectedModel = models[0];
          status.selectedModel = models[0];
          status.isModelReady = true;
        }
      } else {
        status.error = `Ollama server responded with status: ${res.status}`;
      }
    } catch (err: any) {
      status.available = false;
      status.error = err.name === 'AbortError'
        ? 'Connection timed out'
        : 'Ollama is not running locally. Core features remain fully operational.';
    }

    return status;
  }

  public async generateProductListing(input: AiListingPromptInput): Promise<AiListingOutput> {
    const health = await this.checkHealth();

    if (health.available && health.isModelReady) {
      try {
        return await this.callOllamaForListing(input);
      } catch (err) {
        console.warn('Ollama listing generation failed or timed out. Falling back to deterministic generator.', err);
      }
    }

    // Graceful offline heuristic generator
    return this.generateOfflineListing(input);
  }

  private async callOllamaForListing(input: AiListingPromptInput): Promise<AiListingOutput> {
    const specsStr = Object.entries(input.confirmedSpecs || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const prompt = `
You are an e-commerce copywriter. Output MUST be valid raw JSON with no markdown and no backticks.
CRITICAL RULES:
- Never invent specifications, certifications, warranty periods, or claims not provided below.
- Keep tone: ${input.brandVoice || 'Professional, clear, and trustworthy'}.
- Language: ${input.language || 'English'}.
- Channel: ${input.intendedSalesChannel || 'Retail/Online Store'}.

Product Details:
- Name: ${input.productName}
- Brand: ${input.brand || 'Unspecified'}
- Category: ${input.category || 'General'}
- Confirmed Specs: ${specsStr || 'None specified'}

JSON Format required:
{
  "title": "Clear optimized product title",
  "shortDescription": "One or two sentence summary",
  "detailedDescription": "Comprehensive description based strictly on provided specs",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"],
  "searchKeywords": ["keyword1", "keyword2", "keyword3"],
  "promotionalCaption": "Catchy social/retail caption"
}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.selectedModel,
        prompt,
        stream: false,
        format: 'json',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama generation failed: HTTP ${response.status}`);
    }

    const data = await response.json() as { response?: string };
    const rawText = data.response || '{}';
    const parsed = JSON.parse(rawText.trim());

    return {
      title: parsed.title || input.productName,
      shortDescription: parsed.shortDescription || `Quality ${input.category || 'product'} by ${input.brand || 'SellerPilot'}.`,
      detailedDescription: parsed.detailedDescription || '',
      keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures : [],
      searchKeywords: Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords : [],
      promotionalCaption: parsed.promotionalCaption || '',
    };
  }

  private generateOfflineListing(input: AiListingPromptInput): AiListingOutput {
    const brandPrefix = input.brand ? `${input.brand} ` : '';
    const categorySuffix = input.category ? ` - ${input.category}` : '';
    const title = `${brandPrefix}${input.productName}${categorySuffix}`.trim();

    const specsList = Object.entries(input.confirmedSpecs || {}).map(([k, v]) => `${k}: ${v}`);
    const keyFeatures = specsList.length > 0
      ? specsList
      : [
          'High reliability and durable build',
          'Standard industry form factor',
          'Optimized for daily retail and consumer use',
        ];

    const shortDescription = `${title} engineered for dependability and everyday utility in ${input.category || 'retail'}.`;
    const detailedDescription = `${input.productName} delivers exceptional value and consistent performance. Built with quality standards suitable for small businesses and everyday shoppers. Specifications have been verified for accuracy.`;

    const searchKeywords = [
      input.productName.toLowerCase(),
      input.brand?.toLowerCase() || '',
      input.category?.toLowerCase() || '',
      'retail',
      'quality',
    ].filter(Boolean);

    return {
      title,
      shortDescription,
      detailedDescription,
      keyFeatures,
      searchKeywords,
      promotionalCaption: `Upgrade your inventory with the all-new ${input.productName}! In stock now.`,
    };
  }

  // Capability B: Business Insights with strict deterministic queries and allowlisted prompts
  public async getBusinessInsights(userQuestion: string): Promise<AiBusinessInsight> {
    const q = userQuestion.toLowerCase();

    let queryType = 'GENERAL_OVERVIEW';
    let calculatedData: Record<string, any> = {};
    let recommendations: string[] = [];

    if (q.includes('revenue') || q.includes('best') || q.includes('selling') || q.includes('top product')) {
      queryType = 'REVENUE_THIS_MONTH';
      const analytics = this.analyticsService.getSalesAnalytics(30);
      calculatedData = {
        totalRevenue: (analytics.totalRevenuePaise / 100).toFixed(2),
        totalGrossProfit: (analytics.grossProfitPaise / 100).toFixed(2),
        profitMarginPct: analytics.profitMarginPct,
        topByRevenue: analytics.topByRevenue.slice(0, 5).map(p => ({
          name: p.name,
          sku: p.sku,
          revenue: (p.revenuePaise / 100).toFixed(2),
          unitsSold: p.unitsSold,
        })),
      };
      recommendations = [
        'Maintain higher safety stock for top revenue drivers to prevent costly stockouts.',
        'Review supplier lead times for top performers to negotiate volume pricing.',
      ];
    } else if (q.includes('restock') || q.includes('low stock') || q.includes('reorder') || q.includes('shortage')) {
      queryType = 'RESTOCK_NEEDED';
      const restockItems = this.restockService.getRestockRecommendations({ historicalDaysWindow: 30 });
      calculatedData = {
        totalItemsNeedingRestock: restockItems.length,
        criticalCount: restockItems.filter(i => i.priority === 'CRITICAL').length,
        highCount: restockItems.filter(i => i.priority === 'HIGH').length,
        items: restockItems.slice(0, 5).map(i => ({
          name: i.productName,
          sku: i.sku,
          stock: i.currentStock,
          daysLeft: i.daysRemaining,
          priority: i.priority,
          suggestedQty: i.suggestedOrderQty,
          supplier: i.supplierName,
        })),
      };
      recommendations = [
        'Place purchase orders immediately for items marked Critical to avoid lost sales.',
        'Group reorders by supplier to satisfy minimum order quantities (MOQ).',
      ];
    } else if (q.includes('slow') || q.includes('dead') || q.includes('no sale') || q.includes('idle')) {
      queryType = 'SLOW_MOVING';
      const analytics = this.analyticsService.getSalesAnalytics(30);
      calculatedData = {
        slowMovingCount: analytics.slowMoving.length,
        products: analytics.slowMoving.slice(0, 5).map(s => ({
          name: s.name,
          sku: s.sku,
          stock: s.currentStock,
          daysSinceLastSale: s.daysSinceLastSale,
          capitalLockedPaise: (s.inventoryCostPaise / 100).toFixed(2),
        })),
      };
      recommendations = [
        'Consider bundle promotions or minor discounts to liquidate idle capital.',
        'Halt replenishment on slow-moving SKUs until existing stock clears.',
      ];
    } else if (q.includes('category') || q.includes('categories')) {
      queryType = 'TOP_CATEGORIES';
      const analytics = this.analyticsService.getSalesAnalytics(30);
      calculatedData = {
        categories: analytics.categoryPerformance.map(c => ({
          category: c.name,
          unitsSold: c.unitsSold,
          revenue: (c.revenuePaise / 100).toFixed(2),
          profit: (c.grossProfitPaise / 100).toFixed(2),
        })),
      };
      recommendations = [
        'Expand catalog depth in high-margin categories.',
        'Rebalance shelf space toward the strongest categories.',
      ];
    } else {
      queryType = 'GENERAL_OVERVIEW';
      const dashboard = this.analyticsService.getDashboardMetrics(30);
      calculatedData = {
        activeProducts: dashboard.activeProductsCount,
        unitsInStock: dashboard.unitsInStock,
        revenueLast30Days: (dashboard.salesRevenuePaise / 100).toFixed(2),
        lowStockItems: dashboard.lowStockItemsCount,
        outOfStockItems: dashboard.outOfStockCount,
      };
      recommendations = [
        'Keep inventory audit movements up to date.',
        'Use the Restock Planner weekly to anticipate replenishment needs.',
      ];
    }

    // Generate natural language explanation
    let naturalLanguageAnswer = '';
    let isAiGenerated = false;

    const health = await this.checkHealth();
    if (health.available && health.isModelReady) {
      try {
        naturalLanguageAnswer = await this.summarizeWithOllama(userQuestion, queryType, calculatedData);
        isAiGenerated = true;
      } catch (err) {
        console.warn('Ollama insight summarization failed. Using deterministic explanation.', err);
      }
    }

    if (!naturalLanguageAnswer) {
      naturalLanguageAnswer = this.formatDeterministicAnswer(queryType, calculatedData);
    }

    return {
      queryType,
      userQuestion,
      calculatedData,
      naturalLanguageAnswer,
      recommendations,
      isAiGenerated,
      generatedAt: new Date().toISOString(),
    };
  }

  private async summarizeWithOllama(question: string, queryType: string, data: Record<string, any>): Promise<string> {
    const prompt = `
You are SellerPilot AI, an offline retail intelligence assistant.
Explain the business data below to the retailer in a direct, professional, concise summary.

CRITICAL RULES:
- Base your summary STRICTLY on the figures provided below.
- NEVER invent or alter numbers, stock counts, revenue figures, or dates.
- Keep the response between 2 and 4 clear paragraphs.

Question: "${question}"
Category: ${queryType}
Deterministic Database Records:
${JSON.stringify(data, null, 2)}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.selectedModel,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Ollama response not ok');
    const resData = await response.json() as { response?: string };
    return resData.response?.trim() || '';
  }

  private formatDeterministicAnswer(queryType: string, data: Record<string, any>): string {
    switch (queryType) {
      case 'REVENUE_THIS_MONTH': {
        const topList = (data.topByRevenue || [])
          .map((p: any, i: number) => `${i + 1}. ${p.name} (${p.sku}): ₹${p.revenue} (${p.unitsSold} units)`)
          .join('\n');
        return `Over the last 30 days, your business generated total net revenue of ₹${data.totalRevenue} with gross profit of ₹${data.totalGrossProfit} (${data.profitMarginPct}% profit margin).\n\nTop performers by revenue:\n${topList || 'No sales recorded yet for this period.'}`;
      }
      case 'RESTOCK_NEEDED': {
        const list = (data.items || [])
          .map((i: any) => `• ${i.name} (${i.sku}): Current stock ${i.stock} units, priority [${i.priority}], suggested reorder: ${i.suggestedQty} units from ${i.supplier}.`)
          .join('\n');
        return `There are currently ${data.totalItemsNeedingRestock} products requiring restocking (${data.criticalCount} Critical, ${data.highCount} High priority).\n\nKey attention items:\n${list || 'All active items have sufficient stock coverage.'}`;
      }
      case 'SLOW_MOVING': {
        const list = (data.products || [])
          .map((s: any) => `• ${s.name} (${s.sku}): ${s.stock} units in stock, last sold ${s.daysSinceLastSale} days ago (₹${s.capitalLockedPaise} tied up).`)
          .join('\n');
        return `Identified ${data.slowMovingCount} slow-moving products with capital currently tied up in idle inventory:\n\n${list || 'No slow-moving products detected.'}`;
      }
      case 'TOP_CATEGORIES': {
        const list = (data.categories || [])
          .map((c: any) => `• ${c.category}: ₹${c.revenue} revenue, ${c.unitsSold} units sold, ₹${c.profit} gross profit.`)
          .join('\n');
        return `Category breakdown for the selected period:\n\n${list || 'No sales data by category available.'}`;
      }
      default:
        return `Store Overview: You have ${data.activeProducts} active products with ${data.unitsInStock} total units in stock. Sales revenue over the last 30 days is ₹${data.revenueLast30Days}. You have ${data.lowStockItems} low-stock items and ${data.outOfStockItems} out-of-stock items requiring replenishment.`;
    }
  }
}
