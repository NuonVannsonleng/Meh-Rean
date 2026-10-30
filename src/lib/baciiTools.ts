import type { ComponentType } from "react";
import { BulbIcon, CalendarIcon, CameraIcon, FileTextIcon, PenIcon, StarIcon, TableIcon, VideoIcon } from "../components/Icons";
import { t } from "../i18n/en";

export interface BaciiTool {
  to: string;
  title: string;
  titleKm: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}

/** Everything in the BacII section; a new tool is one more entry here. */
export const BACII_TOOLS: BaciiTool[] = [
  {
    to: "/bacii/papers",
    title: t.bacii.papers.optionTitle,
    titleKm: t.bacii.papers.optionTitleKm,
    description: t.bacii.papers.optionDescription,
    Icon: FileTextIcon,
  },
  {
    to: "/bacii/practice",
    title: t.bacii.practice.optionTitle,
    titleKm: t.bacii.practice.optionTitleKm,
    description: t.bacii.practice.optionDescription,
    Icon: BulbIcon,
  },
  {
    to: "/bacii/timer",
    title: t.bacii.timer.optionTitle,
    titleKm: t.bacii.timer.optionTitleKm,
    description: t.bacii.timer.optionDescription,
    Icon: CalendarIcon,
  },
  {
    to: "/live",
    title: t.bacii.live.optionTitle,
    titleKm: t.bacii.live.optionTitleKm,
    description: t.bacii.live.optionDescription,
    Icon: StarIcon,
  },
  {
    to: "/bacii/solve",
    title: t.bacii.solve.optionTitle,
    titleKm: t.bacii.solve.optionTitleKm,
    description: t.bacii.solve.optionDescription,
    Icon: CameraIcon,
  },
  {
    to: "/bacii/mistakes",
    title: t.bacii.mistakes.optionTitle,
    titleKm: t.bacii.mistakes.optionTitleKm,
    description: t.bacii.mistakes.optionDescription,
    Icon: PenIcon,
  },
  {
    to: "/bacii/plan",
    title: t.bacii.plan.optionTitle,
    titleKm: t.bacii.plan.optionTitleKm,
    description: t.bacii.plan.optionDescription,
    Icon: TableIcon,
  },
  {
    to: "/bacii/videos",
    title: t.bacii.videos.optionTitle,
    titleKm: t.bacii.videos.optionTitleKm,
    description: t.bacii.videos.optionDescription,
    Icon: VideoIcon,
  },
];
