import { inferByproductProduct } from "@/lib/byproducts/aliases";

export function parseRoughNoteExpenseLine(line: string) {
  const text = line.trim();
  const amountMatch = text.match(/(?:INR|Rs\.?|₹)?\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const label = amountMatch
    ? text.replace(amountMatch[0], "").replace(/^\s*[-:–—]\s*/, "").replace(/\s*[-:–—]\s*$/, "").trim()
    : text;

  return {
    amount: Number.isFinite(amount) ? amount : null,
    category: inferExpenseCategory(label),
    vendorName: label || null,
    notes: text || null
  };
}

export function parseRoughNoteByproductLine(line: string) {
  const text = line.trim();
  const amountMatch = text.match(/(?:INR|Rs\.?|₹)?\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
  const label = amountMatch
    ? text.replace(amountMatch[0], "").replace(/^\s*[-:–—]\s*/, "").replace(/\s*[-:–—]\s*$/, "").trim()
    : text;

  return {
    productType: inferByproductProduct(label || text),
    subtotalAmount: Number.isFinite(amount) ? amount : null,
    notes: text || null
  };
}

function inferExpenseCategory(label: string) {
  const normalized = label.toLowerCase();

  if (/hamali|hamaali|labou?r|coolie|worker|wage/.test(normalized)) return "labour";
  if (/current|electric|power|bill/.test(normalized)) return "electricity";
  if (/transport|lorry|truck|diesel|driver|freight/.test(normalized)) return "transport";
  if (/repair|maintenance|spare|machine|mill/.test(normalized)) return "maintenance";

  return "other";
}
