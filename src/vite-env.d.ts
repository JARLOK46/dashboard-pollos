/// <reference types="vite/client" />

type Product = {
  id: number; name: string; description: string; price_cents: number; stock: number; image_path: string | null;
};

declare global {
  interface Window {
    salesApi: {
      products: { list(): Promise<Product[]>; create(input: unknown): Promise<Product>; update(input: unknown): Promise<Product> };
      sales: { create(input: unknown): Promise<unknown>; list(limit?: number): Promise<unknown[]>; get(id: number): Promise<unknown> };
      expenses: { create(input: unknown): Promise<unknown>; list(limit?: number): Promise<unknown[]> };
      dashboard: { summary(): Promise<unknown> };
    };
  }
}

export {};
