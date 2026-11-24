import { forwardRef, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { shopNavigationPath } from "@/lib/shop-navigation";

interface AppLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}

/**
 * Same click behaviour as a router <Link>, but rendered without an href
 * attribute. The browser therefore never shows the small URL bar in the
 * corner when the element is hovered — including in fullscreen.
 */
const AppLink = forwardRef<HTMLDivElement, AppLinkProps>(
  ({ to, className, children, ariaLabel }, ref) => {
    const navigate = useNavigate();

    const open = () => {
      const path = shopNavigationPath(to, window.location.origin);
      if (path !== null) navigate(path);
      else window.open(to, "_blank", "noopener,noreferrer");
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    };

    return (
      <div
        ref={ref}
        role="link"
        tabIndex={0}
        aria-label={ariaLabel}
        className={cn("cursor-pointer", className)}
        onClick={open}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    );
  },
);

AppLink.displayName = "AppLink";

export { AppLink };
