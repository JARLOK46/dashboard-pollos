/// <reference types="vite/client" />

type DailyReport = {
  businessDate: string;
  orders: number;
  totalCents: number;
  costCents: number;
  grossProfitCents: number;
  marginPercent: number;
  paymentSplit: { cashCents: number; cardCents: number };
  expenses: Array<{ category: string; total_cents: number; count: number }>;
  expensesTotalCents: number;
  withdrawalsTotalCents: number;
  withdrawals: unknown[];
  cash: {
    openingCents: number | null;
    expectedCents: number | null;
    countedCents: number | null;
    differenceCents: number | null;
    status: string;
  };
  sales: unknown[];
};

type AiToolStatus = 'pending' | 'claimed' | 'completed' | 'failed' | 'cancelled';

type AiToolCall =
  | {
      name: 'create_expense';
      arguments: { description: string; amountCents: number; category: string };
    }
  | { name: 'cash_withdrawal'; arguments: { reason: string; amountCents: number } }
  | {
      name: 'stock_adjustment';
      arguments: { productId: number; quantityDelta: number; reason: string };
    }
  | {
      name: 'create_product';
      arguments: {
        name: string;
        description: string;
        priceCents: number;
        costCents: number;
        stock: number;
      };
    }
  | {
      name: 'void_sale';
      arguments: {
        saleId: number;
        reason: string;
        sale?: { total_cents?: number; items?: Array<{ product_name: string; quantity: number }> };
      };
    };

type Product = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  cost_cents: number;
  stock: number;
  image_path: string | null;
};

declare global {
  interface Window {
    salesApi: {
      products: {
        list(): Promise<Product[]>;
        create(input: {
          name: string;
          description: string;
          priceCents: number;
          costCents: number;
          stock: number;
          imagePath: string | null;
        }): Promise<Product>;
        update(input: {
          id: number;
          name: string;
          description: string;
          priceCents: number;
          costCents: number;
          stock: number;
          imagePath: string | null;
        }): Promise<Product>;
        archive(input: { id: number }): Promise<Product>;
        adjustStock(input: {
          productId: number;
          quantityDelta: number;
          reason: string;
        }): Promise<Product>;
        movements(productId?: number, limit?: number, filters?: unknown): Promise<unknown[]>;
      };
      tables: {
        list(): Promise<Array<{
          id: number;
          name: string;
          active: number;
          order_id: number | null;
          customer_name: string | null;
          notes: string | null;
          order_created_at: string | null;
          order_updated_at: string | null;
          item_count: number;
          unit_count: number;
          total_cents: number;
        }>>;
        getOrder(tableId: number): Promise<{
          id: number;
          table_id: number;
          table_name: string;
          customer_name: string;
          notes: string;
          items: Array<{ product_id: number; product_name: string; quantity: number; unit_price_cents: number }>;
        } | null>;
        saveOrder(input: {
          tableId: number;
          customerName: string;
          notes: string;
          items: Array<{ productId: number; quantity: number }>;
        }): Promise<unknown>;
        clearOrder(tableId: number): Promise<{ tableId: number; cleared: boolean }>;
        payOrder(input: {
          tableId: number;
          paymentMethod: 'cash' | 'card';
          amountReceivedCents: number;
          changeCents: number;
        }): Promise<unknown>;
      };
      sales: {
        create(input: {
          totalCents: number;
          paymentMethod: 'cash' | 'card';
          amountReceivedCents: number;
          changeCents: number;
          customerName?: string;
          notes?: string;
          tableId?: number;
          items: Array<{
            productId: number;
            productName: string;
            quantity: number;
            unitPriceCents: number;
            subtotalCents: number;
          }>;
        }): Promise<unknown>;
        void(id: number, reason: string): Promise<unknown>;
        list(limit?: number, filters?: { from?: string; to?: string; paymentMethod?: 'all' | 'cash' | 'card'; status?: 'all' | 'active' | 'voided' }): Promise<unknown[]>;
        analytics(filters: unknown): Promise<{
          totalCents: number;
          costCents: number;
          grossProfitCents: number;
          marginPercent: number;
          orders: number;
          byDay: Array<{ day: string; total_cents: number; cost_cents: number; orders: number }>;
        }>;
        get(id: number): Promise<unknown>;
      };

      expenses: {
        create(input: {
          description: string;
          amountCents: number;
          category: string;
        }): Promise<unknown>;
        list(limit?: number): Promise<unknown[]>;
      };
      dashboard: {
        summary(): Promise<unknown>;
        alerts(): Promise<
          Array<{
            id: string;
            severity: 'critical' | 'warning' | 'info';
            title: string;
            message: string;
            page: string;
          }>
        >;
      };
      diagnostics: {
        list(): Promise<
          Array<{
            issue_code: string;
            severity: 'critical' | 'warning' | 'info';
            entity_type: string;
            entity_id: number | null;
            message: string;
          }>
        >;
      };
      report: {
        daily(businessDate: string): Promise<DailyReport>;
        export(
          businessDate: string,
          format: 'csv' | 'xlsx',
        ): Promise<{ canceled: boolean; filePath?: string }>;
      };
      export(format: 'csv' | 'xlsx', filters?: { from?: string; to?: string; paymentMethod?: 'all' | 'cash' | 'card'; status?: 'all' | 'active' | 'voided' }): Promise<{ canceled: boolean; filePath?: string }>;
      database: {
        backup(): Promise<{ canceled: boolean; filePath?: string }>;
        restore(): Promise<{ canceled: boolean; restored?: boolean }>;
        automaticStatus(): Promise<{
          directory: string;
          retention: 1;
          lastAttemptAt: string | null;
          lastSuccessAt: string | null;
          lastError: string | null;
          lastPath: string | null;
          lastTrigger: string | null;
        }>;
      };
      window: {
        minimize(): void;
        maximize(): void;
        close(): void;
        isMaximized(): Promise<boolean>;
      };
      settings: {
        get(): Promise<{ businessName: string; currency: string; lowStockThreshold: number }>;
        update(input: {
          businessName: string;
          currency: string;
          lowStockThreshold: number;
        }): Promise<{ businessName: string; currency: string; lowStockThreshold: number }>;
        changePassword(input: {
          currentPassword: string;
          newPassword: string;
        }): Promise<{ changed: boolean }>;
      };
      ai: {
        sessions: {
          list(limit?: number): Promise<
            Array<{
              id: string;
              title: string;
              created_at: string;
              updated_at: string;
              message_count: number;
            }>
          >;
          get(id: string): Promise<{
            id: string;
            title: string;
            created_at: string;
            updated_at: string;
            messages: Array<{
              id: number;
              role: 'user' | 'assistant';
              text: string;
              period?: string | null;
              source?: string | null;
              metrics?: Array<{ label: string; value: string; detail?: string }>;
              toolCall?: AiToolCall | null;
              toolStatus?: AiToolStatus;
              toolError?: string | null;
            }>;
          } | null>;
          create(input: { id: string; title: string }): Promise<unknown>;
          delete(id: string): Promise<{ id: string; deleted: true }>;
          getOrCreate(input: { id: string; title: string }): Promise<{
            id: string;
            title: string;
            created_at: string;
            updated_at: string;
            messages: Array<{ role: 'user' | 'assistant'; text: string }>;
          }>;
          claim(input: {
            sessionId: string;
            messageId: number;
          }): Promise<{ claimed: boolean; status: AiToolStatus }>;
          complete(input: {
            sessionId: string;
            messageId: number;
            status: 'completed' | 'failed';
            error?: string | null;
          }): Promise<{ messageId: number; status: AiToolStatus; error: string | null }>;
          cancel(input: {
            sessionId: string;
            messageId: number;
          }): Promise<{ cancelled: boolean; status: AiToolStatus }>;
          append(input: {
            sessionId: string;
            role: 'user' | 'assistant';
            text: string;
            period?: string | null;
            source?: string | null;
            metrics?: Array<{ label: string; value: string; detail?: string }>;
            toolCall?: AiToolCall | null;
          }): Promise<{ id: number; sessionId: string; title: string }>;
        };
        getConfig(): Promise<{ model: string; configured: boolean; safeStorageAvailable: boolean }>;
        setKey(key: string): Promise<unknown>;
        clearKey(): Promise<unknown>;
        saveModel(model: string): Promise<{ model: string; configured: boolean }>;
        analyze(
          question: string,
          history?: Array<{ role: 'user' | 'assistant'; content: string }>,
          mode?: 'question' | 'daily-summary',
        ): Promise<{
          text: string;
          timestamp: string;
          model: string;
          period?: string | null;
          source?: string;
          metrics?: Array<{ label: string; value: string; detail?: string }>;
          toolCall?: AiToolCall | null;
        }>;
      };
      auth: {
        login(input: { email: string; password: string }): Promise<boolean>;
        logout(): Promise<{ loggedOut: boolean }>;
      };
      cash: {
        open(amountCents: number): Promise<unknown>;
        get(): Promise<{
          opening: unknown;
          register?: any;
          movements: any[];
          balanceCents: number;
          expectedCents?: number;
          countedCents?: number;
          differenceCents?: number;
          isOpen: boolean;
          isClosed?: boolean;
        }>;
        close(
          countedCents: number,
        ): Promise<{ expectedCents: number; countedCents: number; differenceCents: number }>;
        withdraw(input: { amountCents: number; reason: string }): Promise<unknown>;
      };
    };
  }
}

export {};
