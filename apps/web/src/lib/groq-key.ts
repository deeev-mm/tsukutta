"use client";

import { GROQ_STORAGE_KEY } from "@tsukutta/shared";
import { useEffect, useState } from "react";

export function useGroqKey() {
  const [key, setKeyState] = useState("");

  useEffect(() => {
    setKeyState(localStorage.getItem(GROQ_STORAGE_KEY) ?? "");
  }, []);

  const setKey = (value: string) => {
    const v = value.trim();
    if (v) localStorage.setItem(GROQ_STORAGE_KEY, v);
    else localStorage.removeItem(GROQ_STORAGE_KEY);
    setKeyState(v);
  };

  const clear = () => {
    localStorage.removeItem(GROQ_STORAGE_KEY);
    setKeyState("");
  };

  return { key, setKey, clear, hasKey: Boolean(key) };
}
