import { useState } from "react";
import { t } from "../../i18n/en";
import { STICKERS, Sticker } from "./Stickers";

type Tab = "emoji" | "stickers";

const EMOJI: Record<keyof typeof t.messages.emojiGroups, string[]> = {
  smileys: ["😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤓", "🤔", "😴", "😅", "😭", "😤", "😱", "🥳", "🙃", "😬", "🤯", "🫡", "😇", "🤗", "😌", "🥲"],
  study: ["📚", "📖", "📝", "✏️", "📐", "🧮", "🔬", "🧪", "💻", "🎓", "🏫", "📅", "⏰", "☕", "💡", "🧠", "✅", "❌", "🔥", "⭐", "📌", "🎯", "🏆", "📈"],
  hands: ["👍", "👎", "👏", "🙌", "🙏", "👋", "🤝", "✌️", "🤞", "💪", "👌", "🫶", "☝️", "👉", "✍️", "🤙"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "💯", "✨", "🎉", "🌟", "💫"],
};

const TAB_KEY = "meh-rean:chat-panel-tab";

function readTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "stickers" ? "stickers" : "emoji";
  } catch {
    return "emoji";
  }
}

export default function EmojiStickerPanel({
  id,
  onEmoji,
  onSticker,
}: {
  id: string;
  onEmoji: (emoji: string) => void;
  onSticker: (sticker: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(readTab);

  const choose = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Only a convenience.
    }
  };

  return (
    <div id={id} role="dialog" aria-label={t.messages.emojiAndStickers} className="animate-rise border-line flex h-64 flex-col border-t sm:h-72">
      <div role="tablist" aria-label={t.messages.emojiAndStickers} className="flex shrink-0 gap-1 px-3 pt-2">
        {(["emoji", "stickers"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => choose(value)}
            className={`press h-8 rounded-full px-3 text-sm font-semibold ${
              tab === value ? "bg-brand-50 text-accent" : "text-ink-500 hover:bg-surface-hover"
            }`}
          >
            {value === "emoji" ? t.messages.tabEmoji : t.messages.tabStickers}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-2">
        {tab === "emoji" ? (
          Object.entries(EMOJI).map(([group, emoji]) => (
            <section key={group} aria-label={t.messages.emojiGroups[group as keyof typeof EMOJI]}>
              <h3 className="text-ink-500 px-1.5 pt-2 pb-1 text-xs font-semibold">
                {t.messages.emojiGroups[group as keyof typeof EMOJI]}
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))]">
                {emoji.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onEmoji(item)}
                    className="press hover:bg-surface-hover flex h-10 items-center justify-center rounded-lg text-2xl"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1 pt-1">
            {STICKERS.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => onSticker(sticker.id)}
                aria-label={t.messages.sendSticker(sticker.label)}
                className="press hover:bg-surface-hover flex items-center justify-center rounded-xl p-1"
              >
                <Sticker id={sticker.id} className="h-20 w-20" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
