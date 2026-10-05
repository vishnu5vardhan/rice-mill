import type { ProductType } from "@/lib/types";

export type ByproductProduct = Extract<ProductType, "bran" | "broken_rice" | "husk">;

export const byproductAliases: Record<ByproductProduct, string[]> = {
  bran: ["bran", "rice bran", "thoudu", "thodu", "thoodu", "thavudu", "tavudu", "tavdu", "tavida"],
  broken_rice: ["broken rice", "broken", "param", "para", "nuka", "nooka", "nookalu", "nukulu", "rice brokens"],
  husk: ["husk", "rice husk", "unka", "uka", "ooka", "ookka", "pottu", "paddy husk"]
};

export function inferByproductProduct(value: string | null | undefined): ByproductProduct | null {
  if (!value) return null;
  const normalized = normalizeAlias(value);

  for (const [product, aliases] of Object.entries(byproductAliases) as Array<[ByproductProduct, string[]]>) {
    if (aliases.some((alias) => normalized.includes(normalizeAlias(alias)))) return product;
  }

  return null;
}

export function byproductAliasPromptLine() {
  return Object.entries(byproductAliases)
    .map(([product, aliases]) => `${product}: ${aliases.join(", ")}`)
    .join("; ");
}

function normalizeAlias(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
