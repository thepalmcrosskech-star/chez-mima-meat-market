export const CHARCUTERIE_CATEGORY_ID = "0e3b434d-9c58-4c08-b571-b40238a0c567";

export const isWeightUnit = (unitType: string) => unitType === "weight" || unitType === "kg";

const WEIGHT_OPTIONS_DEFAULT = [
  { label: "250g", value: 0.25 },
  { label: "500g", value: 0.5 },
  { label: "750g", value: 0.75 },
  { label: "1kg", value: 1 },
];

const WEIGHT_OPTIONS_CHARCUTERIE = [
  { label: "100g", value: 0.1 },
  { label: "200g", value: 0.2 },
  { label: "300g", value: 0.3 },
  { label: "500g", value: 0.5 },
];

export const getWeightOptions = (categoryId?: string | null) =>
  categoryId === CHARCUTERIE_CATEGORY_ID ? WEIGHT_OPTIONS_CHARCUTERIE : WEIGHT_OPTIONS_DEFAULT;

export const getQuantityRules = (unitType: string, categoryId?: string | null) => {
  if (!isWeightUnit(unitType)) return { minimum: 1, maximum: null, step: 1 };
  if (categoryId === CHARCUTERIE_CATEGORY_ID) return { minimum: 0.1, maximum: 0.5, step: 0.1 };
  return { minimum: 0.25, maximum: null, step: 0.25 };
};

export const getDefaultQuantity = (unitType: string, categoryId?: string | null) =>
  getQuantityRules(unitType, categoryId).minimum;
