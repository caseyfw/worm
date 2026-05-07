import { EVENTS, type ReactionKind } from '@worm/shared';
import './styles.css';
import { createGraph } from './graph.js';
import { createSocket } from './socket.js';

// Graph
const appEl = document.getElementById('app')!;
const graph = createGraph(appEl);

// Socket
const socket = createSocket();

socket.on(EVENTS.history, (samples) => {
  graph.setHistory(samples);
});

socket.on(EVENTS.sample, (sample) => {
  graph.pushSample(sample);
});

// Controls
function submit(kind: ReactionKind): void {
  socket.emit(EVENTS.reaction, { kind });
}

document.getElementById('btn-up')!.addEventListener('click', () => submit('up'));
document.getElementById('btn-down')!.addEventListener('click', () => submit('down'));
