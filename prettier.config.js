// @ts-check
/** @type {import("prettier").Config} */
export default {
  semi: true,
  trailingComma: "none",
  singleQuote: false,
  printWidth: 90,
  endOfLine: "auto",
  tabWidth: 2,
  useTabs: false,
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  importOrder: ["^node:", "<THIRD_PARTY_MODULES>", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["typescript", "jsx", "explicitResourceManagement"]
};
