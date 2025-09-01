import React, { useEffect, useMemo, useState } from "react";

/**
 * Album Progress Dashboard — v3
 * Changes in this pass:
 * - Card size: h-[462px] w-[370px] (fits 2×5 on 1920×1080)
 * - No footer; page has no outer scrollbar (overflow-hidden)
 * - Stage title is inside the progress bar (no % text in bars)
 * - Remove button (×) inline to the right of each bar
 * - Clicking a bar opens a modal that lets you edit the stage name + progress (with slider)
 * - No max stage count; scroll appears inside card if too many
 * - “+” only for Add Bit button
 * - Zoom view centers a single song on a pure black background; UI is the same but enlarged
 */

const DEFAULT_STAGE_NAMES = [
  "Demo",
  "Basic Track",
  "Instruments",
  "Lyrics",
  "Vocals",
  "Mix",
];

const DEFAULT_SONGS = Array.from({ length: 20 }).map((_, i) => ({
  id: i + 1,
  title: `Song ${i + 1}`,
  stages: DEFAULT_STAGE_NAMES.map((name) => ({ name, value: 0 })),
}));

const STORAGE_KEY = "albumProgress_v3";

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash;
}

function formatDHMS(ms) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function useCountdown(targetISO) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = useMemo(() => new Date(targetISO).getTime(), [targetISO]);
  const remaining = Math.max(0, target - now);
  return formatDHMS(remaining);
}

const clamp01 = (v) => Math.min(100, Math.max(0, v));

function ProgressBar({ value, editable = false, onClick, height = "h-4", label }) {
  const pct = clamp01(value);
  const barColor = pct >= 100 ? "bg-emerald-700" : "bg-amber-700";
  return (
    <div className="w-full flex items-center gap-2">
      <div
        className={`relative w-full ${height} bg-neutral-800 rounded-full overflow-hidden ${editable ? "cursor-pointer" : ""}`}
        onClick={editable ? onClick : undefined}
        title={editable ? "Click to edit" : undefined}
      >
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        {label && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] sm:text-sm font-medium text-white/90">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

function EditableText({ text, onSubmit, className, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text || "");
  useEffect(() => setVal(text || ""), [text]);
  return editing ? (
    <input
      className={`bg-neutral-900 border border-neutral-700 rounded px-2 py-1 w-full focus:outline-none focus:ring ${className || ""}`}
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onSubmit((val || placeholder || text || "").trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setVal(text || "");
          setEditing(false);
        }
      }}
      autoFocus
    />
  ) : (
    <div className={`cursor-text ${className || ""}`} onClick={() => setEditing(true)}>
      {val || placeholder || ""}
    </div>
  );
}

function EditStagePrompt({ initialName, initialValue, onClose }) {
  const [name, setName] = useState(initialName || "");
  const [val, setVal] = useState(String(initialValue ?? 0));
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-md space-y-4">
        <div className="text-lg font-semibold">Edit bit</div>
        <div className="space-y-2">
          <label className="text-sm text-neutral-300">Name</label>
          <input
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-neutral-300">Progress: {clamp01(Number(val) || 0)}%</label>
          <input type="range" min={0} max={100} value={Number(val) || 0} onChange={(e) => setVal(e.target.value)} className="w-full" />
        </div>
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => onClose(null)}>
            Cancel
          </button>
          <button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500" onClick={() => onClose({ name: name.trim() || initialName, value: clamp01(Number(val) || 0) })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportImport({ songs, albumTitle }) {
  const exportJSON = async () => {
	  const data = JSON.stringify({ songs, albumTitle }, null, 2);

	  // If supported (Chromium browsers), let the user pick the exact file to overwrite
	  if ('showSaveFilePicker' in window) {
		try {
		  const handle = await window.showSaveFilePicker({
			suggestedName: 'album_dashboard.json',
			types: [
			  { description: 'JSON', accept: { 'application/json': ['.json'] } },
			],
			// You can try to suggest a start folder, but the browser decides:
			// startIn: 'documents' // or 'desktop' (cannot pre-fill F:\ path)
		  });
		  const writable = await handle.createWritable();
		  await writable.write(new Blob([data], { type: 'application/json' }));
		  await writable.close();
		  return;
		} catch (e) {
		  if (e?.name === 'AbortError') return; // user canceled
		  console.error(e);
		  alert('Could not save using the file picker. Falling back to download.');
		}
	  }

	  // Fallback: normal download to the browser’s default folder
	  const blob = new Blob([data], { type: 'application/json' });
	  const url = URL.createObjectURL(blob);
	  const a = document.createElement('a');
	  a.href = url;
	  a.download = 'album_dashboard.json';
	  a.click();
	  URL.revokeObjectURL(url);
	};

	const importJSON = async () => {
	  // If supported, let user pick the file directly
	  if ('showOpenFilePicker' in window) {
		try {
		  const [handle] = await window.showOpenFilePicker({
			types: [
			  { description: 'JSON', accept: { 'application/json': ['.json'] } },
			],
			multiple: false,
		  });
		  const file = await handle.getFile();
		  const txt = await file.text();
		  const data = JSON.parse(txt);
		  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		  window.location.reload();
		  return;
		} catch (e) {
		  if (e?.name === 'AbortError') return; // user canceled
		  console.error(e);
		  alert('Could not open using the file picker. Falling back to upload.');
		}
	  }

	  // Fallback: classic file input
	  const input = document.createElement('input');
	  input.type = 'file';
	  input.accept = '.json,application/json';
	  input.onchange = () => {
		const file = input.files?.[0];
		if (!file) return;
		file.text().then((txt) => {
		  try {
			const data = JSON.parse(txt);
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			window.location.reload();
		  } catch {
			alert('Invalid JSON file');
		  }
		});
	  };
	  input.click();
	};

  const resetData = () => {
    if (confirm("Reset all data to defaults?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };
  return (
    <div className="flex items-center gap-2">
      <button className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700" onClick={exportJSON}>
        Export
      </button>
      <button className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700" onClick={importJSON}>
        Import
      </button>
      <button className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700" onClick={resetData}>
        Reset
      </button>
    </div>
  );
}

function songAverage(song) {
  if (!song.stages?.length) return 0;
  const sum = song.stages.reduce((a, s) => a + clamp01(s.value || 0), 0);
  return Math.round((100 * sum) / (song.stages.length * 100));
}

function albumAverage(songs) {
  if (!songs.length) return 0;
  const sum = songs.reduce((a, s) => a + songAverage(s), 0);
  return Math.round(sum / songs.length);
}

function eligibleCount(songs, threshold = 75) {
  return [...songs].filter(s => songAverage(s) >= threshold).length;
}

function Header({ targetISO, setTargetISO, songs, albumTitle, setAlbumTitle }) {
  const { days, hours, minutes, seconds } = useCountdown(targetISO);
  const [editingDate, setEditingDate] = useState(false);

  return (
    <div className="w-full flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-4">
        <EditableText
          text={albumTitle}
          onSubmit={setAlbumTitle}
          className="text-2xl font-black tracking-wider"
          placeholder="Album Title"
        />
      </div>
	  
	  <div className="text-2xl font-black tracking-wider">
	  {eligibleCount(songs, 75)}/20
	  </div>

      <div className="flex items-center gap-3 text-right">
        {editingDate ? (
          <input
            type="datetime-local"
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
            value={toLocalDatetimeInputValue(targetISO)}
            onChange={(e) => setTargetISO(fromLocalDatetimeInputValue(e.target.value))}
            onBlur={() => setEditingDate(false)}
            autoFocus
          />
        ) : (
          <div className="cursor-pointer" onClick={() => setEditingDate(true)} title="Click to edit target deadline">
            <div className="uppercase text-xs tracking-widest text-neutral-400">Time to Goal</div>
            <div className="text-2xl tabular-nums font-semibold">
              {days}d {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            <div className="text-xs text-neutral-500">Target: {new Date(targetISO).toLocaleString()}</div>
          </div>
        )}
        <ExportImport songs={songs} albumTitle={albumTitle} />
      </div>
    </div>
  );
}

function StageRow({ stage, onApply, onRemove, stageRowHeight = "h-4" }) {
  const [promptOpen, setPromptOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <ProgressBar
          value={stage.value}
          label={stage.name}
          editable
          onClick={() => setPromptOpen(true)}
		  height = {stageRowHeight}
        />
      </div>
      <button
        className="shrink-0 w-6 h-3 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-xs"
        onClick={onRemove}
        title="Remove"
      >
        ×
      </button>

      {promptOpen && (
        <EditStagePrompt
          initialName={stage.name}
          initialValue={stage.value}
          onClose={(res) => {
            setPromptOpen(false);
            if (!res) return;
            // single commit with both name & value
            onApply(res.name, res.value);
          }}
        />
      )}
    </div>
  );
}


function SongCard({ song, onUpdate, onZoom }) {
  const avg = songAverage(song);

  const updateStageAt = (idx, patch) => {
    const stages = song.stages.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdate({ ...song, stages });
  };

  const removeStageAt = (idx) => onUpdate({ ...song, stages: song.stages.filter((_, i) => i !== idx) });
  const addStage = () => onUpdate({ ...song, stages: [...song.stages, { name: `Stage ${song.stages.length + 1}`, value: 0 }] });

  return (
		   <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm p-2 flex flex-col gap-2 h-[232px] w-[376px]">
		  <div className="flex items-center justify-between gap-2">
			<EditableText
			  text={song.title}
			  onSubmit={(t) => onUpdate({ ...song, title: t })}
			  className="font-bold leading-tight text-xl tracking-wider"
			/>
			<button className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => onZoom(song.id)} title="Zoom">Zoom</button>
		  </div>

		  {/* Overall song progress (derived) */}
		  <div className="relative">
			<ProgressBar value={avg} height="h-5" /> {/* slightly smaller bar */}
			<span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
			  {avg}%
			</span>
		  </div>

		  <div className="flex-1 overflow-auto pr-1">
			<div className="flex flex-col gap-1"> {/* less vertical gap */}
			  {song.stages.map((stg, idx) => (
				<StageRow
				  key={`${stg.name}-${idx}`}
				  stage={stg}
				  onApply={(name, value) => updateStageAt(idx, { name, value })}
				  onRemove={() => removeStageAt(idx)}
				/>
			  ))}
			</div>
		  </div>

		  {/* footer shrunk */}
		  <div className="flex items-center justify-end pt-1">
			<button
			  className="w-3 h-3 flex items-center justify-center text-sm rounded bg-neutral-800 hover:bg-neutral-700"
			  onClick={addStage}
			>
			  +
			</button>
		  </div>
		</div>

  );
}

function SongDetail({ song, onUpdate, onBack }) {
  const avg = songAverage(song);

  const updateStageAt = (idx, patch) => {
    const stages = song.stages.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdate({ ...song, stages });
  };

  const removeStageAt = (idx) => onUpdate({ ...song, stages: song.stages.filter((_, i) => i !== idx) });
  const addStage = () => onUpdate({ ...song, stages: [...song.stages, { name: `Stage ${song.stages.length + 1}`, value: 0 }] });

  return (
	  <div className="h-screen w-screen bg-black flex items-center justify-center">
		<div
		  className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-lg flex flex-col"
		  style={{ width: 740, height: 724 }}  // keep your chosen size
		>
		  <div className="flex items-center justify-between mb-4">
			<EditableText
			  text={song.title}
			  onSubmit={(t) => onUpdate({ ...song, title: t })}
			  className="text-3xl font-bold"
			/>
			<button className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700" onClick={onBack}>
			  Back to Grid
			</button>
		  </div>

		  <div className="relative mb-3">
			<ProgressBar value={avg} height="h-9" />
			<span className="absolute inset-0 flex items-center justify-center text-white font-bold">
			  {avg}%
			</span>
		  </div>

		  {/* make this fill remaining space; no fixed height */}
		  <div className="flex-1 overflow-auto pr-1">
			<div className="flex flex-col gap-3">
			  {song.stages.map((stg, idx) => (
				  <StageRow
					key={`${stg.name}-${idx}`}
					stage={stg}
					onApply={(name, value) => updateStageAt(idx, { name, value })}
					onRemove={() => removeStageAt(idx)}
					stageRowHeight = "h-8"
				  />
				))}
			</div>
		  </div>

		  <div className="pt-3 flex items-center justify-between">
			<button
			  className="w-9 h-9 flex items-center justify-center text-lg rounded bg-neutral-800 hover:bg-neutral-700"
			  onClick={addStage}
			>
			  +
			</button>
		  </div>
		</div>
	  </div>
	);
}

function toLocalDatetimeInputValue(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalDatetimeInputValue(value) {
  const d = new Date(value);
  return d.toISOString();
}

export default function App() {
  const stored = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }, []);

  // Migrate older storage shapes
  const migrateSongs = (s) => {
    if (!s) return DEFAULT_SONGS;
    return s.map((song) => {
      if (Array.isArray(song.stages)) return song; // v2+
      if (song.stages && typeof song.stages === "object") {
        const entries = Object.entries(song.stages).map(([name, value]) => ({ name, value: Number(value) || 0 }));
        return { ...song, stages: entries };
      }
      return { ...song, stages: DEFAULT_STAGE_NAMES.map((n) => ({ name: n, value: 0 })) };
    });
  };

  const [songs, setSongs] = useState(() => migrateSongs(stored.songs) || DEFAULT_SONGS);
  const [albumTitle, setAlbumTitle] = useState(() => stored.albumTitle || "Album Dashboard");
  const [targetISO, setTargetISO] = useState(() => stored.targetISO || new Date("2026-08-01T00:00:00").toISOString());

  const hash = useHashRoute();
  const songIdFromHash = useMemo(() => {
    if (hash && hash.startsWith("#song/")) {
      const num = Number(hash.slice(6));
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }, [hash]);

  const currentSong = songIdFromHash ? songs.find((s) => s.id === songIdFromHash) : null;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ songs, targetISO, albumTitle }));
  }, [songs, targetISO, albumTitle]);

  const updateSong = (updated) => setSongs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

	  useEffect(() => {
		document.title = "ALBUM 2026";
	  }, [albumTitle]);
	  
  return (
    <div className="h-screen w-full overflow-hidden bg-neutral-950 text-neutral-100">
      

      {currentSong ? (
		  <SongDetail
			song={currentSong}
			onUpdate={updateSong}
			onBack={() => (window.location.hash = "")}
		  />
		) : (
		  <>
			<Header
			  targetISO={targetISO}
			  setTargetISO={setTargetISO}
			  songs={songs}
			  albumTitle={albumTitle}
			  setAlbumTitle={setAlbumTitle}
			/>

			{/* Album-wide overall progress (with % in center) */}
			<div className="px-4 -mt-2 pb-2 relative">
			  <ProgressBar value={albumAverage(songs)} height="h-9" />
			  <span
				className="absolute inset-0 text-white font-bold"
				style={{
				  lineHeight: "36px", // match h-9 (36px)
				  textAlign: "center",
				}}
			  >
				{albumAverage(songs)}%
			  </span>
			</div>

			<div className="px-4 pb-4 h-[calc(100vh-140px)] overflow-hidden">
			  <div className="grid grid-cols-5 gap-1 justify-items-center">
				{songs.map((song) => (
				  <SongCard
					key={song.id}
					song={song}
					onUpdate={updateSong}
					onZoom={(id) => (window.location.hash = `#song/${id}`)}
				  />
				))}
			  </div>
			</div>
		  </>
		)}
    </div>
  );
}
