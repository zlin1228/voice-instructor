export const azure_to_oculus : Record<number, string> = {
    0: "STOP",
    1: "E",
    2: "Aa",
    3: "O",
    4: "U",
    5: "E",
    6: "I",
    7: "U",
    8: "O",
    9: "Aa",
    10: "O",
    11: "Aa",
    12: "Kk",
    13: "RR",
    14: "Nn",
    15: "SS",
    16: "CH",
    17: "TH",
    18: "FF",
    19: "TH",
    20: "Kk",
    21: "PP",
}

export const phoeme_to_viseme = {
    // Consonants
    "b": "PP", "d": "DD", "d\u0361\u0292": "CH", "\xF0": "TH", "f": "FF", "\u0261": "Kk",
    "h": "Kk", "j": "I", "k": "Kk", "": "Nn", "m": "PP", "n": "Nn",
    "\u014B": "Kk", "p": "PP", "\u0279": "RR", "s": "SS", "\u0283": "CH", "t": "DD",
    "t\u0361\u0283": "CH", "\u03B8": "TH", "v": "FF", "w": "U", "z": "SS", "\u0292": "CH",
    // Vowels
    "\u0259": "E", "\u025A": "E", "\xE6": "Aa", "a\u026A": "Aa", "a\u028A": "Aa", "\u0251": "Aa",
    "e\u026A": "E", "\u025D": "E", "\u025B": "E", "i": "I", "\u026A": "I", "o\u028A": "O",
    "\u0254": "O", "\u0254\u026A": "O", "u": "U", "\u028A": "U", "\u028C": "E",
    // Additional Symbols
    "\u02C8": "STOP", "\u02CC": "STOP", ".": "STOP",
}