import React, { useEffect, useState } from 'react';
import { Settings, Mic, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function MicSettings({ selectedId, onSelect }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const getDevices = async () => {
    try {
      // We request a stream briefly to ensure permissions are granted before listing labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const micDevices = allDevices.filter(d => d.kind === 'audioinput');
      setDevices(micDevices);
      
      // Stop the temp stream
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.error("Error listing devices:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      getDevices();
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl text-white/70 hover:text-white"
        title="Microphone Settings"
      >
        <Settings size={20} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10, x: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: -20 }}
              exit={{ opacity: 0, scale: 0.9, y: 10, x: -20 }}
              className="absolute bottom-full left-1/2 mb-4 w-64 bg-[#111] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 pointer-events-auto"
            >
              <div className="px-3 py-2 border-b border-white/5 mb-1">
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono flex items-center gap-2">
                  <Mic size={10} />
                  Input Source
                </p>
              </div>
              
              <div className="max-h-60 overflow-y-auto space-y-1">
                {devices.length === 0 ? (
                  <p className="text-[11px] text-white/30 px-3 py-4 text-center">No microphones found</p>
                ) : (
                  devices.map(device => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        onSelect(device.deviceId);
                        setIsOpen(false);
                      }}
                      className={`
                        w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-colors
                        ${selectedId === device.deviceId 
                          ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30' 
                          : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'}
                      `}
                    >
                      <span className="truncate flex-1">{device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}</span>
                      {selectedId === device.deviceId && <Check size={14} className="shrink-0 text-violet-400" />}
                    </button>
                  ))
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-white/5 px-2">
                <p className="text-[9px] text-white/20 italic text-center">
                  Select your preferred mic for better results.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
