import { createClient } from "@/lib/supabase/server";
import InventoryClient from "./inventory-client";

export default async function InventarioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const orgId = profile!.organization_id;

  // Fetch initial data in parallel
  const [productsResult, categoriesResult, locationsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        `
        *,
        categories(id, name),
        inventory(id, quantity, min_stock, location_id, locations(id, name))
      `
      )
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("categories")
      .select("*")
      .eq("organization_id", orgId)
      .order("name"),

    supabase
      .from("locations")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <InventoryClient
      initialProducts={productsResult.data || []}
      categories={categoriesResult.data || []}
      locations={locationsResult.data || []}
      userRole={profile!.role}
      userLocationId={profile!.location_id}
    />
  );
}
