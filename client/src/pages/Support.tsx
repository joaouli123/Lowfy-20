import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Clock, 
  MessageCircle,
  Mail,
  MessageSquare,
  Check
} from "lucide-react";
import { insertSupportTicketSchema, type InsertSupportTicket } from "@shared/schema";

const faqItems = [
  {
    question: "Como faço para acessar as ferramentas IA?",
    answer: "Para acessar as ferramentas IA, vá até a página 'Ferramentas IA' no menu lateral. Lá você encontrará os logins e senhas de acesso global para todas as ferramentas disponíveis."
  },
  {
    question: "O que fazer se o login não estiver funcionando?",
    answer: "Se algum login não estiver funcionando, clique no botão 'Reportar Problema com Login' na página de ferramentas. Nossa equipe será notificada e atualizará os acessos o mais rápido possível."
  },
  {
    question: "As ferramentas podem ficar offline?",
    answer: "Sim, eventualmente as ferramentas podem cair. O prazo de retorno é de poucas horas para restabelecer o serviço. Caso uma ferramenta esteja OFF em um acesso, tente no outro acesso."
  },
  {
    question: "Como posso acessar meus cursos?",
    answer: "Acesse a página 'Cursos' no menu lateral. Lá você encontrará todos os cursos disponíveis com informações sobre duração, número de aulas e como acessá-los."
  },
  {
    question: "Qual é o horário de atendimento do suporte?",
    answer: "Nosso suporte está disponível de segunda a sexta-feira, das 9h às 18h. Respondemos e-mails em até 2 horas durante o horário comercial."
  },
  {
    question: "Como funciona o sistema de PLR?",
    answer: "Os PLRs (Private Label Rights) são conteúdos digitais que você pode usar, modificar e revender. Acesse a página 'PLRs' para explorar todo o catálogo organizado por categoria e idioma."
  }
];

export default function Support() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const form = useForm<InsertSupportTicket>({
    resolver: zodResolver(insertSupportTicketSchema.extend({
      subject: insertSupportTicketSchema.shape.subject.refine(val => val !== "", "Campo obrigatório"),
    })),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertSupportTicket) => {
      await apiRequest("POST", "/api/support/tickets", data);
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada!",
        description: "Recebemos sua mensagem e entraremos em contato em breve.",
      });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertSupportTicket) => {
    mutation.mutate(data, {
      onSuccess: () => {
        setIsEmailDialogOpen(false);
      },
    });
  };

  const filteredFAQs = useMemo(() => 
    faqItems.filter(item => 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    ), [searchQuery]
  );

  return (
    <div className="min-h-screen bg-background" data-testid="support-page">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Central de Suporte</h1>
          <p className="text-xl text-muted-foreground">
            Encontre respostas rápidas e suporte personalizado para todas as suas necessidades
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto px-4 mb-12">
        <div>
          {/* Contact Options */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="border-2 hover:border-emerald-700 transition-all">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
                </div>
                    <h3 className="text-xl font-semibold mb-2">Chat ao Vivo</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Resposta imediata com nossa equipe</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      Segundas a 6hs às 18h
                    </p>
                    <p className="text-sm text-gray-500 mb-4 flex items-center justify-center gap-2">
                      <Check className="w-4 h-4 text-emerald-700" />
                      Online agora
                    </p>
                    <Button className="w-full bg-emerald-700 hover:bg-emerald-800" data-testid="button-start-chat">
                      Iniciar Chat
                    </Button>
                  </CardContent>
                </Card>

                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                  <DialogTrigger asChild>
                    <Card className="border-2 hover:border-emerald-700 transition-all cursor-pointer">
                      <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Mail className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">E-mail</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">Envie sua dúvida detalhadamente</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4 flex items-center justify-center gap-2">
                          <Clock className="w-4 h-4" />
                          Resposta em até 24h
                        </p>
                        <p className="text-sm text-gray-500 mb-4 flex items-center justify-center gap-2">
                          <Check className="w-4 h-4 text-emerald-700" />
                          Disponível
                        </p>
                        <Button className="w-full bg-emerald-700 hover:bg-emerald-800" data-testid="button-send-email">
                          Enviar E-mail
                        </Button>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold">Enviar E-mail</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="support-form">
                        <div className="grid md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome Completo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Seu nome" {...field} data-testid="input-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>E-mail</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="seu@email.com" {...field} data-testid="input-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Assunto</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-subject">
                                    <SelectValue placeholder="Selecione o assunto" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Dúvidas">Dúvidas</SelectItem>
                                  <SelectItem value="Sugestão">Sugestão</SelectItem>
                                  <SelectItem value="Suporte">Suporte</SelectItem>
                                  <SelectItem value="Financeiro">Financeiro</SelectItem>
                                  <SelectItem value="Vagas">Vagas</SelectItem>
                                  <SelectItem value="Outro">Outro</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mensagem</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Descreva sua dúvida ou problema em detalhes..."
                                  rows={6}
                                  {...field}
                                  data-testid="textarea-message"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full bg-emerald-700 hover:bg-emerald-800 h-12 text-lg"
                          disabled={mutation.isPending}
                          data-testid="button-submit-support"
                        >
                          {mutation.isPending ? "Enviando..." : "Enviar Mensagem"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                <Card className="border-2 hover:border-emerald-700 transition-all">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">WhatsApp</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Suporte direto via mensagem</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-4 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      Resposta em até 2h
                    </p>
                    <p className="text-sm text-gray-500 mb-4 flex items-center justify-center gap-2">
                      <Check className="w-4 h-4 text-emerald-700" />
                      Online agora
                    </p>
                    <Button 
                      className="w-full bg-emerald-700 hover:bg-emerald-800" 
                      data-testid="button-whatsapp"
                      onClick={() => window.open("https://wa.me/5541999077637?text=Ol%C3%A1%2C%20poderia%20me%20ajudar%3F", "_blank")}
                    >
                      Abrir WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
      </div>
    </div>
  );
}
