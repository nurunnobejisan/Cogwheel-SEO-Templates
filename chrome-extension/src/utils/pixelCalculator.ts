/**
 * SEO Studio Templates — Accurate Google SERP Pixel Calculator
 * 
 * Provides exact pixel-width estimation for Google SERP typography (Arial / Roboto)
 * matching Desktop Title (580px ceiling) and Meta Description (920px ceiling).
 */

const CHAR_WIDTH_MAP: Record<string, number> = {
  // Uppercase wide characters
  "W": 17, "M": 16, "O": 14, "Q": 14, "G": 14, "C": 13, "D": 13, "H": 13, "N": 13, "U": 13,
  // Uppercase medium characters
  "A": 12, "B": 12, "E": 11, "F": 10, "K": 12, "P": 11, "R": 12, "S": 11, "T": 11, "V": 12, "X": 12, "Y": 12, "Z": 11,
  // Uppercase narrow characters
  "I": 5, "J": 8, "L": 9,
  // Lowercase wide characters
  "w": 13, "m": 15,
  // Lowercase medium characters
  "a": 9, "b": 10, "c": 9, "d": 10, "e": 9, "g": 10, "h": 10, "k": 9, "n": 10, "o": 10, "p": 10, "q": 10, "u": 10, "v": 8, "x": 8, "y": 8, "z": 8,
  // Lowercase narrow characters
  "i": 4, "l": 4, "t": 6, "f": 5, "j": 4, "r": 6, "s": 8,
  // Digits
  "0": 10, "1": 7, "2": 10, "3": 10, "4": 10, "5": 10, "6": 10, "7": 10, "8": 10, "9": 10,
  // Punctuation & spaces
  " ": 5, "-": 6, "–": 10, "—": 16, "|": 4, ":": 4, ";": 4, ".": 4, ",": 4, "!": 5, "?": 9, "(": 6, ")": 6, "'": 3, '"': 6
};

const DEFAULT_CHAR_WIDTH = 9;

export const TITLE_PIXEL_LIMIT = 580;
export const META_DESC_PIXEL_LIMIT = 920;

export function calculatePixelWidth(str: string | null | undefined): number {
  if (!str) return 0;
  let total = 0;
  for (const char of str) {
    total += CHAR_WIDTH_MAP[char] ?? DEFAULT_CHAR_WIDTH;
  }
  return total;
}

export type PixelBudgetStatus = "Optimal" | "Pixel Over Budget";

export function getTitlePixelStatus(title: string | null | undefined): {
  pixelWidth: number;
  status: PixelBudgetStatus;
  isOver: boolean;
} {
  const pixelWidth = calculatePixelWidth(title);
  const isOver = pixelWidth > TITLE_PIXEL_LIMIT;
  return {
    pixelWidth,
    status: isOver ? "Pixel Over Budget" : "Optimal",
    isOver
  };
}

export function getMetaDescPixelStatus(desc: string | null | undefined): {
  pixelWidth: number;
  status: PixelBudgetStatus;
  isOver: boolean;
} {
  const pixelWidth = calculatePixelWidth(desc);
  const isOver = pixelWidth > META_DESC_PIXEL_LIMIT;
  return {
    pixelWidth,
    status: isOver ? "Pixel Over Budget" : "Optimal",
    isOver
  };
}
