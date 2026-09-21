import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_EMPRESA_ID = "93d24bc4-e371-4395-8ed8-636d02575de6";
const DEFAULT_ACCOUNT_ID = "939706096831223";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "https://khoeovszuixfwfkaaxaa.supabase.co",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    let body: any = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch (_) {
        body = {};
      }
    }

    const token = Deno.env.get("META_ADS_TOKEN") || body.token;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "META_ADS_TOKEN não configurado no Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawAccountId = (body.ad_account_id || Deno.env.get("META_ADS_ACCOUNT_ID") || DEFAULT_ACCOUNT_ID).replace(/^act_/, "");
    const empresaId = body.empresa_id || DEFAULT_EMPRESA_ID;

    // 1. Buscar detalhes dos anúncios e criativos (Miniatura, texto, status)
    const adsUrl = `https://graph.facebook.com/v21.0/act_${rawAccountId}/ads?fields=id,name,status,effective_status,campaign_id,creative{id,name,thumbnail_url,image_url,title,body}&limit=100&access_token=${token}`;
    const resAds = await fetch(adsUrl);
    const jsonAds = await resAds.json();
    const adsMap: Record<string, any> = {};

    if (jsonAds.data && Array.isArray(jsonAds.data)) {
      for (const ad of jsonAds.data) {
        adsMap[ad.id] = ad;
      }
    }

    // 2. Buscar URLs de preview/player iframe para criativos
    const previewMap: Record<string, string> = {};
    const creativeIds = Array.from(new Set(
      Object.values(adsMap)
        .map((a: any) => a.creative?.id)
        .filter(Boolean)
    ));

    for (const cId of creativeIds.slice(0, 15)) {
      try {
        const pUrl = `https://graph.facebook.com/v21.0/${cId}/previews?ad_format=INSTAGRAM_STANDARD&access_token=${token}`;
        const resP = await fetch(pUrl);
        const jsonP = await resP.json();
        const html = jsonP.data?.[0]?.body;
        const match = html ? html.match(/src="([^"]+)"/) : null;
        if (match && match[1]) {
          previewMap[cId] = match[1].replace(/&amp;/g, "&");
        }
      } catch (err: any) {
        console.error("Erro ao buscar preview do criativo:", cId, err.message);
      }
    }

    // 3. Buscar métricas diárias: last_30d E today para garantir que o dia de HOJE esteja 100% atualizado
    const presetsToFetch = ["last_30d", "today"];
    let allData: any[] = [];
    const fields = "campaign_id,campaign_name,objective,adset_id,adset_name,ad_id,ad_name,impressions,clicks,reach,spend,cpc,cpm,ctr,actions";

    for (const preset of presetsToFetch) {
      let metaUrl: string | null = `https://graph.facebook.com/v21.0/act_${rawAccountId}/insights?level=ad&time_increment=1&fields=${fields}&date_preset=${preset}&limit=100&access_token=${token}`;

      while (metaUrl) {
        const resMeta = await fetch(metaUrl);
        const jsonMeta = await resMeta.json();

        if (!resMeta.ok || jsonMeta.error) {
          console.error(`Erro Meta API Insights (${preset}):`, jsonMeta.error);
          break;
        }

        if (jsonMeta.data && Array.isArray(jsonMeta.data)) {
          allData = allData.concat(jsonMeta.data);
        }

        metaUrl = jsonMeta.paging?.next || null;
        if (allData.length >= 300) break;
      }
    }

    if (allData.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          count: 0,
          message: "Nenhuma métrica encontrada para o período.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = allData.map((r: any) => {
      // Cálculo EXATO da coluna 'Resultados: Conversas por mensagem iniciadas' da Meta
      let conversoes = 0;
      if (r.actions && Array.isArray(r.actions)) {
        for (const a of r.actions) {
          if (a.action_type === "onsite_conversion.messaging_conversation_started_7d") {
            conversoes = Number(a.value) || 0;
            break;
          }
        }
        if (conversoes === 0) {
          for (const a of r.actions) {
            if (a.action_type === "onsite_conversion.messaging_first_reply") {
              conversoes = Number(a.value) || 0;
              break;
            }
          }
        }
      }

      const adInfo = adsMap[r.ad_id] || {};
      const creative = adInfo.creative || {};
      const previewIframeUrl = creative.id ? previewMap[creative.id] : null;

      return {
        empresa_id: empresaId,
        plataforma: "meta",
        conta_id: rawAccountId,
        conta_nome: "Hermanos",
        campanha_id_externo: r.ad_id || r.campaign_id,
        campanha_nome: r.ad_name ? `${r.campaign_name} | ${r.ad_name}` : r.campaign_name,
        data_referencia: r.date_start,
        impressoes: Number(r.impressions) || 0,
        cliques: Number(r.clicks) || 0,
        alcance: Number(r.reach) || 0,
        conversoes,
        gasto: Number(r.spend) || 0,
        cpc: Number(r.cpc) || 0,
        cpm: Number(r.cpm) || 0,
        ctr: Number(r.ctr) || 0,
        roas: 0,
        receita: 0,
        dados_extras: {
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          objective: r.objective || null,
          adset_id: r.adset_id,
          adset_name: r.adset_name,
          ad_id: r.ad_id,
          ad_name: r.ad_name,
          status: adInfo.status || "ACTIVE",
          effective_status: adInfo.effective_status || "ACTIVE",
          thumbnail_url: creative.thumbnail_url || creative.image_url || null,
          preview_iframe_url: previewIframeUrl,
          title: creative.title || null,
          body: creative.body || null,
          actions: r.actions,
        },
      };
    });

    const { error: upsertErr } = await supabase.from("ads_metrics").upsert(rows, {
      onConflict: "plataforma,campanha_id_externo,data_referencia",
    });

    if (upsertErr) {
      console.error("Erro ao salvar métricas no banco:", upsertErr);
      return new Response(
        JSON.stringify({ success: false, error: upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: rows.length,
        message: `${rows.length} anúncios sincronizados (incluindo o dia de hoje ao vivo)!`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Erro geral na Edge Function sync-meta-ads:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
