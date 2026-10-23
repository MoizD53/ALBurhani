async function checkDeployment() {
  const url = 'https://duokarma53-spec.github.io/AL-BHURANI/';
  console.log('Fetching', url);
  const res = await fetch(url);
  console.log('HTTP Status:', res.status);
  const html = await res.text();
  
  // Extract script and style tags
  const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
  const linkMatches = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);
  
  console.log('Scripts found:', scriptMatches);
  console.log('Links found:', linkMatches);

  for (const s of scriptMatches) {
    const fullUrl = s.startsWith('http') ? s : new URL(s, url).href;
    console.log('\nChecking asset:', fullUrl);
    const assetRes = await fetch(fullUrl);
    console.log('Status:', assetRes.status, 'Size:', (await assetRes.text()).length, 'bytes');
  }

  // Check if purchase-bills or dailyBillNumber exists in the deployed JS bundle
  for (const s of scriptMatches) {
    const fullUrl = s.startsWith('http') ? s : new URL(s, url).href;
    const assetRes = await fetch(fullUrl);
    const text = await assetRes.text();
    const hasPurchaseBills = text.includes('purchaseBills') || text.includes('Purchase Bills');
    const hasDailyBill = text.includes('dailyBillNumber') || text.includes('Daily Bill');
    console.log(`Asset ${s} contains 'Purchase Bills': ${hasPurchaseBills}, 'Daily Bill': ${hasDailyBill}`);
  }
}

checkDeployment().catch(console.error);
