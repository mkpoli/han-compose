# Font mixer

The pad blends the five Han Compose faces. Its centre gives them equal shares. Select a vertex for one face, or use the sliders to set an arbitrary ratio. Stroke weight runs from 65% to 150%.

Build from the package’s `js/` directory after installing the workspace dependencies.

```sh
bun run data
bun examples/font-mixer/build.mjs
```

Serve `dist/font-mixer/` over HTTP. The browser reads the five exports listed in `exports.json`. Each entry can point to a separate self-hosted export.

The build includes the pinned ids-input design styles. The six examples cover horizontal, vertical, enclosed, three-part and nested compositions. Drag the pad or a range to see the outline update as you move. Each face slider sets its percentage and redistributes the remainder proportionally.
