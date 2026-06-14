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
    bat1Photo: null,
    bat1r: null,
    bat1b: null,
    bat1sr: null,
    bat2: null,
    bat2Photo: null,
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

  // ── Team names + scores ───────────────────────────────────────────────────
  // New URL format (cricclubs.com/LEAGUE/results/HASH):
  //   series\nvs\nteam1\nABBREV\nscore1/wkts1\novers1/max\nscore2/wkts2\novers2/max\nABBREV\nteam2
  const newBlock = text.match(/\nvs\n([^\n]+)\n[A-Z]{1,5}\n(\d{1,3})\/(\d{1,2})\n([\d.]+)\/\d+\n(\d{1,3})\/(\d{1,2})\n([\d.]+)\/\d+\n[A-Z]{1,5}\n([^\n]+)/);
  if (newBlock) {
    data.team1  = newBlock[1].trim();
    data.score1 = newBlock[2];
    data.wkts1  = newBlock[3];
    data.overs1 = newBlock[4];
    data.team2  = newBlock[8].trim();
    const s2 = newBlock[5], w2 = newBlock[6], o2 = newBlock[7];
    if (!((s2 === '0' && w2 === '0') || o2 === '0.0' || o2 === '0')) {
      data.score2 = s2;
      data.wkts2  = w2;
      data.overs2 = o2;
    }
  } else {
    // Old URL format (viewScorecard.do?matchId=...&clubId=...)
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

    const vsScoreReg = /\n([\w][\w A-Za-z0-9&'.\-]{1,40})\n(\d{1,3})\/(\d{1,2})\n[\s\n]*(\d+\.\d+)[^\n]*?(?:ov|Overs)?[\s\n]*VS\n([\w][\w A-Za-z0-9&'.\-]{1,40})\n(\d{1,3})\/(\d{1,2})\n[\s\n]*([\d./]+)/;
    const vsMatch = text.match(vsScoreReg);
    if (vsMatch) {
      data.team1  = vsMatch[1].trim();
      data.score1 = vsMatch[2];
      data.wkts1  = vsMatch[3];
      const overs1Match = vsMatch[4].match(/([\d.]+)/);
      data.overs1 = overs1Match ? overs1Match[1] : null;
      data.team2  = vsMatch[5].trim();
      data.score2 = vsMatch[6];
      data.wkts2  = vsMatch[7];
      const overs2Match = vsMatch[8].match(/([\d.]+)/);
      const overs2 = overs2Match ? overs2Match[1] : null;
      if ((vsMatch[6] === '0' && vsMatch[7] === '0') || overs2 === '0.0' || overs2 === '0') {
        data.score2 = null;
        data.wkts2  = null;
        data.overs2 = null;
      } else {
        data.overs2 = overs2;
      }
    } else {
      const headerScoreReg = /(\d{1,3})\/(\d{1,2})\n[\s\n]*([\d]{1,2}\.[\d])/g;
      const hScores = [...text.matchAll(headerScoreReg)];
      if (hScores[0]) {
        data.score1 = hScores[0][1];
        data.wkts1  = hScores[0][2];
        data.overs1 = hScores[0][3];
      }
      if (hScores[1]) {
        const score2 = hScores[1][1], wkts2 = hScores[1][2], overs2 = hScores[1][3];
        if (!((score2 === '0' && wkts2 === '0') || overs2 === '0.0')) {
          data.score2 = score2;
          data.wkts2  = wkts2;
          data.overs2 = overs2;
        }
      }
    }
  }

  // ── Current batters ───────────────────────────────────────────────────────
  // New multi-line header format:
  //   Batter\t\nR\t\nB\t\n4s\t\n6s\t\nSR\n\nPlayerName\n\t1\t1\t0\t0\t100.00
  // Old single-line header format:
  //   Batter\tR\tB\t4s\t6s\tSR\nPlayerName\t1\t1\t0\t0\t100.00

  const batsNewReg2 = /Batter\n\t\nR\n\t\nB\n\t\n4s\n\t\n6s\n\t\nSR\n+([^\n]+)\n\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)\n+([^\n]+)\n\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)/;
  const batsNewReg1 = /Batter\n\t\nR\n\t\nB\n\t\n4s\n\t\n6s\n\t\nSR\n+([^\n]+)\n\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)/;
  const batsOldReg2 = /Batter[\s\t]+R[\s\t]+B[\s\t]+4s[\s\t]+6s[\s\t]+SR\n([^\n\t]+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)\n([^\n\t]+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)/;
  const batsOldReg1 = /Batter[\s\t]+R[\s\t]+B[\s\t]+4s[\s\t]+6s[\s\t]+SR\n([^\n\t]+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)/;

  let batsMatch = text.match(batsNewReg2) || text.match(batsOldReg2);
  if (!batsMatch) {
    const single = text.match(batsNewReg1) || text.match(batsOldReg1);
    if (single) {
      batsMatch = [single[0], single[1], single[2], single[3], single[4], single[5], single[6],
                   null, null, null, null, null, null];
    }
  }

  if (batsMatch) {
    const batter1 = batsMatch[1].trim();
    const runs1   = batsMatch[2];
    const balls1  = batsMatch[3];
    const sr1     = batsMatch[6];
    const batter2 = batsMatch[7] ? batsMatch[7].trim() : null;
    const runs2   = batsMatch[8];
    const balls2  = batsMatch[9];
    const sr2     = batsMatch[12];

    const allDeliveries = [];
    const deliveryReg = /to\s+([\s\S]+?)\s*,\s*(\d+|W|\.)\s*(?:runs?|out|wkt)/gm;
    let m;
    while ((m = deliveryReg.exec(text)) !== null) {
      let deliveredTo = m[1].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
      deliveredTo = deliveredTo.split(/\s*\d/)[0].trim();
      if (deliveredTo.length > 2 && !deliveredTo.includes('back')) {
        allDeliveries.push(deliveredTo);
      }
    }

    let strikerFound = false;
    if (allDeliveries.length > 0 && batter2) {
      const strikerShort    = allDeliveries[allDeliveries.length - 1];
      const batter1LastName = batter1.split(' ').pop();
      const batter2LastName = batter2.split(' ').pop();

      if (batter1.toLowerCase().includes(strikerShort.toLowerCase()) ||
          strikerShort.toLowerCase().includes(batter1LastName.toLowerCase())) {
        data.bat1 = batter1; data.bat1r = runs1; data.bat1b = balls1; data.bat1sr = sr1;
        data.bat2 = batter2; data.bat2r = runs2; data.bat2b = balls2; data.bat2sr = sr2;
        strikerFound = true;
      } else if (batter2.toLowerCase().includes(strikerShort.toLowerCase()) ||
                 strikerShort.toLowerCase().includes(batter2LastName.toLowerCase())) {
        data.bat1 = batter2; data.bat1r = runs2; data.bat1b = balls2; data.bat1sr = sr2;
        data.bat2 = batter1; data.bat2r = runs1; data.bat2b = balls1; data.bat2sr = sr1;
        strikerFound = true;
      }
    }

    if (!strikerFound) {
      const totalBalls        = parseInt(balls1 || 0) + parseInt(balls2 || 0);
      const ballsInCurrentOver = totalBalls % 6;
      if (ballsInCurrentOver > 0 && ballsInCurrentOver % 2 === 1) {
        data.bat1 = batter1; data.bat1r = runs1; data.bat1b = balls1; data.bat1sr = sr1;
        if (batter2) { data.bat2 = batter2; data.bat2r = runs2; data.bat2b = balls2; data.bat2sr = sr2; }
      } else if (ballsInCurrentOver > 0 && ballsInCurrentOver % 2 === 0) {
        data.bat1 = batter2; data.bat1r = runs2; data.bat1b = balls2; data.bat1sr = sr2;
        if (batter2) { data.bat2 = batter1; data.bat2r = runs1; data.bat2b = balls1; data.bat2sr = sr1; }
      } else {
        data.bat1 = batter1; data.bat1r = runs1; data.bat1b = balls1; data.bat1sr = sr1;
        if (batter2) { data.bat2 = batter2; data.bat2r = runs2; data.bat2b = balls2; data.bat2sr = sr2; }
      }
    }
  }

  // ── Bowler table ──────────────────────────────────────────────────────────
  // New multi-line: Bowler\t\nO\t\n...\n\nName\n\t0.5\t0\t4\t0\t\n4.80
  // Old single-line: Bowler  O  M  R  W  Econ\nName  0.5  0  4  0  4.80
  const bowlerNewMatch = text.match(/Bowler\n\t\nO\n\t\nM\n\t\nR\n\t\nW\n\t\nEcon\n+([^\n]+)\n\t([\d.]+)\t(\d+)\t(\d+)\t(\d+)\t\n([\d.]+)/);
  const bowlerOldMatch = text.match(/Bowler\s+O\s+M\s+R\s+W\s+Econ\n([^\n]+?)\s+([\d.]+(?:\.\d)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)?/);

  const bowlerMatch = bowlerNewMatch || bowlerOldMatch;
  if (bowlerMatch) {
    data.bowler    = bowlerMatch[1].trim();
    data.bowlerO   = bowlerMatch[2];
    data.bowlerR   = bowlerMatch[4];
    data.bowlerW   = bowlerMatch[5];
    data.bowlerEco = bowlerMatch[6] || null;
  }

  // ── CRR ───────────────────────────────────────────────────────────────────
  // New format: "PROJECTED SCORE:144 RUNS (CRR:7.2)"
  // Old format: from over summaries
  const projCrrMatch = text.match(/\(CRR:([\d.]+)\)/i);
  if (projCrrMatch) {
    data.crr = projCrrMatch[1];
  }

  const isInChaseMode = text.match(/(\d+) runs needed in[\s\S]{0,30}?\((\d+) balls\)/i);

  if (!data.crr && !isInChaseMode) {
    const overSummaryReg = /Over \d+[^\n]*\n\n([^\n]+)\n(\d+) \((\d+)\)\n\n([^\n]+)\n(\d+) \((\d+)\)\n\n([^\n]+)\n(\d+\.\d+-\d+-\d+-\d+)\n\nRun Rate\s*:\n([\d.]+)/;
    const firstSummary = text.match(overSummaryReg);
    if (firstSummary) data.crr = firstSummary[9];
  }

  // ── RRR ───────────────────────────────────────────────────────────────────
  const rrrMatch = text.match(/RRR[:\s]+([\d.]+)/i);
  if (rrrMatch) data.rrr = rrrMatch[1];

  // ── Chase info ────────────────────────────────────────────────────────────
  const chaseMatch = text.match(/(\d+) runs needed in[\s\S]{0,30}?\((\d+) balls\)[^\n]{0,80}?(\d+) wickets remaining/i);
  if (chaseMatch) {
    data.runsNeeded = chaseMatch[1];
    data.ballsLeft  = chaseMatch[2];
    data.wktsInHand = chaseMatch[3];
    if (!data.score2 && data.score1 && data.runsNeeded) {
      const inferredScore2 = parseInt(data.score1) - parseInt(data.runsNeeded);
      data.score2 = String(Math.max(0, inferredScore2));
      data.wkts2  = '—';
    }
  }

  // ── Calculate CRR for chase (if not extracted) ────────────────────────────
  const hasChaseInfo = data.runsNeeded && data.ballsLeft && data.wktsInHand;
  if ((hasChaseInfo || (data.score2 && data.rrr)) && (!data.crr || data.crr === null)) {
    if (data.overs2) {
      const oversMatch = String(data.overs2).match(/(\d+)\.(\d+)/);
      if (oversMatch) {
        const totalOversDecimal = parseInt(oversMatch[1], 10) + (parseInt(oversMatch[2], 10) / 6);
        if (totalOversDecimal > 0 && data.score2) {
          data.crr = (parseInt(data.score2, 10) / totalOversDecimal).toFixed(2);
        }
      } else {
        const oversNum = parseInt(String(data.overs2), 10);
        if (oversNum > 0 && data.score2) {
          data.crr = (parseInt(data.score2, 10) / oversNum).toFixed(2);
        }
      }
    }
  }

  // ── Match status ──────────────────────────────────────────────────────────
  const wonMatch = text.match(/([A-Z][A-Za-z ]+ won by[^\n]{0,80})/);
  if (wonMatch) {
    data.status = wonMatch[1].trim();
  } else {
    const needsMatch = text.match(/(\d+) runs needed in ([\d.]+) overs/i);
    if (needsMatch) data.status = `${needsMatch[1]} runs needed in ${needsMatch[2]} overs`;
  }

  // ── This over ─────────────────────────────────────────────────────────────
  // New format: "OV {n}\n{ball1}\n{ball2}...\nShare"
  const ovSectionMatch = text.match(/\bOV \d+\n([\s\S]+?)(?=\nOV |\nShare\b|\nInfo\b)/);
  if (ovSectionMatch) {
    const balls = ovSectionMatch[1].split('\n')
      .map(l => l.trim())
      .filter(l => l && /^(\d+[a-zA-Z]*|W)$/.test(l));
    if (balls.length > 0) {
      data.thisOver = balls.map(b => {
        const u = b.toUpperCase();
        if (u.includes('WD')) return 'WD';
        if (u.includes('NB')) return 'NB';
        return b;
      }).slice(0, 8);
    }
  }

  // Old format ball-by-ball: "value over.ball" on same line
  if (data.thisOver.length === 0) {
    const allBallLines = [];
    const rawLines = text.split('\n');
    for (let i = 0; i < rawLines.length; i++) {
      const m = rawLines[i].trim().match(/^(\S+)\s+(\d+)\.(\d+)\s*$|^(\d+)\.(\d+)\s*$/);
      if (m) {
        const hasPrefix = m[4] === undefined;
        if (!hasPrefix) {
          // Bare number line (no value prefix) — could be run rate. Require a delivery
          // description ("to ") in the next 3 lines to confirm it's a real ball.
          const nextLines = rawLines.slice(i + 1, i + 4).join(' ');
          if (!nextLines.includes(' to ')) continue;
        }
        if (hasPrefix) {
          allBallLines.push({ value: m[1], over: parseInt(m[2]), ball: parseInt(m[3]) });
        } else {
          allBallLines.push({ value: '0', over: parseInt(m[4]), ball: parseInt(m[5]) });
        }
      }
    }

    const validBallLines = allBallLines.filter(b => b.ball >= 1 && b.ball <= 8);
    if (validBallLines.length > 0) {
      const maxOver = Math.max(...validBallLines.map((b) => b.over));
      const currentOverBalls = validBallLines
        .filter((b) => b.over === maxOver)
        .sort((a, b) => a.ball - b.ball)
        .map((b) => {
          const raw = String(b.value).toUpperCase();
          if (raw === '0' || raw === '') return '0';
          if (raw.includes('WD') || raw === '1WD') return 'WD';
          if (raw.includes('NB')) return 'NB';
          return raw;
        });

      if (currentOverBalls.length > 0) data.thisOver = currentOverBalls.slice(0, 8);

      if (data.runsNeeded && !data.overs2) {
        const ballsInCurrentOver = validBallLines.filter((b) => b.over === maxOver).length;
        if (ballsInCurrentOver > 0 && maxOver > 0) {
          data.overs2 = `${maxOver}.${ballsInCurrentOver}`;
        } else if (maxOver > 1) {
          data.overs2 = String(maxOver - 1);
        } else if (maxOver === 1 && ballsInCurrentOver === 0) {
          data.overs2 = '0.0';
        }
      }
    }
  }

  const overMatch = text.match(/(?:This Over|Current Over)[:\s]+([0-9W46wdnb ,.]+)/i);
  if (overMatch && data.thisOver.length === 0) {
    data.thisOver = overMatch[1].trim().split(/[\s,]+/).filter(Boolean).slice(0, 6);
  }

  return data;
}

// ── Full scorecard (batting + bowling card for one innings) ────────────────
// Expects the innerText of the "Full Scorecard" tab, e.g.:
//   Global Titans innings (20 overs maximum)\tR\tB\t4s\t6s\tSR
//    Sanjay Bhaskaran\tc Chintan P b Pradhuman B\t20\t10\t3\t1\t200.00
//    ...
//   Extras\t(b 1 lb 0 w 9 nb 1 )\t11\t\t\t\t
//   Total\t(4 wickets, 20.0 overs )\t173\t\t\t\t
//   Did not bat: ...
//   Bowling\tO\tM\tDot\tR\tW\tEcon\t
//   \tPradhuman Bagadi\t4.0\t0\t13\t30\t1\t7.50\t(1 w1 nb)
//   ...
const INNINGS_HEADER_RE = /([^\n\t]+) innings \([^\n)]*\)\tR\tB\t4s\t6s\tSR\n/;
const BATTING_ROW_RE = /^ (.+?)\t(.+?)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)$/gm;
const BOWLING_HEADER_RE = /Bowling\tO\tM\tDot\tR\tW\tEcon\t?\n/;
const BOWLING_ROW_RE = /^\t(.+?)\t([\d.]+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t([\d.]+)\t?.*$/gm;

function extractSequentialRows(text, fromIndex, rowRe, mapRow) {
  const rows = [];
  rowRe.lastIndex = fromIndex;
  let expectedPos = fromIndex;
  let m;
  while ((m = rowRe.exec(text)) !== null) {
    if (m.index !== expectedPos) break;
    rows.push(mapRow(m));
    expectedPos = rowRe.lastIndex + 1;
  }
  return rows;
}

// Parses one innings from the "Full Scorecard" tab view. Returns null if the
// expected innings header isn't present in the given text.
function parseInningsScorecard(text) {
  const header = text.match(INNINGS_HEADER_RE);
  if (!header) return null;

  const battingTeam = header[1].trim();
  const battingStart = header.index + header[0].length;
  const batting = extractSequentialRows(text, battingStart, BATTING_ROW_RE, (m) => ({
    name: m[1].trim(),
    dismissal: m[2].trim(),
    runs: m[3],
    balls: m[4],
    fours: m[5],
    sixes: m[6],
    sr: m[7]
  }));

  let bowling = [];
  const bowlingHeader = text.slice(battingStart).match(BOWLING_HEADER_RE);
  if (bowlingHeader) {
    const bowlingStart = battingStart + bowlingHeader.index + bowlingHeader[0].length;
    bowling = extractSequentialRows(text, bowlingStart, BOWLING_ROW_RE, (m) => ({
      name: m[1].trim(),
      overs: m[2],
      maidens: m[3],
      dots: m[4],
      runs: m[5],
      wkts: m[6],
      econ: m[7]
    }));
  }

  return { battingTeam, batting, bowling };
}

module.exports = {
  parseScore,
  parseInningsScorecard
};
