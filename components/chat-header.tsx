"use client";

import { Moon as MoonIcon, Sun as SunIcon } from "lucide-react";
import { memo } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

function PureChatHeader({
  chatId,
  isReadonly,
}: {
  chatId: string;
  isReadonly: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const currentTheme = resolvedTheme ?? "light";
  const isDarkMode = currentTheme === "dark";
  const nextTheme = isDarkMode ? "light" : "dark";

  return (
    <header
      aria-live={isReadonly ? "polite" : "off"}
      className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background px-2 py-1.5 font-serif md:px-2"
      data-chat-id={chatId}
      id={`chat-${chatId}-header`}
    >
      <span className="text-base font-semibold tracking-tight">
        SVRN AI Studio
      </span>
      <Button
        aria-label={`Switch to ${nextTheme} theme`}
        onClick={() => {
          setTheme(nextTheme);
        }}
        size="icon"
        title={`Switch to ${nextTheme} theme`}
        type="button"
        variant="ghost"
      >
        {isDarkMode ? (
          <SunIcon aria-hidden="true" className="size-4" />
        ) : (
          <MoonIcon aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only">Toggle light or dark appearance</span>
      </Button>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
