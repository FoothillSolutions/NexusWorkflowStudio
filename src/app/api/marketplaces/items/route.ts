import { NextResponse } from "next/server";
import {
  getAllMarketplaceItems,
  getIsRefreshing,
} from "@/lib/marketplace/index";

export const dynamic = "force-dynamic";

/** GET /api/marketplaces/items — returns all marketplace library items */
export async function GET() {
  return NextResponse.json({
    items: getAllMarketplaceItems(),
    isRefreshing: getIsRefreshing(),
  });
}
