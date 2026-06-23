import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  imageClassName?: string;
  href?: string;
  size?: "xs" | "sm" | "md" | "lg";
};

const sizes = {
  xs: { width: 96, height: 40, container: "px-2 py-1" },
  sm: { width: 120, height: 48, container: "px-3 py-3" },
  md: { width: 160, height: 64, container: "px-4 py-4" },
  lg: { width: 200, height: 80, container: "px-5 py-5" },
};

export function Logo({
  className,
  imageClassName,
  href = "/",
  size = "md",
}: LogoProps) {
  const { width, height, container } = sizes[size];

  const content = (
    <div
      className={cn(
        "flex items-center justify-center",
        container,
        className
      )}
    >
      <Image
        src="/logo.png"
        alt="GO MOTORS"
        width={width}
        height={height}
        priority
        unoptimized
        className={cn(
          "h-auto w-auto max-w-full bg-transparent object-contain",
          imageClassName
        )}
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
