import type { Item } from "../gameData";

export interface ItemMechanics {
  haste: number;
  lethality: number;
  armorPen: number;
  magicPen: number;
  flatMagicPen: number;
  critDamage: number;
  apMultiplier: number;
  tenacity: number;
  healPower: number;
  onHit: boolean;
  lifeline: boolean;
  stasis: boolean;
  spellShield: boolean;
}

// Las cantidades omitidas en Data Dragon quedan desconocidas; nunca se completan de memoria.
export function itemMechanics(item: Item): ItemMechanics {
  const text = item.description;
  const header =
    /^(?:\s*\d+(?:[.,]\d+)?%?\s+(?:de\s+)?(?:Daño de Golpe Crítico|Probabilidad de Golpe Crítico|Daño de Ataque|Poder de Habilidad|Velocidad de Ataque|Resistencia Mágica|Armadura|Vida|Maná|Aceleración de Habilidad|Velocidad de Movimiento|Letalidad|Penetración de Armadura|Penetración de Magia|Tenacidad|Robo de Vida|Omnivampirismo|poder de curaciones y escudos|Regen\. de Maná Básica|Regen\. de Vida Básica)\s*)+/iu.exec(
      text,
    )?.[0] ?? "";
  const number = (pattern: RegExp, max = 100, source = header) => {
    const value = Number(pattern.exec(source)?.[1]?.replace(",", ".") ?? 0);
    return Number.isFinite(value) && value >= 0 && value <= max ? value : 0;
  };
  return {
    haste: number(/(\d+(?:[.,]\d+)?) de Aceleración de Habilidad/iu),
    lethality: number(/(\d+(?:[.,]\d+)?) de Letalidad/iu),
    armorPen:
      number(/(\d+(?:[.,]\d+)?)% (?:de )?Penetración de Armadura/iu) / 100,
    magicPen: number(/(\d+(?:[.,]\d+)?)% (?:de )?Penetración de Magia/iu) / 100,
    flatMagicPen: number(
      /(?<![\d%])\b(\d+(?:[.,]\d+)?) de Penetración de Magia/iu,
    ),
    critDamage: number(/(\d+(?:[.,]\d+)?)% de Daño de Golpe Crítico/iu) / 100,
    apMultiplier:
      number(
        /Aumenta tu Poder de Habilidad total en un (\d+(?:[.,]\d+)?)%/iu,
        100,
        text,
      ) / 100,
    tenacity: number(/(\d+(?:[.,]\d+)?)% de Tenacidad/iu) / 100,
    healPower:
      number(/(\d+(?:[.,]\d+)?)% (?:de )?poder de curaciones y escudos/iu) /
      100,
    onHit:
      /(?:ataques|ataque).{0,100}(?:al impacto|daño mágico adicional)/iu.test(
        text,
      ),
    lifeline: /Salvavidas/iu.test(text),
    stasis: /estasis/iu.test(text),
    spellShield: /escudo antihechizos/iu.test(text),
  };
}

export function combineMechanics(values: ItemMechanics[]) {
  const sum = (key: "haste" | "lethality" | "flatMagicPen" | "healPower") =>
    values.reduce((s, m) => s + m[key], 0);
  const maximum = (
    key: "armorPen" | "magicPen" | "critDamage" | "apMultiplier" | "tenacity",
  ) => Math.max(0, ...values.map((m) => m[key]));
  return {
    haste: sum("haste"),
    lethality: sum("lethality"),
    flatMagicPen: sum("flatMagicPen"),
    healPower: sum("healPower"),
    armorPen: maximum("armorPen"),
    magicPen: maximum("magicPen"),
    critDamage: maximum("critDamage"),
    apMultiplier: maximum("apMultiplier"),
    // Conservador: premiar la mayor fuente, no sumar porcentajes sin una regla de acumulación verificada.
    tenacity: maximum("tenacity"),
    onHit: values.filter((v) => v.onHit).length,
    lifeline: values.some((v) => v.lifeline),
    stasis: values.some((v) => v.stasis),
    spellShield: values.some((v) => v.spellShield),
  };
}
