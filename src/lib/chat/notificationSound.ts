import soundAsset from "@/assets/notification.mp3.asset.json";

let audio: HTMLAudioElement | null = null;
let lastPlayed = 0;

/** Toca o som de nova mensagem (no máximo 1x a cada 1,5 s). */
export function playNotificationSound() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastPlayed < 1500) return;
  lastPlayed = now;
  try {
    if (!audio) audio = new Audio(soundAsset.url);
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // navegador bloqueou o áudio
  }
}
