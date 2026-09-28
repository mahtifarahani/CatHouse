import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-sm px-3 py-1 text-base leading-5 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
});
