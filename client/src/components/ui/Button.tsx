import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'light';
export type ButtonSize = 'md' | 'lg' | 'xl';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  secondary: 'btn-ghost',
  light: 'btn-light',
};

const SIZE: Record<ButtonSize, string> = {
  md: '',
  lg: 'min-h-[56px] px-8 text-lg',
  xl: 'min-h-[64px] px-10 text-2xl sm:min-h-[72px] sm:px-12 sm:text-3xl',
};

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
) {
  return `${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim();
}

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  className = '',
  type = 'button',
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant, size, className = '', ...rest }: Common & LinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
