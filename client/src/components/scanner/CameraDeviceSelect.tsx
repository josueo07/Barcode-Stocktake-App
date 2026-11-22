import { useEffect, useState } from 'react';

export interface CameraDeviceSelectProps {
  value: string | undefined;
  onChange: (deviceId: string | undefined) => void;
}

/**
 * Lets the user pick a specific camera (e.g. a PC's external webcam vs. built-in one).
 * Device labels are only populated by the browser after camera permission has been granted,
 * so on first load this may just show generic "Camera N" entries until then.
 */
export function CameraDeviceSelect({ value, onChange }: CameraDeviceSelectProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => setDevices(all.filter((d) => d.kind === 'videoinput')))
      .catch(() => setDevices([]));
  }, []);

  if (devices.length <= 1) return null;

  return (
    <label className="camera-device-select">
      Camera
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Cámara trasera (predeterminada)</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Cámara ${d.deviceId.slice(0, 6)}`}
          </option>
        ))}
      </select>
    </label>
  );
}
