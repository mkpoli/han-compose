# Font mixer

The pad blends the five Han Compose faces. Its centre gives them equal shares. Select a vertex for one face, or use the sliders to set an arbitrary ratio. Stroke weight runs from 65% to 150%.

Build from the package’s `js/` directory after installing the workspace dependencies.

```sh
bun run data
mkdir -p dist/font-mixer/src
cp examples/font-mixer/{index.html,exports.json} dist/font-mixer/
cp -r data dist/font-mixer/
bun build examples/font-mixer/app.js --outfile dist/font-mixer/src/app.js
bun build src/worker.js --outfile dist/font-mixer/src/worker.js
```

Serve `dist/font-mixer/` over HTTP. The browser reads the five exports listed in `exports.json`. Each entry can point to a separate self-hosted export.
