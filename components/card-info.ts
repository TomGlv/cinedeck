"use client";

import { createContext, useContext } from "react";
import type { CardData } from "@/lib/cards";

export const CardInfoContext = createContext<(card: CardData) => void>(() => {});

/** `useCardInfo()(card)` opens the card details modal from anywhere. */
export const useCardInfo = () => useContext(CardInfoContext);
