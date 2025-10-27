import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePricing() {
  console.log('Updating subscription pricing...');
  
  // Remove Premium $25/month plan
  const { error: deletePremium } = await supabase
    .from('price_list')
    .delete()
    .eq('id', '25_monthly')
    .eq('endpoint', 'subscription');
  
  if (deletePremium) console.error('Error deleting Premium plan:', deletePremium);
  else console.log('✓ Deleted Premium $25/month plan');

  // Remove Astro $30/year plan
  const { error: deleteAstro } = await supabase
    .from('price_list')
    .delete()
    .eq('id', '30_yearly_astro')
    .eq('endpoint', 'subscription');
  
  if (deleteAstro) console.error('Error deleting Astro plan:', deleteAstro);
  else console.log('✓ Deleted Astro $30/year plan');

  // Update Growth plan from $15 to $10
  const { error: updateGrowth } = await supabase
    .from('price_list')
    .update({
      unit_price_usd: 10.00,
      stripe_price_id: 'price_1SJ7e6J1YhE4Ljp06kfxhNc5',
      name: 'Growth',
      description: 'Unlimited text conversations and reports'
    })
    .eq('id', '15_monthly')
    .eq('endpoint', 'subscription');
  
  if (updateGrowth) console.error('Error updating Growth plan:', updateGrowth);
  else console.log('✓ Updated Growth plan to $10/month');

  console.log('\nDone! Subscription pricing updated.');
}

updatePricing();
