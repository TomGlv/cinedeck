-- CineDeck tables, generated from prisma/schema.prisma with:
--   node scripts/postgres-schema.mjs
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/postgres.prisma --script
-- Later schema changes: diff against the previous schema and add a new migration folder.

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "usernameKey" TEXT,
    "passwordHash" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "cineCoins" INTEGER NOT NULL DEFAULT 1000,
    "unlimitedCoins" BOOLEAN NOT NULL DEFAULT false,
    "lastFreePackAt" TIMESTAMP(3),
    "avatarCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedeemedCode" (
    "playerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedeemedCode_pkey" PRIMARY KEY ("playerId","code")
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "pack" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "opponentId" TEXT,
    "opponentName" TEXT,
    "invitedId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "creatorCards" TEXT NOT NULL,
    "opponentCards" TEXT,
    "creatorValues" TEXT,
    "opponentValues" TEXT,
    "creatorTotal" INTEGER,
    "opponentTotal" INTEGER,
    "winner" TEXT,
    "creatorSeen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnedCard" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "poster" TEXT,
    "type" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "year" INTEGER,
    "franchise" TEXT,
    "rarity" TEXT NOT NULL,
    "finish" TEXT NOT NULL DEFAULT 'normal',
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletedSet" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletedSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "ownedCardId" TEXT,
    "sellerId" TEXT,
    "sellerName" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "poster" TEXT,
    "type" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "year" INTEGER,
    "franchise" TEXT,
    "rarity" TEXT NOT NULL,
    "finish" TEXT NOT NULL DEFAULT 'normal',
    "startPrice" INTEGER NOT NULL,
    "buyNowPrice" INTEGER NOT NULL,
    "currentBid" INTEGER,
    "maxBid" INTEGER,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "bots" TEXT,
    "bidderId" TEXT,
    "bidderName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "soldPrice" INTEGER,
    "buyerId" TEXT,
    "buyerName" TEXT,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "lastBotCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "bidderId" TEXT,
    "bidderName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "rarity" TEXT NOT NULL DEFAULT 'Common',
    "finish" TEXT NOT NULL DEFAULT 'normal',
    "poster" TEXT,
    "buyerName" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "offerCoins" INTEGER NOT NULL DEFAULT 0,
    "requestCoins" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "ownedCardId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "poster" TEXT,
    "type" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "year" INTEGER,
    "franchise" TEXT,
    "rarity" TEXT NOT NULL,
    "finish" TEXT NOT NULL DEFAULT 'normal',

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clock" (
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clock_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "playerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("playerId","cardId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Player_usernameKey_key" ON "Player"("usernameKey");

-- CreateIndex
CREATE INDEX "Session_playerId_idx" ON "Session"("playerId");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "Battle_status_createdAt_idx" ON "Battle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Battle_creatorId_idx" ON "Battle"("creatorId");

-- CreateIndex
CREATE INDEX "Battle_invitedId_status_idx" ON "Battle"("invitedId", "status");

-- CreateIndex
CREATE INDEX "OwnedCard_playerId_idx" ON "OwnedCard"("playerId");

-- CreateIndex
CREATE INDEX "OwnedCard_playerId_franchise_idx" ON "OwnedCard"("playerId", "franchise");

-- CreateIndex
CREATE UNIQUE INDEX "CompletedSet_playerId_slug_key" ON "CompletedSet"("playerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_ownedCardId_key" ON "Listing"("ownedCardId");

-- CreateIndex
CREATE INDEX "Listing_status_endsAt_idx" ON "Listing"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");

-- CreateIndex
CREATE INDEX "Listing_bidderId_idx" ON "Listing"("bidderId");

-- CreateIndex
CREATE INDEX "Bid_listingId_createdAt_idx" ON "Bid"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_bidderId_idx" ON "Bid"("bidderId");

-- CreateIndex
CREATE INDEX "Sale_cardId_soldAt_idx" ON "Sale"("cardId", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");

-- CreateIndex
CREATE INDEX "Notification_playerId_read_createdAt_idx" ON "Notification"("playerId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_receiverId_status_idx" ON "Trade"("receiverId", "status");

-- CreateIndex
CREATE INDEX "Trade_senderId_status_idx" ON "Trade"("senderId", "status");

-- CreateIndex
CREATE INDEX "TradeItem_tradeId_idx" ON "TradeItem"("tradeId");

-- CreateIndex
CREATE INDEX "TradeItem_ownedCardId_idx" ON "TradeItem"("ownedCardId");

-- CreateIndex
CREATE INDEX "Favorite_cardId_idx" ON "Favorite"("cardId");

-- AddForeignKey
ALTER TABLE "RedeemedCode" ADD CONSTRAINT "RedeemedCode_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_invitedId_fkey" FOREIGN KEY ("invitedId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnedCard" ADD CONSTRAINT "OwnedCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedSet" ADD CONSTRAINT "CompletedSet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownedCardId_fkey" FOREIGN KEY ("ownedCardId") REFERENCES "OwnedCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

