import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
  maxSizePerImageMB?: number;
  disabled?: boolean;
}

export function ImageUpload({
  value = [],
  onChange,
  maxImages = 10,
  maxSizeMB = 5,
  maxSizePerImageMB = 2,
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);

    // Validar número de imagens
    if (value.length + files.length > maxImages) {
      setError(`Você pode fazer upload de no máximo ${maxImages} imagens`);
      return;
    }

    // Validar tamanho total
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    const currentSize = 0; // Assumindo que as imagens já enviadas não contam para o limite
    if (totalSize + currentSize > maxSizeMB * 1024 * 1024) {
      setError(
        `O tamanho total das imagens excede ${maxSizeMB}MB. Para imagens maiores, use links externos do Google Drive ou similar.`
      );
      return;
    }

    // Validar tamanho individual
    for (const file of files) {
      if (file.size > maxSizePerImageMB * 1024 * 1024) {
        setError(`A imagem "${file.name}" excede ${maxSizePerImageMB}MB`);
        return;
      }
    }

    // Validar tipo de arquivo
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError(`O arquivo "${file.name}" não é uma imagem válida`);
        return;
      }
    }

    try {
      setUploading(true);
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("images", file);
      });

      const response = await apiRequest("POST", "/api/marketplace/upload-images", formData);
      const data = await response.json();

      onChange([...value, ...data.urls]);
    } catch (err: any) {
      setError(err.message || "Erro ao fazer upload das imagens");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Grid de imagens */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {value.map((url, index) => (
            <div
              key={index}
              className="relative group aspect-square border-2 border-gray-200 rounded-lg overflow-hidden"
              data-testid={`image-preview-${index}`}
            >
              <img
                src={url}
                alt={`Imagem ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-1 rounded">
                  Principal
                </div>
              )}
              <button
                type="button"
                onClick={() => removeImage(index)}
                disabled={disabled || uploading}
                className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                data-testid={`button-remove-image-${index}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botão de upload */}
      {value.length < maxImages && (
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          disabled={disabled || uploading}
          className="w-full h-32 border-2 border-dashed"
          data-testid="button-upload-images"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span>Fazendo upload...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8" />
              <div className="text-center">
                <p className="font-medium">Clique para fazer upload</p>
                <p className="text-xs text-gray-500">
                  Máx {maxSizePerImageMB}MB por imagem, {maxSizeMB}MB total
                </p>
                <p className="text-xs text-gray-500">
                  {value.length}/{maxImages} imagens
                </p>
              </div>
            </div>
          )}
        </Button>
      )}

      <div className="text-xs text-gray-500">
        <p>• A primeira imagem será a capa do produto</p>
        <p>• As imagens serão automaticamente otimizadas</p>
        <p>• Para imagens maiores que {maxSizeMB}MB, use links do Google Drive</p>
      </div>
    </div>
  );
}
