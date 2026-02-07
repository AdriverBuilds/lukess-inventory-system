import { createClient } from "@/lib/supabase/server";
import StatsCard from "@/components/dashboard/StatsCard";
import {
  Package,
  Layers,
  ShoppingCart,
  AlertTriangle,
  TrendingDown,
  CreditCard,
  Banknote,
  QrCode,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const LOW_STOCK_THRESHOLD = 10;

const paymentIcons: Record<string, typeof CreditCard> = {
  cash: Banknote,
  qr: QrCode,
  card: CreditCard,
};

const paymentLabels: Record<string, string> = {
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current user's profile for organization_id
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const orgId = profile!.organization_id;

  // ── Parallel data fetching ────────────────────────────────────────────────

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    productsResult,
    inventoryResult,
    salesTodayResult,
    lowStockResult,
    recentSalesResult,
  ] = await Promise.all([
    // Total products
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_active", true),

    // Total stock (sum of all inventory)
    supabase
      .from("inventory")
      .select("quantity, product_id, products!inner(organization_id)")
      .eq("products.organization_id", orgId),

    // Today's sales
    supabase
      .from("sales")
      .select("total")
      .eq("organization_id", orgId)
      .gte("created_at", todayStart.toISOString()),

    // Low stock products
    supabase
      .from("inventory")
      .select(
        `
        quantity,
        min_stock,
        location_id,
        locations(name),
        products!inner(id, name, sku, organization_id)
      `
      )
      .eq("products.organization_id", orgId)
      .lt("quantity", LOW_STOCK_THRESHOLD)
      .order("quantity", { ascending: true })
      .limit(10),

    // Last 5 sales
    supabase
      .from("sales")
      .select(
        `
        id,
        total,
        payment_method,
        created_at,
        customer_name,
        profiles(full_name),
        locations(name),
        sale_items(quantity)
      `
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // ── Compute stats ─────────────────────────────────────────────────────────

  const totalProducts = productsResult.count || 0;

  const totalStock =
    inventoryResult.data?.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    ) || 0;

  const salesTodayTotal =
    salesTodayResult.data?.reduce((sum, sale) => sum + sale.total, 0) || 0;
  const salesTodayCount = salesTodayResult.data?.length || 0;

  const lowStockCount = lowStockResult.data?.length || 0;
  const lowStockItems = lowStockResult.data || [];
  const recentSales = recentSalesResult.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resumen general de tu negocio
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Productos"
          value={totalProducts}
          icon={Package}
          color="blue"
          subtitle="Productos activos"
        />
        <StatsCard
          title="Stock Total"
          value={totalStock.toLocaleString()}
          icon={Layers}
          color="green"
          subtitle="Unidades en inventario"
        />
        <StatsCard
          title="Ventas Hoy"
          value={`Bs ${salesTodayTotal.toFixed(2)}`}
          icon={ShoppingCart}
          color="purple"
          subtitle={`${salesTodayCount} venta${salesTodayCount !== 1 ? "s" : ""}`}
        />
        <StatsCard
          title="Bajo Stock"
          value={lowStockCount}
          icon={AlertTriangle}
          color={lowStockCount > 0 ? "red" : "green"}
          subtitle={
            lowStockCount > 0
              ? "Requieren atención"
              : "Todo en orden"
          }
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <h2 className="font-semibold text-gray-900">
                Productos con Stock Bajo
              </h2>
            </div>
            <span className="text-xs text-gray-400">
              &lt; {LOW_STOCK_THRESHOLD} unidades
            </span>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No hay productos con stock bajo
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">
                      Producto
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-2.5">
                      Ubicación
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-5 py-2.5">
                      Stock
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lowStockItems.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {item.products?.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.products?.sku}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {(item.locations as any)?.name || "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.quantity === 0
                              ? "bg-red-100 text-red-700"
                              : item.quantity <= 5
                                ? "bg-orange-100 text-orange-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-gray-900">Últimas Ventas</h2>
          </div>

          {recentSales.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No hay ventas registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentSales.map((sale: any) => {
                const PayIcon =
                  paymentIcons[sale.payment_method] || CreditCard;
                const totalItems =
                  sale.sale_items?.reduce(
                    (sum: number, item: any) => sum + item.quantity,
                    0
                  ) || 0;

                return (
                  <div
                    key={sale.id}
                    className="px-5 py-3.5 hover:bg-gray-50 transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <PayIcon className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {sale.customer_name || "Venta directa"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(sale.profiles as any)?.full_name} ·{" "}
                          {(sale.locations as any)?.name} ·{" "}
                          {totalItems} ítem{totalItems !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm font-semibold text-gray-900">
                        Bs {sale.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(
                          new Date(sale.created_at),
                          "dd MMM, HH:mm",
                          { locale: es }
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
