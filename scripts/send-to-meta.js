#!/usr/bin/env node

/**
 * Script para enviar eventos de Purchase para Meta Conversions API
 * 
 * Uso:
 * node scripts/send-to-meta.js '{
 *   "name": "Cliente Name",
 *   "email": "client@email.com",
 *   "phone": "11999999999",
 *   "value": 29700,
 *   "orderId": "order-id-123",
 *   "contentName": "Lowfy Yearly Subscription",
 *   "clientIpAddress": "192.168.1.1",
 *   "clientUserAgent": "Mozilla/5.0...",
 *   "fbp": "fb.2.xxxxx",
 *   "fbc": null
 * }'
 */

const crypto = require('crypto');

// Config
const META_PIXEL_ID = '1097300724975493';
const API_VERSION = 'v21.0';
const accessToken = process.env.META_ACCESS_TOKEN;

if (!accessToken) {
  console.error('❌ META_ACCESS_TOKEN não configurado!');
  console.error('Defina a variável de ambiente: export META_ACCESS_TOKEN="seu-token"');
  process.exit(1);
}

function hashData(data) {
  if (!data) return undefined;
  return crypto.createHash('sha256').update(String(data).toLowerCase().trim()).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

async function sendToMeta(saleData) {
  console.log('\n🚀 ENVIANDO PARA META CONVERSIONS API\n');
  console.log('═'.repeat(50));
  console.log('📊 DADOS DA VENDA');
  console.log('═'.repeat(50));
  console.log('👤 Cliente:', saleData.name);
  console.log('📧 Email:', saleData.email);
  console.log('💰 Valor:', 'R$' + (saleData.value / 100).toLocaleString('pt-BR'));
  console.log('📱 Telefone:', saleData.phone || 'Não informado');
  console.log('🆔 Order ID:', saleData.orderId);
  console.log('═'.repeat(50) + '\n');
  
  const eventTime = Math.floor(Date.now() / 1000);
  
  const userData = {
    em: hashData(saleData.email),
    external_id: saleData.userId ? hashData(saleData.userId) : undefined,
  };
  
  if (saleData.phone) {
    userData.ph = hashData(normalizePhone(saleData.phone));
  }
  
  if (saleData.name) {
    const [firstName, ...lastNameParts] = saleData.name.split(' ');
    userData.fn = hashData(firstName);
    if (lastNameParts.length > 0) {
      userData.ln = hashData(lastNameParts.join(' '));
    }
  }
  
  // Adicionar EMQ data se disponível
  if (saleData.clientIpAddress) {
    userData.client_ip_address = saleData.clientIpAddress;
  }
  if (saleData.clientUserAgent) {
    userData.client_user_agent = saleData.clientUserAgent;
  }
  if (saleData.fbp) {
    userData.fbp = saleData.fbp;
  }
  if (saleData.fbc) {
    userData.fbc = saleData.fbc;
  }
  
  const eventData = {
    event_name: 'Purchase',
    event_time: eventTime,
    action_source: 'website',
    user_data: userData,
    custom_data: {
      currency: 'BRL',
      value: saleData.value / 100,
      content_name: saleData.contentName || 'Lowfy Subscription',
      content_ids: saleData.contentIds || ['subscription'],
      content_type: 'product',
      order_id: saleData.orderId,
      num_items: 1,
    },
    event_source_url: saleData.eventSourceUrl || 'https://lowfy.com.br/',
  };
  
  const payload = {
    data: [eventData],
    access_token: accessToken,
  };
  
  const url = `https://graph.facebook.com/${API_VERSION}/${META_PIXEL_ID}/events`;
  
  console.log('⏳ Enviando para Meta...\n');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    
    console.log('═'.repeat(50));
    console.log('✅ RESPOSTA DO META');
    console.log('═'.repeat(50));
    console.log('HTTP Status:', response.status);
    console.log('Events Received:', result.events_received);
    console.log('FBTrace ID:', result.fbtrace_id);
    console.log('═'.repeat(50) + '\n');
    
    if (response.ok && result.events_received === 1) {
      console.log('🎉 SUCESSO! Evento enviado para Meta com sucesso!\n');
      console.log('Você pode rastrear em:');
      console.log('👉 Meta Ads Manager → Events Manager');
      console.log('👉 FBTrace ID para debug:', result.fbtrace_id);
      console.log('👉 Verificação em ~5-10 minutos\n');
      return true;
    } else {
      console.log('⚠️ AVISO: Status 200 mas pode haver erro:');
      console.log('Messages:', result.messages || 'Nenhuma mensagem');
      return false;
    }
  } catch (err) {
    console.error('\n❌ ERRO NA CHAMADA:');
    console.error('Message:', err.message);
    console.error('\n💡 Dicas:');
    console.error('1. Verifique se META_ACCESS_TOKEN está configurado');
    console.error('2. Verifique sua conexão com internet');
    console.error('3. Verifique se os dados JSON estão válidos\n');
    return false;
  }
}

// Executar se chamado via linha de comando
if (process.argv[2]) {
  try {
    const data = JSON.parse(process.argv[2]);
    sendToMeta(data).then(success => process.exit(success ? 0 : 1));
  } catch (err) {
    console.error('❌ ERRO ao fazer parse do JSON:');
    console.error(err.message);
    console.error('\n💡 Verifique se o JSON está válido:');
    console.error('Exemplo: node scripts/send-to-meta.js \'{"name":"Cliente","email":"x@y.com","value":29700,"orderId":"123"}\'\n');
    process.exit(1);
  }
} else {
  console.error('❌ Uso: node scripts/send-to-meta.js \'<JSON-DATA>\'\n');
  console.error('Exemplo:');
  console.error('node scripts/send-to-meta.js \'{');
  console.error('  "name": "João Silva",');
  console.error('  "email": "joao@email.com",');
  console.error('  "phone": "11999999999",');
  console.error('  "value": 29700,');
  console.error('  "orderId": "sub-123",');
  console.error('  "contentName": "Lowfy Yearly",');
  console.error('  "clientIpAddress": "192.168.1.1",');
  console.error('  "clientUserAgent": "Mozilla/5.0...",');
  console.error('  "fbp": "fb.2.xxxxx",');
  console.error('  "fbc": null');
  console.error('}\'\n');
  process.exit(1);
}

module.exports = { sendToMeta };
