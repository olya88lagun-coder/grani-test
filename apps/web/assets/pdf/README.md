# Pair PDF fonts

Fonts are local and embedded into exported documents. Generation does not fetch a font service.

- Golos Text source: Google Fonts, `ofl/golostext/GolosText[wght].ttf`.
- `GolosText-400.ttf` and `GolosText-600.ttf` are static instances made with fontTools 4.66.1 at weights 400 and 600. Glyph coverage includes Latin, Cyrillic, Ё/ё and the ruble sign.
- Cormorant Garamond Light: the official CatharsisFonts/Cormorant repository, `fonts/ttf/CormorantGaramond-Light.ttf`.
- Original revisions, URLs and SHA-256 hashes are recorded in `sources.json`.
- Licenses: `Golos-OFL.txt` and `Cormorant-OFL.txt` (SIL Open Font License).
- Noto Emoji: Google Fonts `ofl/notoemoji`, static weight 400 via fontTools 4.66.1, with `NotoEmoji-OFL.txt`. Used as a local monochrome fallback for emoji. No remote emoji image service.
- `glyph-ranges.json` records combined cmap coverage. Unsupported rare characters are represented by reversible `[U+CODE]` text in the PDF, with a visible explanation.
- `gems/*.png` are 400px local conversions of the existing public WebP gemstones, made with sharp 0.35.4. The type-to-gem mapping is unchanged.
