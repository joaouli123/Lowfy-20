import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export function LovableCreditsPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const sessionKey = `lovable_popup_shown_${user.id}`;
    const hasBeenShown = sessionStorage.getItem(sessionKey);

    if (!hasBeenShown) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem(sessionKey, "true");
      }, 3000); // Mostra após 3 segundos
      return () => clearTimeout(timer);
    }
  }, [user]);

  const creditOptions = [
    {
      credits: 100,
      price: "39,90",
      link: "https://mpago.la/1qMZAD1",
      image: "/credits-100.png",
    },
    {
      credits: 300,
      price: "79,90",
      link: "https://mpago.la/2EX4sHB",
      image: "/credits-300.png",
    },
    {
      credits: 500,
      price: "129,90",
      link: "https://mpago.la/1FpMznD",
      image: "/credits-500.png",
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none bg-zinc-950">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold text-white text-center">
            Créditos Lovable
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-center text-base">
            Turbine seus projetos com créditos extras!
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 grid grid-cols-1 gap-4">
          {creditOptions.map((option) => (
            <Card key={option.credits} className="bg-zinc-900 border-zinc-800 hover:border-primary/50 transition-colors overflow-hidden">
              <CardContent className="p-0 flex items-center">
                <div className="w-24 h-24 shrink-0">
                  <img 
                    src={option.image} 
                    alt={`${option.credits} créditos`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 p-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-white leading-none mb-1">
                      {option.credits} Créditos
                    </h4>
                    <p className="text-primary font-semibold">
                      R$ {option.price}
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white font-bold px-6"
                    onClick={() => window.open(option.link, "_blank")}
                  >
                    Comprar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-300">
            Talvez mais tarde
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
