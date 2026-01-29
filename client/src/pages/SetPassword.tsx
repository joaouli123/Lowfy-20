
import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";

export default function SetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Parse query params from URL
  const searchParams = new URLSearchParams(window.location.search);
  const email = searchParams.get("email") || "";
  const tempPassword = searchParams.get("temp") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const setPasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("As senhas não coincidem");
      }

      if (newPassword.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres");
      }

      // Fazer login com senha temporária primeiro
      const loginRes = await apiRequest("POST", "/api/auth/login", {
        email,
        password: tempPassword,
      });

      // Atualizar senha
      await apiRequest("PUT", "/api/auth/change-password", {
        newPassword,
      });

      return loginRes;
    },
    onSuccess: () => {
      toast({
        title: "✅ Senha definida com sucesso!",
        description: "Você será redirecionado para o dashboard.",
      });
      
      setTimeout(() => {
        navigate("/dashboard");
        window.location.reload();
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro ao definir senha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Defina sua Senha</CardTitle>
          <CardDescription>
            Crie uma senha segura para acessar sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPasswordMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                disabled
                className="bg-gray-100"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div>
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <Label>Confirmar Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                  required
                  className="pr-10"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <Lock className="w-4 h-4 inline mr-2" />
              Sua senha deve ter no mínimo 6 caracteres
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={setPasswordMutation.isPending}
            >
              {setPasswordMutation.isPending ? "Salvando..." : "Definir Senha e Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
