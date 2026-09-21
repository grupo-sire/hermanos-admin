export interface ThemePalette {
  name: string;
  primary: string;
  label: string;
  preview: string;
}

export const THEME_PALETTES: ThemePalette[] = [
  { name: "Vermelho Hermanos", primary: "0 100% 55%", label: "Vermelho Hermanos", preview: "#ff1a1a" },
  { name: "Dourado", primary: "38 92% 45%", label: "Dourado", preview: "#D4920A" },
  { name: "Vinho", primary: "350 65% 33%", label: "Vinho", preview: "#8B1A3A" },
  { name: "Azul", primary: "217 91% 45%", label: "Azul", preview: "#0A5EC4" },
  { name: "Verde", primary: "145 63% 35%", label: "Verde", preview: "#21844D" },
  { name: "Roxo", primary: "270 60% 45%", label: "Roxo", preview: "#6B2EB8" },
  { name: "Laranja", primary: "24 95% 50%", label: "Laranja", preview: "#F26A0F" },
  { name: "Rosa", primary: "330 65% 50%", label: "Rosa", preview: "#D43B8C" },
  { name: "Cinza", primary: "220 15% 40%", label: "Cinza Moderno", preview: "#576175" },
];

export function applyThemeColors(primary: string) {
  if (!primary) return;
  const root = document.documentElement;
  const parts = primary.split(" ");
  
  if (parts.length < 3) {
    // If not HSL, just set as is
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--accent", primary);
    root.style.setProperty("--ring", primary);
    return;
  }

  const h = parts[0];
  const s = parts[1];
  const lVal = parseInt(parts[2]);
  const darkL = Math.max((lVal || 0) - 13, 10);
  const dark = `${h} ${s} ${darkL}%`;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--accent", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-ring", primary);
  root.style.setProperty("--wine", primary);
  root.style.setProperty("--wine-dark", dark);
}

export function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  const hDeg = Math.round(h * 360);
  const sClamped = Math.max(50, Math.min(80, Math.round(s * 100)));
  const lClamped = Math.max(30, Math.min(45, Math.round(l * 100)));

  return `${hDeg} ${sClamped}% ${lClamped}%`;
}

export function hslToHex(hsl: string): string {
  const parts = hsl.split(" ");
  const hVal = parseInt(parts[0]) / 360;
  const sVal = parseInt(parts[1]) / 100;
  const lVal = parseInt(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (sVal === 0) {
    r = g = b = lVal;
  } else {
    const q = lVal < 0.5 ? lVal * (1 + sVal) : lVal + sVal - lVal * sVal;
    const p = 2 * lVal - q;
    r = hue2rgb(p, q, hVal + 1 / 3);
    g = hue2rgb(p, q, hVal);
    b = hue2rgb(p, q, hVal - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
