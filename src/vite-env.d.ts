/// <reference types="vite/client" />

type DailyReport = { businessDate: string; orders: number; totalCents: number; costCents: number; grossProfitCents: number; marginPercent: number; paymentSplit: { cashCents: number; cardCents: number }; expenses: Array<{ category: string; total_cents: number; count: number }>; expensesTotalCents: number; withdrawalsTotalCents: number; withdrawals: unknown[]; cash: { openingCents: number | null; expectedCents: number | null; countedCents: number | null; differenceCents: number | null; status: string }; sales: unknown[] };

type Product = {
  id: number; name: string; description: string; price_cents: number; cost_cents: number; stock: number; image_path: string | null;
};

declare global {
  interface Window {
    salesApi: {
      products: { list(): Promise<Product[]>; create(input: { name: string; description: string; priceCents: number; costCents: number; stock: number; imagePath: string | null }): Promise<Product>; update(input: { id: number; name: string; description: string; priceCents: number; costCents: number; stock: number; imagePath: string | null }): Promise<Product>; adjustStock(input: { productId: number; quantityDelta: number; reason: string }): Promise<Product>; movements(productId?: number, limit?: number, filters?: unknown): Promise<unknown[]> };
      sales: { create(input: { totalCents: number; paymentMethod: 'cash' | 'card'; amountReceivedCents: number; changeCents: number; items: Array<{ productId: number; productName: string; quantity: number; unitPriceCents: number; subtotalCents: number }> }): Promise<unknown>; list(limit?: number, filters?: unknown): Promise<unknown[]>; analytics(filters: unknown): Promise<{ totalCents: number; costCents: number; grossProfitCents: number; marginPercent: number; orders: number; byDay: Array<{ day: string; total_cents: number; cost_cents: number; orders: number }> }>; get(id: number): Promise<unknown> };
      expenses: { create(input: unknown): Promise<unknown>; list(limit?: number): Promise<unknown[]> };
      dashboard: { summary(): Promise<unknown>; alerts(): Promise<Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; message: string; page: string }>> };
      report: { daily(businessDate: string): Promise<DailyReport>; export(businessDate: string, format: 'csv' | 'xlsx'): Promise<{ canceled: boolean; filePath?: string }> };
      export(format: 'csv' | 'xlsx'): Promise<{ canceled: boolean; filePath?: string }>;
      database: { backup(): Promise<{ canceled: boolean; filePath?: string }>; restore(): Promise<{ canceled: boolean; restored?: boolean }> };
      window: { minimize(): void; maximize(): void; close(): void; isMaximized(): Promise<boolean> };
      settings: { get(): Promise<{ businessName: string; currency: string; lowStockThreshold: number }>; update(input: { businessName: string; currency: string; lowStockThreshold: number }): Promise<{ businessName: string; currency: string; lowStockThreshold: number }>; changePassword(input: { currentPassword: string; newPassword: string }): Promise<{ changed: boolean }> };
      auth: { login(input: { email: string; password: string }): Promise<boolean> };
      cash: { open(amountCents: number): Promise<unknown>; get(): Promise<{ opening: unknown; register?: any; movements: any[]; balanceCents: number; expectedCents?: number; countedCents?: number; differenceCents?: number; isOpen: boolean; isClosed?: boolean }>; close(countedCents: number): Promise<{ expectedCents: number; countedCents: number; differenceCents: number }>; withdraw(input: { amountCents: number; reason: string }): Promise<unknown> };
    };
  }
}

export {};
