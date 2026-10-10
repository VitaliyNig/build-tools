// Pre-flattening (Minecraft 1.8 - 1.12) block ids.
//
// Before 1.13 a blockstate file is named after a model variant ("acacia_planks",
// "silver_wool"), not after a registered block: the real block is a numeric id
// plus a 4-bit data value ("planks" 5:4, "wool" 35:8). Sponge .schem files cannot
// describe those worlds, so palettes from such versions are exported as MCEdit
// .schematic files using this table: variant name -> [block id, data].

/** First data version of the flattened (1.13) block format, snapshot 17w47a. */
const FLATTENING_DATA_VERSION = 1451;

export function isLegacy(dataVersion) {
  return dataVersion < FLATTENING_DATA_VERSION;
}

// Dye order shared by wool, stained clay, concrete and glazed terracotta.
const COLOURS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "silver", "cyan", "purple", "blue", "brown", "green", "red", "black"];
const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];

// Data values below pick the state the palette's texture was taken from:
// facing north = 2 for directional blocks, bark on all sides (12+) for logs,
// seamless (8+) for the "all" double-slab variants, upright (0) for pillars.
const TABLE = {
  stone: [1, 0], granite: [1, 1], smooth_granite: [1, 2], diorite: [1, 3],
  smooth_diorite: [1, 4], andesite: [1, 5], smooth_andesite: [1, 6],
  grass: [2, 0], dirt: [3, 0], coarse_dirt: [3, 1], podzol: [3, 2],
  cobblestone: [4, 0], bedrock: [7, 0], sand: [12, 0], red_sand: [12, 1], gravel: [13, 0],
  gold_ore: [14, 0], iron_ore: [15, 0], coal_ore: [16, 0],
  sponge: [19, 0], lapis_ore: [21, 0], lapis_block: [22, 0], dispenser: [23, 2],
  sandstone: [24, 0], chiseled_sandstone: [24, 1], smooth_sandstone: [24, 2],
  noteblock: [25, 0], sticky_piston: [29, 2], piston: [33, 2],
  gold_block: [41, 0], iron_block: [42, 0],
  stone_double_slab: [43, 8], sandstone_double_slab: [43, 9], wood_old_double_slab: [43, 10],
  cobblestone_double_slab: [43, 11], brick_double_slab: [43, 12], stone_brick_double_slab: [43, 13],
  nether_brick_double_slab: [43, 14], quartz_double_slab: [43, 15],
  brick_block: [45, 0], tnt: [46, 0], bookshelf: [47, 0], mossy_cobblestone: [48, 0],
  obsidian: [49, 0], diamond_ore: [56, 0], diamond_block: [57, 0], crafting_table: [58, 0],
  furnace: [61, 2], lit_furnace: [62, 2], redstone_ore: [73, 0], lit_redstone_ore: [74, 0],
  snow_layer: [78, 7], snow: [80, 0], clay: [82, 0], jukebox: [84, 0], pumpkin: [86, 2],
  netherrack: [87, 0], soul_sand: [88, 0], glowstone: [89, 0], lit_pumpkin: [91, 2],
  stone_monster_egg: [97, 0], cobblestone_monster_egg: [97, 1], stone_brick_monster_egg: [97, 2],
  mossy_brick_monster_egg: [97, 3], cracked_brick_monster_egg: [97, 4],
  chiseled_brick_monster_egg: [97, 5],
  stonebrick: [98, 0], mossy_stonebrick: [98, 1], cracked_stonebrick: [98, 2],
  chiseled_stonebrick: [98, 3],
  brown_mushroom_block: [99, 0], red_mushroom_block: [100, 0], melon_block: [103, 0],
  mycelium: [110, 0], nether_brick: [112, 0], end_stone: [121, 0],
  redstone_lamp: [123, 0], lit_redstone_lamp: [124, 0], emerald_ore: [129, 0],
  emerald_block: [133, 0], command_block: [137, 2], redstone_block: [152, 0], quartz_ore: [153, 0],
  quartz_block: [155, 0], chiseled_quartz_block: [155, 1], quartz_column: [155, 2],
  dropper: [158, 2], prismarine: [168, 0], prismarine_bricks: [168, 1], dark_prismarine: [168, 2],
  sea_lantern: [169, 0], hay_block: [170, 0], hardened_clay: [172, 0], coal_block: [173, 0],
  packed_ice: [174, 0],
  red_sandstone: [179, 0], chiseled_red_sandstone: [179, 1], smooth_red_sandstone: [179, 2],
  red_sandstone_double_slab: [181, 8],
  purpur_block: [201, 0], purpur_pillar: [202, 0], purpur_double_slab: [204, 0],
  end_bricks: [206, 0], repeating_command_block: [210, 2], chain_command_block: [211, 2],
  magma: [213, 0], nether_wart_block: [214, 0], red_nether_brick: [215, 0], bone_block: [216, 0],
  observer: [218, 2],
  structure_block: [255, 2],
};
COLOURS.forEach((colour, i) => {
  TABLE[`${colour}_wool`] = [35, i];
  TABLE[`${colour}_stained_hardened_clay`] = [159, i];
  TABLE[`${colour}_glazed_terracotta`] = [235 + i, 0];
  TABLE[`${colour}_concrete`] = [251, i];
  TABLE[`${colour}_concrete_powder`] = [252, i];
});
WOODS.forEach((wood, i) => {
  TABLE[`${wood}_planks`] = [5, i];
  TABLE[`${wood}_double_slab`] = [125, i];
  TABLE[`${wood}_log`] = i < 4 ? [17, 12 + i] : [162, 12 + i - 4];
});

// Data values of a block turned another way than the table has it.
const FACING = { down: 0, up: 1, north: 2, south: 3, west: 4, east: 5 };
const PUMPKIN_FACING = { south: 0, west: 1, north: 2, east: 3 };
const PUMPKINS = new Set([86, 91]), PILLARS = new Set([170, 202, 216]), QUARTZ = 155;

/**
 * [block id, data] for a palette block id such as "minecraft:oak_log[axis=none]", or null.
 * A facing or a lying axis in the id ("furnace[facing=south]", "hay_block[axis=z]") turns the block.
 */
export function legacyBlock(id) {
  const name = id.replace(/^minecraft:/, "").replace(/\[.*$/, "");
  if (!Object.hasOwn(TABLE, name)) return null;
  const [block, data] = TABLE[name];
  const facing = (/facing=(\w+)/.exec(id) || [])[1], axis = (/axis=([xz])/.exec(id) || [])[1];
  if (facing && data === 2) {
    const turned = (PUMPKINS.has(block) ? PUMPKIN_FACING : FACING)[facing];
    if (turned !== undefined) return [block, turned];
  }
  // Pillars: 0 upright, 4 along x, 8 along z; the quartz column has values of its own.
  if (axis && PILLARS.has(block)) return [block, axis === "x" ? 4 : 8];
  if (axis && block === QUARTZ && data === 2) return [block, axis === "x" ? 3 : 4];
  return [block, data];
}
