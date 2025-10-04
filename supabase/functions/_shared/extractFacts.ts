/**
 * Rule-based fact extraction from article text
 * Extracts: money, recall class, lawsuits, settlements, political donations
 */

export interface ExtractedFacts {
  amount: number | null;
  recall_class: 'I' | 'II' | 'III' | null;
  lawsuit: boolean;
  settlement: boolean;
  recipient_party: 'dem' | 'rep' | null;
  penalty_amount: number | null;
}

export function extractFacts(text: string): ExtractedFacts {
  const amounts: number[] = [];
  
  // Extract money amounts
  const moneyMatches = text.matchAll(/\$\s?([\d,.]+)\s?(million|billion|thousand)?/gi);
  for (const match of moneyMatches) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    const magnitude = match[2]?.toLowerCase();
    
    if (magnitude === 'million') {
      amounts.push(num * 1_000_000);
    } else if (magnitude === 'billion') {
      amounts.push(num * 1_000_000_000);
    } else if (magnitude === 'thousand') {
      amounts.push(num * 1_000);
    } else {
      amounts.push(num);
    }
  }

  // Extract recall class
  const recallMatch = /class\s?(I{1,3})\b/i.exec(text);
  const recallClass = recallMatch?.[1]?.toUpperCase() as 'I' | 'II' | 'III' | null;

  // Detect lawsuit keywords
  const lawsuit = /\b(lawsuit|class[- ]action|litigation|sued|plaintiff)\b/i.test(text);

  // Detect settlement keywords
  const settlement = /\b(settlement|settled|agreed to pay)\b/i.test(text);

  // Extract political party
  let recipientParty: 'dem' | 'rep' | null = null;
  const partyMatch = /\b(democrat(ic)?|republican|gop)\b/i.exec(text);
  if (partyMatch) {
    const party = partyMatch[0].toLowerCase();
    if (party.includes('dem')) {
      recipientParty = 'dem';
    } else if (party.includes('rep') || party === 'gop') {
      recipientParty = 'rep';
    }
  }

  // Try to identify penalty/fine amounts (typically near "fine", "penalty", "pay")
  let penaltyAmount: number | null = null;
  const penaltyMatch = text.match(/(?:fine|penalty|pay|settlement)\s+of\s+\$\s?([\d,.]+)\s?(million|billion)?/i);
  if (penaltyMatch) {
    const num = parseFloat(penaltyMatch[1].replace(/,/g, ''));
    const magnitude = penaltyMatch[2]?.toLowerCase();
    
    if (magnitude === 'million') {
      penaltyAmount = num * 1_000_000;
    } else if (magnitude === 'billion') {
      penaltyAmount = num * 1_000_000_000;
    } else {
      penaltyAmount = num;
    }
  }

  return {
    amount: amounts.length > 0 ? Math.max(...amounts) : null,
    recall_class: recallClass || null,
    lawsuit,
    settlement,
    recipient_party: recipientParty,
    penalty_amount: penaltyAmount || (amounts.length > 0 ? Math.max(...amounts) : null),
  };
}
