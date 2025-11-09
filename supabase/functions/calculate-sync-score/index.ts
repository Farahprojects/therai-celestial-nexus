import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateConnectionProfile } from "../_shared/sync-engine/index.ts";
import type { ConnectionProfile } from "../_shared/sync-engine/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Content-Type": "application/json",
};

interface ScoreBreakdown {
  overall: number;
  astrological: number;
  breakdown: {
    harmonious_aspects: number;
    challenging_aspects: number;
    neutral_aspects: number;
    key_connections: string[];
    dominant_theme: string;
    all_themes: Array<{ name: string; weight: number }>;
  };
  archetype: {
    id: string;
    name: string;
    description: string;
    tone: string;
    keywords: string[];
  };
  poetic_headline: string;
  ai_insight: string;
  calculated_at: string;
  rarity_percentile: number;
  card_image_url?: string | null;
}

/**
 * Calculate rarity percentile based on score distribution
 * TODO: Replace with real database query for actual rarity
 */
function calculateRarity(score: number): number {
  if (score >= 95) return 99;
  if (score >= 90) return 95;
  if (score >= 85) return 90;
  if (score >= 80) return 85;
  if (score >= 75) return 75;
  if (score >= 70) return 65;
  if (score >= 60) return 50;
  return Math.max(0, Math.round((score / 60) * 50));
}

/**
 * Generate image prompt for connection card
 */
function generateSyncCardPrompt(
  profile: ConnectionProfile,
  personAName: string,
  personBName: string,
  rarityPercentile: number
): string {
  return `Create an elegant, mystical connection card in portrait orientation (9:16).

DESIGN STRUCTURE:
- Top third: Celestial background with ${profile.colorScheme}, subtle star field, ethereal glow
- Center: Large white number "${profile.score}%" with cosmic sparkle effects
- Below score: "${profile.headline}" in elegant italic serif font
- Middle section: "${personAName} & ${personBName}" in clean sans-serif
- Quote section: Stylized quote marks around: "${profile.insight}"
${rarityPercentile >= 50 ? `- Badge: Small purple badge with sparkle icon and "Top ${100 - rarityPercentile}% Connection"` : ''}
- Bottom: "therai.co" watermark, subtle and elegant

STYLE:
- Minimal, Apple-inspired aesthetic
- Lots of negative space
- Soft glows and light effects
- Professional typography
- Mystical but not cheesy
- Instagram-ready quality
- Clean, modern, shareable

COLORS:
- Background: ${profile.colorScheme}
- Text: White and light gray
- Accents: Soft glows matching background
- Keep it elegant and premium`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chat_id } = await req.json();

    if (!chat_id) {
      return new Response(
        JSON.stringify({ error: "chat_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[calculate-sync-score] Processing for chat_id: ${chat_id}`);

    // 🚀 PARALLEL FETCH: Get translator log and conversation data simultaneously
    const [logResult, conversationResult] = await Promise.all([
      supabase
        .from('translator_logs')
        .select('swiss_data, user_id')
        .eq('chat_id', chat_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('conversations')
        .select('title')
        .eq('id', chat_id)
        .single()
    ]);

    const { data: translatorLog, error: logError } = logResult;
    if (logError || !translatorLog) {
      console.error('[calculate-sync-score] Error fetching translator log:', logError);
      return new Response(
        JSON.stringify({ error: "Could not fetch synastry data" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: conversation, error: convError } = conversationResult;
    if (convError || !conversation) {
      console.error('[calculate-sync-score] Error fetching conversation:', convError);
    }

    const swissData = translatorLog.swiss_data;
    const userId = translatorLog.user_id;

    console.log('[calculate-sync-score] Swiss data fetched');

    // 🧠 NEW ENGINE: Generate complete connection profile
    // This replaces 200+ lines of manual calculation with semantic interpretation
    const profile: ConnectionProfile = generateConnectionProfile(swissData);

    console.log(`[calculate-sync-score] Profile generated: ${profile.score}% - ${profile.archetype.name}`);
    console.log(`[calculate-sync-score] Dominant theme: ${profile.dominantTheme.name} (${profile.themes.length} themes detected)`);

    // Calculate rarity percentile
    const rarityPercentile = calculateRarity(profile.score);

    // Extract person names from conversation title
    let personAName = 'Person A';
    let personBName = 'Person B';
    
    if (conversation?.title) {
      const title = conversation.title.replace('Sync Score: ', '');
      const parts = title.split(' & ');
      personAName = parts[0] || 'Person A';
      personBName = parts[1] || 'Person B';
    }

    // Build score breakdown for storage and API response
    const scoreBreakdown: ScoreBreakdown = {
      overall: profile.score,
      astrological: profile.score,
      breakdown: {
        harmonious_aspects: profile.features.harmoniousAspects,
        challenging_aspects: profile.features.challengingAspects,
        neutral_aspects: profile.features.neutralAspects,
        key_connections: profile.features.keyConnections,
        dominant_theme: profile.dominantTheme.name,
        all_themes: profile.themes.map(t => ({ name: t.name, weight: t.weight })),
      },
      archetype: {
        id: profile.archetype.id,
        name: profile.archetype.name,
        description: profile.archetype.description,
        tone: profile.archetype.tone,
        keywords: profile.archetype.keywords,
      },
      poetic_headline: profile.headline,
      ai_insight: profile.insight,
      calculated_at: new Date().toISOString(),
      rarity_percentile: rarityPercentile,
    };

    // 📸 Generate connection card image
    console.log('[calculate-sync-score] Generating connection card...');
    
    const cardPrompt = generateSyncCardPrompt(
      profile,
      personAName,
      personBName,
      rarityPercentile
    );

    // Create a placeholder message for the connection card
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chat_id,
        user_id: userId,
        role: 'assistant',
        text: 'Generating your connection card...',
        status: 'pending',
        meta: {
          message_type: 'image',
          sync_score: true,
        }
      })
      .select()
      .single();

    if (messageError || !newMessage) {
      console.error('[calculate-sync-score] Failed to create message:', messageError);
    }

    // 🚀 Broadcast the placeholder message so frontend displays it immediately
    if (newMessage) {
      const channelName = `user-realtime:${userId}`;
      supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'message-insert',
        payload: {
          chat_id: chat_id,
          message: newMessage
        }
      }, { httpSend: true }).catch((broadcastError) => {
        console.error('[calculate-sync-score] Message broadcast failed:', broadcastError);
      });
    }

    let cardImageUrl = null;
    if (newMessage) {
      try {
        const imageResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/image-generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            chat_id: chat_id,
            prompt: cardPrompt,
            user_id: userId,
            mode: 'sync',
            image_id: newMessage.id,
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          cardImageUrl = imageData.image_url;
          console.log('[calculate-sync-score] Card image generated:', cardImageUrl);
        } else {
          console.error('[calculate-sync-score] Image generation failed:', await imageResponse.text());
        }
      } catch (imageError) {
        console.error('[calculate-sync-score] Image generation error:', imageError);
        // Continue without image - not critical
      }
    }

    // Store result in conversations.meta (including image URL)
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        meta: {
          sync_score: {
            ...scoreBreakdown,
            card_image_url: cardImageUrl,
          },
        },
      })
      .eq('id', chat_id);

    if (updateError) {
      console.error('[calculate-sync-score] Error updating conversation:', updateError);
      return new Response(
        JSON.stringify({ error: "Failed to store score" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[calculate-sync-score] Score stored successfully`);

    // Return the score with image URL
    return new Response(
      JSON.stringify({ 
        success: true, 
        score: {
          ...scoreBreakdown,
          card_image_url: cardImageUrl,
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[calculate-sync-score] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
