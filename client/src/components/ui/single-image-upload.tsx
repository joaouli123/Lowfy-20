import { useState, useRef } from "react";
import { Upload, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

interface SingleImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function SingleImageUpload({
  value,
  onChange,
  maxSizeMB = 2,
  disabled = false,
}: SingleImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      setError(`O arquivo "${file.name}" não é uma imagem válida`);
      return;
    }

    // Validar tamanho
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`A imagem excede ${maxSizeMB}MB`);
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("images", file);

      const response = await apiRequest("POST", "/api/marketplace/upload-images", formData);
      const data = await response.json();

      if (data.urls && data.urls.length > 0) {
        onChange(data.urls[0]);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    onChange("");
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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

      {/* Preview de imagem */}
      {value && (
        <div className="relative group aspect-square border-2 border-gray-200 rounded-lg overflow-hidden max-w-xs">
          <img src={value} alt="Imagem" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={removeImage}
            disabled={disabled || uploading}
            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
            data-testid="button-remove-image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Botão de upload */}
      {!value && (
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          disabled={disabled || uploading}
          className="w-full h-32 border-2 border-dashed"
          data-testid="button-upload-image"
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
                <p className="text-xs text-gray-500">Máx {maxSizeMB}MB</p>
              </div>
            </div>
          )}
        </Button>
      )}

      <div className="text-xs text-gray-500">
        <p>• Para imagens maiores, use links do Google Drive</p>
      </div>
    </div>
  );
}
