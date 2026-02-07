"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Location } from "@/lib/types";
import {
  Search,
  Plus,
  Package,
  Filter,
  ChevronDown,
  AlertTriangle,
  Edit,
  MapPin,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  quantity: number;
  min_stock: number;
  location_id: string;
  locations: { id: string; name: string } | null;
}

interface ProductWithRelations {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  brand: string | null;
  sizes: string[];
  colors: string[];
  image_url: string | null;
  is_active: boolean;
  organization_id: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  categories: { id: string; name: string } | null;
  inventory: InventoryItem[];
}

interface InventoryClientProps {
  initialProducts: ProductWithRelations[];
  categories: Category[];
  locations: Location[];
  userRole: "admin" | "manager" | "staff";
  userLocationId: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function InventoryClient({
  initialProducts,
  categories,
  locations,
  userRole,
  userLocationId,
}: InventoryClientProps) {
  const [products, setProducts] =
    useState<ProductWithRelations[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState(
    userRole === "staff" && userLocationId ? userLocationId : ""
  );
  const [showFilters, setShowFilters] = useState(false);

  // ── Supabase Realtime ──────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("inventory-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory" },
        async () => {
          // Refetch products when inventory changes
          const { data } = await supabase
            .from("products")
            .select(
              `
              *,
              categories(id, name),
              inventory(id, quantity, min_stock, location_id, locations(id, name))
            `
            )
            .eq("organization_id", initialProducts[0]?.organization_id || "")
            .eq("is_active", true)
            .order("name");

          if (data) setProducts(data as ProductWithRelations[]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        async () => {
          const { data } = await supabase
            .from("products")
            .select(
              `
              *,
              categories(id, name),
              inventory(id, quantity, min_stock, location_id, locations(id, name))
            `
            )
            .eq("organization_id", initialProducts[0]?.organization_id || "")
            .eq("is_active", true)
            .order("name");

          if (data) setProducts(data as ProductWithRelations[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialProducts]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        (product.brand && product.brand.toLowerCase().includes(searchLower));

      // Category filter
      const matchesCategory =
        !categoryFilter || product.category_id === categoryFilter;

      // Location filter — show only products that have inventory in this location
      const matchesLocation =
        !locationFilter ||
        product.inventory.some((inv) => inv.location_id === locationFilter);

      return matchesSearch && matchesCategory && matchesLocation;
    });
  }, [products, search, categoryFilter, locationFilter]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getStockForLocation = (product: ProductWithRelations, locId: string) => {
    const inv = product.inventory.find((i) => i.location_id === locId);
    return inv?.quantity ?? 0;
  };

  const getTotalStock = (product: ProductWithRelations) => {
    return product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
  };

  const isLowStock = (product: ProductWithRelations) => {
    return product.inventory.some(
      (inv) => inv.quantity < inv.min_stock
    );
  };

  const activeLocationFilter = locationFilter
    ? locations.find((l) => l.id === locationFilter)
    : null;

  const activeCategoryFilter = categoryFilter
    ? categories.find((c) => c.id === categoryFilter)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredProducts.length} producto
            {filteredProducts.length !== 1 ? "s" : ""}
            {search || categoryFilter || locationFilter
              ? " encontrados"
              : " en total"}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition shadow-sm">
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
              showFilters || categoryFilter || locationFilter
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {(categoryFilter || locationFilter) && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {(categoryFilter ? 1 : 0) + (locationFilter ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            {/* Category */}
            <div className="relative flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Categoría
              </label>
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Location */}
            {(userRole === "admin" || userRole === "manager") && (
              <div className="relative flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Ubicación
                </label>
                <div className="relative">
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-700"
                  >
                    <option value="">Todas las ubicaciones</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Clear filters */}
            {(categoryFilter || locationFilter) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setCategoryFilter("");
                    setLocationFilter(
                      userRole === "staff" && userLocationId
                        ? userLocationId
                        : ""
                    );
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-2 hover:bg-red-50 rounded-lg transition"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active filter badges */}
        {(activeCategoryFilter || activeLocationFilter) && !showFilters && (
          <div className="flex flex-wrap gap-2">
            {activeCategoryFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                {activeCategoryFilter.name}
                <button
                  onClick={() => setCategoryFilter("")}
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            )}
            {activeLocationFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                <MapPin className="w-3 h-3" />
                {activeLocationFilter.name}
                <button
                  onClick={() =>
                    setLocationFilter(
                      userRole === "staff" && userLocationId
                        ? userLocationId
                        : ""
                    )
                  }
                  className="hover:text-green-900"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">
              No se encontraron productos
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {search
                ? "Intenta con otro término de búsqueda"
                : "Agrega tu primer producto"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                    Producto
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                    SKU
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                    Categoría
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                    Precio
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                    {locationFilter ? "Stock" : "Stock Total"}
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map((product) => {
                  const stock = locationFilter
                    ? getStockForLocation(product, locationFilter)
                    : getTotalStock(product);
                  const lowStock = isLowStock(product);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 transition cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition">
                            <Package className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {product.name}
                            </p>
                            {product.brand && (
                              <p className="text-xs text-gray-400">
                                {product.brand}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-600 font-mono">
                          {product.sku}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {product.categories ? (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            {product.categories.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          Bs {product.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lowStock && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              stock === 0
                                ? "bg-red-100 text-red-700"
                                : lowStock
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 px-2 py-1 rounded-md hover:bg-blue-50 transition"
                          title="Editar producto"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with stock breakdown by location */}
        {!locationFilter && filteredProducts.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span className="font-medium">Stock por ubicación:</span>
              {locations.map((loc) => {
                const locStock = filteredProducts.reduce(
                  (sum, p) => sum + getStockForLocation(p, loc.id),
                  0
                );
                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setLocationFilter(loc.id);
                      setShowFilters(true);
                    }}
                    className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                  >
                    <MapPin className="w-3 h-3" />
                    {loc.name}: <span className="font-semibold">{locStock}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
