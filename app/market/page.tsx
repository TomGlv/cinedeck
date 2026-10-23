import { redirect } from "next/navigation";

/** The market moved to the home page; keep old links working. */
export default function MarketPage() {
  redirect("/");
}
