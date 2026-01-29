import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft, Loader2, Sparkles, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  productName: z.string().min(3, "Nome do produto deve ter pelo menos 3 caracteres").max(60, "Máximo de 60 caracteres"),
  productPrice: z.string().min(1, "Preço é obrigatório"),
  productDescription: z.string().min(20, "Descrição deve ter pelo menos 20 caracteres").max(90, "Máximo de 90 caracteres"),
  painPoint: z.string().min(20, "Descreva a dor que o produto resolve").max(180, "Máximo de 180 caracteres"),
  objective: z.enum(["sales", "leads", "traffic", "engagement", "awareness", "messages", "app_promotion"]),
  destinationUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  hasPixelConfigured: z.boolean().default(false),
  targetAgeRange: z.string().optional(),
  targetGender: z.string().optional(),
  targetLocation: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  {
    id: 1,
    title: "Dados do Produto",
    description: "Informações básicas sobre o que você está vendendo",
  },
  {
    id: 2,
    title: "Objetivo da Campanha",
    description: "O que você deseja alcançar com os anúncios",
  },
  {
    id: 3,
    title: "Público-Alvo (Opcional)",
    description: "Informações básicas para criar criativos mais direcionados",
  },
];

export default function CreateCampaignWizard({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: "",
      productPrice: "",
      productDescription: "",
      painPoint: "",
      objective: "sales",
      destinationUrl: "",
      hasPixelConfigured: false,
      targetAgeRange: "",
      targetGender: "",
      targetLocation: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const priceValue = parseFloat(data.productPrice.replace(/\./g, '').replace(',', '.'));
      const response = await apiRequest('POST', '/api/meta-ads/campaigns', {
        ...data,
        productPrice: priceValue,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta-ads/campaigns'] });
      toast({
        title: "Campanha criada com sucesso!",
        description: "Seus criativos foram gerados pela IA e estão prontos para usar.",
      });
      form.reset();
      setCurrentStep(1);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar campanha",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  const nextStep = async () => {
    const fields = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fields);

    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getFieldsForStep = (step: number): (keyof FormValues)[] => {
    switch (step) {
      case 1:
        return ["productName", "productPrice", "productDescription", "painPoint"];
      case 2:
        return ["objective"];
      case 3:
        return [];
      default:
        return [];
    }
  };

  const isLastStep = currentStep === STEPS.length;

  return (
    <div className="space-y-6">
      {!createMutation.isPending && (
        <div className="flex items-center mb-6">
          {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  currentStep > step.id
                    ? "bg-green-600 text-white"
                    : currentStep === step.id
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                }`}
              >
                {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
              </div>
              <p className="text-xs mt-2 text-center w-full px-1">{step.title}</p>
            </div>
            {index < STEPS.length - 1 && (
              <div className="flex-1 h-1 mx-4 bg-gray-200 dark:bg-gray-700 mt-[-20px]">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: currentStep > step.id ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        ))}
        </div>
      )}

      {!createMutation.isPending && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{STEPS[currentStep - 1].title}</h3>
          <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].description}</p>
        </div>
      )}

      {createMutation.isPending ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Gerando Criativos com IA...</h3>
          <p className="text-sm text-muted-foreground text-center">
            Estamos criando criativos otimizados para sua campanha. Isso pode levar alguns segundos.
          </p>
        </div>
      ) : (
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {currentStep === 1 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Produto *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Guia Completo do Autismo para Pais" 
                          maxLength={60}
                          {...field} 
                          data-testid="input-product-name" 
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value.length}/60 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Produto (R$) *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="0,00"
                          value={field.value}
                          onChange={(e) => {
                            const formatted = formatCurrency(e.target.value);
                            field.onChange(formatted);
                          }}
                          data-testid="input-product-price" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sobre seu produto/serviço *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva os benefícios do seu produto de forma clara e objetiva"
                          className="min-h-20"
                          maxLength={90}
                          {...field}
                          data-testid="input-product-description"
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value.length}/90 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="painPoint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dor que Resolve *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ex: Ajuda pais perdidos com o diagnóstico de autismo a entender e apoiar seus filhos"
                          className="min-h-20"
                          maxLength={180}
                          {...field}
                          data-testid="input-pain-point"
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value.length}/180 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <FormField
                  control={form.control}
                  name="objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objetivo Principal *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-objective">
                            <SelectValue placeholder="Selecione o objetivo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sales">Vendas (Conversões)</SelectItem>
                          <SelectItem value="leads">Gerar Leads</SelectItem>
                          <SelectItem value="traffic">Tráfego para Site</SelectItem>
                          <SelectItem value="messages">Mensagens (WhatsApp/Messenger)</SelectItem>
                          <SelectItem value="engagement">Engajamento (Curtidas, Comentários)</SelectItem>
                          <SelectItem value="awareness">Reconhecimento de Marca</SelectItem>
                          <SelectItem value="app_promotion">Promoção de App</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Escolha o principal resultado que você quer alcançar
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destinationUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link de Destino (Opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://seusite.com/produto"
                          {...field}
                          data-testid="input-destination-url"
                        />
                      </FormControl>
                      <FormDescription>
                        URL da página de vendas ou captura de leads
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hasPixelConfigured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Pixel ou API Configurada?
                        </FormLabel>
                        <FormDescription>
                          Você já tem o pixel do Meta ou Conversions API configurados?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-has-pixel"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg mb-4 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                    <strong>Atenção:</strong> O Meta agora utiliza o motor de personalização Andromeda, um mecanismo de retrieval baseado em IA generativa, que identifica automaticamente o público com maior probabilidade de conversão — em tempo real — analisando milhões de sinais comportamentais (interações, intenções de compra, contexto e histórico de engajamento).
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                    O sistema aprende sozinho e otimiza automaticamente os resultados.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="targetAgeRange"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Faixa Etária (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 25-45 anos" {...field} data-testid="input-age-range" />
                      </FormControl>
                      <FormDescription>
                        Qual a idade média do seu público?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetGender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gênero (Opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue placeholder="Selecione se aplicável" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="male">Masculino</SelectItem>
                          <SelectItem value="female">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Brasil, São Paulo" {...field} data-testid="input-location" />
                      </FormControl>
                      <FormDescription>
                        Onde seu público está localizado?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1 || createMutation.isPending}
              data-testid="button-prev-step"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>

            {!isLastStep ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={createMutation.isPending}
                data-testid="button-next-step"
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="gap-2 bg-green-600 hover:bg-green-700"
                data-testid="button-create-campaign"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando Criativos...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Criar Campanha com IA
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
      )}
    </div>
  );
}