export function draftCancelUpdatePayload(userId: string | null) {
  return {
    status: "cancelled",
    updated_by: userId
  };
}
