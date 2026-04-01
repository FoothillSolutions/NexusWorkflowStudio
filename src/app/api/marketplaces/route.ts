import { NextResponse } from "next/server";
import {
  getMarketplaceStates,
  getIsRefreshing,
  triggerRefresh,
} from "@/lib/marketplace/index";

export const dynamic = "force-dynamic";

/** GET /api/marketplaces — returns status of all configured marketplaces */
export async function GET() {
  return NextResponse.json({
    marketplaces: getMarketplaceStates(),
    isRefreshing: getIsRefreshing(),
  });
}

/** POST /api/marketplaces — triggers a background refresh */
export async function POST() {
  triggerRefresh();
  return NextResponse.json({ accepted: true }, { status: 202 });
}
