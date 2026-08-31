import { useRef } from 'react';
import { S, saveSettings, UNIT } from '../../lib/settings';
import { fmtDist, dayKey } from '../../lib/format';
import { download } from '../../lib/gpx';
import {
  data, useStore, emit, toast, wipeAll, importBackup,
  addShoe, updateShoe, deleteShoe, shoeDistance,
} from '../../store';
import { IcoBack } from '../icons';

export default function SettingsSheet({ open, onClose, onMapStyleChange }: {
  open: boolean; onClose: () => void; onMapStyleChange: () => void;
}) {
  useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof S>(k: K, v: typeof S[K]) => {
    S[k] = v; saveSettings(); emit();
  };

  const exportAll = () => {
    download(new Blob([JSON.stringify({
      app: 'stride', v: 3, exportedAt: Date.now(), settings: S,
      runs: data.runs, segments: data.segments, efforts: data.efforts, shoes: data.shoes,
    }, null, 1)], { type: 'application/json' }), 'stride-backup-' + dayKey(Date.now()) + '.json');
    toast('Backup downloaded');
  };

  const onImportFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = await importBackup(await f.text());
      toast('Imported ' + n + ' runs');
    } catch { toast('Could not read that file'); }
  };

  const newShoe = async () => {
    const name = prompt('Shoe name (e.g. Pegasus 41)');
    if (!name) return;
    const shoe = await addShoe(name);
    if (confirm('Make "' + shoe.name + '" the default for new runs?')) {
      S.defaultShoeId = shoe.id; saveSettings(); emit();
    }
  };

  return (
    <div className={'sheet' + (open ? ' open' : '')}>
      <div className="sheet-head">
        <button className="iconbtn" onClick={onClose}><IcoBack /></button>
        <h2>Settings</h2>
      </div>
      <div className="scroll" style={{ paddingTop: 14 }}>
        <div className="card">
          <div className="row">
            <div className="lab">Units<small>Distance and pace</small></div>
            <div className="seg">
              <button className={S.units === 'km' ? 'on' : ''} onClick={() => set('units', 'km')}>km</button>
              <button className={S.units === 'mi' ? 'on' : ''} onClick={() => set('units', 'mi')}>mi</button>
            </div>
          </div>
          <div className="row">
            <div className="lab">Weekly goal<small>Distance target per week</small></div>
            <div className="stepper">
              <button onClick={() => set('weeklyGoal', Math.max(1, S.weeklyGoal - 1))}>−</button>
              <b className="num">{S.weeklyGoal} {UNIT()}</b>
              <button onClick={() => set('weeklyGoal', Math.min(300, S.weeklyGoal + 1))}>+</button>
            </div>
          </div>
          <div className="row">
            <div className="lab">Voice splits<small>Announce each {UNIT()} out loud</small></div>
            <div className={'switch' + (S.voice ? ' on' : '')} onClick={() => set('voice', !S.voice)} />
          </div>
          <div className="row">
            <div className="lab">Auto-pause<small>Stop the clock when you stop moving</small></div>
            <div className={'switch' + (S.autoPause ? ' on' : '')} onClick={() => set('autoPause', !S.autoPause)} />
          </div>
          <div className="row">
            <div className="lab">Keep screen awake<small>Needed for reliable GPS while running</small></div>
            <div className={'switch' + (S.keepAwake ? ' on' : '')} onClick={() => set('keepAwake', !S.keepAwake)} />
          </div>
          <div className="row">
            <div className="lab">Map style</div>
            <div className="seg">
              <button className={S.mapStyle === 'dark' ? 'on' : ''}
                onClick={() => { set('mapStyle', 'dark'); onMapStyleChange(); }}>Dark</button>
              <button className={S.mapStyle === 'street' ? 'on' : ''}
                onClick={() => { set('mapStyle', 'street'); onMapStyleChange(); }}>Street</button>
            </div>
          </div>
        </div>

        <div className="sec-title">Gear<span className="meta">shoe mileage</span></div>
        <div className="card">
          {data.shoes.map(shoe => (
            <div className="row" key={shoe.id}>
              <div className="lab" style={shoe.retired ? { color: 'var(--dim)' } : undefined}>
                {shoe.name}{S.defaultShoeId === shoe.id && !shoe.retired ? ' · default' : ''}{shoe.retired ? ' · retired' : ''}
                <small>{fmtDist(shoeDistance(shoe.id), 0)} {UNIT()} logged</small>
              </div>
              {!shoe.retired && S.defaultShoeId !== shoe.id && (
                <button className="chip" onClick={() => { S.defaultShoeId = shoe.id; saveSettings(); emit(); }}>set default</button>
              )}
              <button className="chip" onClick={async () => {
                if (shoe.retired) {
                  if (confirm('Delete "' + shoe.name + '"? Runs keep their record.')) await deleteShoe(shoe.id);
                } else {
                  await updateShoe({ ...shoe, retired: true });
                  if (S.defaultShoeId === shoe.id) { S.defaultShoeId = null; saveSettings(); }
                  emit();
                }
              }}>{shoe.retired ? 'delete' : 'retire'}</button>
            </div>
          ))}
          <button className="linkbtn" onClick={newShoe}>+ Add shoes</button>
        </div>

        <div className="sec-title">Your data</div>
        <div className="card">
          <button className="linkbtn" onClick={exportAll}>Export all runs (JSON backup)</button>
          <button className="linkbtn" onClick={() => fileRef.current?.click()}>Import a backup file</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
            onChange={e => onImportFile(e.target.files?.[0])} />
          <button className="linkbtn danger" onClick={async () => {
            if (!confirm('Delete ALL runs on this device? This cannot be undone.')) return;
            await wipeAll(); toast('All runs deleted');
          }}>Delete all runs</button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--dim)', padding: '16px 2px', lineHeight: 1.6 }}>
          Stride keeps every run on this device only — nothing is uploaded anywhere.
          Back up regularly if this phone matters to you.<br /><br />
          Maps © OpenStreetMap contributors — free tiles, no API key. Weather by Open-Meteo.
        </div>
      </div>
    </div>
  );
}
