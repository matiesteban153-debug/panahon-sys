interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  hasClockedIn?: boolean;
}

const bgColors = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

function getColorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return bgColors[Math.abs(hash) % bgColors.length];
}

const sizes = {
  sm: { container: "w-10 h-10", text: "text-base" },
  md: { container: "w-14 h-14", text: "text-xl" },
  lg: { container: "w-20 h-20", text: "text-3xl" },
};

export function EmployeeAvatar({ name, size = "sm", hasClockedIn }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colorClass = getColorForName(name);
  const s = sizes[size];

  return (
    <div className="relative inline-flex">
      <div
        className={`${s.container} rounded-full flex items-center justify-center font-semibold ${colorClass}`}
      >
        <span className={s.text}>{initials}</span>
      </div>
      {hasClockedIn !== undefined && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
            hasClockedIn ? "bg-[#22C55E]" : "bg-gray-300"
          }`}
        />
      )}
    </div>
  );
}
