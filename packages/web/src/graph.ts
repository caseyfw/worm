import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Sample } from '@worm/shared';

const HISTORY_WINDOW_S = 60;
const Y_GRID = 0.2;

export interface Graph {
  pushSample(s: Sample): void;
  setHistory(samples: Sample[]): void;
  destroy(): void;
}

export function createGraph(container: HTMLElement): Graph {
  // We store samples as relative seconds from an anchor time for cleaner x-axis display.
  // But uPlot needs monotonically increasing x values, so we use absolute seconds
  // and control the visible range via setScale.
  let xData: number[] = [];
  let yData: number[] = [];

  const opts: uPlot.Options = {
    width: container.clientWidth || 800,
    height: container.clientHeight || 600,
    cursor: { show: false },
    legend: { show: false },
    // select: { show: false } as unknown as uPlot.Select,
    series: [
      {}, // x-axis (timestamps)
      {
        stroke: '#ff2a2a',
        width: 2.5,
        points: { show: false },
        paths: uPlot.paths.spline!(),
      },
    ],
    scales: {
      x: {
        time: false,
        auto: false,
      },
      y: {
        auto: false,
        range: [-1, 1],
      },
    },
    axes: [
      {
        // x-axis
        stroke: '#666',
        size: 10,
        grid: {
          stroke: '#333',
          width: 1,
        },
        ticks: { show: false },
        gap: 8,
        space: 80,
        values: () => [],
      },
      {
        // y-axis
        stroke: '#666',
        size: 10,
        grid: {
          stroke: '#333',
          width: 1,
        },
        ticks: { show: false },
        incrs: [Y_GRID],
        gap: 8,
        values: () => [],
      },
    ],
    hooks: {
      draw: [
        (u) => {
          // Draw bolder midline at y=0
          const ctx = u.ctx;
          const y0 = u.valToPos(0, 'y', true);
          const left = u.bbox.left;
          const right = left + u.bbox.width;
          ctx.save();
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(left, y0);
          ctx.lineTo(right, y0);
          ctx.stroke();
          ctx.restore();
        },
      ],
    },
  };

  const chart = new uPlot(opts, [xData, yData], container);

  // Resize observer
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chart.setSize({ width: Math.round(width), height: Math.round(height) });
      }
    }
  });
  ro.observe(container);

  function redraw(): void {
    const now = Date.now() / 1000;
    const max = xData.length > 0 ? Math.max(xData[xData.length - 1]!, now) : now;
    const min = max - HISTORY_WINDOW_S;

    chart.setData([xData, yData], false);
    chart.setScale('x', { min, max });
  }

  return {
    pushSample(s: Sample): void {
      const tSec = s.t / 1000;
      xData.push(tSec);
      yData.push(s.value);

      // Trim to window
      const cutoff = tSec - HISTORY_WINDOW_S;
      while (xData.length > 0 && xData[0]! < cutoff) {
        xData.shift();
        yData.shift();
      }

      redraw();
    },

    setHistory(samples: Sample[]): void {
      xData = samples.map((s) => s.t / 1000);
      yData = samples.map((s) => s.value);
      redraw();
    },

    destroy(): void {
      ro.disconnect();
      chart.destroy();
    },
  };
}
