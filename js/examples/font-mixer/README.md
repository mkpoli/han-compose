# Font mixer

The pad blends the five Han Compose faces. Its centre gives them equal shares. Select a vertex for one face, or use the sliders to set an arbitrary ratio. Stroke weight runs from 65% to 150%.

Build from the package’s `js/` directory after installing the workspace dependencies.

```sh
bun run data
bun examples/font-mixer/build.mjs
```

Serve `dist/font-mixer/` over HTTP. The browser reads the five exports listed in `exports.json`. Each entry can point to a separate self-hosted export.

The build includes the pinned ids-input design styles. The 18 examples include left–right, stacked, enclosed and nested compositions. Drag the pad or a range to see the outline update as you move. Each face slider sets its percentage and redistributes the remainder proportionally.

Press **Play** to record a tour of the faces. It follows the pad's edges from each face to its neighbour, crosses the pad between the faces that are not neighbours, then wanders through the interior and returns to Sans, where the loop starts again. The pad shows the route of the current part. **Neighbours**, **Distant** and **Free** start at, or jump to, that part.

The seconds setting is the travel time between two faces; the interior takes five times as long. Playback begins once the remaining frames can be prepared ahead of the playhead, and **Preparing…** stays until every frame is stored. **Pause** holds the current frame and **Resume** continues from it. Editing the IDS, a face share, the stroke weight or the travel time stops playback. Cancelling preparation keeps the previous manual mix.
