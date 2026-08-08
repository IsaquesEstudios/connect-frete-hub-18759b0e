import { cn } from "@/lib/utils";

// Servido a partir de /public para funcionar em qualquer hospedagem (VPS/Coolify).
const LOGO_URL = "/sv-logo.png";

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
