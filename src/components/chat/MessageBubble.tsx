import { useRef, type ReactNode } from "react";
import { useChatMediaUrl } from "../../hooks/useChatMediaUrl";
import { t } from "../../i18n/en";
import { detectAttachmentKind } from "../../lib/attachments";
import { messageSnippet } from "../../lib/chat";
import { formatDateTime, formatFileSize } from "../../lib/format";
import { REACTION_TYPES, type Message, type PublicUser, type ReactionType } from "../../types";
import Avatar from "../Avatar";
import { DownloadIcon, PenIcon, TrashIcon } from "../Icons";
import { AttachmentIcon } from "../PostAttachments";
import ReactionIcon from "../ReactionIcon";
import { Sticker } from "./Stickers";
import VoicePlayer from "./VoicePlayer";

/** A message still on its way to the server. */
export interface PendingMessage extends Message {
  pending: true;
  /** The send failed; the bubble offers a retry. */
  failed?: boolean;
}

export type Bubble = Message | PendingMessage;

export function isPending(message: Bubble): message is PendingMessage {
  return "pending" in message;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
/** How long a finger has to rest on a message to open its options. */
const LONG_PRESS_MS = 450;

/** Plain text with web links made clickable. Nothing else is interpreted. */
function MessageText({ body }: { body: string }) {
  const parts = body.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2 break-all"
            onClick={(event) => event.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ChatImage({ message, alt, onOpen }: { message: Message; alt: string; onOpen: () => void }) {
  const attachment = message.attachment;
  const { url } = useChatMediaUrl(attachment);
  const ratio = attachment?.width && attachment.height ? `${attachment.width} / ${attachment.height}` : "4 / 3";
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label={t.messages.viewPhoto}
      className="bg-surface-hover block w-[min(17rem,64vw)] overflow-hidden sm:w-72"
      style={{ aspectRatio: ratio, maxHeight: "22rem" }}
    >
      {url && <img src={url} alt={alt} className="animate-fade h-full w-full object-cover" draggable={false} />}
    </button>
  );
}

function ChatVideo({ message, label }: { message: Message; label: string }) {
  const attachment = message.attachment;
  const { url } = useChatMediaUrl(attachment);
  const ratio = attachment?.width && attachment.height ? `${attachment.width} / ${attachment.height}` : "16 / 9";
  return (
    <div className="w-[min(17rem,64vw)] overflow-hidden bg-black sm:w-72" style={{ aspectRatio: ratio, maxHeight: "22rem" }}>
      {url && (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          className="h-full w-full"
        />
      )}
    </div>
  );
}

function ChatFile({ message, mine }: { message: Message; mine: boolean }) {
  const attachment = message.attachment;
  const { url: download, failed } = useChatMediaUrl(attachment, "downloadUrl");
  const { url: inline } = useChatMediaUrl(attachment);
  if (!attachment) return null;
  const kind = detectAttachmentKind(attachment.mimeType, attachment.name);
  return (
    <div className="w-[min(17rem,64vw)] sm:w-72">
      <div className="flex items-center gap-3">
        <AttachmentIcon kind={kind} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={attachment.name}>
            {attachment.name}
          </p>
          <p className={`text-xs ${mine ? "text-white/80" : "text-ink-500"}`}>
            {failed ? t.messages.fileUnavailable : formatFileSize(attachment.size)}
          </p>
        </div>
        {download && (
          <a
            href={download}
            download={attachment.name}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            aria-label={t.messages.downloadAria(attachment.name)}
            className={`press flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              mine ? "bg-white/20 hover:bg-white/30" : "bg-surface hover:bg-surface-muted"
            }`}
          >
            <DownloadIcon className="h-4 w-4" />
          </a>
        )}
      </div>
      {kind === "audio" && inline && (
        <audio src={inline} controls preload="metadata" className="mt-2 w-full" onClick={(event) => event.stopPropagation()} />
      )}
    </div>
  );
}

function ReplyQuote({
  target,
  mine,
  nameFor,
  onJump,
}: {
  target: Message | null;
  mine: boolean;
  nameFor: (userId: string) => string;
  onJump: () => void;
}) {
  const snippet = target
    ? messageSnippet({ ...target, deleted: Boolean(target.deletedAt), attachmentName: target.attachment?.name, duration: target.attachment?.duration })
    : t.messages.replyUnavailable;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onJump();
      }}
      disabled={!target}
      aria-label={t.messages.jumpToReply}
      className={`mb-1 block max-w-[min(17rem,64vw)] rounded-xl border-l-4 px-2.5 py-1.5 text-left text-xs sm:max-w-72 ${
        mine ? "bg-brand-50 border-brand-600 ml-auto" : "bg-surface-hover border-ink-400"
      }`}
    >
      <span className="text-ink-900 block font-semibold">{target ? t.messages.repliedTo(nameFor(target.senderId)) : t.messages.reply}</span>
      <span className="text-ink-500 line-clamp-2">{snippet}</span>
    </button>
  );
}

function ReactionSummary({
  reactions,
  nameFor,
  onOpen,
}: {
  reactions: Record<string, ReactionType>;
  nameFor: (userId: string) => string;
  onOpen: () => void;
}) {
  const entries = Object.entries(reactions);
  if (!entries.length) return null;
  const types = REACTION_TYPES.filter((type) => entries.some(([, value]) => value === type));
  const label = types
    .map((type) =>
      t.messages.reactedBy(
        t.reactions[type],
        entries
          .filter(([, value]) => value === type)
          .map(([userId]) => nameFor(userId))
          .join(", "),
      ),
    )
    .join("; ");
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      title={label}
      aria-label={label}
      className="press bg-surface border-line animate-pop relative z-10 -mt-2 flex h-6 items-center gap-0.5 rounded-full border px-1 shadow-sm"
    >
      {types.map((type) => (
        <ReactionIcon key={type} type={type} className="h-4.5 w-4.5" />
      ))}
      {entries.length > 1 && <span className="text-ink-700 px-0.5 text-[11px] font-semibold">{entries.length}</span>}
    </button>
  );
}

export interface MessageBubbleProps {
  message: Bubble;
  me: string;
  other: PublicUser;
  joinsPrevious: boolean;
  joinsNext: boolean;
  /** undefined: no reply; null: replying to something no longer loaded. */
  replyTarget: Message | null | undefined;
  selected: boolean;
  highlighted: boolean;
  onSelect: (open: boolean) => void;
  onOpenImage: (message: Message) => void;
  onReact: (reaction: ReactionType | null) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onUnsend: () => void;
  onJump: (messageId: string) => void;
  onRetry?: () => void;
  onDiscard?: () => void;
  footer?: ReactNode;
}

export default function MessageBubble({
  message,
  me,
  other,
  joinsPrevious,
  joinsNext,
  replyTarget,
  selected,
  highlighted,
  onSelect,
  onOpenImage,
  onReact,
  onReply,
  onCopy,
  onEdit,
  onUnsend,
  onJump,
  onRetry,
  onDiscard,
  footer,
}: MessageBubbleProps) {
  const mine = message.senderId === me;
  const sending = isPending(message);
  const failed = isPending(message) && Boolean(message.failed);
  const deleted = Boolean(message.deletedAt);
  const hold = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const nameFor = (userId: string) => (userId === me ? t.messages.youName : other.displayName);
  const attachment = message.attachment;
  const myReaction = message.reactions[me] ?? null;

  const bubbleTone = mine ? "bg-brand-600 text-white" : "bg-surface-hover text-ink-900";
  const corners = mine
    ? `${joinsPrevious ? "rounded-tr-md" : ""} ${joinsNext ? "rounded-br-md" : ""}`
    : `${joinsPrevious ? "rounded-tl-md" : ""} ${joinsNext ? "rounded-bl-md" : ""}`;

  const endHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
  };

  let content: ReactNode;
  if (deleted) {
    content = (
      <div className={`border-line text-ink-500 rounded-2xl border border-dashed px-3.5 py-2 text-sm italic ${corners}`}>
        {mine ? t.messages.unsentMine : t.messages.unsentTheirs(other.displayName)}
      </div>
    );
  } else if (message.kind === "sticker" && message.sticker) {
    content = <Sticker id={message.sticker} className="h-28 w-28 sm:h-32 sm:w-32" />;
  } else if ((message.kind === "image" || message.kind === "video") && attachment) {
    content = (
      <div className={`overflow-hidden rounded-2xl ${corners} ${message.body ? bubbleTone : ""}`}>
        {message.kind === "image" ? (
          <ChatImage message={message} alt={message.body || t.messages.photoFrom(nameFor(message.senderId))} onOpen={() => onOpenImage(message)} />
        ) : (
          <ChatVideo message={message} label={t.messages.videoFrom(nameFor(message.senderId))} />
        )}
        {message.body && (
          <p className="max-w-[min(17rem,64vw)] px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere] sm:max-w-72 sm:text-sm">
            <MessageText body={message.body} />
          </p>
        )}
      </div>
    );
  } else if (message.kind === "voice" && attachment) {
    content = (
      <div className={`rounded-2xl px-3 py-2 ${bubbleTone} ${corners}`}>
        <VoicePlayer attachment={attachment} mine={mine} />
      </div>
    );
  } else if (message.kind === "file" && attachment) {
    content = (
      <div className={`rounded-2xl px-3 py-2.5 ${bubbleTone} ${corners}`}>
        <ChatFile message={message} mine={mine} />
        {message.body && (
          <p className="mt-2 max-w-[min(17rem,64vw)] text-[15px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere] sm:max-w-72 sm:text-sm">
            <MessageText body={message.body} />
          </p>
        )}
      </div>
    );
  } else {
    content = (
      <div
        className={`max-w-[min(80vw,34rem)] rounded-2xl px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap [overflow-wrap:anywhere] sm:max-w-[34rem] sm:text-sm ${bubbleTone} ${corners}`}
      >
        <MessageText body={message.body} />
      </div>
    );
  }

  const canDownload = Boolean(attachment && !deleted && !sending);

  return (
    <div
      id={`message-${message.id}`}
      className={`flex flex-col ${mine ? "items-end" : "items-start"} ${joinsPrevious ? "mt-0.5" : "mt-3"}`}
    >
      {message.replyToId && replyTarget !== undefined && !deleted && (
        <div className={mine ? "self-end" : "pl-10"}>
          <ReplyQuote target={replyTarget} mine={mine} nameFor={nameFor} onJump={() => replyTarget && onJump(replyTarget.id)} />
        </div>
      )}

      <div className={`flex max-w-full items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        {!mine && (
          <span className="w-8 shrink-0" aria-hidden="true">
            {!joinsNext && <Avatar user={other} size="sm" />}
          </span>
        )}
        <div
          role="button"
          tabIndex={sending ? -1 : 0}
          aria-expanded={sending ? undefined : selected}
          aria-label={t.messages.actions(nameFor(message.senderId))}
          title={formatDateTime(message.createdAt)}
          onClick={() => {
            if (hold.current?.fired) {
              hold.current = null;
              return;
            }
            if (!sending) onSelect(!selected);
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget && !sending) {
              event.preventDefault();
              onSelect(!selected);
            }
          }}
          onContextMenu={(event) => {
            if (sending) return;
            event.preventDefault();
            onSelect(true);
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch" || sending) return;
            const state = { timer: 0, x: event.clientX, y: event.clientY, fired: false };
            state.timer = window.setTimeout(() => {
              state.fired = true;
              navigator.vibrate?.(8);
              onSelect(true);
            }, LONG_PRESS_MS);
            hold.current = state;
          }}
          onPointerMove={(event) => {
            const state = hold.current;
            if (state && Math.hypot(event.clientX - state.x, event.clientY - state.y) > 10) endHold();
          }}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          className={`relative flex min-w-0 cursor-default flex-col rounded-2xl outline-offset-2 transition-[opacity,box-shadow] select-text ${
            mine ? "items-end" : "items-start"
          } ${sending && !failed ? "opacity-60" : ""} ${failed ? "opacity-80" : ""} ${highlighted ? "ring-accent animate-pop ring-2 ring-offset-2" : ""}`}
        >
          <span className="sr-only">{mine ? t.messages.you : `${other.displayName}: `}</span>
          {content}
          {!deleted && (
            <div className={`flex ${mine ? "justify-end pr-2" : "justify-start pl-2"}`}>
              <ReactionSummary reactions={message.reactions} nameFor={nameFor} onOpen={() => onSelect(true)} />
            </div>
          )}
        </div>
      </div>

      {message.editedAt && !deleted && !selected && (
        <p className={`text-ink-500 mt-0.5 text-[11px] ${mine ? "pr-1" : "pl-11"}`}>{t.messages.edited}</p>
      )}
      {sending && !failed && (
        <p className="text-ink-500 animate-fade mt-1 text-xs" role="status">
          {message.attachment ? t.messages.uploading : t.messages.sending}
        </p>
      )}
      {failed && (
        <p className="text-danger-fg animate-fade mt-1 flex items-center gap-2 text-xs font-medium" role="alert">
          {t.messages.notSent}
          <button type="button" onClick={onRetry} className="link text-xs">
            {t.messages.retry}
          </button>
          <button type="button" onClick={onDiscard} className="text-ink-500 touch-target text-xs font-semibold hover:underline">
            {t.messages.discard}
          </button>
        </p>
      )}

      {selected && !sending && (
        <div
          className={`animate-pop border-line bg-surface mt-1.5 flex max-w-full flex-col gap-1.5 rounded-2xl border p-1.5 shadow-lg ${
            mine ? "origin-top-right" : "ml-10 origin-top-left"
          }`}
        >
          {!deleted && (
            <div role="group" aria-label={t.messages.react} className="flex items-center gap-0.5">
              {REACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onReact(myReaction === type ? null : type)}
                  aria-pressed={myReaction === type}
                  aria-label={myReaction === type ? t.messages.removeReaction : t.messages.reactWith(t.reactions[type])}
                  title={t.reactions[type]}
                  className={`press flex h-10 w-10 items-center justify-center rounded-full hover:scale-110 ${
                    myReaction === type ? "bg-brand-50 ring-accent ring-2" : "hover:bg-surface-hover"
                  }`}
                >
                  <ReactionIcon type={type} className="h-7 w-7" />
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <time dateTime={message.createdAt} className="text-ink-500 px-2 text-xs">
              {timeFormat.format(new Date(message.createdAt))}
              {message.editedAt && ` · ${t.messages.edited}`}
            </time>
            {!deleted && (
              <button type="button" onClick={onReply} className="press hover:bg-surface-hover text-ink-700 h-9 rounded-full px-3 font-medium">
                {t.messages.reply}
              </button>
            )}
            {!deleted && message.body && (
              <button type="button" onClick={onCopy} className="press hover:bg-surface-hover text-ink-700 h-9 rounded-full px-3 font-medium">
                {t.messages.copy}
              </button>
            )}
            {mine && !deleted && message.kind === "text" && (
              <button type="button" onClick={onEdit} className="press hover:bg-surface-hover text-ink-700 inline-flex h-9 items-center gap-1 rounded-full px-3 font-medium">
                <PenIcon className="h-3.5 w-3.5" />
                {t.messages.edit}
              </button>
            )}
            {canDownload && attachment && <DownloadAction message={message} />}
            {mine && !deleted && (
              <button
                type="button"
                onClick={onUnsend}
                className="press hover:bg-surface-hover text-danger-fg inline-flex h-9 items-center gap-1 rounded-full px-3 font-medium"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                {t.messages.unsend}
              </button>
            )}
          </div>
        </div>
      )}

      {footer}
    </div>
  );
}

function DownloadAction({ message }: { message: Message }) {
  const { url } = useChatMediaUrl(message.attachment, "downloadUrl");
  if (!url || !message.attachment) return null;
  return (
    <a
      href={url}
      download={message.attachment.name}
      target="_blank"
      rel="noopener noreferrer"
      className="press hover:bg-surface-hover text-ink-700 inline-flex h-9 items-center gap-1 rounded-full px-3 font-medium"
    >
      <DownloadIcon className="h-3.5 w-3.5" />
      {t.messages.download}
    </a>
  );
}
