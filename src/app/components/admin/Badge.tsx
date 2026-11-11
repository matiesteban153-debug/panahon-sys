interface BadgeProps {
  variant: "active" | "inactive" | "complete" | "incomplete" | "warning" | "orange";
  children?: React.ReactNode;
  text?: string;
}

const variants = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  complete: "bg-emerald-50 text-emerald-700",
  incomplete: "bg-amber-50 text-amber-700",
  warning: "bg-amber-50 text-amber-700",
  orange: "bg-orange-100 text-orange-700",
};

export function Badge({ variant, children, text }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${variants[variant]}`}
      style={{ fontSize: "0.75rem", fontWeight: 600 }}
    >
      {children ?? text}
    </span>
  );
}