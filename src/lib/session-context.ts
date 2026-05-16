"use client";
import { createContext, useContext } from "react";

export type ActiveSession = { id: string; name: string } | null;

export const ActiveSessionCtx = createContext<ActiveSession>(null);
export const useActiveSession = () => useContext(ActiveSessionCtx);
