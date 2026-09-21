import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");

    // Auth Token we are checking (removes "Bearer " prefix if present)
    const token = (authHeader?.replace("Bearer ", "") || apiKey || "").trim();

    // Standard Supabase Secrets + Custom N8N Bypass Secret
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
    const n8nBypassToken = Deno.env.get("N8N_TOKEN") || "";

    // If it's the Service Role key OR our custom N8N_TOKEN, it's a "ServiceRole" bypass
    const isServiceRole = (token !== "" && (token === serviceRoleKey.trim() || (n8nBypassToken !== "" && token === n8nBypassToken.trim())));

    console.log("Verificando autenticação:", {
      isServiceRole,
      hasToken: !!token,
      matchedServiceRole: (token !== "" && token === serviceRoleKey.trim()),
      matchedN8nToken: (n8nBypassToken !== "" && token === n8nBypassToken.trim())
    });

    if (!token) {
      console.error("Negado: Falta cabeçalho Authorization ou apikey");
      return new Response(JSON.stringify({ error: "Cabeçalhos de autenticação ausentes" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let inviterUser: any = null;

    if (!isServiceRole) {
      // Use the service role admin client to validate the user's JWT token securely.
      // This avoids issues with the anon client failing to parse the Authorization header.
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const jwt = token;
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);

      console.log("JWT verification:", { hasUser: !!user, error: userError?.message });

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado - sessão inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inviterUser = user;

      // Check user roles using admin client (bypasses RLS so it always works)
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id);
      console.log("User roles found:", roles);
      const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "super_admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores podem convidar usuários" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const {
      email,
      nome,
      perfil_acesso_id,
      role,
      unidade_id,
      empresa_id,
      new_company_name, // Optional: for n8n/provisioning
      plano_id,         // Optional: for n8n/provisioning
      asaas_customer_id // Optional: for n8n/provisioning
    } = await req.json();
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

    // Generate invite link with redirect to set-password page
    const siteUrl = "https://10xmarketing.space";
    let inviteLink: string | undefined;
    let invitedUser: any = null;

    // Provision new company if requested (e.g. from n8n checkout)
    let targetEmpresaId = empresa_id || null;

    if (new_company_name && !targetEmpresaId) {
      console.log("Provisioning new company:", new_company_name);
      const { data: newEmpresa, error: empError } = await supabaseAdmin
        .from("empresas")
        .insert({
          nome: new_company_name,
          slug: `${slugify(new_company_name)}-${Math.random().toString(36).substring(2, 7)}`,
          email: email,
          plano_id: plano_id || null,
          asaas_customer_id: asaas_customer_id || null,
          status: "active",
          acesso_liberado: true,
          onboarding_completo: true
        })
        .select()
        .single();

      if (empError) throw new Error("Erro ao criar empresa: " + empError.message);
      targetEmpresaId = newEmpresa.id;

      // Create default unit
      await supabaseAdmin.from("unidades").insert({
        empresa_id: targetEmpresaId,
        nome: "Matriz",
        status: "active"
      });

      // Create default email templates for the new company
      await supabaseAdmin.from("email_config").insert([
        {
          empresa_id: targetEmpresaId,
          tipo: "convite_usuario",
          assunto: "Você foi convidado para {{nome_empresa}}",
          corpo_html: `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <center>
    <div style="max-width: 600px; margin: 40px auto; background-color: #121212; border-radius: 24px; overflow: hidden; border: 1px solid #2a2a2a; box-shadow: 0 30px 60px rgba(0,0,0,0.8);">
      
      <div style="width: 100%; height: 200px; background-image: url('https://10xmarketing.com.br/images/link-preview.jpg'); background-size: cover; background-position: center; position: relative;">
        <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, transparent, #121212);"></div>
        <div style="position: absolute; bottom: 15px; width: 100%; text-align: center;">
             <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">{{nome_empresa}}</h1>
        </div>
      </div>

      <div style="padding: 40px 30px; text-align: center;">
        <h2 style="color: #a855f7; font-size: 26px; margin-bottom: 10px; font-weight: 300;">Olá, <strong>{{nome_cliente}}</strong>! 👋</h2>
        
        <p style="color: #a1a1aa; line-height: 1.8; font-size: 16px; margin-bottom: 30px;">
          Seja muito bem-vindo(a) ao seu novo ecossistema de marketing. Estamos felizes em tê-lo(a) como nosso(a) novo(a) assinante!
        </p>

        <div style="background: rgba(168, 85, 247, 0.05); border-radius: 20px; padding: 30px; border: 1px solid rgba(168, 85, 247, 0.2);">
          
          <a href="{{link_login}}" style="display: block; padding: 16px 30px; background: linear-gradient(90deg, #9333ea, #7e22ce); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; box-shadow: 0 10px 20px rgba(147, 51, 234, 0.3);">
            Acessar o Sistema
          </a>

          <a href="{{link_definir_senha}}" style="display: block; padding: 14px 30px; background: transparent; color: #a855f7; text-decoration: none; border-radius: 12px; font-weight: bold; border: 2px solid #a855f7; text-transform: uppercase; letter-spacing: 1px;">
            Definir Minha Senha
          </a>

          <p style="margin: 20px 0 0; color: #71717a; font-size: 13px;">
            Utilize os botões acima para configurar seu acesso e começar.
          </p>
        </div>

        <div style="margin-top: 30px; padding: 20px; border-top: 1px solid #2a2a2a;">
          <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">📱 Agendamento Facilitado</p>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
            Dentro da plataforma, você poderá agendar seus atendimentos e acompanhar o status dos seus serviços em tempo real.
          </p>
        </div>
      </div>

      <div style="padding: 30px; background-color: #0a0a0a; text-align: center; border-top: 1px solid #1e1e1e;">
        <p style="color: #475569; font-size: 12px; margin: 0; letter-spacing: 1px;">
          {{nome_empresa}} - Estratégia e Escala<br>
          Obrigado pela preferência!
        </p>
      </div>
    </div>
  </center>
</body>
</html>`,
        },
        {
          empresa_id: targetEmpresaId,
          tipo: "lembrete_agendamento",
          assunto: "Lembrete: Seu agendamento em {{nome_empresa}} é amanhã!",
          corpo_html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="text-align:center;padding:30px 0;background:linear-gradient(135deg,{{cor_primaria}},#1a1a2e);border-radius:12px;"><h1 style="color:white;margin:0;font-size:24px;">{{nome_empresa}}</h1></div><div style="padding:30px 20px;"><h2 style="color:#333;">Lembrete de Agendamento</h2><p style="color:#666;">Olá <strong>{{nome_cliente}}</strong>,</p><div style="background:#f8f8f8;border-radius:8px;padding:20px;margin:16px 0;"><p style="margin:4px 0;color:#333;"><strong>📅 Data:</strong> {{data_agendamento}}</p><p style="margin:4px 0;color:#333;"><strong>⏰ Horário:</strong> {{horario_agendamento}}</p><p style="margin:4px 0;color:#333;"><strong>✂️ Serviço:</strong> {{servico}}</p><p style="margin:4px 0;color:#333;"><strong>👤 Profissional:</strong> {{profissional}}</p></div></div></div>',
          horas_antes: 24,
        },
      ]);
    }

    // Resolve empresa_id if not provided and not a new company.
    // IMPORTANT: super_admin should NEVER inherit empresa_id from the inviter — they are global.
    const assignedRole = role || "barber";
    const isSuperAdminRole = assignedRole === "super_admin";

    if (!isSuperAdminRole && !targetEmpresaId && inviterUser) {
      const { data: inviterRole } = await supabaseAdmin
        .from("user_roles")
        .select("empresa_id")
        .eq("user_id", inviterUser.id)
        .not("role", "eq", "super_admin")
        .maybeSingle();
      targetEmpresaId = inviterRole?.empresa_id || null;
    }
    // For super_admin, force empresa_id to null regardless
    if (isSuperAdminRole) targetEmpresaId = null;

    // Get empresa slug for branded redirect
    let empresaSlug: string | null = null;
    if (targetEmpresaId) {
      const { data: empresaData } = await supabaseAdmin
        .from("empresas")
        .select("slug")
        .eq("id", targetEmpresaId)
        .single();
      empresaSlug = empresaData?.slug || null;
    }

    const redirectUrl = `${siteUrl}/definir-senha${empresaSlug ? `?slug=${empresaSlug}` : ""}`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError) {
      // If user already exists, generate a magic link instead to allow re-invite
      if (linkError.message?.includes("already been registered") || (linkError as any).code === "email_exists") {
        console.log("User already exists, generating magic link for:", email);

        // Find existing user
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = usersData?.users?.find((u: any) => u.email === email);

        if (existingUser) {
          invitedUser = existingUser;

          // Generate a password reset link so they can set their password
          const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
            options: {
              redirectTo: redirectUrl,
            },
          });

          if (resetError) {
            console.error("Generate recovery link error:", resetError);
            return new Response(JSON.stringify({ error: resetError.message }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          inviteLink = resetData?.properties?.action_link;
        } else {
          return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        console.error("Generate link error:", linkError);
        return new Response(JSON.stringify({ error: linkError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      inviteLink = linkData?.properties?.action_link;
      invitedUser = linkData?.user;
    }

    // targetEmpresaId already resolved above

    // Build the login URL for the email (slug-based if available)
    const loginUrl = empresaSlug ? `${siteUrl}/login/${empresaSlug}` : `${siteUrl}/login`;

    // Send custom branded email via Resend
    await sendCustomInviteEmail(supabaseAdmin, email, inviteLink || "#", loginUrl, targetEmpresaId, nome);

    // Save the invite record
    await supabaseAdmin.from("convites").insert({
      email,
      perfil_acesso_id: perfil_acesso_id || null,
      convidado_por: inviterUser?.id || null,
      empresa_id: targetEmpresaId,
      status: "pendente",
    });

    if (invitedUser) {
      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("id, role, empresa_id")
        .eq("user_id", invitedUser.id);

      // For super_admin: find existing super_admin entry. For tenant roles: find non-super_admin.
      const existingRole = isSuperAdminRole
        ? existingRoles?.find((item: any) => item.role === "super_admin") || null
        : existingRoles?.find((item: any) => item.role !== "super_admin") || null;

      // super_admin NEVER gets empresa_id, unidade_id or perfil_acesso_id
      const rolePayload = isSuperAdminRole
        ? { role: "super_admin", empresa_id: null, perfil_acesso_id: null, unidade_id: null }
        : {
          role: assignedRole,
          empresa_id: targetEmpresaId,
          perfil_acesso_id: perfil_acesso_id || null,
          unidade_id: assignedRole === "admin" ? null : (unidade_id || null),
        };

      if (existingRole) {
        await supabaseAdmin.from("user_roles").update(rolePayload).eq("id", existingRole.id);
      } else {
        await supabaseAdmin.from("user_roles").insert({
          user_id: invitedUser.id,
          ...rolePayload,
        });
      }

      const userName = nome || email.split("@")[0];

      await supabaseAdmin.from("profiles").upsert({
        user_id: invitedUser.id,
        nome: userName,
        email: email,
      }, { onConflict: "user_id" });

      if (assignedRole === "barber" && unidade_id) {
        const { data: existingBarbeiro } = await supabaseAdmin
          .from("barbeiros")
          .select("id")
          .eq("user_id", invitedUser.id)
          .maybeSingle();

        if (!existingBarbeiro) {
          await supabaseAdmin.from("barbeiros").insert({
            nome: userName,
            email: email,
            user_id: invitedUser.id,
            unidade_id: unidade_id,
            status: "active",
          });
        }
      }
    }

    if (targetEmpresaId && assignedRole === "admin") {
      try {
        console.log("Provisionando WhatsApp Evolution para a empresa...");
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/evolution-api`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ action: "connect", empresaId: targetEmpresaId }),
        });
        console.log("Comando enviado para Evolution API!");
      } catch (evoErr: any) {
        console.error("Erro ao tentar provisionar WhatsApp:", evoErr.message);
      }
    }

    console.log("User invited successfully:", email, "role:", assignedRole, "unidade:", unidade_id);

    return new Response(JSON.stringify({ success: true, user: invitedUser }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in invite-user:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendCustomInviteEmail(supabaseAdmin: any, toEmail: string, inviteLink: string, loginUrl: string, targetEmpresaId?: string, userName?: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured, skipping custom email");
    return;
  }

  // Fetch empresa data from the target empresa (tenant-specific)
  let empresa: any = null;
  if (targetEmpresaId) {
    const { data } = await supabaseAdmin
      .from("empresas")
      .select("nome, cor_primaria, email, logo_url, slug")
      .eq("id", targetEmpresaId)
      .single();
    empresa = data;
  }
  // Fallback to empresa_config (global/master)
  if (!empresa) {
    const { data } = await supabaseAdmin
      .from("empresa_config")
      .select("nome, cor_primaria, email, logo_url")
      .limit(1)
      .single();
    empresa = data;
  }

  // Use the global welcome template (convite_cliente, empresa_id IS NULL)
  let template: any = null;
  {
    const { data } = await supabaseAdmin
      .from("email_config")
      .select("*")
      .eq("tipo", "convite_cliente")
      .is("empresa_id", null)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    template = data;
  }
  // Fallback: global convite_usuario (empresa_id IS NULL)
  if (!template) {
    const { data } = await supabaseAdmin
      .from("email_config")
      .select("*")
      .eq("tipo", "convite_usuario")
      .is("empresa_id", null)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    template = data;
  }

  const nomeEmpresa = empresa?.nome || "10X Marketing";
  const emailRemetente = "noreply@10xmarketing.space";
  const corHex = hslToHex(empresa?.cor_primaria || "270 60% 45%");
  const logoUrl = empresa?.logo_url || "";

  let assunto: string;
  let corpo: string;

  if (template) {
    const vars: Record<string, string> = {
      nome_empresa: nomeEmpresa,
      cor_primaria: corHex,
      logo_url: logoUrl,
      link_acesso: loginUrl,
      link_login: loginUrl,
      link_definir_senha: inviteLink,
      nome_cliente: userName || toEmail.split("@")[0],
      nome_user: userName || toEmail.split("@")[0],
      nome: userName || toEmail.split("@")[0],
    };

    assunto = template.assunto;
    corpo = template.corpo_html;

    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
      assunto = assunto.replace(regex, value);
      corpo = corpo.replace(regex, value);
    }

    if (!corpo.includes("{{link_definir_senha}}") && !corpo.includes(inviteLink)) {
      corpo += `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0 20px 20px;">
          <p style="color: #888; font-size: 13px; line-height: 1.6;">
            Primeiro acesso? Defina sua senha aqui:<br/>
            <a href="${inviteLink}" style="color: ${corHex}; font-weight: bold;">Definir senha</a>
          </p>
        </div>`;
    }
  } else {
    // Fallback template
    assunto = `Você foi convidado para ${nomeEmpresa}`;
    corpo = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <center>
    <div style="max-width: 600px; margin: 40px auto; background-color: #121212; border-radius: 24px; overflow: hidden; border: 1px solid #2a2a2a; box-shadow: 0 30px 60px rgba(0,0,0,0.8);">
      
      <div style="width: 100%; height: 200px; background-image: url('https://10xmarketing.com.br/images/link-preview.jpg'); background-size: cover; background-position: center; position: relative;">
        <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, transparent, #121212);"></div>
        <div style="position: absolute; bottom: 15px; width: 100%; text-align: center;">
             <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">${nomeEmpresa}</h1>
        </div>
      </div>

      <div style="padding: 40px 30px; text-align: center;">
        <h2 style="color: #a855f7; font-size: 26px; margin-bottom: 10px; font-weight: 300;">Olá, <strong>${userName || toEmail.split("@")[0]}</strong>! 👋</h2>
        
        <p style="color: #a1a1aa; line-height: 1.8; font-size: 16px; margin-bottom: 30px;">
          Seja muito bem-vindo(a) ao seu novo ecossistema de marketing. Estamos felizes em tê-lo(a) como nosso(a) novo(a) assinante!
        </p>

        <div style="background: rgba(168, 85, 247, 0.05); border-radius: 20px; padding: 30px; border: 1px solid rgba(168, 85, 247, 0.2);">
          
          <a href="${loginUrl}" style="display: block; padding: 16px 30px; background: linear-gradient(90deg, #9333ea, #7e22ce); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; box-shadow: 0 10px 20px rgba(147, 51, 234, 0.3);">
            Acessar o Sistema
          </a>

          <a href="${inviteLink}" style="display: block; padding: 14px 30px; background: transparent; color: #a855f7; text-decoration: none; border-radius: 12px; font-weight: bold; border: 2px solid #a855f7; text-transform: uppercase; letter-spacing: 1px;">
            Definir Minha Senha
          </a>

          <p style="margin: 20px 0 0; color: #71717a; font-size: 13px;">
            Utilize os botões acima para configurar seu acesso e começar.
          </p>
        </div>

        <div style="margin-top: 30px; padding: 20px; border-top: 1px solid #2a2a2a;">
          <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">📱 Agendamento Facilitado</p>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">
            Dentro da plataforma, você poderá agendar seus atendimentos e acompanhar o status dos seus serviços em tempo real.
          </p>
        </div>
      </div>

      <div style="padding: 30px; background-color: #0a0a0a; text-align: center; border-top: 1px solid #1e1e1e;">
        <p style="color: #475569; font-size: 12px; margin: 0; letter-spacing: 1px;">
          ${nomeEmpresa} - Estratégia e Escala<br>
          Obrigado pela preferência!
        </p>
      </div>
    </div>
  </center>
</body>
</html>`;
  }

  const resend = new Resend(resendApiKey);
  try {
    await resend.emails.send({
      from: `${nomeEmpresa} <${emailRemetente}>`,
      to: [toEmail],
      subject: assunto,
      html: corpo,
    });
    console.log("Custom invite email sent to:", toEmail);
  } catch (err: any) {
    console.error("ERRO RESEND (ignorado para não travar a criação):", err.message);
  }
}

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
