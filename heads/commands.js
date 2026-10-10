// Commands that give a head in the game. The HeadDB plugin gives a head by its
// catalogue id; vanilla /give needs the texture itself, written the way each
// game version reads item data.

export const FORMATS = ["hdb", "1.20.5", "1.16", "1.13", "1.12"];

const TEXTURE_URL = "http://textures.minecraft.net/texture/";

/** The "textures" property of a profile: base64 of the JSON that points at the skin. */
export const textureValue = (hash) => btoa(JSON.stringify({ textures: { SKIN: { url: TEXTURE_URL + hash } } }));

/**
 * A UUID made from the texture hash. Any id works; one tied to the texture
 * means that two copies of the same head stack in the inventory.
 */
function uuid(hash) {
  const hex = hash.padStart(32, "0").slice(-32);
  return { hex, ints: [0, 8, 16, 24].map((i) => parseInt(hex.slice(i, i + 8), 16) | 0) };
}
const dashed = (hex) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

/** The command for one head in a format from FORMATS. */
export function command(head, format) {
  if (format === "hdb") return `/hdb give ${head.id}`;
  const value = textureValue(head.texture);
  const { hex, ints } = uuid(head.texture);
  switch (format) {
    case "1.20.5": return `/give @s player_head[profile={properties:[{name:"textures",value:"${value}"}]}]`;
    case "1.16": return `/give @s player_head{SkullOwner:{Id:[I;${ints.join(",")}],Properties:{textures:[{Value:"${value}"}]}}}`;
    case "1.13": return `/give @s player_head{SkullOwner:{Id:"${dashed(hex)}",Properties:{textures:[{Value:"${value}"}]}}}`;
    case "1.12": return `/give @s skull 1 3 {SkullOwner:{Id:"${dashed(hex)}",Properties:{textures:[{Value:"${value}"}]}}}`;
    default: throw new Error(`unknown format ${format}`);
  }
}

/** Longest line the chat box takes; longer commands only work from a command block. */
export const CHAT_LIMIT = 256;
