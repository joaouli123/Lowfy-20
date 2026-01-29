import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone } from "lucide-react";

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export default function PreSellPreview() {
  const [html, setHtml] = useState("");
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [, setLocation] = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');

    if (!sessionId) {
      setLocation('/presell-builder');
      return;
    }

    // Priorizar localStorage (mais confiável entre janelas)
    let savedData = localStorage.getItem(`presell-preview-${sessionId}`);
    
    if (!savedData) {
      savedData = sessionStorage.getItem(`presell-preview-${sessionId}`);
    }

    if (!savedData) {
      setLocation('/presell-builder');
      return;
    }

    try {
      const pageData = JSON.parse(savedData);
      const generatedHTML = generateHTML(pageData);
      setHtml(generatedHTML);
      
      // Limpar localStorage após carregar (evitar acúmulo)
      setTimeout(() => {
        localStorage.removeItem(`presell-preview-${sessionId}`);
        sessionStorage.removeItem(`presell-preview-${sessionId}`);
      }, 1000);
    } catch (error) {
      setLocation('/presell-builder');
    }
  }, [setLocation]);

  const generateHTML = (page: any): string => {
    const elementsHTML = page.elements.map((el: any) => {
      const paddingStyle = `${el.styles?.paddingTop || '0px'} ${el.styles?.paddingRight || '0px'} ${el.styles?.paddingBottom || '0px'} ${el.styles?.paddingLeft || '0px'}`;
      const marginStyle = `${el.styles?.marginTop || '0px'} ${el.styles?.marginRight || '0px'} ${el.styles?.marginBottom || '0px'} ${el.styles?.marginLeft || '0px'}`;

      switch (el.type) {
        case 'headline':
          return `<h1 style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle};">${el.content}</h1>`;
        
        case 'subheadline':
          return `<h2 style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle};">${el.content}</h2>`;
        
        case 'video':
          return `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};"><iframe width="100%" height="400" src="${el.styles?.videoUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        
        case 'text':
          return `<p style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle}; white-space: pre-wrap;">${el.content}</p>`;
        
        case 'button':
          return `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};"><a href="${el.styles?.buttonUrl}" target="_blank" style="display: inline-block; background-color: ${el.styles?.backgroundColor}; color: ${el.styles?.color}; font-size: ${el.styles?.fontSize}; padding: 18px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${el.content}</a></div>`;
        
        case 'image':
          return `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle};"><img src="${el.styles?.imageUrl}" alt="${el.content}" style="max-width: 100%; height: auto; border-radius: 8px;"></div>`;
        
        case 'divider':
          return `<hr style="border: none; border-top: 2px solid #ddd; margin: 30px 0;">`;
        
        case 'countdown':
          return `<div id="${el.id}" style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.countdownTextColor || el.styles?.color}; background-color: ${el.styles?.countdownBgColor || 'transparent'}; padding: ${paddingStyle}; margin: ${marginStyle}; font-weight: bold; border-radius: 8px;">${el.styles?.countdownPrefix || ''}<span class="countdown-time">00:00:00</span></div><script>const countdown${el.id.replace(/-/g, '')} = () => { const end = new Date('${el.styles?.countdownDate}').getTime(); const now = new Date().getTime(); const distance = end - now; if (distance < 0) { document.getElementById('${el.id}').querySelector('.countdown-time').innerHTML = 'EXPIRADO'; return; } const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const seconds = Math.floor((distance % (1000 * 60)) / 1000); document.getElementById('${el.id}').querySelector('.countdown-time').innerHTML = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0'); }; setInterval(countdown${el.id.replace(/-/g, '')}, 1000); countdown${el.id.replace(/-/g, '')}();</script>`;
        
        default:
          return '';
      }
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.name || 'Pre-Sell'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: ${page.settings.fontFamily}; 
      background-color: ${page.settings.backgroundColor}; 
      padding: 0; 
      line-height: 1.6;
    }
    .container { 
      max-width: ${page.settings.maxWidth}; 
      margin: 0 auto; 
      background: white; 
      padding: 40px;
    }
    @media (max-width: 768px) {
      .container { padding: 20px; }
    }
  </style>
  ${page.scripts?.head || ''}
</head>
<body>
  ${page.scripts?.body || ''}
  <div class="container">
    ${elementsHTML}
  </div>
  ${page.scripts?.footer || ''}
</body>
</html>`;
  };

  if (!html) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando preview...</p>
        </div>
      </div>
    );
  }

  const viewportSizes = {
    desktop: 'w-full',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]'
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-center gap-2">
        <Button
          variant={viewport === 'desktop' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewport('desktop')}
          className="gap-2"
        >
          <Monitor className="h-4 w-4" />
          Desktop
        </Button>
        <Button
          variant={viewport === 'tablet' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewport('tablet')}
          className="gap-2"
        >
          <Tablet className="h-4 w-4" />
          Tablet
        </Button>
        <Button
          variant={viewport === 'mobile' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewport('mobile')}
          className="gap-2"
        >
          <Smartphone className="h-4 w-4" />
          Mobile
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <div className={`${viewportSizes[viewport]} transition-all duration-300`}>
          <iframe
            srcDoc={html}
            className="w-full h-full border-0 bg-white shadow-2xl rounded-lg"
            style={{ minHeight: '100vh' }}
            title="Pre-Sell Preview"
          />
        </div>
      </div>
    </div>
  );
}
