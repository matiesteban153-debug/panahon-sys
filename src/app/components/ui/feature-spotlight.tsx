import { useEffect, useId, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";

interface FeatureSpotlightProps {
  featureId: string;
  title: string;
  description: string;
  children: ReactNode;
  actionLabel?: string;
}

const acknowledgedFeatures = new Set<string>();

export function FeatureSpotlight({ featureId, title, description, children, actionLabel = "Entendido" }: FeatureSpotlightProps) {
  const [unread, setUnread] = useState(false);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const storageKey = `panahon:feature-spotlight:${featureId}`;

  useEffect(() => {
    const update = () => {
      let seen = acknowledgedFeatures.has(storageKey);
      try {
        seen = seen || localStorage.getItem(storageKey) === "read";
      } catch {}
      setUnread(!seen);
      setOpen(false);
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("panahon:spotlight-read", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("panahon:spotlight-read", update);
    };
  }, [storageKey]);

  const acknowledge = () => {
    acknowledgedFeatures.add(storageKey);
    try {
      localStorage.setItem(storageKey, "read");
    } catch {}
    setUnread(false);
    setOpen(false);
    window.dispatchEvent(new Event("panahon:spotlight-read"));
  };

  return (
    <Popover.Root open={open && unread} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="flex max-w-full items-center gap-1">
          {children}
          {unread && <Popover.Trigger aria-label={`Ver novedad: ${title}`} className="flex min-h-11 shrink-0 items-center rounded-lg px-1.5 text-[10px] font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span className="flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-1"><span aria-hidden="true" className="size-1.5 rounded-full bg-orange-600" /> Nuevo</span></Popover.Trigger>}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content side="bottom" align="end" sideOffset={6} collisionPadding={16} aria-labelledby={titleId} aria-describedby={descriptionId} className="z-[90] w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in motion-reduce:animate-none">
          <h2 id={titleId} className="text-sm font-semibold leading-snug">{title}</h2>
          <p id={descriptionId} className="mt-1.5 text-xs leading-relaxed text-slate-600">{description}</p>
          <div className="mt-2 flex justify-end"><button type="button" onClick={acknowledge} className="min-h-11 rounded-lg px-3 text-xs font-semibold text-orange-800 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{actionLabel}</button></div>
          <Popover.Arrow className="fill-white" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
