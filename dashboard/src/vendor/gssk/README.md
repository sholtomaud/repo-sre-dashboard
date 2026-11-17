# GSSK (vendored)

`gssk.js`, `gssk.wasm` and `gssk.d.ts` are the WebAssembly build of
[GSSK-Giannantoni](https://github.com/energese-project/GSSK-Giannantoni)
v6.0.2, copied unchanged from its `dist` branch (tag `dist-v6.0.2`). MIT
licensed; see `LICENSE`.

The dashboard uses it to integrate the forecast model of the two issue
queues (see `src/lib/gssk-simulator.ts`). To update, copy the three files
from a newer `dist-v*` tag.
