import { NextResponse } from "next/server";
import {
  getAllMarketplaceItems,
  getAllMarketplaceWorkflows,
  getIsRefreshing,
} from "@/lib/marketplace/index";

export const dynamic = "force-dynamic";

/** GET /api/marketplaces/items — returns all marketplace library items and workflows */
export async function GET() {
  return NextResponse.json({
    items: getAllMarketplaceItems(),
    workflows: getAllMarketplaceWorkflows(),
    isRefreshing: getIsRefreshing(),
  });
}
