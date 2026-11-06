//! The composer's two numeric kernels. Both evaluate their float expressions in a fixed order, so an
//! export's bytes depend on the inputs alone.
use numpy::ndarray::Array2;
use numpy::{IntoPyArray, PyArray2, PyReadonlyArray1, PyReadonlyArray2};
use pyo3::prelude::*;

/// A size × size mask of `bx` (x0, y0, x1, y1, y up), filled by the nonzero rule at pixel centres.
/// An edge crossing a row at x adds its direction to the winding of every pixel centre right of x.
#[pyfunction]
fn fill<'py>(py: Python<'py>, rings: Vec<PyReadonlyArray2<'py, f64>>, size: usize, bx: (f64, f64, f64, f64)) -> Bound<'py, PyArray2<bool>> {
    let (x0, y0, x1, y1) = bx;
    let side = size as f64;
    let xs: Vec<f64> = (0..size).map(|i| x0 + (i as f64 + 0.5) * (x1 - x0) / side).collect();
    let ys: Vec<f64> = (0..size).map(|i| y1 - (i as f64 + 0.5) * (y1 - y0) / side).collect();
    let mut delta = vec![0i32; size * (size + 1)];
    for ring in &rings {
        let ring = ring.as_array();
        let n = ring.nrows();
        for k in 0..n {
            let (ax, ay) = (ring[[k, 0]], ring[[k, 1]]);
            let next = if k + 1 == n { 0 } else { k + 1 };
            let (bx_, by) = (ring[[next, 0]], ring[[next, 1]]);
            if ay == by {
                continue;
            }
            let (low, high, step) = if ay < by { (ay, by, 1) } else { (by, ay, -1) };
            // Rows run down the box, so the rows with low <= y < high are one run.
            let first = ys.partition_point(|&y| y >= high);
            let last = ys.partition_point(|&y| y >= low);
            for (r, &y) in ys.iter().enumerate().take(last).skip(first) {
                let x = ax + (y - ay) * (bx_ - ax) / (by - ay);
                delta[r * (size + 1) + xs.partition_point(|&c| c <= x)] += step;
            }
        }
    }
    let mut mask = Array2::<bool>::from_elem((size, size), false);
    for r in 0..size {
        let mut winding = 0;
        for c in 0..size {
            winding += delta[r * (size + 1) + c];
            mask[[r, c]] = winding != 0;
        }
    }
    mask.into_pyarray(py)
}

/// One contour's ring from the arrays `_ring_plan` makes. Each node ends on the mean of two points; a
/// curved node is a quadratic segment from the node before it, sampled at `ts`.
#[pyfunction]
#[allow(clippy::too_many_arguments)]
fn ring<'py>(py: Python<'py>, points: PyReadonlyArray2<'py, f64>, first: PyReadonlyArray1<'py, isize>, second: PyReadonlyArray1<'py, isize>,
             curved: PyReadonlyArray1<'py, isize>, offs: PyReadonlyArray1<'py, isize>, lines: PyReadonlyArray1<'py, i64>,
             samples: PyReadonlyArray1<'py, i64>, size: usize, ts: PyReadonlyArray1<'py, f64>) -> Bound<'py, PyArray2<f64>> {
    let (p, a, b, c, o, l, s, t) = (points.as_array(), first.as_array(), second.as_array(), curved.as_array(),
                                    offs.as_array(), lines.as_array(), samples.as_array(), ts.as_array());
    let on = |i: usize, d: usize| (p[[a[i] as usize, d]] + p[[b[i] as usize, d]]) / 2.0;
    let mut out = Array2::<f64>::zeros((size, 2));
    let mut is_curved = vec![false; a.len()];
    for &node in c.iter() {
        is_curved[node as usize] = true;
    }
    let mut straight = 0;
    for i in 0..a.len() {
        if !is_curved[i] {
            for d in 0..2 {
                out[[l[straight] as usize, d]] = on(i, d);
            }
            straight += 1;
        }
    }
    let steps = t.len();
    for (q, &node) in c.iter().enumerate() {
        let node = node as usize;
        for (k, &at) in t.iter().enumerate() {
            let place = s[q * steps + k] as usize;
            let rest = 1.0 - at;
            for d in 0..2 {
                out[[place, d]] = rest * rest * on(node - 1, d) + 2.0 * rest * at * p[[o[q] as usize, d]] + at * at * on(node, d);
            }
        }
    }
    out.into_pyarray(py)
}

#[pymodule]
fn _raster(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(fill, m)?)?;
    m.add_function(wrap_pyfunction!(ring, m)?)?;
    Ok(())
}
