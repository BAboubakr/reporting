// Use the same relevance and event identity layer as the dashboard.
import { signals } from './data/signals.js?report=V4-20261017-1';
import { cleanSignals } from './data-cleaner.js?report=V4-20261017-1';
const events=cleanSignals(signals);
signals.splice(0,signals.length,...events);
window.__atlasSignalSanitized=true;
window.__atlasSignalSanitizedCount=events.length;


