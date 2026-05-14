function parseScore(text) {
  const data = {
    team1: 'Team 1',
    team2: 'Team 2',
    score1: null,
    wkts1: null,
    overs1: null,
    score2: null,
    wkts2: null,
    overs2: null,
    bat1: null,
    bat1r: null,
    bat1b: null,
    bat1sr: null,
    bat2: null,
    bat2r: null,
    bat2b: null,
    bat2sr: null,
    bowler: null,
    bowlerO: null,
    bowlerW: null,
    bowlerR: null,
    bowlerEco: null,
    status: 'Live',
    crr: null,
    rrr: null,
    runsNeeded: null,
    ballsLeft: null,
    wktsInHand: null,
    thisOver: []
  };

  // ── Team names ──────────────────────────────────────────────────────────────
  // CricClubs ballbyball format:
  //   \nJersey Lions\n273/4\n\n\n20.0 /20 ov\n\nVS\nUSACA\n211/7\n
  const vsBlock = text.match(/\n([\w][\w A-Za-z0-9&'.\-]{1,40})\n\d{1,3}\/\d{1,2}[\s\S]{0,80}VS\n([\w][\w A-Za-z0-9&'.\-]{1,40})\n/);
  if (vsBlock) {
    data.team1 = vsBlock[1].trim();
    data.team2 = vsBlock[2].trim();
  } else {
    const vsLine = text.match(/([A-Z][A-Za-z ]{2,25})\s+vs\.?\s+([A-Z][A-Za-z ]{2,25})/i);
    if (vsLine) {
      data.team1 = vsLine[1].trim();
      data.team2 = vsLine[2].trim();
    }
  }

  // ── Header scores ────────────────────────────────────────────────────────────
  // Extract scores from the VS block (top of page)
  // Format: "Team1\n(score1/wkts1)\n\n(overs1) ov\n\nVS\nTeam2\n(score2/wkts2)\n\n(overs2)"
  const vsScoreReg = /\n([\w][\w A-Za-z0-9&'.\-]{1,40})\n(\d{1,3})\/(\d{1,2})\n[\s\n]*(\d+\.\d+)[^\n]*?(?:ov|Overs)?[\s\n]*VS\n([\w][\w A-Za-z0-9&'.\-]{1,40})\n(\d{1,3})\/(\d{1,2})\n[\s\n]*(\d+\.\d+)/;
  const vsMatch = text.match(vsScoreReg);
  
  if (vsMatch) {
    // Matched both teams in VS block
    data.team1 = vsMatch[1].trim();
    data.score1 = vsMatch[2];
    data.wkts1 = vsMatch[3];
    // Extract numeric overs from the overs field (might be "10.5" or "0/0" or "0.0")
    const overs1Match = vsMatch[4].match(/([\d.]+)/);
    data.overs1 = overs1Match ? overs1Match[1] : null;
    
    data.team2 = vsMatch[5].trim();
    data.score2 = vsMatch[6];
    data.wkts2 = vsMatch[7];
    const overs2Match = vsMatch[8].match(/([\d.]+)/);
    const overs2 = overs2Match ? overs2Match[1] : null;
    
    // Don't extract score2 if it's not started placeholder (0/0, 0.0)
    if ((vsMatch[6] === '0' && vsMatch[7] === '0') || overs2 === '0.0' || overs2 === '0') {
      data.score2 = null;
      data.wkts2 = null;
      data.overs2 = null;
    } else {
      data.overs2 = overs2;
    }
  } else {
    // Fallback: use headerScoreReg if VS block extraction failed
    const headerScoreReg = /(\d{1,3})\/(\d{1,2})\n[\s\n]*([\d]{1,2}\.[\d])/g;
    const hScores = [...text.matchAll(headerScoreReg)];
    if (hScores[0]) {
      data.score1 = hScores[0][1];
      data.wkts1 = hScores[0][2];
      data.overs1 = hScores[0][3];
    }
    if (hScores[1]) {
      // Only extract score2 if it's not a placeholder (0/0, 0.0 overs = not started)
      const score2 = hScores[1][1];
      const wkts2 = hScores[1][2];
      const overs2 = hScores[1][3];
      // Check if this is a "not started" placeholder (0/0, 0.0)
      if (!((score2 === '0' && wkts2 === '0') || overs2 === '0.0')) {
        data.score2 = score2;
        data.wkts2 = wkts2;
        data.overs2 = overs2;
      }
    }
  }

  // ── Current batters from live stats table (ALWAYS use this, never from over summaries) ──
  // Live stats table format (near top of page, tab-separated):
  //   Batter\tR\tB\t4s\t6s\tSR
  //   PlayerName1\tR1\tB1\t4s1\t6s1\tSR1
  //   PlayerName2\tR2\tB2\t4s2\t6s2\tSR2 (optional, may have only 1 batter after wicket)
  
  // Try matching 2 batters first (normal case)
  const batsTableReg2 = /Batter[\s\t]+R[\s\t]+B[\s\t]+4s[\s\t]+6s[\s\t]+SR\n([^\n\t]+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)\n([^\n\t]+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)/;
  let batsMatch = text.match(batsTableReg2);
  
  // If 2 batters not found, try matching just 1 batter (after wicket)
  const batsTableReg1 = /Batter[\s\t]+R[\s\t]+B[\s\t]+4s[\s\t]+6s[\s\t]+SR\n([^\n\t]+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)/;
  if (!batsMatch) {
    const singleMatch = text.match(batsTableReg1);
    if (singleMatch) {
      // Convert single match to same format as 2-batter match for consistent handling
      batsMatch = [
        singleMatch[0],
        singleMatch[1], singleMatch[2], singleMatch[3], singleMatch[4], singleMatch[5], singleMatch[6],
        null, null, null, null, null, null  // Placeholder for second batter
      ];
    }
  }
  
  if (batsMatch) {
    const batter1 = batsMatch[1].trim();
    const runs1 = batsMatch[2];
    const balls1 = batsMatch[3];
    const batter2 = batsMatch[7] ? batsMatch[7].trim() : null;
    const runs2 = batsMatch[8];
    const balls2 = batsMatch[9];

    // Determine who is on strike by looking at LAST delivery in ball-by-ball
    // Find all "to PlayerName, [runs] runs" patterns and use the LAST one
    const allDeliveries = [];
    // Match "to FullName, X runs" - specific pattern for deliveries only
    const deliveryReg = /to\s+([\s\S]+?)\s*,\s*(\d+|W|\.)\s*(?:runs?|out|wkt)/gm;
    let m;
    while ((m = deliveryReg.exec(text)) !== null) {
      let deliveredTo = m[1].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
      // Extract just the name (stop at any numbers)
      deliveredTo = deliveredTo.split(/\s*\d/)[0].trim();
      if (deliveredTo.length > 2 && !deliveredTo.includes('back')) {  // Filter out non-names
        allDeliveries.push(deliveredTo);
      }
    }

    let strikerFound = false;
    if (allDeliveries.length > 0 && batter2) {
      const strikerShort = allDeliveries[allDeliveries.length - 1]; // Last one
      
      // More robust matching: check if names match (allowing partial matches)
      const batter1LastName = batter1.split(' ').pop();
      const batter2LastName = batter2.split(' ').pop();
      
      // Check if last delivery was to batter1
      if (batter1.toLowerCase().includes(strikerShort.toLowerCase()) || 
          strikerShort.toLowerCase().includes(batter1LastName.toLowerCase())) {
        data.bat1 = batter1;
        data.bat1r = runs1;
        data.bat1b = balls1;
        data.bat2 = batter2;
        data.bat2r = runs2;
        data.bat2b = balls2;
        strikerFound = true;
      } 
      // Check if last delivery was to batter2 (then batter2 is on strike, so swap)
      else if (batter2.toLowerCase().includes(strikerShort.toLowerCase()) || 
               strikerShort.toLowerCase().includes(batter2LastName.toLowerCase())) {
        data.bat1 = batter2;
        data.bat1r = runs2;
        data.bat1b = balls2;
        data.bat2 = batter1;
        data.bat2r = runs1;
        data.bat2b = balls1;
        strikerFound = true;
      }
    }
    
    // If on-strike determination failed or only 1 batter, use heuristic
    // Heuristic: in cricket, strike alternates every 6 balls within an over
    // Calculate total balls and determine whose turn it is
    if (!strikerFound) {
      const totalBalls = parseInt(balls1 || 0) + parseInt(balls2 || 0);
      const ballsInCurrentOver = totalBalls % 6;
      
      // After odd numbered deliveries (1, 3, 5), batter2 is about to face
      // After even numbered deliveries (0, 2, 4), batter1 is about to face
      // So if ballsInCurrentOver is odd, batter2 just batted, batter1 on strike next
      if (ballsInCurrentOver > 0 && ballsInCurrentOver % 2 === 1) {
        // batter1 on strike
        data.bat1 = batter1;
        data.bat1r = runs1;
        data.bat1b = balls1;
        if (batter2) {
          data.bat2 = batter2;
          data.bat2r = runs2;
          data.bat2b = balls2;
        }
      } else if (ballsInCurrentOver > 0 && ballsInCurrentOver % 2 === 0) {
        // batter2 on strike
        data.bat1 = batter2;
        data.bat1r = runs2;
        data.bat1b = balls2;
        if (batter2) {
          data.bat2 = batter1;
          data.bat2r = runs1;
          data.bat2b = balls1;
        }
      } else {
        // At the start (0 balls), first batter on strike
        data.bat1 = batter1;
        data.bat1r = runs1;
        data.bat1b = balls1;
        if (batter2) {
          data.bat2 = batter2;
          data.bat2r = runs2;
          data.bat2b = balls2;
        }
      }
    }
  }

  // ── CRR from over summary (if available) ───────────────────────────────────
  // Only extract CRR from the most recent over summary if batters weren't found
  // Skip this during chase mode as we'll calculate it instead
  const isInChaseMode = text.match(/(\d+) runs needed in[\s\S]{0,30}?\((\d+) balls\)/i);
  if (!batsMatch && !isInChaseMode) {
    const overSummaryReg = /Over \d+[^\n]*\n\n([^\n]+)\n(\d+) \((\d+)\)\n\n([^\n]+)\n(\d+) \((\d+)\)\n\n([^\n]+)\n(\d+\.\d+-\d+-\d+-\d+)\n\nRun Rate\s*:\n([\d.]+)/;
    const firstSummary = text.match(overSummaryReg);
    if (firstSummary) {
      data.crr = firstSummary[9];
    }
  }

  // ── Over summary blocks (for CRR and bowler info) ───────────────────────────
  // Each over ends with a summary block - use for CRR if not already set
  // NOTE: DO NOT extract batters from here - use live stats table instead
  // Skip during chase mode to avoid picking up first inning data
  if (!data.crr && !isInChaseMode) {
    const overSummaryReg = /Over \d+[^\n]*\n\n([^\n]+)\n(\d+) \((\d+)\)\n\n([^\n]+)\n(\d+) \((\d+)\)\n\n([^\n]+)\n(\d+\.\d+-\d+-\d+-\d+)\n\nRun Rate\s*:\n([\d.]+)/;
    const firstSummary = text.match(overSummaryReg);
    if (firstSummary) {
      data.crr = firstSummary[9];
    }
  }

  // ── RRR ──────────────────────────────────────────────────────────────────────
  const rrrMatch = text.match(/RRR[:\s]+([\d.]+)/i);
  if (rrrMatch) {
    data.rrr = rrrMatch[1];
  }

  // ── Chase info (2nd inning) ──────────────────────────────────────────────────
  // Format: "268 runs needed in 19.0 overs (114 balls) with 10 wickets remaining"
  const chaseMatch = text.match(/(\d+) runs needed in[\s\S]{0,30}?\((\d+) balls\)[^\n]{0,80}?(\d+) wickets remaining/i);
  if (chaseMatch) {
    data.runsNeeded = chaseMatch[1];
    data.ballsLeft  = chaseMatch[2];
    data.wktsInHand = chaseMatch[3];
    
    // If we're in chase mode (runsNeeded detected) but score2 is still null
    // infer score2 from: score2 = score1 - runsNeeded
    if (!data.score2 && data.score1 && data.runsNeeded) {
      const inferredScore2 = parseInt(data.score1) - parseInt(data.runsNeeded);
      data.score2 = String(Math.max(0, inferredScore2));
      data.wkts2 = '—'; // Mark as active but unknown exact wickets
    }
  }

  // ── Calculate CRR for second inning (chase mode) if not extracted ──────────
  // During chase, page might not display CRR explicitly, so calculate it from actual score
  // Always calculate during chase mode to ensure we have CRR
  const hasChaseInfo = data.runsNeeded && data.ballsLeft && data.wktsInHand;
  if ((hasChaseInfo || (data.score2 && data.rrr)) && (!data.crr || data.crr === null)) {
    // Convert overs2 format "X.Y" to decimal: X + Y/6
    if (data.overs2) {
      const oversMatch = String(data.overs2).match(/(\d+)\.(\d+)/);
      if (oversMatch) {
        const completedOvers = parseInt(oversMatch[1], 10);
        const ballsInCurrentOver = parseInt(oversMatch[2], 10);
        const totalOversDecimal = completedOvers + (ballsInCurrentOver / 6);
        
        if (totalOversDecimal > 0 && data.score2) {
          const crrValue = parseInt(data.score2, 10) / totalOversDecimal;
          data.crr = crrValue.toFixed(2);
        }
      } else {
        // overs2 might be just a number like "3", handle that case
        const oversNum = parseInt(String(data.overs2), 10);
        if (oversNum > 0 && data.score2) {
          const crrValue = parseInt(data.score2, 10) / oversNum;
          data.crr = crrValue.toFixed(2);
        }
      }
    }
  }

  // ── Match status ─────────────────────────────────────────────────────────────
  // Won: "Jersey Lions won by 62 Runs" (match completion, not toss)
  // Live: "268 runs needed in 19.0 overs"
  const wonMatch = text.match(/([A-Z][A-Za-z ]+ won by[^\n]{0,80})/);
  if (wonMatch) {
    data.status = wonMatch[1].trim();
  } else {
    const needsMatch = text.match(/(\d+) runs needed in ([\d.]+) overs/i);
    if (needsMatch) {
      data.status = `${needsMatch[1]} runs needed in ${needsMatch[2]} overs`;
    }
  }

  // ── This over – individual ball deliveries ────────────────────────────────────
  // Ball line format (one per line): "1 6.1  " or " 6.2  " or "4 6.3  " or "W 6.4  " or "1wd 6.5  "
  // Strategy: find the highest over number referenced in ball notation, extract its balls.
  const allBallLines = [];
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^(\S+)\s+(\d+)\.(\d+)\s*$|^(\d+)\.(\d+)\s*$/);
    if (m) {
      if (m[4] !== undefined) {
        // dot ball (no value before over.ball)
        allBallLines.push({ value: '0', over: parseInt(m[4]), ball: parseInt(m[5]) });
      } else {
        allBallLines.push({ value: m[1], over: parseInt(m[2]), ball: parseInt(m[3]) });
      }
    }
  }

  if (allBallLines.length > 0) {
    const maxOver = Math.max(...allBallLines.map((b) => b.over));
    const currentOverBalls = allBallLines
      .filter((b) => b.over === maxOver)
      .sort((a, b) => a.ball - b.ball)
      .map((b) => {
        const raw = String(b.value).toUpperCase();
        if (raw === '0' || raw === '') return '0';
        if (raw.includes('WD') || raw === '1WD') return 'WD';
        if (raw.includes('NB')) return 'NB';
        return raw;
      });

    if (currentOverBalls.length > 0) {
      data.thisOver = currentOverBalls.slice(0, 8);
    }

    // If we're in chase mode (score2 inferred or runsNeeded detected), update overs2 from ball-by-ball
    // BUT ONLY if overs2 wasn't already successfully extracted from VS block
    // (ball-by-ball only shows current over, not full history like VS block does)
    // Use runsNeeded as the reliable indicator that we're in chase mode
    if (data.runsNeeded && !data.overs2) {
      const ballsInCurrentOver = allBallLines.filter((b) => b.over === maxOver).length;
      // overs2 format: "X.Y" where X = current over number, Y = balls bowled in that over
      // maxOver is the over number currently being played (1, 2, 3, ...)
      // ballsInCurrentOver is the number of balls bowled in that over (0-6, but typically 0-5 during play)
      if (ballsInCurrentOver > 0 && maxOver > 0) {
        data.overs2 = `${maxOver}.${ballsInCurrentOver}`;
      } else if (maxOver > 1) {
        // If no balls in current over yet, show previous complete over
        data.overs2 = String(maxOver - 1);
      } else if (maxOver === 1 && ballsInCurrentOver === 0) {
        // First over, no balls yet - show 0.0
        data.overs2 = '0.0';
      }
    }
  }

  // ── Strike rates (fallback from scorecard pages) ─────────────────────────────
  const strikeRatePattern = /(\d+\.\d+)\s*SR/gi;
  const strikeRates = [];
  let match;
  while ((match = strikeRatePattern.exec(text)) !== null) {
    strikeRates.push(match[1]);
  }
  if (strikeRates[0]) {
    data.bat1sr = strikeRates[0];
  }
  if (strikeRates[1]) {
    data.bat2sr = strikeRates[1];
  }

  // Always extract current bowler from live Bowler stats table
  // The FIRST bowler listed is typically the most recent/current one
  // Format: "Bowler  O       M       R       W       Econ\nBowlerName  O  M  R  W  Econ"
  const bowlerTableMatch = text.match(/Bowler\s+O\s+M\s+R\s+W\s+Econ\n([^\n]+?)\s+(\d+(?:\.\d)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)?/);
  if (bowlerTableMatch) {
    data.bowler = bowlerTableMatch[1].trim();
    data.bowlerO = bowlerTableMatch[2];
    data.bowlerR = bowlerTableMatch[4];
    data.bowlerW = bowlerTableMatch[5];
    data.bowlerEco = bowlerTableMatch[6] || null;
  }

  // Fallback: look for "This Over" or "Current Over"
  const overMatch = text.match(/(?:This Over|Current Over)[:\s]+([0-9W46wdnb ,.]+)/i);
  if (overMatch && data.thisOver.length === 0) {
    data.thisOver = overMatch[1].trim().split(/[\s,]+/).filter(Boolean).slice(0, 6);
  }

  return data;
}

module.exports = {
  parseScore
};
