import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bug, Send, X, Image as ImageIcon, Video, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const { toast } = useToast();

  const reportBugMutation = useMutation({
    mutationFn: async (data: { message: string; files: File[] }) => {
      const formData = new FormData();
      formData.append('message', data.message);

      data.files.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch('/api/support/bug-report', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar bug report');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Obrigado pelo feedback!",
        description: "Seu relato de bug foi enviado com sucesso. Nossa equipe irá analisá-lo em breve.",
      });
      setBugDescription("");
      setSelectedFiles([]);
      setFilePreviews([]);
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar seu relato. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length + selectedFiles.length > 3) {
      toast({
        title: "Muitos arquivos",
        description: "Você pode anexar no máximo 3 arquivos.",
        variant: "destructive",
      });
      return;
    }

    const totalSize = [...selectedFiles, ...files].reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 45 * 1024 * 1024) { // 45MB total
      toast({
        title: "Arquivos muito grandes",
        description: "O tamanho total dos arquivos não pode exceder 45MB.",
        variant: "destructive",
      });
      return;
    }

    // Generate previews for new files
    const newPreviews: string[] = [];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        if (newPreviews.length === files.length) {
          setFilePreviews([...filePreviews, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setSelectedFiles([...selectedFiles, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!bugDescription.trim()) {
      toast({
        title: "Campo vazio",
        description: "Por favor, descreva o problema encontrado.",
        variant: "destructive",
      });
      return;
    }
    reportBugMutation.mutate({ message: bugDescription, files: selectedFiles });
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className="fixed bottom-6 right-6 z-50 bg-primary hover:bg-primary/90 text-white shadow-lg gap-1.5 text-xs px-3 py-2"
        data-testid="button-bug-report"
      >
        <Bug className="h-3.5 w-3.5" />
        Encontrou algum bug?
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-bug-report">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-primary" />
              Encontrou algum problema?
            </DialogTitle>
            <DialogDescription>
              Nos ajude a melhorar! Descreva o bug ou problema que você encontrou.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="bug-description">Descrição do problema</Label>
              <Textarea
                id="bug-description"
                placeholder="Descreva o problema que você encontrou... Ex: 'Ao clicar no botão X, a página não carrega' ou 'O formulário Y não está salvando os dados'"
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                className="min-h-[120px] mt-2"
                data-testid="input-bug-description"
              />
            </div>

            <div>
              <Label htmlFor="bug-attachments">Anexos (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Adicione fotos ou vídeos que ajudem a ilustrar o problema (máx. 3 arquivos, 15MB cada)
              </p>
              <div className="relative">
                <Input
                  id="bug-attachments"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-bug-attachments"
                />
                <label
                  htmlFor="bug-attachments"
                  className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Upload className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    Escolher Ficheiros
                  </span>
                </label>
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Arquivos selecionados:</Label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg border overflow-hidden bg-muted">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={filePreviews[index]}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                data-testid="button-cancel-bug-report"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={reportBugMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-submit-bug-report"
              >
                {reportBugMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Relato
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}