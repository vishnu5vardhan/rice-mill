import type { RecordStatus } from "@/lib/types";

const stockEligibleStatuses: RecordStatus[] = ["confirmed", "reconciled", "locked", "exported", "adjusted"];

export function canCreateStockEventFromBusinessEvent(input: {
  businessEventStatus: RecordStatus;
  businessEventMillId: string;
  stockEventMillId: string;
}) {
  return (
    input.businessEventMillId === input.stockEventMillId &&
    stockEligibleStatuses.includes(input.businessEventStatus)
  );
}
