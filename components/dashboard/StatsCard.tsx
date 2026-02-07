import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: "blue" | "green" | "orange" | "red" | "purple";
  subtitle?: string;
}

const colorMap = {
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-600",
    text: "text-blue-600",
  },
  green: {
    bg: "bg-emerald-50",
    icon: "bg-emerald-600",
    text: "text-emerald-600",
  },
  orange: {
    bg: "bg-amber-50",
    icon: "bg-amber-600",
    text: "text-amber-600",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-600",
    text: "text-red-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-600",
    text: "text-purple-600",
  },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className={`text-xs font-medium ${colors.text}`}>{subtitle}</p>
          )}
        </div>
        <div
          className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center`}
        >
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
      </div>
    </div>
  );
}
