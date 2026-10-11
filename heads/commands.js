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
    case "1.20.5": return `/give @p player_head[profile={properties:[{name:"textures",value:"${value}"}]}]`;
    case "1.16": return `/give @p player_head{SkullOwner:{Id:[I;${ints.join(",")}],Properties:{textures:[{Value:"${value}"}]}}}`;
    case "1.13": return `/give @p player_head{SkullOwner:{Id:"${dashed(hex)}",Properties:{textures:[{Value:"${value}"}]}}}`;
    case "1.12": return `/give @p skull 1 3 {SkullOwner:{Id:"${dashed(hex)}",Properties:{textures:[{Value:"${value}"}]}}}`;
    default: throw new Error(`unknown format ${format}`);
  }
}

/** Longest line the chat box takes; longer commands only work from a command block. */
export const CHAT_LIMIT = 256;

/** Slots in a shulker box; a longer text takes several boxes. */
export const BOX_SLOTS = 27;

/** One head as an item inside a container, in a format from FORMATS other than "hdb". */
function headItem(head, slot, format) {
  const value = textureValue(head.texture);
  const { hex, ints } = uuid(head.texture);
  switch (format) {
    case "1.20.5":
      return `{slot:${slot},item:{id:"minecraft:player_head",count:1,components:{"minecraft:profile":{properties:[{name:"textures",value:"${value}"}]}}}}`;
    case "1.16":
      return `{Slot:${slot}b,id:"minecraft:player_head",Count:1b,tag:{SkullOwner:{Id:[I;${ints.join(",")}],Properties:{textures:[{Value:"${value}"}]}}}}`;
    case "1.13":
      return `{Slot:${slot}b,id:"minecraft:player_head",Count:1b,tag:{SkullOwner:{Id:"${dashed(hex)}",Properties:{textures:[{Value:"${value}"}]}}}}`;
    case "1.12":
      return `{Slot:${slot}b,id:"minecraft:skull",Damage:3s,Count:1b,tag:{SkullOwner:{Id:"${dashed(hex)}",Properties:{textures:[{Value:"${value}"}]}}}}`;
    default: throw new Error(`unknown format ${format}`);
  }
}

/**
 * A command that gives a shulker box holding these heads, each in its slot:
 * slots is [[slot number, head]]. Vanilla /give only, since the box carries
 * the textures; "hdb" falls back to the newest format.
 */
export function boxCommand(slots, format) {
  const version = format === "hdb" ? "1.20.5" : format;
  const items = slots.map(([slot, head]) => headItem(head, slot, version)).join(",");
  switch (version) {
    case "1.20.5": return `/give @p shulker_box[container=[${items}]]`;
    case "1.16": case "1.13": return `/give @p shulker_box{BlockEntityTag:{Items:[${items}]}}`;
    case "1.12": return `/give @p purple_shulker_box 1 0 {BlockEntityTag:{Items:[${items}]}}`;
    default: throw new Error(`unknown format ${version}`);
  }
}

/**
 * HeadDB commands for a set of heads, one per head: [[head, count]]. The
 * plugin takes an amount only after a player name ("/hdb give <id> <player>
 * <amount>"), so without one a head that is needed twice gets two lines.
 */
export function hdbCommands(counts, player = "") {
  const name = player.trim();
  return counts.flatMap(([head, count]) => (name
    ? [`/hdb give ${head.id} ${name} ${count}`]
    : Array.from({ length: count }, () => `/hdb give ${head.id}`)));
}
