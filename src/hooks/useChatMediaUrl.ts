import { useEffect, useState } from "react";
import { getAttachmentUrl } from "../services/api";
import type { MessageAttachment } from "../types";

/**
 * A chat file's URL, ready for <img>, <audio> or a link. Signed URLs and blob
 * URLs pass straight through; browser-only mode resolves its IndexedDB files.
 */
export function useChatMediaUrl(attachment: MessageAttachment | null, which: "url" | "downloadUrl" = "url") {
  const source = attachment?.[which] ?? "";
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });

  useEffect(() => {
    if (!attachment || !source) {
      setState({ url: null, failed: Boolean(attachment) });
      return;
    }
    let active = true;
    getAttachmentUrl({
      id: attachment.path,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: "other",
      url: source,
    })
      .then((url) => active && setState({ url, failed: false }))
      .catch(() => active && setState({ url: null, failed: true }));
    return () => {
      active = false;
    };
    // The path identifies the file; the object itself is rebuilt on every render.
  }, [attachment?.path, source]);

  return state;
}
