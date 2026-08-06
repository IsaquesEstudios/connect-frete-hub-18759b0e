import { cn } from "@/lib/utils";
import logoAsset from "@/assets/sv-logo.png.asset.json";

export function Logo({
  className,
  iconClassName,
  textClassName,
}: {
  className?: string;
  iconClassName?: string;
  /** @deprecated the logo is an image wordmark; kept for API compatibility */
  textClassName?: string;
}) {
  void textClassName;
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src={logoAsset.url}
        alt="SV Logística"
        className={cn("h-8 w-auto object-contain", iconClassName)}
        loading="lazy"
      />
    </span>
  );
}
