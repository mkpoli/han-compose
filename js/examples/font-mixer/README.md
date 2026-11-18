# Font mixer

The pad blends the five Han Compose faces. Its centre gives them equal shares. Select a vertex for one face, or use the sliders to set an arbitrary ratio. Stroke weight runs from 65% to 150%.

Build from the package’s `js/` directory after installing the workspace dependencies.

```sh
bun run data
bun examples/font-mixer/build.mjs
```

Serve `dist/font-mixer/` over HTTP. The browser reads the five exports listed in `exports.json`. Each entry can point to a separate self-hosted export.

The build includes the pinned ids-input design styles. The 18 examples include left–right, stacked, enclosed and nested compositions. Drag the pad or a range to see the outline update as you move. Each face slider sets its percentage and redistributes the remainder proportionally.

Choose two faces and press **Play loop** to record a transition. Playback starts at the first face, holds briefly at each end and returns along the same frames. The duration is the travel time in each direction. **Pause** holds the current frame and **Resume** continues from it. Editing the IDS, a face share, the stroke weight or the transition settings stops playback. Cancelling preparation keeps the previous manual mix.
