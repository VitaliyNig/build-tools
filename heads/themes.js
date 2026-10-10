// Ready-made selections of the street things BuildTheEarth builders reach for.
// A head belongs to a selection when its name has all the words of one of the
// `terms` (a word of five letters or more also matches longer words that start
// with it, "mailbox" → "mailboxes"), its category is one of `categories` (any,
// if not given), and its name contains none of the `exclude` phrases. A term
// that starts with "=" takes only heads named exactly so, colour or variant in
// brackets aside: "=duck" is "Duck (white)", not "Naruto Duck". Heads are
// listed in the order of the terms that find them.

const STREET = ["decoration", "blocks", "miscellaneous"];

export const THEMES = [
  {
    id: "signs",
    name: ["Road signs", "Дорожные знаки"],
    terms: ["stop sign", "yield sign", "traffic sign", "road sign", "street sign", "bus stop", "tram stop", "crossroad sign",
      "parking", "mph sign", "speed limit", "one way", "no entry", "pedestrian crossing", "warning sign", "sign"],
    categories: STREET,
    exclude: ["dollar", "plus sign", "minus sign", "equals", "percent", "head sign"],
  },
  {
    id: "lights",
    name: ["Traffic lights", "Светофоры"],
    terms: ["traffic light", "traffic lamp", "traffic signal", "tram signal", "railroad signal", "tram light", "signal", "push button"],
    categories: STREET,
  },
  {
    id: "road",
    name: ["Road and pavement", "Дорога и тротуар"],
    terms: ["traffic cone", "barrier", "barricade", "bollard", "hydrant", "manhole", "drain", "parking meter", "crosswalk",
      "road", "railway crossing", "train crossing"],
    categories: STREET,
    exclude: ["barrier block", "sign"],
  },
  {
    id: "lamps",
    name: ["Street lamps", "Фонари"],
    terms: ["street lamp", "streetlight", "street light", "lamp post", "lamppost", "street lantern", "=lantern", "old lantern",
      "lantern with candle", "lantern on holder", "copper lantern", "stone lantern", "paper lantern", "chinese lantern",
      "japanese lantern", "warning lamp", "wall lamp", "industrial lamp", "modern lamp", "ceiling lamp", "=lamp"],
    categories: STREET,
  },
  {
    id: "bins",
    name: ["Bins", "Мусорки"],
    terms: ["trash can", "trashcan", "trash bin", "garbage can", "recycling bin", "dumpster", "garbage", "compost bin", "bin"],
    categories: STREET,
    exclude: ["bot", "animatronic", "raccoon"],
  },
  {
    id: "mail",
    name: ["Post", "Почта"],
    terms: ["mailbox", "mail box", "postbox", "letterbox", "mail package", "parcel", "newspaper", "envelope"],
    categories: STREET,
    exclude: ["boy in"],
  },
  {
    id: "boxes",
    name: ["Boxes and crates", "Ящики и коробки"],
    terms: ["cardboard box", "cardboard shipment", "=crate", "wooden crate", "oak crate", "spruce crate", "birch crate",
      "jungle crate", "acacia crate", "cherry crate", "mangrove crate", "bamboo crate", "iron crate", "metal crate",
      "cargo crate", "military crate", "locked crate", "=package", "mail package", "amazon box", "amazon package", "=box", "wooden box",
      "metal box", "empty box", "straw box", "=barrel", "barrel", "=sack", "sack", "pallet"],
    categories: STREET,
    exclude: ["door crate", "crate pick", "crate shovel", "crate hatchet", "mysterious", "pandora", "crayon", "ammo", "tnt", "hider"],
  },
  {
    id: "facade",
    name: ["On the walls", "На фасадах"],
    terms: ["air conditioner", "=ac", "gray ac", "security camera", "satellite dish", "antenna", "=vent", "fuse box",
      "electric meter", "gas meter", "intercom", "doorbell", "fire alarm", "=speaker", "hanging speaker", "=pipe", "copper pipe",
      "rusty pipe", "iron pipe", "gray pipe", "exhaust pipe", "elbow pipe", "tee pipe", "cross pipe", "=clock", "old clock",
      "wall clock", "modern clock", "wooden clock"],
    categories: STREET,
  },
  {
    id: "street",
    name: ["Street furniture", "Уличные мелочи"],
    terms: ["vending", "atm", "payphone", "phone booth", "ticket machine", "ticket office", "kiosk", "bench", "fountain",
      "bubbler", "bike rack", "bicycle parking", "bicycle garage", "flag pole", "flagpole"],
    categories: STREET,
    exclude: ["atm screen"],
  },
  {
    id: "plants",
    name: ["Potted plants", "Растения в горшках"],
    terms: ["potted", "flowerpot", "flower pot", "planter", "flower box", "bush", "hedge"],
    categories: ["decoration", "plants", "blocks"],
    exclude: ["pot of gold", "honey pot", "tea pot"],
  },
  {
    id: "transport",
    name: ["Vehicles", "Транспорт"],
    terms: ["police car", "sheriff car", "fire truck", "=car", "old car", "=bus", "old bus", "vw bus", "=truck", "truck with",
      "=van", "surf van", "surfer van", "=taxi", "=tram", "old train", "ice train", "underground train", "train engine",
      "train carriage", "=bicycle", "=bike", "=scooter", "=motorcycle", "=boat"],
    categories: STREET,
    exclude: ["car engine", "sign"],
  },
  {
    id: "birds",
    name: ["Birds", "Птицы"],
    terms: ["=pigeon", "white pigeon", "wood pigeon", "collared dove", "=dove", "=crow", "=seagull", "seagull on", "=sparrow",
      "=raven", "magpie", "jackdaw", "=duck", "mallard", "ruddy duck", "=swan", "=goose", "=owl", "=parrot", "bird house",
      "bird feeder", "birdcage", "bird cage", "bird nest", "=bird", "bird on"],
    categories: ["animals", "decoration"],
    exclude: ["class"],
  },
  {
    id: "flags",
    name: ["Flags", "Флаги"],
    terms: [],
    categories: ["flags"],
  },
];
