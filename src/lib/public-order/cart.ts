import type { CartState } from './types';
import { safeJsonParse, safeJsonStringify } from '@/lib/json-utils';

export function parseCart(value: string | null | undefined): CartState {
  const parsed = safeJsonParse<CartState>(value, { items: [] });
  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

export function stringifyCart(cart: CartState) {
  return safeJsonStringify(cart);
}

export function setCartQuantity(
  cart: CartState,
  productId: string,
  variantId: string | undefined,
  quantity: number,
): CartState {
  const items = cart.items.filter(
    (item) => !(item.productId === productId && (item.variantId || '') === (variantId || '')),
  );

  return {
    items: [...items, { productId, variantId, quantity }],
  };
}
