import { used } from './util';
import { a } from './a';
import { runDanger } from './danger';
import { processOrders } from './orders';
import { processInvoices } from './invoices';

export function main(input: string): number {
  used();
  runDanger(input);
  processOrders([]);
  processInvoices([]);
  return a();
}

// deeply nested decision tree — trips cognitive-complexity and max-depth
export function categorize(n: number, mode: string, flag: boolean): string {
  let result = '';
  if (n > 0) {
    if (mode === 'a') {
      if (flag) {
        for (let i = 0; i < n; i++) {
          if (i % 2 === 0) {
            while (result.length < i) {
              if (i % 3 === 0) {
                result += 'x';
              } else if (i % 5 === 0) {
                result += 'y';
              } else {
                result += 'z';
              }
            }
          } else if (i % 7 === 0) {
            result += 'q';
          }
        }
      } else if (n > 10) {
        result = 'big';
      } else {
        result = 'small';
      }
    } else if (mode === 'b') {
      result = flag ? 'b1' : 'b2';
    } else if (mode === 'c') {
      result = flag ? 'c1' : 'c2';
    } else {
      result = 'unknown';
    }
  } else if (n < 0) {
    result = 'negative';
  }
  return result;
}
