export function runDanger(userInput: string): unknown {
  // eslint-security: eval with expression
  const value = eval(userInput);
  const factory = new Function('x', 'return x * 2');
  fetch('http://api.example.com/data');
  return { value, factory };
}

export function redirect(req: { query: { next: string } }, res: { redirect(url: string): void }) {
  res.redirect(req.query.next);
}
