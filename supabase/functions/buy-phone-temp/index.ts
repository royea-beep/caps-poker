const TWILIO_SID   = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const BASE = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}`;
const auth = () => "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: {"Access-Control-Allow-Origin":"*"} });
  const { area_code } = await req.json();
  const search = await fetch(`${BASE}/AvailablePhoneNumbers/US/Local.json?AreaCode=${area_code}&SmsEnabled=true&VoiceEnabled=true&Limit=1`, { headers: { Authorization: auth() } });
  const avail = await search.json();
  if (!avail.available_phone_numbers?.length) return Response.json({ error: `No numbers in ${area_code}` }, { status: 404 });
  const number = avail.available_phone_numbers[0].phone_number;
  const buy = await fetch(`${BASE}/IncomingPhoneNumbers.json`, { method:"POST", headers:{"Authorization":auth(),"Content-Type":"application/x-www-form-urlencoded"}, body:`PhoneNumber=${encodeURIComponent(number)}` });
  const data = await buy.json();
  if (!data.phone_number) return Response.json({ error: `Purchase failed: ${JSON.stringify(data).slice(0,200)}` }, { status: 500 });
  const d = data.phone_number.replace(/\D/g,""); const n = d.startsWith("1")?d.slice(1):d;
  const friendly = `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}`;
  return Response.json({ success:true, phone_number: data.phone_number, friendly_name: friendly, area_code, sid: data.sid });
});
