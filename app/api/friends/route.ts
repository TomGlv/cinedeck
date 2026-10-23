import { NextResponse, type NextRequest } from "next/server";
import { playerAction, readJson } from "@/lib/api";
import { getOrCreatePlayer } from "@/lib/player";
import { answerFriendRequest, getFriends, removeFriend, sendFriendRequest } from "@/lib/social";

export const dynamic = "force-dynamic";

/** GET -> FriendsDTO */
export async function GET() {
  const player = await getOrCreatePlayer();
  return NextResponse.json(await getFriends(player.id));
}

/**
 * POST { action: "add", username }
 * POST { action: "accept" | "decline", requestId }
 * POST { action: "remove", username }
 */
export async function POST(req: NextRequest) {
  const player = await getOrCreatePlayer();
  const body = await readJson(req);
  const username = String(body.username ?? "");
  const requestId = String(body.requestId ?? "");

  return playerAction(player.id, async () => {
    switch (body.action) {
      case "add":
        return { message: await sendFriendRequest(player.id, username) };
      case "accept":
      case "decline":
        await answerFriendRequest(player.id, requestId, body.action === "accept");
        return { message: body.action === "accept" ? "Friend added" : "Request declined" };
      case "remove":
        await removeFriend(player.id, username);
        return { message: "Removed" };
      default:
        return { message: "" };
    }
  });
}
