/**
 * Lowfy Custom Domain Proxy - Cloudflare Worker v2.0.0
 * 
 * SISTEMA SIMPLIFICADO:
 * - Usuários configuram apenas 1 CNAME apontando para proxy.lowfy.com.br
 * - SSL é automático via Cloudflare proxy do usuário (nuvem laranja)
 * - Cada subdomínio é tratado como único (www.site.com ≠ site.com ≠ loja.site.com)
 * 
 * FLUXO:
 * 1. Requisição chega no domínio do usuário
 * 2. Cloudflare do usuário faz proxy para proxy.lowfy.com.br
 * 3. Este Worker consulta /api/domain-lookup/{hostname} no Lowfy
 * 4. Se encontrar, faz proxy para a página correspondente
 * 5. Se não encontrar, mostra página de "domínio não configurado"
 */

const LOWFY_ORIGIN = 'https://lowfy.com.br';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname;
    
    // Bypass para domínio principal do Lowfy
    if (hostname === 'lowfy.com.br' || hostname === 'www.lowfy.com.br') {
      return fetch(request);
    }
    
    // Status do Worker
    if (hostname.includes('workers.dev') || hostname === 'proxy.lowfy.com.br') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'Lowfy Custom Domain Proxy',
        version: '2.1.0',
        instructions: 'Configure seu domínio com CNAME apontando para proxy.lowfy.com.br com proxy ativado (nuvem laranja)'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ACME Challenge para validação SSL - Cloudflare for SaaS HTTP validation
    // Essas requisições vêm do Cloudflare para validar o certificado SSL
    if (pathname.startsWith('/.well-known/acme-challenge/') || 
        pathname.startsWith('/.well-known/cf-custom-hostname-challenge/')) {
      
      // Fazer proxy da requisição ACME para o Lowfy processar
      const acmeUrl = `${LOWFY_ORIGIN}${pathname}`;
      const acmeResponse = await fetch(acmeUrl, {
        method: 'GET',
        headers: {
          'Host': 'lowfy.com.br',
          'User-Agent': 'Lowfy-Proxy/2.1.0',
          'X-Original-Host': hostname,
          'X-ACME-Validation': 'true'
        }
      });
      
      // Se o Lowfy responder com o challenge, retornar
      if (acmeResponse.ok) {
        const body = await acmeResponse.text();
        return new Response(body, {
          status: 200,
          headers: { 
            'Content-Type': 'text/plain',
            'X-Served-By': 'Lowfy-Proxy-ACME'
          }
        });
      }
      
      // Fallback: tentar buscar o challenge do Cloudflare API
      // O Cloudflare for SaaS espera que respondamos com o token correto
      console.log(`ACME challenge for ${hostname}: ${pathname}`);
      return new Response('', { status: 404 });
    }
    
    try {
      // Consultar API do Lowfy para descobrir qual página servir
      // Passa o hostname EXATO (sem normalização de www)
      const lookupResponse = await fetch(`${LOWFY_ORIGIN}/api/domain-lookup/${encodeURIComponent(hostname)}`, {
        headers: {
          'Host': 'lowfy.com.br',
          'User-Agent': 'Lowfy-Proxy/2.0.0'
        }
      });
      
      if (!lookupResponse.ok) {
        console.error('Lookup failed:', lookupResponse.status);
        return new Response('Erro ao consultar domínio', { status: 502 });
      }
      
      const lookupData = await lookupResponse.json();
      
      if (!lookupData.found) {
        return new Response(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Domínio não configurado</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); }
              .container { text-align: center; padding: 40px; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); max-width: 500px; margin: 20px; }
              h1 { color: #29654F; margin-bottom: 16px; font-size: 24px; }
              p { color: #666; line-height: 1.8; margin: 12px 0; }
              .domain { background: #f0f0f0; padding: 8px 16px; border-radius: 8px; font-family: monospace; display: inline-block; margin: 8px 0; }
              a { color: #29654F; text-decoration: none; font-weight: 600; }
              a:hover { text-decoration: underline; }
              .footer { margin-top: 24px; font-size: 12px; color: #999; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🔗 Domínio não configurado</h1>
              <p>O domínio</p>
              <div class="domain">${hostname}</div>
              <p>não está vinculado a nenhuma página no Lowfy.</p>
              <p>Se você é o dono deste domínio, acesse sua conta no <a href="${LOWFY_ORIGIN}">Lowfy</a> e configure o domínio na sua página.</p>
              <div class="footer">Lowfy Proxy v2.0.0</div>
            </div>
          </body>
          </html>
        `, {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      
      // Construir URL da página no Lowfy
      const targetUrl = `${LOWFY_ORIGIN}${lookupData.path}${url.search}`;
      
      // Fazer requisição para o Lowfy
      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: {
          'Accept': request.headers.get('Accept') || '*/*',
          'Accept-Language': request.headers.get('Accept-Language') || 'pt-BR',
          'User-Agent': request.headers.get('User-Agent') || 'Lowfy-Proxy/2.0.0',
          'X-Original-Host': hostname,
          'X-Forwarded-Host': hostname,
          'X-Forwarded-Proto': 'https',
          'Host': 'lowfy.com.br'
        },
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        redirect: 'manual'
      });
      
      const response = await fetch(proxyRequest);
      
      // Copiar resposta e ajustar headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Served-By', 'Lowfy-Proxy');
      responseHeaders.set('X-Proxy-Version', '2.0.0');
      responseHeaders.delete('x-frame-options');
      
      // Processar a resposta
      let body = response.body;
      const contentType = response.headers.get('content-type') || '';
      
      // Se for HTML, ajustar URLs
      if (contentType.includes('text/html')) {
        const html = await response.text();
        body = html
          .replace(/https:\/\/lowfy\.com\.br\/pages\//g, '/')
          .replace(/https:\/\/lowfy\.com\.br\/presell\//g, '/')
          .replace(/href="https:\/\/lowfy\.com\.br\/(assets|uploads|static)/g, `href="${LOWFY_ORIGIN}/$1`)
          .replace(/src="https:\/\/lowfy\.com\.br\/(assets|uploads|static)/g, `src="${LOWFY_ORIGIN}/$1`);
      }
      
      // Ajustar Location header em caso de redirect
      if (responseHeaders.has('location')) {
        const location = responseHeaders.get('location');
        if (location) {
          const newLocation = location
            .replace(/https:\/\/lowfy\.com\.br\/pages\/[^\/\?]+/g, `https://${hostname}`)
            .replace(/https:\/\/lowfy\.com\.br\/presell\/[^\/\?]+/g, `https://${hostname}`);
          responseHeaders.set('location', newLocation);
        }
      }
      
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
      
    } catch (error) {
      console.error('Proxy error:', error);
      return new Response(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Erro temporário</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            h1 { color: #e53e3e; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>⚠️ Erro temporário</h1>
            <p>Não foi possível carregar a página. Tente novamente em alguns segundos.</p>
            <p style="color: #999; font-size: 12px;">Proxy v2.0.0</p>
          </div>
        </body>
        </html>
      `, {
        status: 502,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }
};
