"""Rebuild the guide networks `compose_guide` draws with.

    uv run --extra train scripts/train_guide.py samples --take 20000
    uv run --extra train scripts/train_guide.py train --seeds 3
    uv run --extra train scripts/train_guide.py export

`samples` draws every compound character the font has, with nothing taken from the character itself,
and keeps its draft, its two operands' own glyphs in the boxes the learned layout gives them, the
operator, and the real glyph. The jōyō kanji are left out: a character the guide has seen is not a
fair test of it.

`train` fits a U-Net per seed on that sample, asked for the real glyph from the draft. `export`
writes each to ONNX under `cache/compose/guide-v1/`, for `Guide.load` to run without PyTorch.

The image is a better map of where strokes go than the draft, and is never drawn: `compose_guide`
only moves the font's own strokes toward it.
"""

from __future__ import annotations

import multiprocessing as mp
from pathlib import Path

import numpy as np
import typer

from han_compose import compose as C
from han_compose import compose_guide as G
from han_compose import compose_layout, compose_standalone, kanjivg_cuts
from han_compose.vocab import cache_root

app = typer.Typer(add_completion=False)


def _composer() -> C.Composer:
    """The composer as `scripts/compose_ids.py` builds it, without a guide."""
    composer = C.Composer(C.Font(C.font_file(), C.fallback_files()), C.japanese_sequences())
    layout = cache_root() / "compose" / compose_layout.LAYOUT_FILE
    if layout.exists():
        composer.layout = compose_layout.LayoutModel.load(layout)
    composer.kvg = kanjivg_cuts.Cutter(composer)
    alone = cache_root() / "compose" / compose_standalone.STANDALONE_FILE
    if alone.exists():
        composer.standalone = compose_standalone.StandaloneModel.load(alone)
    return composer


_HOLD: C.Composer | None = None  # one composer per worker process


def _start() -> None:  # pragma: no cover - runs in each worker
    global _HOLD
    _HOLD = _composer()


def _draw(char: str) -> dict | None:  # pragma: no cover - runs in each worker
    """One character's draft, operands, operator and real glyph; None where it cannot be drawn."""
    c = _HOLD
    try:
        seq = c.sequences[char]
        tree = C.parse(seq)
    except (KeyError, ValueError):
        return None
    if not isinstance(tree, tuple) or tree[0] not in G.OPS:
        return None
    c.exclude = {char}
    try:
        placed = c.compose(seq)
    except Exception:
        return None
    glyph = c.font.glyph(char)
    if glyph is None:
        return None
    truth = C.raster([C.Placed(glyph, glyph.box, glyph.box)], G.SIZE)
    return {"draft": C.raster(placed, G.SIZE), "ops": G.operands(c, seq),
            "op": G.OPS.index(tree[0]), "truth": truth}


def samples(take: int = 20000, workers: int = 4, out: Path | None = None) -> None:
    """Draw `take` compound characters the font has into shards `cache/compose/guide-samples-part*.npz`."""
    c = _composer()
    jōyō = set(C.japanese_characters())
    chars = sorted(
        ch for ch, seq in c.sequences.items()
        if ch not in jōyō and c.font.has(ch) and len(seq) > 1 and seq[0] in G.OPS
    )[:take]
    typer.echo(f"{len(chars)} characters to draw")
    path = out or cache_root() / "compose" / "guide-samples.npz"
    path.parent.mkdir(parents=True, exist_ok=True)
    # Shards are written as they fill, so the job holds one shard in memory whatever the take.
    held: list[dict] = []
    parts = 0
    drawn = 0

    def flush() -> None:
        nonlocal held, parts
        if not held:
            return
        parts += 1
        np.savez_compressed(
            path.with_name(f"{path.stem}-part{parts:03d}.npz"),
            draft=np.packbits(np.stack([r["draft"] for r in held]), axis=-1),
            ops=np.packbits(np.stack([r["ops"] for r in held]), axis=-1),
            op=np.array([r["op"] for r in held], dtype=np.int8),
            truth=np.packbits(np.stack([r["truth"] for r in held]), axis=-1),
        )
        held = []

    with mp.get_context("fork").Pool(workers, initializer=_start, maxtasksperchild=200) as pool:
        for k, row in enumerate(pool.imap_unordered(_draw, chars, chunksize=4)):
            if row is not None:
                held.append(row)
                drawn += 1
            if len(held) >= 500:
                flush()
            if k % 1000 == 0:
                typer.echo(f"{k} of {len(chars)}, {drawn} drawn")
    flush()
    typer.echo(f"{drawn} drawn -> {path.stem}-part*.npz beside {path.name}")


def _model(width: int):
    """The U-Net the guide runs: three channels in (draft, and each operand), ink out."""
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    def block(i: int, o: int) -> nn.Sequential:
        return nn.Sequential(nn.Conv2d(i, o, 3, padding=1), nn.GroupNorm(8, o), nn.GELU(),
                             nn.Conv2d(o, o, 3, padding=1), nn.GroupNorm(8, o), nn.GELU())

    class Gen(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.op = nn.Embedding(len(G.OPS), 8)
            self.e = nn.ModuleList([block(11, width), block(width, 2 * width), block(2 * width, 4 * width),
                                    block(4 * width, 8 * width), block(8 * width, 8 * width)])
            self.u = nn.ModuleList([nn.ConvTranspose2d(8 * width, 8 * width, 2, 2),
                                    nn.ConvTranspose2d(8 * width, 4 * width, 2, 2),
                                    nn.ConvTranspose2d(4 * width, 2 * width, 2, 2),
                                    nn.ConvTranspose2d(2 * width, width, 2, 2)])
            self.d = nn.ModuleList([block(16 * width, 8 * width), block(8 * width, 4 * width),
                                    block(4 * width, 2 * width), block(2 * width, width)])
            self.out = nn.Conv2d(width, 1, 1)

        def forward(self, draft, op):
            e = self.op(op)[:, :, None, None].expand(-1, -1, draft.shape[2], draft.shape[3])
            h = torch.cat([draft, e], 1)
            skips = []
            for k, blk in enumerate(self.e):
                h = blk(h if k == 0 else F.max_pool2d(h, 2))
                skips.append(h)
            for up, blk, skip in zip(self.u, self.d, reversed(skips[:-1])):
                h = blk(torch.cat([up(h), skip], 1))
            return self.out(h)[:, 0] + 4 * (draft[:, 0] - 0.5)

    return Gen()


def train(width: int = 48, epochs: int = 30, seeds: int = 3, batch: int = 64,
          samples_file: Path | None = None, out: Path | None = None) -> None:
    """Fit `seeds` U-Nets on the `guide-samples-part*.npz` shards, each with its own seed."""
    import torch
    import torch.nn.functional as F

    base = samples_file or cache_root() / "compose" / "guide-samples.npz"
    shards = [np.load(f) for f in sorted(base.parent.glob(f"{base.stem}-part*.npz"))]
    data = {k: np.concatenate([d[k] for d in shards]) for k in ("draft", "ops", "op", "truth")}
    drafts = np.unpackbits(data["draft"], axis=-1)[..., :G.SIZE].astype(np.uint8)
    ops = np.unpackbits(data["ops"], axis=-1)[..., :G.SIZE].astype(np.uint8)
    truth = np.unpackbits(data["truth"], axis=-1)[..., :G.SIZE].astype(np.uint8)
    ops_index = data["op"].astype(np.int64)
    # What the network reads: the draft it is given, and each operand's own glyph beside it.
    x = np.stack([drafts, ops[:, 0], ops[:, 1]], 1).astype(np.float32)
    y = truth.astype(np.float32)
    keep = np.random.default_rng(0).random(len(x)) > 0.05
    train_idx, val_idx = np.nonzero(keep)[0], np.nonzero(~keep)[0]
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    folder = out or cache_root() / "compose" / "guide-weights"
    folder.mkdir(parents=True, exist_ok=True)
    typer.echo(f"train {len(train_idx)} val {len(val_idx)} on {dev}")

    def batches(idx: np.ndarray):
        for b in range(0, len(idx), batch):
            i = idx[b:b + batch]
            yield (torch.tensor(x[i]).to(dev), torch.tensor(ops_index[i]).to(dev),
                   torch.tensor(y[i]).to(dev))

    for seed in range(seeds):
        torch.manual_seed(seed)
        net = _model(width).to(dev)
        opt = torch.optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-4)
        sched = torch.optim.lr_scheduler.OneCycleLR(opt, 1e-3, total_steps=epochs * (len(train_idx) // batch + 1))
        best = -1.0
        held = torch.tensor(y[val_idx]).to(dev) > 0
        for epoch in range(epochs):
            net.train()
            for draft, op, target in batches(np.random.permutation(train_idx)):
                logits = net(draft, op)
                p = torch.sigmoid(logits)
                dice = 1 - (2 * (p * target).sum((1, 2)) + 1) / (p.sum((1, 2)) + target.sum((1, 2)) + 1)
                loss = F.binary_cross_entropy_with_logits(logits, target) + dice.mean()
                opt.zero_grad()
                loss.backward()
                opt.step()
                sched.step()
            net.eval()
            with torch.no_grad():
                made = torch.cat([net(d, o) for d, o, _ in batches(val_idx)]) > 0
            score = (made & held).sum((1, 2)).float().div(
                (made | held).sum((1, 2)).clamp(min=1).float()).mean().item()
            typer.echo(f"seed {seed} epoch {epoch + 1}: val IoU {score:.3f}")
            if score > best:
                best = score
                torch.save(net.state_dict(), folder / f"guide-{seed + 1}.pt")
        typer.echo(f"seed {seed}: best {best:.3f} -> {folder / f'guide-{seed + 1}.pt'}")


def export(width: int = 48, weights: Path | None = None, out: Path | None = None) -> None:
    """Write each trained network to ONNX as `guide-<n>.onnx`, reading `draft` and `op`, writing ink."""
    import torch

    folder = weights or cache_root() / "compose" / "guide-weights"
    target = out or cache_root() / "compose" / "guide-v1"
    target.mkdir(parents=True, exist_ok=True)
    class Ink(torch.nn.Module):
        """The network's logits as the 0-to-1 ink `Guide.ink` reads."""

        def __init__(self, net: torch.nn.Module) -> None:
            super().__init__()
            self.net = net

        def forward(self, draft, op):
            return torch.sigmoid(self.net(draft, op))

    for name in sorted(folder.glob("guide-*.pt")):
        net = _model(width)
        net.load_state_dict(torch.load(name, map_location="cpu"))
        net.eval()
        draft = torch.zeros(1, 3, G.SIZE, G.SIZE)
        op = torch.zeros(1, dtype=torch.int64)
        torch.onnx.export(Ink(net), (draft, op), target / f"{name.stem}.onnx", dynamo=False,
                          input_names=["draft", "op"], output_names=["ink"], opset_version=17,
                          dynamic_axes={"draft": {0: "n"}, "op": {0: "n"}, "ink": {0: "n"}})
        typer.echo(f"{name.name} -> {target / (name.stem + '.onnx')}")


app.command()(samples)
app.command()(train)
app.command()(export)

if __name__ == "__main__":
    app()
