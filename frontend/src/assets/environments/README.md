# Environment assets

- `relax-inn-seaview-suite.jpg` — tonemapped preview of the "Relax Inn Seaview Suite" HDRI by
  Poly Haven (polyhaven.com), licensed CC0 (public domain, no attribution required). Sourced from
  https://polyhaven.com/a/relax_inn_seaview_suite and downscaled to 2048px wide for web use. A
  plain JPG rather than the raw HDR/EXR: the avatar scene only uses this as a flat background
  image (`<Environment background="only">`), never for HDR-based lighting math, so the much
  cheaper standard texture path is both sufficient and avoids a float-texture GPU decode.
