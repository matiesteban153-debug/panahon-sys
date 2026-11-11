import svgPaths from "../../imports/svg-9dqf0kngaq";

interface PanahonLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  color?: "orange" | "dark" | "white";
  showText?: boolean;
}

const sizes = {
  xs: { icon: 20, gap: "gap-1.5", text: "0.875rem" },
  sm: { icon: 24, gap: "gap-2", text: "1.0625rem" },
  md: { icon: 28, gap: "gap-2", text: "1.25rem" },
  lg: { icon: 36, gap: "gap-2.5", text: "1.375rem" },
};

const colors = {
  orange: { fill: "#F97316", text: "text-[#F97316]" },
  dark: { fill: "#1A1A1A", text: "text-[#1A1A1A]" },
  white: { fill: "#FFFFFF", text: "text-white" },
};

function SunburstIcon({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 586.393 586.393"
      fill="none"
      className="flex-shrink-0"
    >
      <path d={svgPaths.p34abd900} fill={fill} />
      <path d={svgPaths.p5b24000} fill={fill} />
      <path d={svgPaths.p28e5b280} fill={fill} />
      <path d={svgPaths.p27c28f00} fill={fill} />
      <path d={svgPaths.p2765f980} fill={fill} />
      <path d={svgPaths.p2abcdb00} fill={fill} />
      <path d={svgPaths.p4af9c00} fill={fill} />
      <path d={svgPaths.p356e9e80} fill={fill} />
      <path d={svgPaths.p481e100} fill={fill} />
      <path d={svgPaths.p3d85c300} fill={fill} />
      <path d={svgPaths.p9a5c000} fill={fill} />
      <path d={svgPaths.pfd46b80} fill={fill} />
      <path d={svgPaths.p115dc800} fill={fill} />
      <path d={svgPaths.p7673d00} fill={fill} />
      <path d={svgPaths.p1eda2000} fill={fill} />
      <path d={svgPaths.p12447c00} fill={fill} />
    </svg>
  );
}

export function PanahonLogo({
  size = "md",
  color = "orange",
  showText = true,
}: PanahonLogoProps) {
  const s = sizes[size];
  const c = colors[color];

  return (
    <div className={`flex items-center ${s.gap}`}>
      <SunburstIcon size={s.icon} fill={c.fill} />
      {showText && (
        <span
          className={c.text}
          style={{
            fontSize: s.text,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Panahon
        </span>
      )}
    </div>
  );
}
