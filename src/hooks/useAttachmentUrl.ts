import { useEffect, useState } from "react";
import { getAttachmentUrl } from "../services/api";
import type { Attachment } from "../types";

interface AttachmentUrlState {
  url: string | null;
  failed: boolean;
}

export function useAttachmentUrl(attachment: Attachment): AttachmentUrlState {
  const [state, setState] = useState<AttachmentUrlState>({ url: null, failed: false });

  useEffect(() => {
    let active = true;
    getAttachmentUrl(attachment)
      .then((url) => active && setState({ url, failed: false }))
      .catch(() => active && setState({ url: null, failed: true }));
    return () => {
      active = false;
    };
  }, [attachment]);

  return state;
}
