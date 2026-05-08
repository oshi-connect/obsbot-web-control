# Oshi Connect Brand Guide

## Overview

This guide documents the brand colors and typography for Oshi Connect. Use these tokens consistently across the website, marketing materials, and logo assets.

## Colors


| Token           | Hex       | Tailwind                                             | Role                                          |
| --------------- | --------- | ---------------------------------------------------- | --------------------------------------------- |
| oshi-pink       | `#F6598E` | `text-oshi-pink`, `bg-oshi-pink`, `border-oshi-pink` | Primary — CTAs, headings, accents             |
| oshi-magenta    | `#D91EA7` | `text-oshi-magenta`, `bg-oshi-magenta`               | Secondary — hover states                      |
| oshi-cyan       | `#27E4EB` | `text-oshi-cyan`, `bg-oshi-cyan`, `border-oshi-cyan` | Accent — highlights, icons                    |
| oshi-light-cyan | `#E6FCFF` | `bg-oshi-light-cyan`                                 | Accent light — card backgrounds, subtle fills |
| oshi-light-pink | `#FFF2FA` | `bg-oshi-light-pink`                                 | Background — page base                        |


Opacity variants: use `/20`, `/30`, `/50` suffixes (e.g. `border-oshi-pink/30`).

## Typography

### Primary brand font — Franxurter Totally

Display font used in the logo. Retro/kawaii style by Lathan Couch. Not available on Google Fonts; requires self-hosting (FontSpace, CDNFonts) if used in web copy.

### Web UI font — Fredoka

Used site-wide for headings and body. Weights: 400, 600, 700, 800. Fallback: Inter, sans-serif.

- **Tailwind**: `font-sans`
- **Headings**: Bold, uppercase, italic, normal tracking (`font-bold uppercase italic tracking-normal`)
- **Body text**: `text-gray-900` (`#111827`)

## Usage Notes

- Prefer `oshi-pink` for primary actions and key headings.
- Use `oshi-magenta` for hover states on pink elements.
- Pair `oshi-cyan` with `oshi-light-cyan` for secondary/creator-focused sections.
- Keep `oshi-light-pink` as the default page background for brand consistency.

