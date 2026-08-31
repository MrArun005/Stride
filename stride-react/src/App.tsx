import { useEffect, useState } from 'react';
import type { Run, Segment } from './lib/types';
import { loadAll } from './store';
import { initTracker, startWatch, tryRestore, setOnFinished } from './lib/tracker';
import TabBar, { type Tab } from './components/TabBar';
import RunScreen from './components/RunScreen';
import HistoryScreen from './components/HistoryScreen';
import SegmentsScreen from './components/SegmentsScreen';
import ProgressScreen from './components/ProgressScreen';
import RunDetailSheet from './components/sheets/RunDetailSheet';
import SegmentSheet from './components/sheets/SegmentSheet';
import SegmentMakerSheet from './components/sheets/SegmentMakerSheet';
import SettingsSheet from './components/sheets/SettingsSheet';
import HeatmapSheet from './components/sheets/HeatmapSheet';
import Toast from './components/Toast';

export default function App() {
  const [tab, setTab] = useState<Tab>('run');
  const [detailRun, setDetailRun] = useState<Run | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [seg, setSeg] = useState<Segment | null>(null);
  const [segOpen, setSegOpen] = useState(false);
  const [makerRun, setMakerRun] = useState<Run | null>(null);
  const [makerOpen, setMakerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [heatOpen, setHeatOpen] = useState(false);
  const [mapEpoch, setMapEpoch] = useState(0);   // bumped on map-style change to rebuild sheet maps

  useEffect(() => {
    (async () => {
      await loadAll();
      initTracker();
      startWatch();
      await tryRestore();
    })();
    setOnFinished(run => { setDetailRun(run); setDetailOpen(true); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const openDetail = (r: Run) => { setDetailRun(r); setDetailOpen(true); };

  return (
    <div id="app">
      <RunScreen active={tab === 'run'} />
      <HistoryScreen active={tab === 'history'} onOpen={openDetail} />
      <SegmentsScreen active={tab === 'segments'} onOpen={s => { setSeg(s); setSegOpen(true); }} />
      <ProgressScreen active={tab === 'progress'}
        onSettings={() => setSettingsOpen(true)} onHeatmap={() => setHeatOpen(true)} />
      <TabBar tab={tab} onTab={setTab} />

      <RunDetailSheet key={'d' + mapEpoch} run={detailRun} open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onMakeSegment={r => { setMakerRun(r); setMakerOpen(true); }} />
      <HeatmapSheet key={'h' + mapEpoch} open={heatOpen} onClose={() => setHeatOpen(false)} />
      <SegmentSheet key={'s' + mapEpoch} seg={seg} open={segOpen} onClose={() => setSegOpen(false)} />
      <SegmentMakerSheet key={'m' + mapEpoch} run={makerRun} open={makerOpen}
        onClose={() => setMakerOpen(false)}
        onSaved={sg => { setMakerOpen(false); setSeg(sg); setSegOpen(true); }} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}
        onMapStyleChange={() => setMapEpoch(e => e + 1)} />

      <Toast />
      <div id="grain" />
    </div>
  );
}
