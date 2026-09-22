import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

const base = "h-5 w-5 shrink-0";

function createIcon(paths: ReactNode, filled = false) {
  return function Icon({ className = base }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 1.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const SearchIcon = createIcon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>);
export const CloseIcon = createIcon(<path d="M6 6l12 12M18 6L6 18" />);
export const ArrowLeftIcon = createIcon(<><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>);
export const UserIcon = createIcon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>);
export const DownloadIcon = createIcon(<><path d="M12 4v10" /><path d="m8 11 4 4 4-4" /><path d="M5 19h14" /></>);
export const UploadIcon = createIcon(<><path d="M12 20V10" /><path d="m8 13 4-4 4 4" /><path d="M5 5h14" /></>);
export const ExternalLinkIcon = createIcon(<><path d="M14 5h5v5" /><path d="M19 5 10 14" /><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></>);
export const LogoIcon = createIcon(
  <>
    <path d="M12 6.5A2.5 2.5 0 0 0 9.5 4H4v13h5.5a2.5 2.5 0 0 1 2.5 2.5" />
    <path d="M12 6.5A2.5 2.5 0 0 1 14.5 4H20v13h-5.5a2.5 2.5 0 0 0-2.5 2.5" />
  </>,
);
export const AlertIcon = createIcon(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></>);
export const CheckIcon = createIcon(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const PlusIcon = createIcon(<path d="M12 5v14M5 12h14" />);
export const HomeIcon = createIcon(<><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></>);
export const BookmarkIcon = createIcon(<path d="M6 4h12v16l-6-4-6 4z" />);
export const BookmarkFilledIcon = createIcon(<path d="M6 4h12v16l-6-4-6 4z" />, true);
export const ShareIcon = createIcon(<><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></>);
export const CommentIcon = createIcon(<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z" />);
export const StarIcon = createIcon(<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />);
export const StarFilledIcon = createIcon(<path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />, true);
export const ThumbsUpIcon = createIcon(<><path d="M7 11v9H4v-9z" /><path d="M7 11l4-7a2 2 0 0 1 2.9 2.2L13 10h5.6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.4 20H7" /></>);
export const SettingsIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>,
);
export const LogOutIcon = createIcon(<><path d="M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" /><path d="m16 16 4-4-4-4" /><path d="M20 12H9" /></>);
export const SunIcon = createIcon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const MoonIcon = createIcon(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />);
export const MonitorIcon = createIcon(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>);
export const ImageIcon = createIcon(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>);
export const VideoIcon = createIcon(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>);
export const MusicIcon = createIcon(<><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>);
export const FileIcon = createIcon(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>);
export const FileTextIcon = createIcon(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>);
export const PresentationIcon = createIcon(<><path d="M3 4h18M4 4v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4" /><path d="m9 20 3-5 3 5" /></>);
export const TableIcon = createIcon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></>);
export const ArchiveIcon = createIcon(<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>);
export const PaperclipIcon = createIcon(<path d="m20 11.5-8.1 8.1a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />);
export const MoreIcon = createIcon(<><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>, true);
export const TrashIcon = createIcon(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>);
export const LinkIcon = createIcon(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const EyeIcon = createIcon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOffIcon = createIcon(<><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></>);
export const CameraIcon = createIcon(<><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>);
export const MapPinIcon = createIcon(<><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>);
export const GraduationIcon = createIcon(<><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6" /></>);
export const SendIcon = createIcon(<><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4z" /></>);
export const LockIcon = createIcon(<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>);
export const PaletteIcon = createIcon(<><path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5a1.5 1.5 0 0 1 1.5-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></>);
export const CalendarIcon = createIcon(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>);
export const FilterIcon = createIcon(<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>);
