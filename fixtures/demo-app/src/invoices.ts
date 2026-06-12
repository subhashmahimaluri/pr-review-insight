type Line = { id: string; price: number; quantity: number; discount: number };

export function processInvoices(items: Line[]): number {
  let total = 0;
  let discounted = 0;
  let skipped = 0;
  for (const item of items) {
    if (item.quantity <= 0) {
      skipped += 1;
      continue;
    }
    const gross = item.price * item.quantity;
    const rebate = item.discount > 0 ? gross * (item.discount / 100) : 0;
    const net = gross - rebate;
    if (rebate > 0) {
      discounted += 1;
    }
    total += Math.round(net * 100) / 100;
  }
  console.log(`processed=${items.length} discounted=${discounted} skipped=${skipped}`);
  return total;
}
