import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user exists
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = usersData?.users?.find((u: any) => u.email === email);

    if (!existingUser) {
      // Don't reveal if user exists or not for security
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = "https://sistema10x.lovable.app";

    // Generate recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${siteUrl}/definir-senha`,
      },
    });

    if (linkError) {
      throw new Error(linkError.message);
    }

    const recoveryLink = linkData?.properties?.action_link;
    if (!recoveryLink) {
      throw new Error("Não foi possível gerar o link de recuperação");
    }

    // Fetch empresa config for branding
    const { data: empresa } = await supabaseAdmin
      .from("empresa_config")
      .select("nome, cor_primaria, email, logo_url")
      .limit(1)
      .single();

    const nomeEmpresa = empresa?.nome || "Sistema";
    const corHex = hslToHex(empresa?.cor_primaria || "350 65% 33%");
    const logoUrl = empresa?.logo_url || "";

    // Send branded email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resend = new Resend(resendApiKey);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, ${corHex}, #1a1a2e); border-radius: 12px;">
          ${logoUrl ? `<img src="${logoUrl}" alt="${nomeEmpresa}" style="max-height: 50px; margin-bottom: 12px;" />` : ""}
          <h1 style="color: white; margin: 0; font-size: 24px;">${nomeEmpresa}</h1>
        </div>
        <div style="padding: 30px 20px;">
          <h2 style="color: #333;">Redefinir Senha</h2>
          <p style="color: #666; line-height: 1.6;">Você solicitou a redefinição da sua senha de acesso ao sistema <strong>${nomeEmpresa}</strong>.</p>
          <p style="color: #666; line-height: 1.6;">Clique no botão abaixo para criar uma nova senha:</p>
          <div style="text-align: center; padding: 20px 0;">
            <a href="${recoveryLink}" style="background: ${corHex}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Redefinir Senha</a>
          </div>
          <p style="color: #999; font-size: 12px;">Se você não solicitou a redefinição, ignore este email. O link expira em 24 horas.</p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: `${nomeEmpresa} <noreply@10xmarketing.com.br>`,
      to: [email],
      subject: `Redefinir senha - ${nomeEmpresa}`,
      html,
    });

    console.log("Password reset email sent to:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-reset-password:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function hslToHex(hsl: string): string {
  const parts = hsl.split(" ");
  const h = parseInt(parts[0]) / 360;
  const s = parseInt(parts[1]) / 100;
  const l = parseInt(parts[2]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
