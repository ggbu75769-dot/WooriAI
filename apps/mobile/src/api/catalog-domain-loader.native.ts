type CatalogDomainNamespace = typeof import("@wooriai/domain/release4-catalog");

let loadedCatalogDomain: CatalogDomainNamespace | null = null;

function loadCatalogDomain(): CatalogDomainNamespace {
  if (!loadedCatalogDomain) {
    loadedCatalogDomain = require("@wooriai/domain/release4-catalog") as CatalogDomainNamespace;
  }
  return loadedCatalogDomain;
}

// Full 408-item taxonomy data is unnecessary for HOME. Load it only when a catalog-specific
// local backend method actually reads one of these exports.
export const catalogDomain = new Proxy({} as CatalogDomainNamespace, {
  get: (_target, property) => Reflect.get(loadCatalogDomain(), property)
});
