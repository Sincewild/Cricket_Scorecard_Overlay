function createInitialScoreState() {
  return {
    team1: 'Team 1',
    team2: 'Team 2',
    team1Logo: null,
    team2Logo: null,
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
    status: 'Loading...',
    crr: null,
    rrr: null,
    runsNeeded: null,
    ballsLeft: null,
    wktsInHand: null,
    thisOver: [],
    scorecard: {},
    lastUpdated: null,
    error: null,
    matchUrl: null
  };
}

module.exports = {
  createInitialScoreState
};
