import { sendFacebookConversionEvent } from "../server/services/facebookConversions";

const eventData = {
  email: "iven.digital@gmail.com",
  phone: "85987654321",
  firstPurchaseTime: new Date("2025-12-15T19:14:56"),
  value: 99.90,
  currency: "BRL",
  clientIpAddress: "186.216.103.112",
  clientUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  fbc: "fb.2.1764765660431.89258351179148987",
  fbp: "fb.2.1764765660431.89258351179148987",
};

console.log("Enviando evento Meta corrigido para Rafael...");
sendFacebookConversionEvent(eventData)
  .then((result) => {
    console.log("✅ Sucesso!", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
