// The total of a cart.

// Prices are in cents.

export function total(prices: number[], discount: number): number {

  if (discount > 100) {
    // A discount over 100% is a bug in the caller.

    throw new Error(`discount ${discount} is over 100`);
  }
  return prices.reduce((sum, price) => sum + price, 0) * (1 - discount / 100);
}
