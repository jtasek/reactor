# DTCG interchange: first increment

Reactor provides a subset adapter for the published [DTCG Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/)
and [Color Module 2025.10](https://www.designtokens.org/tr/2025.10/color/).
This increment does not claim full format or Resolver conformance.

## Supported

- `color`: opaque `srgb` objects with three numeric components in [0, 1]. Missing alpha means
  1. Import rounds each channel to Reactor's 8-bit hex representation. The optional hex
  fallback is validated but components determine the color. Export emits components, alpha and hex.
- `number`: finite, unitless values, including zero and negative/fractional values.
- Named groups, inherited `$type`, `$root` tokens, and same-type aliases. Alias types may be
  inferred from their source. Aliases remain references; they are never flattened to literals.
- Curly aliases such as `{brand.ink}` and local whole-token JSON Pointers such as
  `#/brand/ink/$value`, including URI percent encoding and JSON Pointer `~0` / `~1` escapes where names are representable.
- An optional `$schema` equal to the published 2025.10 format schema.

Reactor variable names use `/` as the group separator. DTCG names containing literal `/`, `$`,
`.` or braces, empty/trimmed path segments and unnamed top-level root tokens are rejected
when they cannot be represented unambiguously. A variable whose name is also a group exports
as that group's `$root` token. Limits: 1 MiB, 1,000 tokens, 32 path segments (including the token or `$root` name), on import and export; native resolver
limits also apply to alias chains.

## Explicit rejection

The adapter rejects the entire import/export when it encounters unsupported definitions.
The message identifies the location and construct. Nothing is imported and no partial file
is downloaded. Native Reactor packages remain available for all native definitions.

Unsupported in this increment: native text/boolean variables, dimensions and modes; DTCG
units and composite types; transparency, other color spaces and `none` components; property-level
and remote references; `$extends`; descriptions, deprecation and unknown metadata/extensions.
No units are stripped or interpreted as plain numbers, no mode is picked implicitly, and no
unsupported variables are silently omitted. These capabilities require later consumers and tests.

## Identity and updates

The optional `$extensions["io.github.jtasek.reactor"]` root object carries `{version: 1, id, name}`.
Each exported token carries `{id, source: {packageId, tokenId}}` under the same key. An alias
also carries its native literal `fallback`, which preserves the definition without changing
its DTCG reference. Extension values are untrusted and validated through native package readers. Incomplete or null
identity metadata is rejected; filename/path identity is assigned only when the extension is absent.

Tools that preserve this extension preserve rename-safe identity. Files without it use
`dtcg:<filename>` as package identity and their Reactor group path as token identity. A rename
of an external file or token cannot imply an update; import conflict choices stay explicit.
Re-exporting an imported file adds the extension. The adapter changes no durable document
schema and shares the native package import preview, conflict choices, validation and shared undo.
