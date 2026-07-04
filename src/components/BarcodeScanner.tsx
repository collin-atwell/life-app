import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui';
import type { FoodItem } from '../types';
import { communityFoodByBarcode } from '../lib/communityFoods';

// ---------- Barcode scanning ----------
// Camera → barcode via the native BarcodeDetector API (Android/Chrome) with a
// zxing fallback (iPhone Safari has no BarcodeDetector). The code is looked up
// in the community cache first (works offline), then Open Food Facts (~3M
// products, free, CORS-enabled).

interface OffProduct {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number>;
}

export async function lookupBarcode(code: string): Promise<Omit<FoodItem, 'id'> | null> {
  const cached = communityFoodByBarcode(code);
  if (cached) return { ...cached };
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,nutriments`,
  );
  if (!res.ok) return null;
  const json = await res.json() as { status: number; product?: OffProduct };
  const p = json.product;
  if (json.status !== 1 || !p?.nutriments) return null;
  const n = p.nutriments;
  // Prefer per-serving values when present, else per 100g.
  const perServing = n['energy-kcal_serving'] !== undefined;
  const k = (base: string) => (perServing ? n[`${base}_serving`] : n[`${base}_100g`]) ?? 0;
  const calories = Math.round((perServing ? n['energy-kcal_serving'] : n['energy-kcal_100g']) ?? 0);
  if (!calories) return null;
  return {
    name: [p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' — ') || `Product ${code}`,
    serving: perServing ? (p.serving_size || '1 serving') : '100 g',
    calories,
    protein: Math.round(k('proteins') * 10) / 10,
    carbs: Math.round(k('carbohydrates') * 10) / 10,
    fat: Math.round(k('fat') * 10) / 10,
    barcode: code,
  };
}

type NativeDetector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare const BarcodeDetector: (new (opts: { formats: string[] }) => NativeDetector) | undefined;

export function BarcodeScanner({ onFound, onClose }: {
  onFound: (food: Omit<FoodItem, 'id'>) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Starting camera…');
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const handledRef = useRef(false);

  const handleCode = async (code: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    stopRef.current();
    setBusy(true);
    setStatus(`Found ${code} — looking it up…`);
    try {
      const food = await lookupBarcode(code);
      if (food) onFound(food);
      else {
        setStatus(`Barcode ${code} isn't in the database yet — add it as a custom food (and share it so the next scan finds it).`);
        handledRef.current = false;
        setBusy(false);
      }
    } catch {
      setStatus('Lookup failed — check your connection, or enter the food manually.');
      handledRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | undefined;
    let zxingControls: { stop: () => void } | null = null;

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        if (typeof BarcodeDetector !== 'undefined') {
          // Native path (Android / desktop Chrome)
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          video.srcObject = stream;
          await video.play();
          const detector = new BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          setStatus('Point the camera at a barcode');
          interval = setInterval(async () => {
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) handleCode(codes[0].rawValue);
            } catch { /* frame not ready */ }
          }, 300);
        } else {
          // zxing fallback (iPhone Safari)
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          setStatus('Point the camera at a barcode');
          zxingControls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
            if (result) handleCode(result.getText());
          });
        }
      } catch {
        if (!cancelled) setStatus('Camera unavailable — type the barcode number below instead.');
      }
    })();

    stopRef.current = () => {
      clearInterval(interval);
      zxingControls?.stop();
      stream?.getTracks().forEach(t => t.stop());
    };
    return () => { cancelled = true; stopRef.current(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Scan a barcode" onClose={() => { stopRef.current(); onClose(); }}>
      <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 10, background: '#000', minHeight: 220 }} />
      <p className="small muted" role="status">{status}</p>
      <div className="form-row">
        <input inputMode="numeric" placeholder="…or type the barcode number" value={manual} onChange={e => setManual(e.target.value)} />
        <button className="btn btn-sm" disabled={busy || manual.length < 8} onClick={() => handleCode(manual.trim())} style={{ maxWidth: 110 }}>Look up</button>
      </div>
      <p className="small muted">Product data from Open Food Facts + the Health Hub community database.</p>
    </Modal>
  );
}
