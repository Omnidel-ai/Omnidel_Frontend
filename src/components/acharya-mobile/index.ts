/**
 * Acharya mobile kit: the components the Kaarigar app (omnidel-acharya at
 * PR #207) and the Contractor app (OmniPulse) both need, built once.
 *
 * Map and reasoning: docs/ACHARYA_OMNIPULSE_COMMON_COMPONENTS.md.
 *
 * Presentation only, like the desktop kit: no fetching, no routing, no session.
 * Each app keeps its own voice session, strings and data, and passes state in.
 *
 * Desktop components that already cover a shared need are reused, not
 * re-exported: `EmptyState`, `Skeleton` and `Button` come from `src/components/common`.
 */
import "./acharya-mobile.css";

export { MobileIcon, MOBILE_ICON_NAMES } from "./Icon";
export type { MobileIconName, MobileIconProps } from "./Icon";

export { MobileScreen, ScreenHeader, IconButton } from "./MobileScreen";
export type { MobileLook, MobileScreenProps, ScreenHeaderProps, IconButtonProps } from "./MobileScreen";

export { BottomDock } from "./BottomDock";
export type { BottomDockProps, DockItem } from "./BottomDock";

export { MicButton, ConnectingDots } from "./MicButton";
export type { MicButtonProps, MicStatus } from "./MicButton";

export { VoiceWaveform } from "./VoiceWaveform";
export type { VoiceWaveformProps } from "./VoiceWaveform";

export { micLevel, createLevelBus, frameRms } from "./micLevel";
export type { LevelSource } from "./micLevel";

export { PersonAvatar, PersonAvatarStack } from "./PersonAvatar";
export type { PersonAvatarProps } from "./PersonAvatar";

export { Card, SectionHeader } from "./Card";
export type { CardProps, CardTone, SectionHeaderProps } from "./Card";

export { Tag, colorTagStyle } from "./Tag";
export type { TagProps, TagTone } from "./Tag";

export { StatTile, StatRow } from "./StatTile";
export type { StatTileProps, StatTone } from "./StatTile";

export { DetailList, ProfileHero } from "./DetailList";
export type { DetailListProps, DetailRow, ProfileHeroProps } from "./DetailList";

export { ListRow, RowList } from "./ListRow";
export type { ListRowProps } from "./ListRow";

export { TaskCard } from "./TaskCard";
export type { TaskCardProps, DueTone } from "./TaskCard";

export { SegmentedTabs } from "./SegmentedTabs";
export type { SegmentedTab, SegmentedTabsProps } from "./SegmentedTabs";

export { ChoiceGroup } from "./ChoiceGroup";
export type { Choice, ChoiceGroupProps } from "./ChoiceGroup";

export { OtpInput, PhoneInput, formatIndianPhone } from "./SignInFields";
export type { OtpInputProps, PhoneInputProps } from "./SignInFields";

export { BottomSheet } from "./BottomSheet";
export type { BottomSheetProps } from "./BottomSheet";
