import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "title",
            "heading",
            "body",
            "table",
            "caption",
            "overline",
            "micro",
            "tiny",
            "eyebrow",
            "h2",
            "h3",
          ],
        },
      ],
    },
  },
});

/**
 * Merges class names using `clsx` and resolves Tailwind utility conflicts
 * while keeping custom semantic font-size tokens distinct from text colors.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
