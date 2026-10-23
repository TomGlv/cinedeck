import { NextResponse, type NextRequest } from "next/server";
import { fulfill, verifyIpn } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** NOWPayments IPN: credits the coins once the payment is "finished" (fully paid and confirmed). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { payment_status?: string; order_id?: string } | null;
  if (!body || !verifyIpn(body, req.headers.get("x-nowpayments-sig"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  if (body.payment_status === "finished" && body.order_id) {
    const coins = await fulfill(body.order_id);
    console.log(`[payments] ${body.order_id} finished, +${coins} coins`);
  }
  return NextResponse.json({ received: true });
}
