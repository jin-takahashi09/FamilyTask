export type MemberCalendarColor = {
  id: string;
  dot: string;
  ring: string;
  border: string;
  bar: string;
  text: string;
};

export const MEMBER_CALENDAR_COLORS: readonly MemberCalendarColor[] = [
  {
    id: "amber",
    dot: "bg-amber-500",
    ring: "bg-gradient-to-tr from-amber-400 to-orange-400",
    border: "border-amber-300 bg-amber-50",
    bar: "bg-amber-500",
    text: "text-amber-800",
  },
  {
    id: "sky",
    dot: "bg-sky-500",
    ring: "bg-gradient-to-tr from-sky-400 to-blue-500",
    border: "border-sky-300 bg-sky-50",
    bar: "bg-sky-500",
    text: "text-sky-800",
  },
  {
    id: "emerald",
    dot: "bg-emerald-500",
    ring: "bg-gradient-to-tr from-emerald-400 to-teal-500",
    border: "border-emerald-300 bg-emerald-50",
    bar: "bg-emerald-500",
    text: "text-emerald-800",
  },
  {
    id: "violet",
    dot: "bg-violet-500",
    ring: "bg-gradient-to-tr from-violet-400 to-purple-500",
    border: "border-violet-300 bg-violet-50",
    bar: "bg-violet-500",
    text: "text-violet-800",
  },
  {
    id: "rose",
    dot: "bg-rose-500",
    ring: "bg-gradient-to-tr from-rose-400 to-pink-500",
    border: "border-rose-300 bg-rose-50",
    bar: "bg-rose-500",
    text: "text-rose-800",
  },
  {
    id: "teal",
    dot: "bg-teal-500",
    ring: "bg-gradient-to-tr from-teal-400 to-cyan-500",
    border: "border-teal-300 bg-teal-50",
    bar: "bg-teal-500",
    text: "text-teal-800",
  },
];

export function getMemberCalendarColor(userId: string): MemberCalendarColor {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return MEMBER_CALENDAR_COLORS[hash % MEMBER_CALENDAR_COLORS.length];
}
