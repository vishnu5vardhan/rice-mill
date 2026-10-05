import type { QuestionIntent } from "@/lib/validation/schemas";

const intentPatterns: Array<[QuestionIntent, RegExp[]]> = [
  ["what_came_today", [/what came today/i, /came today/i, /today.*paddy/i]],
  ["what_came_yesterday", [/what came yesterday/i, /came yesterday/i, /yesterday.*paddy/i, /entries.*yesterday/i, /yesterday.*entries/i]],
  ["entries_incomplete", [/incomplete/i, /pending entries/i, /missing data/i]],
  ["truck_sheets_missing", [/truck sheet.*missing/i, /missing.*truck sheet/i]],
  ["truck_sheet_count", [/how many.*truck sheets?/i, /count.*truck sheets?/i, /total.*truck sheets?/i, /truck sheets?.*(i have|we have|available|uploaded)/i]],
  ["lot_mismatch", [/mismatch/i, /conflict/i, /disputed lot/i]],
  ["confirmed_stock", [/confirmed stock/i, /how much.*stock/i, /stock exists/i]],
  ["byproducts_sold", [/by-products? were sold/i, /bran.*sold/i, /broken rice.*sold/i, /husk.*sold/i]],
  ["low_sale_rate", [/low.*sale rate/i, /rate looks low/i, /cheap sale/i]],
  ["expenses_this_month", [/expenses.*month/i, /this month.*expense/i, /cost.*month/i]],
  ["ca_export_ready", [/sent to ca/i, /send to ca/i, /ca export/i, /data.*ca/i]]
];

export function parseQuestionIntent(question: string): QuestionIntent {
  const normalized = question.trim();
  for (const [intent, patterns] of intentPatterns) {
    if (patterns.some((pattern) => pattern.test(normalized))) return intent;
  }
  return "unknown";
}

export function intentLabel(intent: QuestionIntent) {
  const labels: Record<QuestionIntent, string> = {
    what_came_today: "What came today?",
    what_came_yesterday: "What came yesterday?",
    entries_incomplete: "Which entries are incomplete?",
    truck_sheet_count: "How many truck sheets do I have?",
    truck_sheets_missing: "Which truck sheets are missing?",
    lot_mismatch: "Which lot has mismatch?",
    confirmed_stock: "How much confirmed stock exists?",
    byproducts_sold: "What by-products were sold?",
    low_sale_rate: "Which sale rate looks low?",
    expenses_this_month: "What expenses are recorded this month?",
    ca_export_ready: "What data can be sent to CA?",
    unknown: "Unknown question"
  };
  return labels[intent];
}
