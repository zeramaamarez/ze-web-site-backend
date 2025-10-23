import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import slugify from 'slugify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(value: string): string {
  const slug = slugify(value, {
    lower: true,
    strict: true,
    locale: 'pt'
  });

  return slug.length ? slug : Math.random().toString(36).slice(2, 8);
}

export function isObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}
