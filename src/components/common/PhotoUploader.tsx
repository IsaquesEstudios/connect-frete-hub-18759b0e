import { Camera, ImageUp, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { optimizeImageToDataUrl } from "@/lib/media/optimize";

// Otimiza a imagem (redimensiona + comprime) antes de salvar, mantendo a foto
// leve o suficiente para caber no banco sem perder qualidade perceptível.
async function fileToDataUrl(file: File): Promise<string> {
  try {
    return await optimizeImageToDataUrl(file, {
      maxDimension: 384,
      targetBytes: 60_000,
    });
  } catch (err) {
    throw new Error((err as Error).message || "Falha ao processar imagem.");
  }
}

export function PhotoUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const handle = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      const dataUrl = await fileToDataUrl(f);
      onChange(dataUrl);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border bg-muted">
        {value ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img src={value} alt="foto do perfil" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            sem foto
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <ImageUp className="mr-2 h-4 w-4" /> Enviar do dispositivo
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => cameraRef.current?.click()}>
          <Camera className="mr-2 h-4 w-4" /> Tirar foto
        </Button>
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => onChange("")}
          >
            <X className="mr-1 h-4 w-4" /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
